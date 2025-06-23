import 'dotenv/config';
import express from 'express';
import { Database } from '@sqlitecloud/drivers';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { runMigrations } from './migrate.js';
import { authenticateApiKey, createUser, listUsers } from './lib/server-auth.js';

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration for production
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // In production, only allow specific domains
    const allowedOrigins = [
      'https://your-dashboard.vercel.app',
      'https://exciting-patience-production.up.railway.app', // Allow API self-requests
      'http://localhost:3001', // For development
      'http://localhost:3000'  // For development
    ];
    
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
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

let db;

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    if (!db) {
      db = new Database(DATABASE_URL);
    }
    
    // Simple query to verify database connectivity
    await db.sql`SELECT 1 as health_check`;
    
    res.json({ 
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      database: 'connected'
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({ 
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed'
    });
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
  const { email, username, fullName } = req.body;
  
  if (!email || !username) {
    return res.status(400).json({ error: 'Email and username are required' });
  }

  try {
    const user = await createUser({ email, username, fullName });
    res.json({ 
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.full_name,
        apiKey: user.api_key
      }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(400).json({ error: error.message });
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
  
  console.log('=== Aggregate API called ===');
  console.log('User ID:', userId);
  console.log('Query params:', { since, until, machineId });
  
  try {
    
    // Execute queries with template literal syntax (SQLite Cloud compatible)
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
    
    const daily = await db.sql(dailyQuery);
    
    // Debug: Check what data exists in the table
    const debugCount = await db.sql('SELECT COUNT(*) as count FROM usage_data WHERE user_id = ?', [userId]);
    console.log('Total records for user:', debugCount[0]?.count);
    
    const debugCountAll = await db.sql('SELECT COUNT(*) as count FROM usage_data');
    console.log('Total records in table:', debugCountAll[0]?.count);
    
    const debugUsers = await db.sql('SELECT DISTINCT user_id FROM usage_data');
    console.log('User IDs in usage_data:', debugUsers);
    
    const debugSample = await db.sql('SELECT * FROM usage_data WHERE user_id = ? LIMIT 3', [userId]);
    console.log('Sample records:', debugSample);
    
    // Try without parameter binding
    const debugDirect = await db.sql`SELECT COUNT(*) as count FROM usage_data WHERE user_id = ${userId}`;
    console.log('Direct query count:', debugDirect[0]?.count);
    
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
    
    const totals = await db.sql(totalQuery);
    
    console.log('Aggregate API - Daily results:', daily);
    console.log('Aggregate API - Totals results:', totals[0]);
    
    res.json({
      daily: daily,
      totals: totals[0] || {}
    });
    
  } catch (error) {
    console.error('Error fetching aggregate data:', error);
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

// Sample data generation endpoint for testing
app.post('/api/usage/sample', authenticateApiKey, async (req, res) => {
  const userId = req.user.id;
  const machineId = req.body.machineId || `${req.user.username}-machine`;
  
  console.log('=== Sample data generation ===');
  console.log('User ID:', userId);
  console.log('Machine ID:', machineId);
  
  try {
    const sampleData = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      const baseTokens = isWeekend ? 5000 + Math.random() * 2000 : 8000 + Math.random() * 5000;
      const inputTokens = Math.floor(baseTokens * 0.7);
      const outputTokens = Math.floor(baseTokens * 0.3);
      const totalTokens = inputTokens + outputTokens;
      
      const costPerToken = 0.000003; // Rough Claude pricing
      const totalCost = totalTokens * costPerToken;
      
      sampleData.push({
        machine_id: machineId,
        user_id: userId,
        date: date.toISOString().split('T')[0],
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cache_creation_tokens: Math.floor(Math.random() * 1000),
        cache_read_tokens: Math.floor(Math.random() * 500),
        total_tokens: totalTokens,
        total_cost: totalCost,
        models_used: JSON.stringify(['claude-3-5-sonnet-20241022']),
        model_breakdowns: JSON.stringify({
          'claude-3-5-sonnet-20241022': {
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            cost: totalCost
          }
        })
      });
    }
    
    console.log('Generated sample data entries:', sampleData.length);
    console.log('Sample entry:', sampleData[0]);
    
    for (const dayData of sampleData) {
      console.log('Inserting:', dayData.date, dayData.total_cost);
      await db.sql`
        INSERT OR REPLACE INTO usage_data (
          machine_id, user_id, date, input_tokens, output_tokens, 
          cache_creation_tokens, cache_read_tokens, total_tokens,
          total_cost, models_used, model_breakdowns
        ) VALUES (
          ${dayData.machine_id},
          ${dayData.user_id},
          ${dayData.date},
          ${dayData.input_tokens},
          ${dayData.output_tokens},
          ${dayData.cache_creation_tokens},
          ${dayData.cache_read_tokens},
          ${dayData.total_tokens},
          ${dayData.total_cost},
          ${dayData.models_used},
          ${dayData.model_breakdowns}
        )
      `;
    }
    
    console.log('All sample data inserted successfully');
    
    res.json({ 
      message: 'Sample data generated successfully',
      recordsCreated: sampleData.length,
      machineId: machineId
    });
    
  } catch (error) {
    console.error('Error generating sample data:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Admin endpoint to enable leaderboard for any user
app.post('/api/admin/enable-leaderboard', authenticateApiKey, async (req, res) => {
  const { userId, displayName } = req.body;
  
  try {
    await db.sql`
      UPDATE users 
      SET 
        leaderboard_enabled = 1,
        display_name = ${displayName || null},
        leaderboard_updated_at = CURRENT_TIMESTAMP
      WHERE id = ${userId}
    `;
    
    res.json({ 
      message: `Leaderboard enabled for user ${userId}`,
      userId,
      displayName: displayName || null
    });
    
  } catch (error) {
    console.error('Error enabling leaderboard:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Admin endpoint to fix missing columns
app.post('/api/admin/fix-schema', authenticateApiKey, async (req, res) => {
  try {
    console.log('Adding missing leaderboard columns...');
    
    // Add leaderboard_enabled column
    await db.sql`ALTER TABLE users ADD COLUMN leaderboard_enabled BOOLEAN DEFAULT 0`;
    console.log('Added leaderboard_enabled column');
    
    // Add leaderboard_updated_at column
    await db.sql`ALTER TABLE users ADD COLUMN leaderboard_updated_at DATETIME`;
    console.log('Added leaderboard_updated_at column');
    
    // Update existing users with default timestamp
    await db.sql`UPDATE users SET leaderboard_updated_at = CURRENT_TIMESTAMP WHERE leaderboard_updated_at IS NULL`;
    console.log('Updated existing users with timestamps');
    
    res.json({ message: 'Schema fixed successfully' });
  } catch (error) {
    console.error('Error fixing schema:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin endpoint to check database schema
app.get('/api/admin/schema', authenticateApiKey, async (req, res) => {
  try {
    const usersSchema = await db.sql`PRAGMA table_info(users)`;
    const usageDataSchema = await db.sql`PRAGMA table_info(usage_data)`;
    
    res.json({ 
      users: usersSchema,
      usage_data: usageDataSchema
    });
  } catch (error) {
    console.error('Error getting schema:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Admin endpoint to check user data distribution
app.get('/api/admin/user-stats', authenticateApiKey, async (req, res) => {
  try {
    const userStats = await db.sql`
      SELECT 
        user_id,
        COUNT(*) as record_count,
        COUNT(DISTINCT machine_id) as machine_count,
        MIN(date) as earliest_date,
        MAX(date) as latest_date
      FROM usage_data 
      GROUP BY user_id 
      ORDER BY user_id
    `;
    
    const machineStats = await db.sql`
      SELECT 
        user_id,
        machine_id,
        COUNT(*) as record_count
      FROM usage_data 
      GROUP BY user_id, machine_id 
      ORDER BY user_id, machine_id
    `;
    
    res.json({ userStats, machineStats });
  } catch (error) {
    console.error('Error getting user stats:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Admin endpoint to update machine ownership
app.post('/api/admin/update-machines', authenticateApiKey, async (req, res) => {
  const { machines, targetUserId } = req.body;
  
  console.log('=== Admin update machines ===');
  console.log('Machines to update:', machines);
  console.log('Target user ID:', targetUserId);
  
  try {
    for (const machineId of machines) {
      const result = await db.sql`
        UPDATE usage_data 
        SET user_id = ${targetUserId} 
        WHERE machine_id = ${machineId}
      `;
      console.log(`Updated ${machineId} to user ${targetUserId}`);
    }
    
    res.json({ 
      message: 'Machines updated successfully',
      machinesUpdated: machines.length
    });
    
  } catch (error) {
    console.error('Error updating machines:', error);
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

// User leaderboard settings endpoints
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

// Input sanitization function
function sanitizeDisplayName(input) {
  if (!input || typeof input !== 'string') return null;
  
  // Trim whitespace and limit length
  let sanitized = input.trim().slice(0, 50);
  
  // Remove HTML tags and dangerous characters
  sanitized = sanitized.replace(/<[^>]*>/g, '');
  sanitized = sanitized.replace(/[<>'"&]/g, '');
  
  return sanitized || null;
}

app.put('/api/user/leaderboard-settings', authenticateApiKey, async (req, res) => {
  const userId = req.user.id;
  const { leaderboard_enabled, display_name } = req.body;
  
  // Sanitize display name
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

// Analytics endpoint - cost breakdown
app.get('/api/usage/analytics/costs', authenticateApiKey, async (req, res) => {
  const { machineId, groupBy = 'day' } = req.query;
  const userId = req.user.id;
  
  try {
    let query;
    const params = [];
    
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
    db = new Database(DATABASE_URL);
    await runMigrations();
    
    app.listen(PORT, () => {
      console.log(`Claude Code Usage Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
}

initializeServer();

process.on('SIGINT', async () => {
  if (db) {
    await db.close();
    console.log('Database connection closed.');
  }
  process.exit(0);
});