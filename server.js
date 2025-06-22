import 'dotenv/config';
import express from 'express';
import { Database } from '@sqlitecloud/drivers';
import cors from 'cors';
import { runMigrations } from './migrate.js';
import { authenticateApiKey, createUser, listUsers } from './lib/auth.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

let db;

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