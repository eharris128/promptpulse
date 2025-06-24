import { Database } from '@sqlitecloud/drivers';
import { logger } from './logger.js';

class DatabaseManager {
  constructor(connectionString, options = {}) {
    this.connectionString = connectionString;
    this.options = {
      maxConnections: options.maxConnections || parseInt(process.env.DB_MAX_CONNECTIONS) || 10,
      idleTimeout: options.idleTimeout || parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
      retryAttempts: options.retryAttempts || parseInt(process.env.DB_RETRY_ATTEMPTS) || 3,
      retryDelay: options.retryDelay || parseInt(process.env.DB_RETRY_DELAY) || 1000,
      ...options
    };
    
    this.pool = [];
    this.activeConnections = 0;
    this.isShuttingDown = false;
    this.lastHealthCheck = null;
    this.connectionErrors = 0;
    this.totalQueries = 0;
    this.failedQueries = 0;
  }

  async getConnection() {
    if (this.isShuttingDown) {
      throw new Error('Database manager is shutting down');
    }

    // Try to get an existing connection from the pool
    let connection = this.pool.find(conn => !conn.inUse && conn.isHealthy);
    
    if (connection) {
      connection.inUse = true;
      connection.lastUsed = Date.now();
      logger.debug('Reusing existing database connection', { 
        poolSize: this.pool.length,
        activeConnections: this.activeConnections 
      });
      return connection.db;
    }

    // Create new connection if under limit
    if (this.activeConnections < this.options.maxConnections) {
      try {
        const db = await this.createConnection();
        connection = {
          db,
          inUse: true,
          isHealthy: true,
          createdAt: Date.now(),
          lastUsed: Date.now(),
          lastHealthCheck: Date.now()
        };
        
        this.pool.push(connection);
        this.activeConnections++;
        
        logger.info('Created new database connection', { 
          poolSize: this.pool.length,
          activeConnections: this.activeConnections 
        });
        
        return db;
      } catch (error) {
        logger.error('Failed to create database connection', { error: error.message });
        throw error;
      }
    }

    // Wait for a connection to become available
    logger.warn('Connection pool at capacity, waiting for available connection', {
      maxConnections: this.options.maxConnections,
      activeConnections: this.activeConnections
    });
    
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        const availableConn = this.pool.find(conn => !conn.inUse && conn.isHealthy);
        if (availableConn) {
          clearInterval(checkInterval);
          availableConn.inUse = true;
          availableConn.lastUsed = Date.now();
          resolve(availableConn.db);
        }
      }, 100);
      
      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('Timeout waiting for database connection'));
      }, 10000);
    });
  }

  async createConnection() {
    for (let attempt = 1; attempt <= this.options.retryAttempts; attempt++) {
      try {
        const db = new Database(this.connectionString);
        
        // Test the connection
        await db.sql`SELECT 1 as test`;
        
        this.connectionErrors = 0; // Reset error count on success
        return db;
      } catch (error) {
        logger.error(`Database connection attempt ${attempt} failed`, { 
          error: error.message,
          attempt,
          maxAttempts: this.options.retryAttempts
        });
        
        this.connectionErrors++;
        
        if (attempt === this.options.retryAttempts) {
          throw new Error(`Failed to connect after ${attempt} attempts: ${error.message}`);
        }
        
        // Exponential backoff
        const delay = this.options.retryDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  async releaseConnection(db) {
    const connection = this.pool.find(conn => conn.db === db);
    if (connection) {
      connection.inUse = false;
      connection.lastUsed = Date.now();
      logger.debug('Released database connection back to pool');
    }
  }

  async executeQuery(queryFn, context = {}) {
    const startTime = Date.now();
    let db;
    let attempt = 0;
    
    while (attempt < this.options.retryAttempts) {
      attempt++;
      
      try {
        db = await this.getConnection();
        
        logger.debug('Executing database query', { 
          context,
          attempt,
          queryId: context.queryId || 'unknown'
        });
        
        const result = await queryFn(db);
        
        const duration = Date.now() - startTime;
        logger.info('Database query completed', { 
          ...context,
          duration,
          attempt,
          success: true
        });
        
        this.totalQueries++;
        return result;
        
      } catch (error) {
        const isConnectionError = error.message.includes('Connection unavailable') || 
                                 error.errorCode === 'ERR_CONNECTION_NOT_ESTABLISHED';
        
        logger.error('Database query failed', {
          ...context,
          error: error.message,
          errorCode: error.errorCode,
          attempt,
          isConnectionError,
          duration: Date.now() - startTime
        });
        
        if (isConnectionError && db) {
          // Mark connection as unhealthy
          const connection = this.pool.find(conn => conn.db === db);
          if (connection) {
            connection.isHealthy = false;
            logger.warn('Marked connection as unhealthy', { poolSize: this.pool.length });
          }
        }
        
        if (attempt === this.options.retryAttempts || !isConnectionError) {
          this.failedQueries++;
          throw error;
        }
        
        // Wait before retry with exponential backoff
        const delay = this.options.retryDelay * Math.pow(2, attempt - 1);
        logger.info(`Retrying query after ${delay}ms`, { attempt, nextAttempt: attempt + 1 });
        await new Promise(resolve => setTimeout(resolve, delay));
        
      } finally {
        if (db) {
          await this.releaseConnection(db);
        }
      }
    }
  }

  async healthCheck() {
    const unhealthyConnections = [];
    
    for (const connection of this.pool) {
      if (!connection.inUse) {
        try {
          await connection.db.sql`SELECT 1 as health_check`;
          connection.isHealthy = true;
          connection.lastHealthCheck = Date.now();
        } catch (error) {
          connection.isHealthy = false;
          unhealthyConnections.push(connection);
          logger.warn('Connection health check failed', { 
            error: error.message,
            connectionAge: Date.now() - connection.createdAt
          });
        }
      }
    }
    
    // Remove unhealthy connections
    for (const unhealthy of unhealthyConnections) {
      await this.removeConnection(unhealthy);
    }
    
    this.lastHealthCheck = Date.now();
    
    return {
      healthy: this.pool.filter(c => c.isHealthy).length,
      unhealthy: unhealthyConnections.length,
      total: this.pool.length,
      activeConnections: this.activeConnections,
      connectionErrors: this.connectionErrors,
      totalQueries: this.totalQueries,
      failedQueries: this.failedQueries
    };
  }

  async removeConnection(connection) {
    try {
      await connection.db.close();
    } catch (error) {
      logger.error('Error closing connection', { error: error.message });
    }
    
    const index = this.pool.indexOf(connection);
    if (index > -1) {
      this.pool.splice(index, 1);
      this.activeConnections--;
      logger.info('Removed connection from pool', { 
        poolSize: this.pool.length,
        activeConnections: this.activeConnections
      });
    }
  }

  async cleanup() {
    // Clean up idle connections
    const now = Date.now();
    const idleConnections = this.pool.filter(conn => 
      !conn.inUse && 
      (now - conn.lastUsed) > this.options.idleTimeout
    );
    
    for (const idle of idleConnections) {
      logger.info('Removing idle connection', { 
        idleTime: now - idle.lastUsed,
        idleTimeout: this.options.idleTimeout
      });
      await this.removeConnection(idle);
    }
  }

  async shutdown() {
    logger.info('Shutting down database manager');
    this.isShuttingDown = true;
    
    // Close all connections
    for (const connection of this.pool) {
      try {
        await connection.db.close();
      } catch (error) {
        logger.error('Error closing connection during shutdown', { error: error.message });
      }
    }
    
    this.pool = [];
    this.activeConnections = 0;
    logger.info('Database manager shutdown complete');
  }

  getMetrics() {
    return {
      poolSize: this.pool.length,
      activeConnections: this.activeConnections,
      healthyConnections: this.pool.filter(c => c.isHealthy).length,
      inUseConnections: this.pool.filter(c => c.inUse).length,
      connectionErrors: this.connectionErrors,
      totalQueries: this.totalQueries,
      failedQueries: this.failedQueries,
      lastHealthCheck: this.lastHealthCheck,
      uptime: this.pool.length > 0 ? Date.now() - Math.min(...this.pool.map(c => c.createdAt)) : 0
    };
  }
}

// Singleton instance
let dbManager;

export function initializeDbManager(connectionString, options) {
  if (!dbManager) {
    dbManager = new DatabaseManager(connectionString, options);
    
    // Run periodic health checks
    setInterval(async () => {
      try {
        await dbManager.healthCheck();
      } catch (error) {
        logger.error('Health check failed', { error: error.message });
      }
    }, 60000); // Every minute
    
    // Run periodic cleanup
    setInterval(async () => {
      try {
        await dbManager.cleanup();
      } catch (error) {
        logger.error('Connection cleanup failed', { error: error.message });
      }
    }, 300000); // Every 5 minutes
  }
  
  return dbManager;
}

export function getDbManager() {
  if (!dbManager) {
    throw new Error('Database manager not initialized');
  }
  return dbManager;
}