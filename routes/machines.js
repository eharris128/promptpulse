import express from 'express';
import { authenticateApiKey } from '../lib/server-auth.js';
import { logDatabaseQuery, logError, log } from '../lib/logger.js';

const router = express.Router();

// Get user's machines
router.get('/api/machines', authenticateApiKey, async (req, res) => {
  const userId = req.user.id;
  const queryContext = logDatabaseQuery('fetch_machines', userId);
  
  try {
    const machines = await req.dbManager.executeQuery(async (db) => {
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

export default router;