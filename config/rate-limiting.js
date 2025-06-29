import rateLimit from 'express-rate-limit';

// General rate limiting for cost protection
export const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// More strict rate limiting for batch uploads (cost protection)
export const batchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Only 5 batch uploads per minute per IP
  message: {
    error: 'Batch upload rate limit exceeded. Please wait before uploading again.',
    retryAfter: '1 minute'
  }
});