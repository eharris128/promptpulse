import winston from 'winston';
import crypto from 'crypto';
import chalk from 'chalk';

// Enhanced console format with colors and visual emphasis
const enhancedConsoleFormat = winston.format.printf(({ level, message, timestamp, requestId, category, ...metadata }) => {
  let timestampStr = chalk.gray(timestamp);
  let levelStr, messageStr;
  let prefix = '';
  let suffix = '';
  
  // Color coding based on log level
  switch (level.toLowerCase()) {
    case 'error':
      levelStr = chalk.bgRed.white.bold(' ERROR ');
      messageStr = chalk.red.bold(message);
      // Add visual emphasis for errors
      prefix = chalk.red('🚨 ');
      suffix = chalk.red(' ⚠️');
      break;
    case 'warn':
      levelStr = chalk.bgYellow.black.bold(' WARN  ');
      messageStr = chalk.yellow.bold(message);
      prefix = chalk.yellow('⚠️  ');
      break;
    case 'info':
      levelStr = chalk.bgGreen.white(' INFO  ');
      messageStr = chalk.white(message);
      break;
    case 'debug':
      levelStr = chalk.bgBlue.white(' DEBUG ');
      messageStr = chalk.blue(message);
      break;
    default:
      levelStr = chalk.bgGray.white(` ${level.toUpperCase().padEnd(5)} `);
      messageStr = chalk.white(message);
  }
  
  // Category-specific color coding
  if (category) {
    let categoryColor;
    switch (category) {
      case 'database':
        categoryColor = chalk.cyan;
        prefix += categoryColor('🗄️  ');
        break;
      case 'auth':
        categoryColor = chalk.magenta;
        prefix += categoryColor('🔐 ');
        break;
      case 'api':
        categoryColor = chalk.green;
        prefix += categoryColor('🌐 ');
        break;
      case 'performance':
        categoryColor = chalk.yellow;
        prefix += categoryColor('⚡ ');
        break;
      case 'email':
        categoryColor = chalk.blue;
        prefix += categoryColor('📧 ');
        break;
      default:
        categoryColor = chalk.white;
    }
    messageStr = categoryColor(message);
  }
  
  let msg = `${timestampStr} ${levelStr}`;
  
  if (requestId) {
    msg += ` ${chalk.dim.cyan(`[${requestId}]`)}`;
  }
  
  msg += ` ${prefix}${messageStr}${suffix}`;
  
  // Enhanced metadata formatting
  if (Object.keys(metadata).length > 0) {
    const metadataStr = JSON.stringify(metadata, null, 2);
    if (level.toLowerCase() === 'error') {
      msg += `\n${chalk.red('   Details:')} ${chalk.dim(metadataStr)}`;
    } else {
      msg += ` ${chalk.dim(metadataStr)}`;
    }
  }
  
  // Add visual separator for critical errors
  if (level.toLowerCase() === 'error' && (category === 'email' || category === 'database' || category === 'auth')) {
    const separator = chalk.red('━'.repeat(80));
    msg = `\n${separator}\n${msg}\n${separator}`;
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
    // Console transport with enhanced formatting
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        enhancedConsoleFormat
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
  
  // Email operations
  emailSending: (to, subject, service = 'resend') => {
    logger.info(`Sending email: ${subject}`, { category: 'email', to, subject, service });
  },
  
  emailSuccess: (to, subject, emailId, service = 'resend') => {
    logger.info(`Email sent successfully: ${subject}`, { category: 'email', to, subject, emailId, service });
  },
  
  emailError: (error, context) => {
    logger.error(`Email service error`, { 
      category: 'email', 
      error: error.message || error,
      errorDetails: error,
      ...context 
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
  },
  
  // Enhanced error logging with context
  error: (message, context = {}) => {
    const category = context.category || 'general';
    logger.error(message, { category, ...context });
  },
  
  // Enhanced info logging with context
  info: (message, context = {}) => {
    const category = context.category || 'general';
    logger.info(message, { category, ...context });
  },
  
  // Enhanced warn logging with context
  warn: (message, context = {}) => {
    const category = context.category || 'general';
    logger.warn(message, { category, ...context });
  }
};

export default logger;