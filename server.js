import 'dotenv/config';
import express from 'express';
import { setupMiddleware } from './config/middleware.js';
import { setupDatabase } from './config/database.js';
import { addDbManagerToRequest } from './utils/route-helpers.js';
import { logger } from './lib/logger.js';
import emailService from './lib/email-service.js';

// Import route modules
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import machinesRoutes from './routes/machines.js';
import leaderboardRoutes from './routes/leaderboard.js';
import analyticsRoutes from './routes/analytics.js';
import teamsRoutes from './routes/teams.js';
import userSettingsRoutes from './routes/user-settings.js';
import usageRoutes from './routes/usage.js';

const app = express();
const PORT = process.env.PORT || 3000;
let dbManager = null; // Make dbManager accessible for graceful shutdown

async function initializeServer() {
  try {
    // Setup database
    dbManager = setupDatabase();
    
    // Setup middleware
    setupMiddleware(app);
    
    // Add dbManager to all requests
    app.use(addDbManagerToRequest(dbManager));
    
    // Register route modules
    app.use('/', healthRoutes);
    app.use('/', authRoutes); 
    app.use('/', usersRoutes);
    app.use('/', machinesRoutes);
    app.use('/', leaderboardRoutes);
    app.use('/', analyticsRoutes);
    app.use('/', teamsRoutes);
    app.use('/', userSettingsRoutes);
    app.use('/', usageRoutes);
    
    // Log initialization info
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
    try {
      await dbManager.shutdown();
      logger.info('Database manager shut down successfully');
    } catch (error) {
      logger.error('Error shutting down database manager', { error: error.message });
    }
  }
  
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  
  if (dbManager) {
    try {
      await dbManager.shutdown();
      logger.info('Database manager shut down successfully');
    } catch (error) {
      logger.error('Error shutting down database manager', { error: error.message });
    }
  }
  
  process.exit(0);
});