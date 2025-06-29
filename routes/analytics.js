import express from 'express';
import { authenticateApiKey } from '../lib/server-auth.js';
import { logError } from '../lib/logger.js';

const router = express.Router();

// Get usage patterns analytics
router.get('/api/usage/analytics/patterns', authenticateApiKey, async (req, res) => {
  const { machineId, period = 'day' } = req.query;
  const userId = req.user.id;
  
  try {
    const patterns = await req.dbManager.executeQuery(async (db) => {
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
      
      // Build query safely with parameterized queries
      let whereConditions = ['user_id = ?'];
      let params = [userId];
      
      if (machineId) {
        whereConditions.push('machine_id = ?');
        params.push(machineId);
      }
      
      const query = `
        SELECT 
          ${groupBy} as period,
          COUNT(*) as session_count,
          SUM(total_tokens) as total_tokens,
          SUM(total_cost) as total_cost,
          AVG(duration_minutes) as avg_duration_minutes
        FROM usage_sessions
        WHERE ${whereConditions.join(' AND ')}
        GROUP BY ${groupBy} 
        ORDER BY period
      `;
      
      return await db.prepare(query).bind(...params).all();
    }, { operation: 'fetch_usage_patterns', user_id: userId });
    
    res.json({ period, patterns });
  } catch (error) {
    logError(error, { context: 'fetch_usage_patterns', userId });
    res.status(500).json({ error: 'Database error' });
  }
});

// Get cost analytics
router.get('/api/usage/analytics/costs', authenticateApiKey, async (req, res) => {
  const { machineId, groupBy = 'day' } = req.query;
  const userId = req.user.id;
  
  try {
    const costs = await req.dbManager.executeQuery(async (db) => {
      let query;
      let params = [userId];
      
      // Build WHERE conditions safely
      let whereConditions = ['user_id = ?'];
      if (machineId) {
        whereConditions.push('machine_id = ?');
        params.push(machineId);
      }
      
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
            WHERE ${whereConditions.join(' AND ')}
            ORDER BY total_cost DESC 
            LIMIT 100
          `;
          break;
          
        case 'project':
          const projectWhereConditions = [...whereConditions, 'project_path IS NOT NULL'];
          query = `
            SELECT 
              project_path,
              COUNT(*) as session_count,
              SUM(total_cost) as total_cost,
              SUM(total_tokens) as total_tokens,
              AVG(duration_minutes) as avg_duration
            FROM usage_sessions
            WHERE ${projectWhereConditions.join(' AND ')}
            GROUP BY project_path 
            ORDER BY total_cost DESC
          `;
          break;
          
        default: // day
          query = `
            SELECT 
              date(start_time) as date,
              COUNT(*) as session_count,
              SUM(total_cost) as total_cost,
              SUM(total_tokens) as total_tokens
            FROM usage_sessions
            WHERE ${whereConditions.join(' AND ')}
            GROUP BY date(start_time) 
            ORDER BY date DESC
          `;
      }
      
      return await db.prepare(query).bind(...params).all();
    }, { operation: 'fetch_cost_analytics', user_id: userId });
    
    res.json({ groupBy, costs });
  } catch (error) {
    logError(error, { context: 'fetch_cost_analytics', userId });
    res.status(500).json({ error: 'Database error' });
  }
});

export default router;