import { initializeDbManager } from '../lib/db-manager.js';
import { logger } from '../lib/logger.js';

export function setupDatabase() {
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    logger.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  // Initialize database manager
  const dbManager = initializeDbManager(DATABASE_URL, {
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS) || 10,
    idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
    retryAttempts: parseInt(process.env.DB_RETRY_ATTEMPTS) || 3,
    retryDelay: parseInt(process.env.DB_RETRY_DELAY) || 1000
  });

  return dbManager;
}