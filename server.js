import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { authenticateApiKey, createUser, listUsers } from './lib/server-auth.js';
import { initializeDbManager, getDbManager } from './lib/db-manager.js';
import { logger, requestLogger, logDatabaseQuery, logError, log } from './lib/logger.js';
import emailService from './lib/email-service.js';
import reportGenerator from './lib/report-generator.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for Railway deployment (fixes X-Forwarded-For header validation)
app.set('trust proxy', 1);

// CORS configuration for production
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // In production, only allow specific domains
    const allowedOrigins = [
      'https://exciting-patience-production.up.railway.app',
      'https://www.promptpulse.dev',
      'https://promptpulse.dev',
      'http://localhost:3001',
      'http://localhost:3000'
    ];
    
    // Allow all Vercel preview and production domains
    if (origin && (
      origin.endsWith('.vercel.app') || 
      origin.endsWith('.vercel.com') ||
      origin.includes('promptpulse') // Allow custom domains with promptpulse
    )) {
      allowedOrigins.push(origin);
    }
    
    // Add custom domain from environment variable
    if (process.env.PROMPTPULSE_DASHBOARD_URL) {
      allowedOrigins.push(process.env.PROMPTPULSE_DASHBOARD_URL);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

// Add request logging middleware first
app.use(requestLogger());

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' })); // Limit payload size for cost protection

// Rate limiting for cost protection
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all requests
app.use(limiter);

// More strict rate limiting for batch uploads (cost protection)
const batchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Only 5 batch uploads per minute per IP
  message: {
    error: 'Batch upload rate limit exceeded. Please wait before uploading again.',
    retryAfter: '1 minute'
  }
});

// Apply to batch endpoints
app.use('/api/usage/*/batch', batchLimiter);

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  logger.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

let dbManager;

// Health check endpoint
app.get('/health', async (req, res) => {
  const queryContext = logDatabaseQuery('health_check', null);
  
  try {
    await dbManager.executeQuery(async (db) => {
      return await db.sql`SELECT 1 as health_check`;
    }, queryContext);
    
    res.json({ 
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.2',
      database: 'connected'
    });
    
    log.performance('health_check', Date.now() - queryContext.startTime);
  } catch (error) {
    logError(error, { context: 'health_check', queryContext });
    res.status(503).json({ 
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed'
    });
  }
});

// Database health check endpoint
app.get('/api/health/db', async (req, res) => {
  try {
    const healthStatus = await dbManager.healthCheck();
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: healthStatus
    });
  } catch (error) {
    logError(error, { context: 'db_health_check' });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Database metrics endpoint
app.get('/api/metrics', async (req, res) => {
  try {
    const metrics = dbManager.getMetrics();
    res.json({
      timestamp: new Date().toISOString(),
      database: metrics,
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        pid: process.pid
      }
    });
  } catch (error) {
    logError(error, { context: 'metrics' });
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

// Authentication validation endpoint
app.get('/api/auth/validate', authenticateApiKey, async (req, res) => {
  // If we get here, the API key is valid (middleware already validated)
  res.json({ 
    user: {
      id: req.user.id,
      email: req.user.email,
      username: req.user.username,
      full_name: req.user.full_name
    }
  });
});

// Username lookup endpoint (public - returns limited user info)
app.get('/api/users/by-username/:username', async (req, res) => {
  const { username: rawUsername } = req.params;
  const username = decodeURIComponent(rawUsername);
  const queryContext = logDatabaseQuery('lookup_user_by_username', null);
  
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }
  
  try {
    logger.debug('Looking up username', { username, rawUsername: req.params.username });
    
    const user = await dbManager.executeQuery(async (db) => {
      return await db.sql`SELECT * FROM users WHERE username = ${username} LIMIT 1`;
    }, { ...queryContext, operation: 'find_user_by_username' });
    
    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      user: {
        id: user[0].id,
        username: user[0].username,
        email: user[0].email,
        created_at: user[0].created_at,
        api_key_preview: user[0].api_key.substring(0, 8) + '...'
      }
    });
    
    log.performance('lookup_user_by_username', Date.now() - queryContext.startTime, { username });
    
  } catch (error) {
    logError(error, { context: 'lookup_user_by_username', username, queryContext });
    res.status(500).json({ error: 'Database error' });
  }
});

// User management endpoints
app.post('/api/users', async (req, res) => {
  const { email, username } = req.body;
  
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    const user = await createUser({ email, username });
    res.json({ 
      message: 'User created successfully',
      user: {
        id: user.id,
        ksuid: user.ksuid,
        email: user.email,
        username: user.username,
        apiKey: user.api_key
      }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(400).json({ error: error.message });
  }
});

// API key validation endpoint
app.get('/api/auth/validate', authenticateApiKey, async (req, res) => {
  try {
    // If we reach here, authentication was successful
    res.json({
      message: 'API key is valid',
      user: {
        id: req.user.id,
        ksuid: req.user.ksuid,
        email: req.user.email,
        username: req.user.username,
        created_at: req.user.created_at
      }
    });
  } catch (error) {
    console.error('Error in auth validation:', error);
    res.status(500).json({ error: 'Validation failed' });
  }
});

app.get('/api/users', authenticateApiKey, async (req, res) => {
  try {
    const users = await listUsers();
    res.json(users);
  } catch (error) {
    console.error('Error listing users:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/usage', authenticateApiKey, async (req, res) => {
  const { machineId, data } = req.body;
  const userId = req.user.id;
  
  if (!machineId || !data) {
    return res.status(400).json({ error: 'Missing machineId or data' });
  }

  try {
    await dbManager.executeQuery(async (db) => {
      for (const dayData of data) {
        await db.sql`
          INSERT OR REPLACE INTO usage_data (
            machine_id, user_id, date, input_tokens, output_tokens, 
            cache_creation_tokens, cache_read_tokens, total_tokens,
            total_cost, models_used, model_breakdowns
          ) VALUES (
            ${machineId},
            ${userId},
            ${dayData.date},
            ${dayData.inputTokens},
            ${dayData.outputTokens},
            ${dayData.cacheCreationTokens},
            ${dayData.cacheReadTokens},
            ${dayData.totalTokens},
            ${dayData.totalCost},
            ${JSON.stringify(dayData.modelsUsed)},
            ${JSON.stringify(dayData.modelBreakdowns)}
          )
        `;
      }
    }, { operation: 'upload_usage_data', user_id: userId, machine_id: machineId });
    
    res.json({ 
      message: 'Usage data uploaded successfully',
      recordsProcessed: data.length
    });
    
  } catch (error) {
    console.error('Error inserting data:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/usage/aggregate', authenticateApiKey, async (req, res) => {
  const { since, until, machineId } = req.query;
  const userId = req.user.id;
  const queryContext = logDatabaseQuery('usage_aggregate', userId);
  
  log.apiCall('/api/usage/aggregate', 'GET', userId);
  logger.debug('Aggregate API called', {
    userId,
    queryParams: { since, until, machineId },
    requestId: req.requestId
  });
  
  try {
    
    const results = await dbManager.executeQuery(async (db) => {
      // Build daily query
      let dailyQuery = `
        SELECT 
          machine_id,
          date,
          SUM(input_tokens) as input_tokens,
          SUM(output_tokens) as output_tokens,
          SUM(cache_creation_tokens) as cache_creation_tokens,
          SUM(cache_read_tokens) as cache_read_tokens,
          SUM(total_tokens) as total_tokens,
          SUM(total_cost) as total_cost
        FROM usage_data
        WHERE user_id = ${userId}
      `;
      
      if (since) dailyQuery += ` AND date >= '${since}'`;
      if (until) dailyQuery += ` AND date <= '${until}'`;
      if (machineId) dailyQuery += ` AND machine_id = '${machineId}'`;
      
      dailyQuery += ' GROUP BY machine_id, date ORDER BY date DESC, machine_id';
      
      // Build total query
      let totalQuery = `
        SELECT 
          COUNT(DISTINCT machine_id) as total_machines,
          SUM(input_tokens) as total_input_tokens,
          SUM(output_tokens) as total_output_tokens,
          SUM(cache_creation_tokens) as total_cache_creation_tokens,
          SUM(cache_read_tokens) as total_cache_read_tokens,
          SUM(total_tokens) as total_tokens,
          SUM(total_cost) as total_cost
        FROM usage_data
        WHERE user_id = ${userId}
      `;
      
      if (since) totalQuery += ` AND date >= '${since}'`;
      if (until) totalQuery += ` AND date <= '${until}'`;
      if (machineId) totalQuery += ` AND machine_id = '${machineId}'`;
      
      // Execute both queries
      const [daily, totals] = await Promise.all([
        db.sql(dailyQuery),
        db.sql(totalQuery)
      ]);
      
      // Debug logging
      const debugCount = await db.sql`SELECT COUNT(*) as count FROM usage_data WHERE user_id = ${userId}`;
      logger.debug('Usage data debug info', {
        userId,
        userRecordCount: debugCount[0]?.count,
        dailyResultsCount: daily.length,
        requestId: req.requestId
      });
      
      return { daily, totals: totals[0] };
    }, { ...queryContext, operation: 'aggregate_usage_data' });
    
    logger.debug('Aggregate API results', {
      userId,
      dailyResultsCount: results.daily.length,
      totals: results.totals,
      requestId: req.requestId
    });
    
    res.json({
      daily: results.daily,
      totals: results.totals || {}
    });
    
    log.performance('aggregate_usage_data', Date.now() - queryContext.startTime, { userId });
    
  } catch (error) {
    logError(error, { context: 'aggregate_usage_data', userId, queryContext });
    log.apiError('/api/usage/aggregate', error, 500);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/machines', authenticateApiKey, async (req, res) => {
  const userId = req.user.id;
  const queryContext = logDatabaseQuery('fetch_machines', userId);
  
  try {
    const machines = await dbManager.executeQuery(async (db) => {
      return await db.sql`
        SELECT 
          machine_id,
          COUNT(*) as days_tracked,
          MIN(date) as first_date,
          MAX(date) as last_date,
          SUM(total_cost) as total_cost
        FROM usage_data 
        WHERE user_id = ${userId}
        GROUP BY machine_id
        ORDER BY last_date DESC
      `;
    }, { ...queryContext, operation: 'fetch_user_machines' });
    
    res.json(machines);
    log.performance('fetch_machines', Date.now() - queryContext.startTime, { userId, machineCount: machines.length });
  } catch (error) {
    logError(error, { context: 'fetch_machines', userId, queryContext });
    res.status(500).json({ error: 'Database error' });
  }
});

// Session data endpoints
app.get('/api/usage/sessions', authenticateApiKey, async (req, res) => {
  const { machineId, projectPath, since, until, limit = 50 } = req.query;
  const userId = req.user.id;
  const queryContext = logDatabaseQuery('fetch_sessions', userId);
  
  try {
    const sessions = await dbManager.executeQuery(async (db) => {
      // Build query dynamically with SQLite Cloud syntax
      let conditions = [`user_id = ${userId}`];
      
      if (machineId) {
        conditions.push(`machine_id = '${machineId}'`);
      }
      
      if (projectPath) {
        conditions.push(`project_path LIKE '%${projectPath}%'`);
      }
      
      if (since) {
        conditions.push(`start_time >= '${since}'`);
      }
      
      if (until) {
        conditions.push(`start_time <= '${until}'`);
      }
      
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      
      return await db.sql`
        SELECT * FROM usage_sessions 
        ${whereClause}
        ORDER BY start_time DESC 
        LIMIT ${parseInt(limit)}
      `;
    }, { ...queryContext, operation: 'fetch_user_sessions' });
    
    // Parse JSON fields
    sessions.forEach(session => {
      if (session.models_used) session.models_used = JSON.parse(session.models_used);
      if (session.model_breakdowns) session.model_breakdowns = JSON.parse(session.model_breakdowns);
    });
    
    res.json(sessions);
    log.performance('fetch_sessions', Date.now() - queryContext.startTime, { userId, sessionCount: sessions.length });
  } catch (error) {
    logError(error, { context: 'fetch_sessions', userId, queryContext });
    res.status(500).json({ error: 'Database error' });
  }
});

// Block data endpoints
app.get('/api/usage/blocks', authenticateApiKey, async (req, res) => {
  const { machineId, since, until, activeOnly } = req.query;
  const userId = req.user.id;
  
  try {
    const blocks = await dbManager.executeQuery(async (db) => {
      let conditions = [`user_id = ${userId}`];
      
      if (machineId) {
        conditions.push(`machine_id = '${machineId}'`);
      }
      
      if (since) {
        conditions.push(`start_time >= '${since}'`);
      }
      
      if (until) {
        conditions.push(`start_time <= '${until}'`);
      }
      
      if (activeOnly === 'true') {
        conditions.push('is_active = 1');
      }
      
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      
      return await db.sql`
        SELECT * FROM usage_blocks 
        ${whereClause}
        ORDER BY start_time DESC
      `;
    }, { operation: 'fetch_usage_blocks', user_id: userId });
    
    // Parse JSON fields
    blocks.forEach(block => {
      if (block.models_used) block.models_used = JSON.parse(block.models_used);
    });
    
    res.json(blocks);
  } catch (error) {
    console.error('Error fetching blocks:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Batch upload endpoints for CLI
app.post('/api/usage/daily/batch', authenticateApiKey, async (req, res) => {
  const { records } = req.body;
  const userId = req.user.id;
  const queryContext = logDatabaseQuery('upload_daily_batch', userId);
  
  if (!records || !Array.isArray(records)) {
    return res.status(400).json({ error: 'Records array is required' });
  }
  
  try {
    let processedCount = 0;
    
    await dbManager.executeQuery(async (db) => {
      for (const record of records) {
        // Validate user_id matches authenticated user
        if (record.user_id !== userId) {
          continue; // Skip records not belonging to this user
        }
        
        await db.sql`
          INSERT OR REPLACE INTO usage_data (
            machine_id, user_id, date, input_tokens, output_tokens, 
            cache_creation_tokens, cache_read_tokens, total_tokens,
            total_cost, models_used, model_breakdowns
          ) VALUES (
            ${record.machine_id},
            ${record.user_id},
            ${record.date},
            ${record.input_tokens},
            ${record.output_tokens},
            ${record.cache_creation_tokens},
            ${record.cache_read_tokens},
            ${record.total_tokens},
            ${record.total_cost},
            ${JSON.stringify(record.models_used)},
            ${JSON.stringify(record.model_breakdowns)}
          )
        `;
        processedCount++;
      }
    }, { ...queryContext, operation: 'batch_upload_daily_data' });
    
    res.json({ 
      message: 'Daily data uploaded successfully',
      processed: processedCount,
      total: records.length
    });
    
    log.performance('upload_daily_batch', Date.now() - queryContext.startTime, { 
      userId, processed: processedCount, total: records.length 
    });
    
  } catch (error) {
    logError(error, { context: 'upload_daily_batch', userId, queryContext });
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/usage/sessions/batch', authenticateApiKey, async (req, res) => {
  const { records } = req.body;
  const userId = req.user.id;
  const queryContext = logDatabaseQuery('upload_sessions_batch', userId);
  
  if (!records || !Array.isArray(records)) {
    return res.status(400).json({ error: 'Records array is required' });
  }
  
  try {
    let processedCount = 0;
    
    await dbManager.executeQuery(async (db) => {
      for (const record of records) {
        // Validate user_id matches authenticated user
        if (record.user_id !== userId) {
          continue; // Skip records not belonging to this user
        }
        
        await db.sql`
          INSERT OR REPLACE INTO usage_sessions (
            machine_id, user_id, session_id, project_path, start_time, end_time,
            duration_minutes, input_tokens, output_tokens, 
            cache_creation_tokens, cache_read_tokens, total_tokens,
            total_cost, models_used, model_breakdowns
          ) VALUES (
            ${record.machine_id},
            ${record.user_id},
            ${record.session_id},
            ${record.project_path},
            ${record.start_time},
            ${record.end_time},
            ${record.duration_minutes},
            ${record.input_tokens},
            ${record.output_tokens},
            ${record.cache_creation_tokens},
            ${record.cache_read_tokens},
            ${record.total_tokens},
            ${record.total_cost},
            ${JSON.stringify(record.models_used)},
            ${JSON.stringify(record.model_breakdowns)}
          )
        `;
        processedCount++;
      }
    }, { ...queryContext, operation: 'batch_upload_session_data' });
    
    res.json({ 
      message: 'Session data uploaded successfully',
      processed: processedCount,
      total: records.length
    });
    
    log.performance('upload_sessions_batch', Date.now() - queryContext.startTime, { 
      userId, processed: processedCount, total: records.length 
    });
    
  } catch (error) {
    logError(error, { context: 'upload_sessions_batch', userId, queryContext });
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/usage/blocks/batch', authenticateApiKey, async (req, res) => {
  const { records } = req.body;
  const userId = req.user.id;
  const queryContext = logDatabaseQuery('upload_blocks_batch', userId);
  
  if (!records || !Array.isArray(records)) {
    return res.status(400).json({ error: 'Records array is required' });
  }
  
  try {
    let processedCount = 0;
    
    await dbManager.executeQuery(async (db) => {
      for (const record of records) {
        // Validate user_id matches authenticated user
        if (record.user_id !== userId) {
          continue; // Skip records not belonging to this user
        }
        
        await db.sql`
          INSERT OR REPLACE INTO usage_blocks (
            machine_id, user_id, block_id, start_time, end_time, actual_end_time,
            is_active, entry_count, input_tokens, output_tokens, 
            cache_creation_tokens, cache_read_tokens, total_tokens,
            total_cost, models_used
          ) VALUES (
            ${record.machine_id},
            ${record.user_id},
            ${record.block_id},
            ${record.start_time},
            ${record.end_time},
            ${record.actual_end_time},
            ${record.is_active},
            ${record.entry_count},
            ${record.input_tokens},
            ${record.output_tokens},
            ${record.cache_creation_tokens},
            ${record.cache_read_tokens},
            ${record.total_tokens},
            ${record.total_cost},
            ${JSON.stringify(record.models_used)}
          )
        `;
        processedCount++;
      }
    }, { ...queryContext, operation: 'batch_upload_block_data' });
    
    res.json({ 
      message: 'Block data uploaded successfully',
      processed: processedCount,
      total: records.length
    });
    
    log.performance('upload_blocks_batch', Date.now() - queryContext.startTime, { 
      userId, processed: processedCount, total: records.length 
    });
    
  } catch (error) {
    logError(error, { context: 'upload_blocks_batch', userId, queryContext });
    res.status(500).json({ error: 'Database error' });
  }
});

// Analytics endpoint - usage patterns
app.get('/api/usage/analytics/patterns', authenticateApiKey, async (req, res) => {
  const { machineId, period = 'day' } = req.query;
  const userId = req.user.id;
  
  try {
    const patterns = await dbManager.executeQuery(async (db) => {
      let groupBy, dateFormat;
      
      switch (period) {
        case 'hour':
          groupBy = "strftime('%H', start_time)";
          dateFormat = 'hour';
          break;
        case 'day':
          groupBy = "strftime('%w', start_time)";
          dateFormat = 'day_of_week';
          break;
        case 'week':
          groupBy = "strftime('%W', start_time)";
          dateFormat = 'week';
          break;
        default:
          groupBy = "date(start_time)";
          dateFormat = 'date';
      }
      
      let query = `
        SELECT 
          ${groupBy} as period,
          COUNT(*) as session_count,
          SUM(total_tokens) as total_tokens,
          SUM(total_cost) as total_cost,
          AVG(duration_minutes) as avg_duration_minutes
        FROM usage_sessions
        WHERE user_id = ${userId}
      `;
      
      if (machineId) {
        query += ` AND machine_id = '${machineId}'`;
      }
      
      query += ` GROUP BY ${groupBy} ORDER BY period`;
      
      return await db.sql`${query}`;
    }, { operation: 'fetch_usage_patterns', user_id: userId });
    
    res.json({ period, patterns });
  } catch (error) {
    console.error('Error fetching patterns:', error);
    res.status(500).json({ error: 'Database error' });
  }
});


// Leaderboard endpoints
app.get('/api/leaderboard/:period', authenticateApiKey, async (req, res) => {
  const { period } = req.params; // 'daily' or 'weekly'
  const userId = req.user.id;
  const queryContext = logDatabaseQuery('fetch_leaderboard', userId);
  
  try {
    let dateFilter = '';
    if (period === 'daily') {
      dateFilter = "date = date('now')";
    } else if (period === 'weekly') {
      dateFilter = "date >= date('now', '-7 days')";
    } else {
      return res.status(400).json({ error: 'Invalid period. Use daily or weekly.' });
    }
    
    const leaderboardData = await dbManager.executeQuery(async (db) => {
      // Get leaderboard data for users who opted in
      const leaderboardQuery = `
        SELECT 
          u.id as user_id,
          u.username,
          u.display_name,
          SUM(ud.total_tokens) as total_tokens,
          SUM(ud.total_cost) as total_cost,
          ROUND(AVG(ud.total_tokens), 0) as daily_average,
          ROW_NUMBER() OVER (ORDER BY SUM(ud.total_tokens) DESC) as rank
        FROM users u
        JOIN usage_data ud ON u.id = ud.user_id
        WHERE u.leaderboard_enabled = 1 AND ${dateFilter}
        GROUP BY u.id, u.username, u.display_name
        ORDER BY total_tokens DESC
        LIMIT 100
      `;
      
      return await db.sql(leaderboardQuery);
    }, { ...queryContext, operation: 'fetch_leaderboard_data', period });
    
    const totalParticipants = leaderboardData.length;
    
    // Add percentiles
    const entriesWithPercentiles = leaderboardData.map((entry, index) => ({
      ...entry,
      percentile: Math.round(((totalParticipants - index) / totalParticipants) * 100)
    }));
    
    // Find current user's rank
    const userRank = entriesWithPercentiles.find(entry => entry.user_id === userId)?.rank;
    
    res.json({
      period,
      entries: entriesWithPercentiles,
      user_rank: userRank,
      total_participants: totalParticipants
    });
    
    log.performance('fetch_leaderboard', Date.now() - queryContext.startTime, { 
      userId, period, participantCount: totalParticipants 
    });
    
  } catch (error) {
    logError(error, { context: 'fetch_leaderboard', userId, period, queryContext });
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/user/leaderboard-settings', authenticateApiKey, async (req, res) => {
  const userId = req.user.id;
  const queryContext = logDatabaseQuery('get_leaderboard_settings', userId);
  
  try {
    const user = await dbManager.executeQuery(async (db) => {
      return await db.sql`
        SELECT leaderboard_enabled, display_name 
        FROM users 
        WHERE id = ${userId}
      `;
    }, { ...queryContext, operation: 'get_user_leaderboard_settings' });
    
    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      leaderboard_enabled: Boolean(user[0].leaderboard_enabled),
      display_name: user[0].display_name
    });
    
    log.performance('get_leaderboard_settings', Date.now() - queryContext.startTime, { userId });
    
  } catch (error) {
    logError(error, { context: 'get_leaderboard_settings', userId, queryContext });
    res.status(500).json({ error: 'Database error' });
  }
});

function sanitizeDisplayName(input) {
  if (!input || typeof input !== 'string') return null;
  
  let sanitized = input.trim().slice(0, 50);
  
  sanitized = sanitized.replace(/<[^>]*>/g, '');
  sanitized = sanitized.replace(/[<>'"&]/g, '');
  
  return sanitized || null;
}

app.put('/api/user/leaderboard-settings', authenticateApiKey, async (req, res) => {
  const userId = req.user.id;
  const { leaderboard_enabled, display_name } = req.body;
  const queryContext = logDatabaseQuery('update_leaderboard_settings', userId);
  
  const sanitizedDisplayName = sanitizeDisplayName(display_name);
  
  try {
    await dbManager.executeQuery(async (db) => {
      return await db.sql`
        UPDATE users 
        SET 
          leaderboard_enabled = ${leaderboard_enabled ? 1 : 0},
          display_name = ${sanitizedDisplayName},
          leaderboard_updated_at = CURRENT_TIMESTAMP
        WHERE id = ${userId}
      `;
    }, { ...queryContext, operation: 'update_user_leaderboard_settings' });
    
    res.json({ 
      message: 'Leaderboard settings updated successfully',
      leaderboard_enabled: Boolean(leaderboard_enabled),
      display_name: sanitizedDisplayName
    });
    
    log.performance('update_leaderboard_settings', Date.now() - queryContext.startTime, { 
      userId, leaderboard_enabled, display_name: !!sanitizedDisplayName 
    });
    
  } catch (error) {
    logError(error, { context: 'update_leaderboard_settings', userId, queryContext });
    res.status(500).json({ error: 'Database error' });
  }
});

// Email preferences endpoints
app.get('/api/user/email-preferences', authenticateApiKey, async (req, res) => {
  const userId = req.user.id;
  const queryContext = logDatabaseQuery('get_email_preferences', userId);
  
  try {
    const preferences = await dbManager.executeQuery(async (db) => {
      // Get user email and preferences
      const userResult = await db.sql`
        SELECT email, timezone FROM users WHERE id = ${userId}
      `;
      
      const preferencesResult = await db.sql`
        SELECT * FROM user_email_preferences WHERE user_id = ${userId}
      `;
      
      return { user: userResult[0], preferences: preferencesResult[0] };
    }, { ...queryContext, operation: 'get_user_email_preferences' });
    
    if (!preferences.user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Default values if no preferences exist yet
    const defaultPrefs = {
      email_reports_enabled: false,
      report_frequency: 'weekly',
      preferred_time: '09:00',
      timezone: preferences.user.timezone || 'UTC'
    };
    
    const userPrefs = preferences.preferences ? {
      email_reports_enabled: Boolean(preferences.preferences.email_reports_enabled),
      report_frequency: preferences.preferences.report_frequency,
      preferred_time: preferences.preferences.preferred_time,
      timezone: preferences.preferences.timezone
    } : defaultPrefs;
    
    res.json({
      email: preferences.user.email,
      ...userPrefs
    });
    
    log.performance('get_email_preferences', Date.now() - queryContext.startTime, { userId });
    
  } catch (error) {
    logError(error, { context: 'get_email_preferences', userId, queryContext });
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/user/email-preferences', authenticateApiKey, async (req, res) => {
  const userId = req.user.id;
  const { email_reports_enabled, report_frequency, preferred_time, timezone } = req.body;
  const queryContext = logDatabaseQuery('update_email_preferences', userId);
  
  // Validate inputs
  const validFrequencies = ['daily', 'weekly', 'monthly'];
  if (report_frequency && !validFrequencies.includes(report_frequency)) {
    return res.status(400).json({ error: 'Invalid report frequency. Must be daily, weekly, or monthly.' });
  }
  
  if (preferred_time && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(preferred_time)) {
    return res.status(400).json({ error: 'Invalid time format. Use HH:MM format.' });
  }
  
  try {
    await dbManager.executeQuery(async (db) => {
      // Insert or update preferences
      return await db.sql`
        INSERT OR REPLACE INTO user_email_preferences (
          user_id, email_reports_enabled, report_frequency, preferred_time, timezone
        ) VALUES (
          ${userId},
          ${email_reports_enabled ? 1 : 0},
          ${report_frequency || 'weekly'},
          ${preferred_time || '09:00'},
          ${timezone || 'UTC'}
        )
      `;
    }, { ...queryContext, operation: 'update_user_email_preferences' });
    
    res.json({ 
      message: 'Email preferences updated successfully',
      email_reports_enabled: Boolean(email_reports_enabled),
      report_frequency: report_frequency || 'weekly',
      preferred_time: preferred_time || '09:00',
      timezone: timezone || 'UTC'
    });
    
    log.performance('update_email_preferences', Date.now() - queryContext.startTime, { 
      userId, email_reports_enabled: Boolean(email_reports_enabled) 
    });
    
  } catch (error) {
    logError(error, { context: 'update_email_preferences', userId, queryContext });
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/user/email', authenticateApiKey, async (req, res) => {
  const userId = req.user.id;
  const { email } = req.body;
  const queryContext = logDatabaseQuery('update_user_email', userId);
  
  // Validate email
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required' });
  }
  
  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  
  try {
    await dbManager.executeQuery(async (db) => {
      // Check if email is already in use by another user
      const existingUser = await db.sql`
        SELECT id FROM users 
        WHERE email = ${email} AND id != ${userId}
        LIMIT 1
      `;
      
      if (existingUser.length > 0) {
        throw new Error('Email already in use');
      }
      
      // Update user's email
      return await db.sql`
        UPDATE users 
        SET email = ${email}
        WHERE id = ${userId}
      `;
    }, { ...queryContext, operation: 'update_user_email' });
    
    res.json({ 
      message: 'Email updated successfully',
      email: email
    });
    
    log.performance('update_user_email', Date.now() - queryContext.startTime, { userId });
    
  } catch (error) {
    if (error.message === 'Email already in use') {
      return res.status(409).json({ error: 'Email already in use' });
    }
    logError(error, { context: 'update_user_email', userId, queryContext });
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/user/test-email', authenticateApiKey, async (req, res) => {
  const userId = req.user.id;
  const queryContext = logDatabaseQuery('send_test_email', userId);
  
  try {
    // Get user info
    const user = await dbManager.executeQuery(async (db) => {
      return await db.sql`
        SELECT email, username, display_name FROM users WHERE id = ${userId}
      `;
    }, { ...queryContext, operation: 'get_user_for_test_email' });
    
    if (!user[0] || !user[0].email) {
      return res.status(400).json({ 
        error: 'No email address found for your account. Please add an email address to your profile first.' 
      });
    }
    
    if (!emailService.isEnabled()) {
      return res.status(503).json({ 
        error: 'Email service is not configured. Please contact support.' 
      });
    }
    
    // Send test email
    const result = await emailService.sendTestEmail(user[0].email, user[0].username);
    
    // Log the email send attempt
    await dbManager.executeQuery(async (db) => {
      return await db.sql`
        INSERT INTO email_send_log (
          user_id, email_type, email_address, status, error_message, resend_email_id
        ) VALUES (
          ${userId}, 'test', ${user[0].email}, ${result.success ? 'sent' : 'failed'}, 
          ${result.error || null}, ${result.emailId || null}
        )
      `;
    }, { operation: 'log_test_email_send' });
    
    if (result.success) {
      res.json({ 
        message: 'Test email sent successfully!',
        email: user[0].email
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to send test email. Please try again later.',
        details: result.error
      });
    }
    
    log.performance('send_test_email', Date.now() - queryContext.startTime, { 
      userId, success: result.success 
    });
    
  } catch (error) {
    logError(error, { context: 'send_test_email', userId, queryContext });
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/user/plan-settings', authenticateApiKey, async (req, res) => {
  const userId = req.user.id;
  const queryContext = logDatabaseQuery('get_plan_settings', userId);
  
  try {
    const user = await dbManager.executeQuery(async (db) => {
      return await db.sql`
        SELECT claude_plan FROM users WHERE id = ${userId}
      `;
    }, { ...queryContext, operation: 'get_user_plan_settings' });
    
    if (!user[0]) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ 
      claude_plan: user[0].claude_plan || 'max_100'
    });
    
    log.performance('get_plan_settings', Date.now() - queryContext.startTime, { userId });
    
  } catch (error) {
    logError(error, { context: 'get_plan_settings', userId, queryContext });
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/user/plan-settings', authenticateApiKey, async (req, res) => {
  const userId = req.user.id;
  const { claude_plan } = req.body;
  const queryContext = logDatabaseQuery('update_plan_settings', userId);
  
  // Validate plan
  const validPlans = ['pro_17', 'max_100', 'max_200'];
  if (!claude_plan || !validPlans.includes(claude_plan)) {
    return res.status(400).json({ 
      error: 'Invalid Claude plan. Must be one of: pro_17, max_100, max_200' 
    });
  }
  
  try {
    await dbManager.executeQuery(async (db) => {
      return await db.sql`
        UPDATE users 
        SET claude_plan = ${claude_plan}
        WHERE id = ${userId}
      `;
    }, { ...queryContext, operation: 'update_user_plan_settings' });
    
    res.json({ 
      message: 'Plan settings updated successfully',
      claude_plan: claude_plan
    });
    
    log.performance('update_plan_settings', Date.now() - queryContext.startTime, { 
      userId, claude_plan 
    });
    
  } catch (error) {
    logError(error, { context: 'update_plan_settings', userId, queryContext });
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/usage/analytics/costs', authenticateApiKey, async (req, res) => {
  const { machineId, groupBy = 'day' } = req.query;
  const userId = req.user.id;
  
  try {
    const costs = await dbManager.executeQuery(async (db) => {
      let query;
      
      switch (groupBy) {
        case 'session':
          query = `
            SELECT 
              session_id,
              project_path,
              start_time,
              duration_minutes,
              total_cost,
              total_tokens
            FROM usage_sessions
            WHERE user_id = ${userId}
          `;
          if (machineId) {
            query += ` AND machine_id = '${machineId}'`;
          }
          query += ' ORDER BY total_cost DESC LIMIT 100';
          break;
          
        case 'project':
          query = `
            SELECT 
              project_path,
              COUNT(*) as session_count,
              SUM(total_cost) as total_cost,
              SUM(total_tokens) as total_tokens,
              AVG(duration_minutes) as avg_duration
            FROM usage_sessions
            WHERE user_id = ${userId} AND project_path IS NOT NULL
          `;
          if (machineId) {
            query += ` AND machine_id = '${machineId}'`;
          }
          query += ' GROUP BY project_path ORDER BY total_cost DESC';
          break;
          
        default: // day
          query = `
            SELECT 
              date(start_time) as date,
              COUNT(*) as session_count,
              SUM(total_cost) as total_cost,
              SUM(total_tokens) as total_tokens
            FROM usage_sessions
            WHERE user_id = ${userId}
          `;
          if (machineId) {
            query += ` AND machine_id = '${machineId}'`;
          }
          query += ' GROUP BY date(start_time) ORDER BY date DESC';
      }
      
      return await db.sql`${query}`;
    }, { operation: 'fetch_cost_analytics', user_id: userId });
    
    res.json({ groupBy, costs });
  } catch (error) {
    console.error('Error fetching costs:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

async function initializeServer() {
  try {
    // Initialize database manager
    dbManager = initializeDbManager(DATABASE_URL, {
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS) || 10,
      idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
      retryAttempts: parseInt(process.env.DB_RETRY_ATTEMPTS) || 3,
      retryDelay: parseInt(process.env.DB_RETRY_DELAY) || 1000
    });
    
    logger.info('Database manager initialized', {
      maxConnections: dbManager.options.maxConnections,
      idleTimeout: dbManager.options.idleTimeout,
      retryAttempts: dbManager.options.retryAttempts
    });
    
    // Log email service status
    const emailDomain = process.env.EMAIL_FROM_DOMAIN || 'mail.promptpulse.dev';
    logger.info('Email service status', {
      enabled: emailService.isEnabled(),
      resendApiKeyConfigured: !!process.env.RESEND_API_KEY,
      resendApiKeyLength: process.env.RESEND_API_KEY?.length || 0,
      emailDomain: emailDomain,
      fromAddress: `PromptPulse <noreply@${emailDomain}>`
    });
    
    app.listen(PORT, () => {
      logger.info(`PromptPulse server started`, {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        logLevel: logger.level,
        emailServiceEnabled: emailService.isEnabled()
      });
    });
  } catch (error) {
    logger.error('Failed to initialize server', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

initializeServer();

// Graceful shutdown handling
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully');
  
  if (dbManager) {
    await dbManager.shutdown();
    logger.info('Database manager shut down');
  }
  
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  
  if (dbManager) {
    await dbManager.shutdown();
    logger.info('Database manager shut down');
  }
  
  process.exit(0);
});