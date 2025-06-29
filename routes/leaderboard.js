import express from 'express';
import { authenticateApiKey } from '../lib/server-auth.js';
import { CommonValidators } from '../lib/validation-middleware.js';
import { logDatabaseQuery, logError, log } from '../lib/logger.js';

const router = express.Router();

// Get leaderboard data
router.get('/api/leaderboard/:period', authenticateApiKey, CommonValidators.leaderboardParams, async (req, res) => {
  const { period } = req.params; // 'daily' or 'weekly'
  const userId = req.user.id;
  const queryContext = logDatabaseQuery('fetch_leaderboard', userId);
  
  try {
    let daysBack;
    if (period === 'daily') {
      // Show data from the last 2 days to be more inclusive
      daysBack = 1;
    } else if (period === 'weekly') {
      daysBack = 7;
    } else {
      return res.status(400).json({ error: 'Invalid period. Use daily or weekly.' });
    }
    
    const leaderboardData = await req.dbManager.executeQuery(async (db) => {
      // Get leaderboard data for users who opted in using tagged template literal
      return await db.sql`
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
        WHERE u.leaderboard_enabled = 1 AND date >= date('now', '-' || ${daysBack} || ' days')
        GROUP BY u.id, u.username, u.display_name
        ORDER BY total_tokens DESC
        LIMIT 100
      `;
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

export default router;