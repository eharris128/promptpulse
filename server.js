import 'dotenv/config';
import express from 'express';
import { Database } from '@sqlitecloud/drivers';
import cors from 'cors';
import { runMigrations } from './migrate.js';

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

app.post('/api/usage', async (req, res) => {
  const { machineId, data } = req.body;
  
  if (!machineId || !data) {
    return res.status(400).json({ error: 'Missing machineId or data' });
  }

  try {
    for (const dayData of data) {
      await db.sql`
        INSERT OR REPLACE INTO usage_data (
          machine_id, date, input_tokens, output_tokens, 
          cache_creation_tokens, cache_read_tokens, total_tokens,
          total_cost, models_used, model_breakdowns
        ) VALUES (
          ${machineId},
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

app.get('/api/usage/aggregate', async (req, res) => {
  const { since, until, machineId } = req.query;
  
  try {
    let whereConditions = [];
    
    if (since) whereConditions.push(`date >= '${since}'`);
    if (until) whereConditions.push(`date <= '${until}'`);
    if (machineId) whereConditions.push(`machine_id = '${machineId}'`);
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    const dailyQuery = `
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
      ${whereClause}
      GROUP BY machine_id, date 
      ORDER BY date DESC, machine_id
    `;
    
    const totalQuery = `
      SELECT 
        COUNT(DISTINCT machine_id) as total_machines,
        SUM(input_tokens) as total_input_tokens,
        SUM(output_tokens) as total_output_tokens,
        SUM(cache_creation_tokens) as total_cache_creation_tokens,
        SUM(cache_read_tokens) as total_cache_read_tokens,
        SUM(total_tokens) as total_tokens,
        SUM(total_cost) as total_cost
      FROM usage_data
      ${whereClause}
    `;
    
    const daily = await db.sql`${dailyQuery}`;
    const totals = await db.sql`${totalQuery}`;
    
    res.json({
      daily: daily,
      totals: totals[0] || {}
    });
    
  } catch (error) {
    console.error('Error fetching aggregate data:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/machines', async (req, res) => {
  try {
    // First check what tables exist
    console.log('Checking tables...');
    const tables = await db.sql`SELECT name FROM sqlite_master WHERE type='table'`;
    console.log('Available tables:', tables);
    
    const machines = await db.sql`
      SELECT 
        machine_id,
        COUNT(*) as days_tracked,
        MIN(date) as first_date,
        MAX(date) as last_date,
        SUM(total_cost) as total_cost
      FROM usage_data 
      GROUP BY machine_id
      ORDER BY last_date DESC
    `;
    
    res.json(machines);
  } catch (error) {
    console.error('Error fetching machines:', error);
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