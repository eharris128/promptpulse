import express from 'express';
import { authenticateApiKey } from '../lib/server-auth.js';
import { logDatabaseQuery, logError, log, logger } from '../lib/logger.js';

const router = express.Router();

// Authentication validation endpoint 
router.get('/api/auth/validate', authenticateApiKey, async (req, res) => {
  try {
    // If we get here, the API key is valid (middleware already validated)
    res.json({ 
      message: 'API key is valid',
      user: {
        id: req.user.id,
        email: req.user.email,
        username: req.user.username,
        full_name: req.user.full_name,
        created_at: req.user.created_at
      }
    });
  } catch (error) {
    logError(error, { context: 'auth_validation' });
    res.status(500).json({ error: 'Validation failed' });
  }
});

// Username lookup endpoint (public - returns limited user info)
router.get('/api/users/by-username/:username', async (req, res) => {
  const { username: rawUsername } = req.params;
  const username = decodeURIComponent(rawUsername);
  const queryContext = logDatabaseQuery('lookup_user_by_username', null);
  
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }
  
  try {
    logger.debug('Looking up username', { username, rawUsername: req.params.username });
    
    const user = await req.dbManager.executeQuery(async (db) => {
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
        created_at: user[0].created_at
      }
    });
    
    log.performance('lookup_user_by_username', Date.now() - queryContext.startTime, { username });
    
  } catch (error) {
    logError(error, { context: 'lookup_user_by_username', username, queryContext });
    res.status(500).json({ error: 'Database error' });
  }
});

export default router;