# PromptPulse Dashboard

The web dashboard for PromptPulse - track and analyze your Claude Code usage across multiple machines.

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

1. Get your API key by running: `promptpulse login`
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

This dashboard can be deployed on:

- **Railway** - Full-stack hosting with your API server
- **Netlify** - Static site hosting
- **AWS Amplify** - AWS integration
- **Self-hosted** - Any static web server

## License

MIT License - see the main repository for details.