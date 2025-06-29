import express from 'express';
import cors from 'cors';
import { corsOptions } from './cors.js';
import { limiter, batchLimiter } from './rate-limiting.js';
import { requestLogger } from '../lib/logger.js';
import { 
  detectSqlInjectionMiddleware, 
  sanitizeAllInputs, 
  securityHeaders 
} from '../lib/validation-middleware.js';

export function setupMiddleware(app) {
  // Trust proxy for Railway deployment (fixes X-Forwarded-For header validation)
  app.set('trust proxy', 1);

  // Add request logging middleware first
  app.use(requestLogger());

  // CORS
  app.use(cors(corsOptions));
  
  // JSON parsing with size limit
  app.use(express.json({ limit: '10mb' })); // Limit payload size for cost protection

  // Rate limiting
  app.use(limiter);
  
  // More strict rate limiting for batch uploads
  app.use('/api/usage/*/batch', batchLimiter);

  // Security middleware
  app.use(securityHeaders);
  app.use(detectSqlInjectionMiddleware);
  app.use(sanitizeAllInputs);
}