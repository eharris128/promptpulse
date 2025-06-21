# PromptPulse

Track and aggregate Claude Code usage across multiple machines with automatic collection via cron.

## Installation

```bash
npm install -g promptpulse
```

## Setup

After installation, run the setup command to configure automatic usage collection every 15 minutes:

```bash
promptpulse setup
# or use the shorthand
ppulse setup
```

This will add a cron job that runs collection every 15 minutes.

## Configuration

Set the following environment variables:

- `DATABASE_URL` - SQLite Cloud database connection string (required)
- `MACHINE_ID` - Custom machine identifier (optional, defaults to hostname)

You can set these in a `.env` file in your project directory or export them in your shell.

## Usage

### Manual Collection

To manually collect and upload usage data:

```bash
promptpulse collect
# or
ppulse collect
```

### View Commands

```bash
promptpulse --help
# or
ppulse --help
```

## Quick Start

### 1. Server Setup

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# Run migrations
npm run migrate

# Start server
npm start
```

### 2. Upload Usage Data

```bash
# Manual upload
node upload-usage.js

# Check what data was uploaded
curl http://localhost:3000/api/machines
curl http://localhost:3000/api/usage/aggregate
```

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

### How It Handles Different Scenarios

#### Scenario 1: Machine On All Day
- Cron runs at 8 AM, 12 PM, 4 PM, and 8 PM
- First successful upload of the day uploads data
- Subsequent runs skip (no duplicate uploads)

#### Scenario 2: Machine Started After 9 AM
- If you start your machine at 11 AM, cron will catch it at 12 PM
- If you start at 2 PM, cron will catch it at 4 PM
- If you start at 6 PM, cron will catch it at 8 PM

#### Scenario 3: Machine Started After 8 PM
- Login script detects no upload happened today
- Runs upload automatically in background when you open terminal
- Won't delay your login process

#### Scenario 4: Weekend/Irregular Usage
- System tracks last upload date, not just daily schedule
- Will upload whenever you next use the machine
- No data is ever lost due to irregular usage patterns

### Files Created

```
ccleaderboard/
├── upload-usage.js           # Main upload script
├── cron-upload.sh           # Wrapper script for cron with logging
├── upload-on-login.sh       # Runs upload if missed on login
└── logs/
    ├── upload-YYYY-MM.log   # Monthly log files
    └── last-upload          # Tracks last successful upload date
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

#### 3. Test Setup
```bash
# Test manual upload
node upload-usage.js

# Test cron script
./cron-upload.sh

# Test login script  
./upload-on-login.sh
```

### Configuration

#### Environment Variables

```bash
# Custom server URL (default: http://localhost:3000)
export SERVER_URL=https://your-server.com

# Custom machine ID (default: hostname-randomid)
export MACHINE_ID=my-custom-machine-id

# Custom Claude data directory (default: ~/.claude)
export CLAUDE_CONFIG_DIR=/path/to/claude/data
```

#### Using Custom Configuration

```bash
# Upload with custom server
SERVER_URL=https://my-server.com node upload-usage.js

# Upload with custom machine ID
MACHINE_ID=laptop-work node upload-usage.js
```

## Management Commands

### View Upload Status

```bash
# Check current cron jobs
crontab -l

# View recent upload logs
cat logs/upload-$(date +%Y-%m).log

# Check last upload date
cat logs/last-upload

# View all log files
ls -la logs/
```

### Manual Operations

```bash
# Run upload manually
node upload-usage.js

# Run cron script manually (includes logging)
./cron-upload.sh

# Test login script
./upload-on-login.sh
```

### Troubleshooting

#### Check Upload Logs
```bash
# View current month's logs
tail -f logs/upload-$(date +%Y-%m).log

# View all errors in logs
grep ERROR logs/upload-*.log
```

#### Verify Cron Service
```bash
# Check if cron is running
sudo systemctl status cron

# View cron logs
sudo journalctl -u cron -f
```

#### Test Upload Manually
```bash
# Test if upload script works
node upload-usage.js

# Test if cron script works
./cron-upload.sh

# Check server connectivity
curl http://localhost:3000/api/machines
```

### Modifying the Schedule

#### Change Cron Frequency
```bash
# Edit crontab
crontab -e

# Examples:
# Every 2 hours: 0 */2 * * * /path/to/cron-upload.sh
# Once daily at 9 AM: 0 9 * * * /path/to/cron-upload.sh  
# Every hour 9-5: 0 9-17 * * * /path/to/cron-upload.sh
```

#### Disable Login Script
```bash
# Comment out or remove this line from your shell profile:
# /path/to/ccleaderboard/upload-on-login.sh
```

#### Disable All Automation
```bash
# Remove cron job
crontab -r

# Remove from shell profile (adjust for your shell)
sed -i '/upload-on-login.sh/d' ~/.bashrc  # Linux
sed -i '' '/upload-on-login.sh/d' ~/.zshrc  # macOS with zsh
```

## API Endpoints

### Get Machines
```bash
GET /api/machines
# Returns list of all machines with usage summary
```

### Get Usage Data
```bash
GET /api/usage/aggregate
GET /api/usage/aggregate?machineId=MACHINE_ID
GET /api/usage/aggregate?since=2024-01-01&until=2024-12-31
# Returns aggregated usage data with optional filtering
```

### Upload Usage Data
```bash
POST /api/usage
Content-Type: application/json

{
  "machineId": "machine-identifier",
  "data": [
    {
      "date": "2024-01-01",
      "inputTokens": 1000,
      "outputTokens": 2000,
      "cacheCreationTokens": 100,
      "cacheReadTokens": 200,
      "totalTokens": 3300,
      "totalCost": 1.50,
      "modelsUsed": ["claude-3-5-sonnet-20241022"],
      "modelBreakdowns": [...]
    }
  ]
}
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

## Security Notes

- Machine IDs are automatically generated (hostname + random suffix)
- No sensitive data is transmitted (only usage statistics)
- All communication is over HTTP (configure HTTPS for production)
- Logs contain no sensitive information

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

### Log Locations

- Upload logs: `logs/upload-YYYY-MM.log`
- Last upload tracking: `logs/last-upload`
- System cron logs: `/var/log/cron` (requires sudo)

## Development

The original server and migration scripts are still available:

```bash
npm start        # Start the API server
npm run migrate  # Run database migrations
```

To develop locally:

1. Clone the repository
2. Install dependencies: `npm install`
3. Create a `.env` file with your `DATABASE_URL`
4. Run migrations: `npm run migrate`
5. Link the package locally: `npm link`
6. Test commands: `promptpulse --help`