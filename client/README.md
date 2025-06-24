# PromptPulse Dashboard

The web dashboard for PromptPulse - track and analyze your Claude Code usage across multiple machines.

## Quick Deployment to Vercel

### 1. Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone)

Or manually:

1. **Import to Vercel**: Go to [vercel.com/new](https://vercel.com/new)
2. **Select Repository**: Import your GitHub repository
3. **Configure Project**: 
   - **Root Directory**: `client`
   - **Framework**: Next.js (auto-detected)
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `.next` (auto-detected)

### 2. Set Environment Variables

In Vercel dashboard, add these environment variables:

```bash
NEXT_PUBLIC_API_URL=https://exciting-patience-production.up.railway.app
```

### 3. Deploy

Vercel will automatically build and deploy your dashboard.

## Local Development

### Prerequisites

- Node.js 18+
- Running PromptPulse API server

### Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Edit .env.local with your API URL
# NEXT_PUBLIC_API_URL=http://localhost:3000

# Start development server
npm run dev
```

The dashboard will be available at `http://localhost:3001`

## Features

- **Authentication**: Secure login with API keys
- **Usage Analytics**: View token usage, costs, and trends
- **Multi-Machine Support**: Track usage across different devices
- **Dark/Light Mode**: Toggle between themes
- **Real-time Data**: Live updates from your PromptPulse API
- **Responsive Design**: Works on desktop and mobile

## Authentication

1. Get your API key by running: `promptpulse user init`
2. Open the dashboard and enter your API key
3. Start exploring your Claude Code usage data!

## API Integration

The dashboard connects to your PromptPulse API server to:

- Fetch usage statistics and analytics
- Display machine information
- Show session and project data
- Generate usage reports

## Configuration

### Environment Variables

- `NEXT_PUBLIC_API_URL`: The URL of your PromptPulse API server

### Customization

The dashboard uses:
- **Next.js 15** for the React framework
- **Tailwind CSS** for styling
- **Recharts** for data visualization
- **Radix UI** for accessible components

## Production Deployment

This dashboard is optimized for deployment on:

- **Vercel** (recommended) - Zero configuration, global CDN
- **Netlify** - Static site hosting
- **Railway** - Full-stack hosting
- **AWS Amplify** - AWS integration

## License

MIT License - see the main repository for details.