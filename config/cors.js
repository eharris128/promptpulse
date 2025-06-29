// CORS configuration for production
export const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // In production, only allow specific domains
    const allowedOrigins = [
      'https://exciting-patience-production.up.railway.app',
      'https://www.promptpulse.dev',
      'https://promptpulse.dev',
      'http://localhost:3001',
      'http://localhost:3000'
    ];
    
    // Allow all Vercel preview and production domains
    if (origin && (
      origin.endsWith('.vercel.app') || 
      origin.endsWith('.vercel.com') ||
      origin.includes('promptpulse') // Allow custom domains with promptpulse
    )) {
      allowedOrigins.push(origin);
    }
    
    // Add custom domain from environment variable
    if (process.env.PROMPTPULSE_DASHBOARD_URL) {
      allowedOrigins.push(process.env.PROMPTPULSE_DASHBOARD_URL);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};