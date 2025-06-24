#!/usr/bin/env node

import 'dotenv/config';
import { initializeDbManager } from './db-manager.js';
import emailScheduler from './email-scheduler.js';
import log from './logger.js';

/**
 * Script to be run by cron for processing email reports
 * This script is designed to run every hour and check for pending emails
 */
async function runEmailScheduler() {
  const startTime = Date.now();
  
  try {
    log.info('Starting email scheduler cron job');
    
    // Initialize database manager
    const DATABASE_URL = process.env.DATABASE_URL;
    if (!DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is required');
    }
    
    initializeDbManager(DATABASE_URL, {
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS) || 10,
      idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
      retryAttempts: parseInt(process.env.DB_RETRY_ATTEMPTS) || 3,
      retryDelay: parseInt(process.env.DB_RETRY_DELAY) || 1000
    });
    
    const results = await emailScheduler.processPendingEmails();
    
    const duration = Date.now() - startTime;
    log.info('Email scheduler cron job completed', {
      duration: `${duration}ms`,
      results
    });
    
    console.log('Email scheduler completed successfully');
    console.log(`Results: ${JSON.stringify(results)}`);
    
    process.exit(0);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error('Email scheduler cron job failed', { 
      error: error.message, 
      duration: `${duration}ms`
    });
    
    console.error('Email scheduler failed:', error.message);
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runEmailScheduler();
}

export { runEmailScheduler };