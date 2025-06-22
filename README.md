# PromptPulse

Multi-user platform for tracking and analyzing Claude Code usage across multiple machines. Features automatic data collection, user authentication, and a beautiful web dashboard for visualizing usage patterns.

## Features

- 🔐 **Multi-user support** with API key authentication
- 📊 **Beautiful dashboard** built with Next.js and Recharts
- 🖥️ **Multi-machine tracking** - aggregate usage across all your devices
- ⏰ **Automatic collection** via cron job configuration
- 📈 **Detailed analytics** - daily costs, token usage, session tracking
- 🏷️ **Project-based insights** - see usage by project
- 💰 **Cost tracking** - monitor your Claude API spending

## Installation

```bash
npm install -g promptpulse
```

## Quick Start

### 1. Initialize Your User Account

```bash
# Create your first user account
promptpulse user init

# This will create a default user and save your API key
```

### 2. Set Up Automatic Collection

```bash
# Configure cron job for automatic data collection
promptpulse setup
```

### 3. Collect Usage Data

```bash
# Manually collect usage data
promptpulse collect
```

### 4. Launch the Dashboard

```bash
# Option 1: Start both server and client simultaneously (recommended)
npm run dev

# Option 2: Start manually in separate terminals
# Terminal 1: Start the API server
node server.js

# Terminal 2: Start the dashboard
cd client && npm run dev

# Open http://localhost:3001 in your browser
```

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```bash
# Required
DATABASE_URL=your_sqlite_cloud_connection_string

# Optional
MACHINE_ID=custom-machine-name  # Defaults to hostname
PORT=3000                       # API server port
```

### User Configuration

User credentials are stored in `~/.promptpulse/config.json` after running `promptpulse user init`.

## Usage

### Manual Collection

To manually collect and upload usage data:

```bash
# Collect all data (daily, sessions, blocks)
promptpulse collect
# or
ppulse collect

# Collect specific granularity
ppulse collect --granularity daily    # Only daily aggregates
ppulse collect --granularity session  # Only session data
ppulse collect --granularity blocks   # Only 5-hour blocks
ppulse collect --granularity all      # Everything (default)
```

### User Management

```bash
# Create a new user
promptpulse user create <email> <username> [fullName]

# List all users
promptpulse user list

# Show current user
promptpulse user whoami

# Configure API key
promptpulse user config set api-key <key>
promptpulse user config get api-key
promptpulse user config show
```

### View Commands

```bash
promptpulse --help
# or
ppulse --help
```

## Web Dashboard

The PromptPulse dashboard provides a beautiful interface for visualizing your Claude Code usage:

### Features

- **Real-time statistics** - Total cost, tokens, and usage breakdowns
- **Interactive charts** - Daily cost trends and token usage over time
- **Machine management** - View usage across all your devices
- **Session tracking** - Detailed session and project analytics
- **Dark mode support** - Easy on the eyes during long coding sessions

### Running the Dashboard

```bash
# Option 1: Start both server and client together (recommended)
npm run dev

# Option 2: Manual startup in separate terminals
# Terminal 1: Start the API server
node server.js

# Terminal 2: Start the dashboard
cd client
npm install  # First time only
npm run dev

# Open http://localhost:3001
```

### Dashboard Authentication

1. Open http://localhost:3001
2. Enter your API key (shown when you ran `promptpulse user init`)
3. Click "Connect" to access your dashboard

Your API key is securely stored in localStorage for future sessions.

## Automated Upload Setup

The system includes robust automation to ensure your Claude Code usage data is uploaded regularly, even if your machine isn't always on at scheduled times.

### Components

1. **Cron Job** - Runs multiple times daily
2. **Login Script** - Catches missed uploads when you login
3. **Smart Deduplication** - Prevents uploading the same day's data multiple times
4. **Comprehensive Logging** - Tracks all upload activity

### Installation

The automated upload system was installed with the following components:

#### Cron Job Schedule
```bash
# Runs every 4 hours during typical work hours
0 8,12,16,20 * * * /path/to/ccleaderboard/cron-upload.sh
```

#### Login Script
Added to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.) to run on each terminal session:
```bash
/path/to/ccleaderboard/upload-on-login.sh
```

### Setup Automation

Set up the automation (replace `/path/to/project` with your actual installation directory):

#### 1. Install Cron Job
```bash
# Create crontab entry (update path to your installation)
echo "0 8,12,16,20 * * * /path/to/project/cron-upload.sh" | crontab -

# Or edit manually
crontab -e
# Add: 0 8,12,16,20 * * * /path/to/project/cron-upload.sh

# Verify installation
crontab -l
```

#### 2. Install Login Script  
```bash
# Add to your shell profile (update path to your installation)
echo "" >> ~/.bashrc  # or ~/.zshrc on macOS
echo "# Claude Code usage upload on login" >> ~/.bashrc
echo "/path/to/project/upload-on-login.sh" >> ~/.bashrc

# Reload shell profile
source ~/.bashrc  # or source ~/.zshrc
```

## API Reference

All API endpoints require authentication via the `X-API-Key` header.

### Authentication

```bash
# Create a new user
POST /api/users
{
  "email": "user@example.com",
  "username": "username",
  "fullName": "Full Name"  // optional
}

# List all users (requires authentication)
GET /api/users
X-API-Key: your_api_key
```

### Usage Data

```bash
# Get aggregated usage data
GET /api/usage/aggregate
X-API-Key: your_api_key

# Get machines
GET /api/machines
X-API-Key: your_api_key

# Get sessions
GET /api/usage/sessions?limit=50&projectPath=myproject
X-API-Key: your_api_key

# Get blocks (5-hour billing periods)
GET /api/usage/blocks?activeOnly=true
X-API-Key: your_api_key
```

### Analytics

```bash
# Usage patterns
GET /api/usage/analytics/patterns?period=day
X-API-Key: your_api_key

# Cost breakdown
GET /api/usage/analytics/costs?groupBy=project
X-API-Key: your_api_key
```

## Data Sources

The upload script reads Claude Code usage data from local JSONL files located at:
- `~/.claude/projects/**/*.jsonl` (default)
- `$CLAUDE_CONFIG_DIR/projects/**/*.jsonl` (if custom path set)

This data includes:
- Token usage (input, output, cache creation, cache read)
- Model information
- Timestamps
- Cost calculations

## Architecture

### Project Structure

```
promptpulse/
├── server.js              # API server with authentication
├── client/                # Next.js dashboard
│   ├── src/
│   │   ├── app/          # Next.js app directory
│   │   ├── components/   # React components
│   │   ├── lib/          # API client and utilities
│   │   └── types/        # TypeScript types
│   └── package.json
├── lib/                   # CLI library code
│   ├── auth.js           # Authentication utilities
│   ├── collect.js        # Data collection logic
│   ├── setup.js          # Cron setup
│   └── user-cli.js       # User management CLI
├── migrations/           # Database migrations
└── bin/                  # CLI entry point
    └── promptpulse.js
```

### Data Flow

1. **Collection**: CLI reads Claude usage data from `~/.claude/projects/`
2. **Authentication**: User's API key validates requests
3. **Storage**: Data stored in SQLite Cloud with user isolation
4. **API**: RESTful endpoints serve user-specific data
5. **Dashboard**: React app visualizes usage patterns

## Multi-User Support

### How It Works

- Each user has a unique API key for authentication
- All usage data is scoped to the authenticated user
- Multiple users can track their usage independently
- Machines can be shared or user-specific

### Use Cases

- **Teams**: Each developer tracks their own Claude usage
- **Freelancers**: Separate usage by client projects
- **Personal**: Track usage across work and personal machines

## Development

### Prerequisites

- Node.js 18+
- SQLite Cloud account or local SQLite database
- Claude Code installed locally

### Local Development

```bash
# Clone the repository
git clone https://github.com/yourusername/promptpulse.git
cd promptpulse

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your DATABASE_URL

# Run migrations
npm run migrate

# Start both server and client simultaneously
npm run dev

# Or start separately:
# npm start                    # API server only
# cd client && npm run dev     # Dashboard only

# For CLI development
npm link  # Link the CLI globally
promptpulse --help
```

### Database Migrations

Create new migrations in the `migrations/` directory:

```sql
-- migrations/004_your_migration.sql
CREATE TABLE your_table (
  id INTEGER PRIMARY KEY,
  ...
);
```

Run migrations:

```bash
npm run migrate
```

## Deployment

### API Server

The API server can be deployed to any Node.js hosting platform:

1. Set environment variables (DATABASE_URL)
2. Run migrations: `npm run migrate`
3. Start server: `npm start`

### Dashboard

The Next.js dashboard can be deployed to Vercel, Netlify, or any static hosting:

```bash
cd client
npm run build
npm run start  # For production
```

### Docker Support

Coming soon - Docker images for easy deployment.

## Security Notes

- Machine IDs are automatically generated (hostname + random suffix)
- No sensitive data is transmitted (only usage statistics)
- All communication is over HTTP (configure HTTPS for production)
- Logs contain no sensitive information
- API keys are securely generated and stored

## Dependencies

- Node.js 18+
- `ccusage` package for reading Claude Code data
- SQLite Cloud or local SQLite database
- `cron` service (standard on Linux/macOS)

## Support

### Common Issues

1. **"No usage data found"** - Ensure you have used Claude Code and data exists in `~/.claude/projects/`
2. **Permission denied** - Ensure scripts are executable: `chmod +x *.sh`
3. **Cron not running** - Check cron service: `sudo systemctl status cron`
4. **Database errors** - Verify database connection and run migrations
5. **Authentication failed** - Check your API key with `promptpulse user whoami`

### Log Locations

- Upload logs: `logs/upload-YYYY-MM.log`
- Last upload tracking: `logs/last-upload`
- System cron logs: `/var/log/cron` (requires sudo)

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE.md for details