# PromptPulse Deployment Guide

This guide walks you through deploying PromptPulse to Railway.

## Prerequisites

- SQLite Cloud database already set up
- Git repository with your code
- Railway account (free tier available)

## Step 1: Railway Deployment

### 1.1 Create Railway Project

1. Visit [railway.app](https://railway.app) and sign up
2. Click "New Project" → "Deploy from GitHub repo"
3. Connect your GitHub account and select your PromptPulse repository
4. Railway will automatically detect the Dockerfile and start building

### 1.2 Configure Environment Variables

In your Railway project dashboard, go to Variables and add:

```bash
DATABASE_URL=your_sqlite_cloud_connection_string
NODE_ENV=production
RAILWAY_ENVIRONMENT=production
PORT=3000

# Optional: Email service for reports and notifications
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Optional: Database connection pool tuning
DB_MAX_CONNECTIONS=10
DB_IDLE_TIMEOUT=30000
DB_RETRY_ATTEMPTS=3
DB_RETRY_DELAY=1000

# Optional: Logging level
LOG_LEVEL=info
```


## Step 2: Update Configuration

### 2.1 Get Your Railway URL

After deployment, Railway provides a URL like: `https://your-app-name.railway.app`

### 2.2 Update Production URLs

Edit `lib/config.js` and replace the placeholder URLs:

```javascript
// Update these lines
const PRODUCTION_API_URL = process.env.PROMPTPULSE_API_ENDPOINT || 'https://your-actual-app.railway.app';
const PRODUCTION_DASHBOARD_URL = process.env.PROMPTPULSE_DASHBOARD_URL || 'https://www.promptpulse.dev';
```

### 2.3 Update CORS Settings

Edit `server.js` and update the allowed origins:

```javascript
const allowedOrigins = [
  'https://www.promptpulse.dev', // Update this
  'http://localhost:3001', // Keep for development
  'http://localhost:3000'  // Keep for development
];
```

## Step 3: Database Migration

Run migrations on your production database:

```bash
# Set your production DATABASE_URL locally
export DATABASE_URL="your_sqlite_cloud_connection_string"

# Run migrations
npm run migrate
```

## Step 4: Deploy Dashboard (Optional)

### 4.1 Vercel Deployment

1. Go to [vercel.com](https://vercel.com) and sign up
2. Import your project's `client` folder
3. Set environment variables:
   ```bash
   NEXT_PUBLIC_API_URL=https://your-app.railway.app
   ```
4. Deploy and get your dashboard URL

### 4.2 Update Dashboard URL

Update your Railway environment variables:
```bash
PROMPTPULSE_DASHBOARD_URL=https://www.promptpulse.dev
```

## Step 5: Test Your Deployment

### 5.1 Health Check

Visit: `https://your-app.railway.app/health`

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0",
  "database": "connected"
}
```

### 5.2 Test CLI

Update your npm package and test:

```bash
# Update the production URL in lib/config.js first
npm pack
npm install -g ./promptpulse-1.0.0.tgz

# Test the CLI
promptpulse login
promptpulse collect
```

## Step 6: Publish to NPM

### 6.1 Update Package Version

```bash
npm version patch  # or minor/major
```

### 6.2 Publish

```bash
npm publish
```


## Security Notes

- API keys are required for all endpoints
- CORS is configured for your specific dashboard domain
- Database credentials are never exposed to clients
- All data is isolated by user ID

## Troubleshooting

### Deployment Fails

- Check Railway build logs for errors
- Verify all environment variables are set
- Ensure DATABASE_URL is correctly formatted

### App Not Responding

- Review Railway deployment logs
- Check if service is running in Railway dashboard
- Verify all environment variables are set

### CORS Errors

- Verify dashboard URL is in CORS allowedOrigins
- Check environment variables are set correctly
- Test with curl to isolate frontend vs backend issues

## Support

For deployment issues:
1. Check Railway documentation
2. Review Railway project logs
3. Test health endpoint first
4. Verify environment variables

Your PromptPulse service is now ready for production use!