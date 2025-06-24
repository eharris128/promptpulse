# PromptPulse Deployment Guide

This guide walks you through deploying PromptPulse to Railway with cost protection.

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
```

### 1.3 Set Up Cost Protection (CRITICAL)

1. Go to your project Settings → Usage Limits
2. Set a hard limit: **$15/month** (recommended starting point)
3. Configure email alerts:
   - Alert at $5 (50% of budget)
   - Alert at $10 (75% of budget)
   - Hard limit at $15 (app shuts down to prevent overcharges)

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
promptpulse user init
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

## Cost Monitoring

### Expected Costs

- **Light usage** (< 100 API calls/day): $3-7/month
- **Medium usage** (< 1000 API calls/day): $7-12/month
- **Heavy usage**: App shuts down at $15/month limit

### Monitoring Tools

1. **Railway Dashboard**: Real-time usage and cost tracking
2. **Usage Alerts**: Email notifications at 50%, 75%, 90% of limit
3. **Hard Limit**: Automatic shutdown at $15 to prevent overcharges

### Cost Optimization Tips

1. Monitor the Railway metrics dashboard weekly
2. Adjust usage limits based on actual patterns
3. Consider increasing limits only after 2-3 months of stable usage
4. Use the health endpoint for uptime monitoring

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

### App Shuts Down

- Check if you hit your usage limit
- Review Railway usage dashboard
- Increase limit if needed or optimize code

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

Your PromptPulse service is now ready for production use with cost protection!