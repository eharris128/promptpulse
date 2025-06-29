import express from 'express';
import { logDatabaseQuery, logError, log } from '../lib/logger.js';

const router = express.Router();

// Health check endpoint
router.get('/health', async (req, res) => {
  const queryContext = logDatabaseQuery('health_check', null);
  
  try {
    await req.dbManager.executeQuery(async (db) => {
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
router.get('/api/health/db', async (req, res) => {
  try {
    const healthStatus = await req.dbManager.healthCheck();
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
router.get('/api/metrics', async (req, res) => {
  try {
    const metrics = req.dbManager.getMetrics();
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

export default router;