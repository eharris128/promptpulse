# PromptPulse

Track and analyze your Claude Code usage with beautiful dashboards and competitive leaderboards. PromptPulse is a hosted service that automatically collects your usage data and provides insights across all your machines.

## Features

- 🔐 **Secure API key authentication** for private data access
- 📊 **Beautiful hosted dashboard** built with Next.js and Recharts
- 🖥️ **Multi-machine tracking** - aggregate usage across all your devices
- 🏆 **Competitive leaderboards** - compare your usage with other users (opt-in)
- 📈 **Detailed analytics** - daily costs, token usage, session tracking
- 🏷️ **Project-based insights** - see usage by project
- 💰 **Cost tracking** - monitor your Claude API spending
- ⚡ **Simple CLI** - easy setup and data collection

## Installation

```bash
npm install -g @eharris128/promptpulse
```

## Quick Start

### 1. Initialize Your Account

```bash
# Create your user account and get your API key
promptpulse user init
```

This creates your secure user account and provides you with a unique API key.

### 2. Collect Your Usage Data

```bash
# Upload your Claude Code usage data
promptpulse collect
```

### 3. View Your Dashboard

Visit your personalized dashboard at: [https://promptpulse-git-master-evan-harris-projects.vercel.app](https://promptpulse-git-master-evan-harris-projects.vercel.app)

Enter your API key to access your private analytics and insights.

## Usage

### Data Collection

```bash
# Collect all usage data (recommended)
promptpulse collect

# Collect specific granularity
promptpulse collect --granularity daily    # Only daily aggregates
promptpulse collect --granularity session  # Only session data
promptpulse collect --granularity blocks   # Only 5-hour blocks
promptpulse collect --granularity all      # Everything (default)
```

### User Management

```bash
# Show current user info
promptpulse user whoami

# View your API key
promptpulse user config show

# Configure a different API key
promptpulse user config set api-key <your-key>
```

### Get Help

```bash
promptpulse --help
# or
ppulse --help
```

## Web Dashboard

Access your personalized dashboard to view:

### Analytics Features
- **Real-time statistics** - Total cost, tokens, and usage breakdowns
- **Interactive charts** - Daily cost trends and token usage over time
- **Machine management** - View usage across all your devices
- **Session tracking** - Detailed session and project analytics
- **Dark mode support** - Easy on the eyes during long coding sessions

### Leaderboard Features
- **Daily & Weekly rankings** - See how you stack up against other users
- **Opt-in participation** - Complete control over your privacy
- **Custom display names** - Show a nickname instead of your username
- **Percentile rankings** - Know where you stand in the community

### Privacy Controls
- **Leaderboard settings** - Enable/disable participation anytime
- **Display name management** - Control how you appear to others
- **Private by default** - Your data stays private unless you opt in

## Dashboard Authentication

1. Open your dashboard URL
2. Enter your API key (from `promptpulse user init`)
3. Click "Connect" to access your analytics

Your API key is securely stored for future sessions.

## Leaderboard Participation

### Opt-in to Competition

The leaderboard is completely opt-in. To participate:

1. Visit your dashboard Settings page
2. Enable "Leaderboard Participation"
3. Optionally set a custom display name
4. Your usage will appear in daily and weekly rankings

### Privacy Information

**When leaderboard is enabled:**
- Your token usage and costs are included in rankings
- Your username or display name is shown publicly
- Your ranking position and percentile are calculated
- No other personal information is shared

**When leaderboard is disabled:**
- Your data is completely private
- You can still view the leaderboard but won't appear on it
- You can re-enable participation at any time

## Data Sources

PromptPulse reads your Claude Code usage data from:
- `~/.claude/projects/**/*.jsonl` (default location)
- `$CLAUDE_CONFIG_DIR/projects/**/*.jsonl` (if custom path set)

This includes:
- Token usage (input, output, cache creation, cache read)
- Model information and pricing
- Timestamps and session data
- Cost calculations

## Multi-User Support

### How It Works
- Each user has a unique API key for authentication
- All data is completely isolated between users
- Multiple team members can track usage independently
- Machines can be shared or user-specific

### Use Cases
- **Teams** - Each developer tracks their own Claude usage
- **Freelancers** - Separate usage by client projects
- **Personal** - Track usage across work and personal machines

## Security & Privacy

- 🔐 API keys provide secure authentication
- 🏠 All data is isolated per user account
- 🌐 Hosted service - no local database required
- 📝 Logs contain no sensitive information
- 🚫 No personal data beyond usage statistics

## CLI Commands Reference

### User Commands
```bash
promptpulse user init                              # Create account
promptpulse user whoami                           # Show current user
promptpulse user config show                      # Show API key
promptpulse user config set api-key <key>         # Set API key
```

### Data Collection
```bash
promptpulse collect                               # Collect all data
promptpulse collect --granularity <type>         # Collect specific data
```

### Aliases
You can use `ppulse` as a shorthand for `promptpulse` in all commands.

## Support

### Common Issues

1. **"No usage data found"** - Ensure you have used Claude Code and data exists in `~/.claude/projects/`
2. **"Authentication failed"** - Check your API key with `promptpulse user whoami`
3. **"Connection error"** - Verify your internet connection and try again

### Getting Help

- Use `promptpulse --help` for command documentation
- Check your API key is valid with `promptpulse user whoami`
- Ensure you have Claude Code usage data in `~/.claude/projects/`

## Contributing

Contributions are welcome! Please:

1. Fork the repository at [github.com/eharris128/promptpulse](https://github.com/eharris128/promptpulse)
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE.md for details

---

**Ready to get started?** Run `promptpulse user init` and start tracking your Claude Code usage today!