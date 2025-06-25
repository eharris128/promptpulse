import winston from 'winston';
import crypto from 'crypto';

// Custom format for clean console output
const consoleFormat = winston.format.printf(({ level, message, timestamp, requestId, ...metadata }) => {
  let msg = `${timestamp} [${level.toUpperCase()}]`;
  
  if (requestId) {
    msg += ` [${requestId}]`;
  }
  
  msg += ` ${message}`;
  
  // Add metadata if present
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  
  return msg;
});

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { 
    service: 'promptpulse-api',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Console transport with custom formatting
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        consoleFormat
      )
    })
  ]
});

// Add file transport in production
if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.File({ 
    filename: 'logs/error.log', 
    level: 'error',
    maxsize: 10485760, // 10MB
    maxFiles: 5
  }));
  
  logger.add(new winston.transports.File({ 
    filename: 'logs/combined.log',
    maxsize: 10485760, // 10MB
    maxFiles: 5
  }));
}

// Generate unique request ID
export function generateRequestId() {
  return crypto.randomBytes(8).toString('hex');
}

// Express middleware for request logging
export function requestLogger() {
  return (req, res, next) => {
    const requestId = generateRequestId();
    const startTime = Date.now();
    
    // Attach request ID to request object
    req.requestId = requestId;
    
    // Log request
    logger.info('Incoming request', {
      requestId,
      method: req.method,
      url: req.url,
      userAgent: req.get('user-agent'),
      userId: req.user?.id
    });
    
    // Capture response
    const originalSend = res.send;
    res.send = function(data) {
      res.send = originalSend;
      res.send(data);
      
      const duration = Date.now() - startTime;
      
      // Log response
      logger.info('Request completed', {
        requestId,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration,
        userId: req.user?.id
      });
      
      // Log slow requests
      if (duration > 1000) {
        logger.warn('Slow request detected', {
          requestId,
          method: req.method,
          url: req.url,
          duration,
          threshold: 1000
        });
      }
    };
    
    // Error handling
    res.on('error', (error) => {
      logger.error('Response error', {
        requestId,
        error: error.message,
        stack: error.stack
      });
    });
    
    next();
  };
}

// Database query logger
export function logDatabaseQuery(queryName, userId) {
  return {
    queryId: crypto.randomBytes(4).toString('hex'),
    queryName,
    userId,
    startTime: Date.now()
  };
}

// Performance timer helper
export class Timer {
  constructor(name, metadata = {}) {
    this.name = name;
    this.metadata = metadata;
    this.startTime = Date.now();
    this.marks = [];
  }
  
  mark(label) {
    const now = Date.now();
    const duration = now - this.startTime;
    const lastMark = this.marks[this.marks.length - 1];
    const sinceLast = lastMark ? now - lastMark.time : duration;
    
    this.marks.push({
      label,
      time: now,
      duration,
      sinceLast
    });
    
    logger.debug(`Timer mark: ${this.name} - ${label}`, {
      ...this.metadata,
      duration,
      sinceLast
    });
  }
  
  end() {
    const duration = Date.now() - this.startTime;
    
    logger.info(`Timer completed: ${this.name}`, {
      ...this.metadata,
      duration,
      marks: this.marks.map(m => ({
        label: m.label,
        duration: m.duration,
        sinceLast: m.sinceLast
      }))
    });
    
    return duration;
  }
}

// Error logging helper
export function logError(error, context = {}) {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    code: error.code || error.errorCode,
    ...context
  };
  
  // Add specific handling for database errors
  if (error.message?.includes('Connection unavailable') || 
      error.errorCode === 'ERR_CONNECTION_NOT_ESTABLISHED') {
    errorInfo.category = 'database_connection';
    errorInfo.severity = 'high';
  }
  
  logger.error('Application error', errorInfo);
  
  return errorInfo;
}

// Structured logging helpers
export const log = {
  // Database operations
  dbQuery: (operation, details) => {
    logger.debug(`Database: ${operation}`, { category: 'database', operation, ...details });
  },
  
  dbError: (operation, error, details) => {
    logger.error(`Database error: ${operation}`, { 
      category: 'database', 
      operation, 
      error: error.message,
      errorCode: error.errorCode,
      ...details 
    });
  },
  
  // Authentication
  authSuccess: (userId, method) => {
    logger.info('Authentication successful', { category: 'auth', userId, method });
  },
  
  authFailure: (reason, details) => {
    logger.warn('Authentication failed', { category: 'auth', reason, ...details });
  },
  
  // API operations
  apiCall: (endpoint, method, userId) => {
    logger.debug(`API call: ${method} ${endpoint}`, { category: 'api', endpoint, method, userId });
  },
  
  apiError: (endpoint, error, statusCode) => {
    logger.error(`API error: ${endpoint}`, { 
      category: 'api', 
      endpoint, 
      error: error.message,
      statusCode 
    });
  },
  
  // Performance
  performance: (operation, duration, metadata) => {
    const level = duration > 5000 ? 'warn' : 'info';
    logger[level](`Performance: ${operation}`, { 
      category: 'performance',
      operation,
      duration,
      ...metadata
    });
  }
};

export default logger;