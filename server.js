import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { authenticateApiKey, createUser, listUsers } from './lib/server-auth.js';
import { initializeDbManager, getDbManager } from './lib/db-manager.js';
import { logger, requestLogger, logDatabaseQuery, logError, log } from './lib/logger.js';

const app = express();
const PORT = process.env.PORT || 3000;

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
  
  try {
    const machines = await db.sql`
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
    
    res.json(machines);
  } catch (error) {
    console.error('Error fetching machines:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Session data endpoints
app.get('/api/usage/sessions', authenticateApiKey, async (req, res) => {
  const { machineId, projectPath, since, until, limit = 50 } = req.query;
  const userId = req.user.id;
  
  try {
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
    
    const sessions = await db.sql`
      SELECT * FROM usage_sessions 
      ${whereClause}
      ORDER BY start_time DESC 
      LIMIT ${parseInt(limit)}
    `;
    
    // Parse JSON fields
    sessions.forEach(session => {
      if (session.models_used) session.models_used = JSON.parse(session.models_used);
      if (session.model_breakdowns) session.model_breakdowns = JSON.parse(session.model_breakdowns);
    });
    
    res.json(sessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Block data endpoints
app.get('/api/usage/blocks', authenticateApiKey, async (req, res) => {
  const { machineId, since, until, activeOnly } = req.query;
  const userId = req.user.id;
  
  try {
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
    
    const blocks = await db.sql`
      SELECT * FROM usage_blocks 
      ${whereClause}
      ORDER BY start_time DESC
    `;
    
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
  
  if (!records || !Array.isArray(records)) {
    return res.status(400).json({ error: 'Records array is required' });
  }
  
  try {
    let processedCount = 0;
    
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
    
    res.json({ 
      message: 'Daily data uploaded successfully',
      processed: processedCount,
      total: records.length
    });
  } catch (error) {
    console.error('Error uploading daily data:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/usage/sessions/batch', authenticateApiKey, async (req, res) => {
  const { records } = req.body;
  const userId = req.user.id;
  
  if (!records || !Array.isArray(records)) {
    return res.status(400).json({ error: 'Records array is required' });
  }
  
  try {
    let processedCount = 0;
    
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
    
    res.json({ 
      message: 'Session data uploaded successfully',
      processed: processedCount,
      total: records.length
    });
  } catch (error) {
    console.error('Error uploading session data:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/usage/blocks/batch', authenticateApiKey, async (req, res) => {
  const { records } = req.body;
  const userId = req.user.id;
  
  if (!records || !Array.isArray(records)) {
    return res.status(400).json({ error: 'Records array is required' });
  }
  
  try {
    let processedCount = 0;
    
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
    
    res.json({ 
      message: 'Block data uploaded successfully',
      processed: processedCount,
      total: records.length
    });
  } catch (error) {
    console.error('Error uploading block data:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Analytics endpoint - usage patterns
app.get('/api/usage/analytics/patterns', authenticateApiKey, async (req, res) => {
  const { machineId, period = 'day' } = req.query;
  const userId = req.user.id;
  
  try {
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
    
    const patterns = await db.sql`${query}`;
    
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
  
  try {
    let dateFilter = '';
    if (period === 'daily') {
      dateFilter = "date = date('now')";
    } else if (period === 'weekly') {
      dateFilter = "date >= date('now', '-7 days')";
    } else {
      return res.status(400).json({ error: 'Invalid period. Use daily or weekly.' });
    }
    
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
    
    const entries = await db.sql(leaderboardQuery);
    const totalParticipants = entries.length;
    
    // Add percentiles
    const entriesWithPercentiles = entries.map((entry, index) => ({
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
    
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/user/leaderboard-settings', authenticateApiKey, async (req, res) => {
  const userId = req.user.id;
  
  try {
    const user = await db.sql`
      SELECT leaderboard_enabled, display_name 
      FROM users 
      WHERE id = ${userId}
    `;
    
    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      leaderboard_enabled: Boolean(user[0].leaderboard_enabled),
      display_name: user[0].display_name
    });
    
  } catch (error) {
    console.error('Error fetching leaderboard settings:', error);
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
  
  const sanitizedDisplayName = sanitizeDisplayName(display_name);
  
  try {
    await db.sql`
      UPDATE users 
      SET 
        leaderboard_enabled = ${leaderboard_enabled ? 1 : 0},
        display_name = ${sanitizedDisplayName},
        leaderboard_updated_at = CURRENT_TIMESTAMP
      WHERE id = ${userId}
    `;
    
    res.json({ 
      message: 'Leaderboard settings updated successfully',
      leaderboard_enabled: Boolean(leaderboard_enabled),
      display_name: sanitizedDisplayName
    });
    
  } catch (error) {
    console.error('Error updating leaderboard settings:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/usage/analytics/costs', authenticateApiKey, async (req, res) => {
  const { machineId, groupBy = 'day' } = req.query;
  const userId = req.user.id;
  
  try {
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
    
    const costs = await db.sql`${query}`;
    
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
    
    app.listen(PORT, () => {
      logger.info(`PromptPulse server started`, {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        logLevel: logger.level
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