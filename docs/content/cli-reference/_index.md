---
title: "CLI Reference"
linkTitle: "CLI Reference"
weight: 2
description: "Complete command-line interface documentation"
---

# CLI Reference

PromptPulse provides a comprehensive command-line interface for managing your Claude Code usage analytics.

## Core Commands

### `promptpulse` / `ppulse`

The main CLI command. Can be used in short form as `ppulse`.

### Authentication Commands

#### `promptpulse login`

Create a new account or login with an existing API key.

```bash
# Interactive account creation
promptpulse login

promptpulse login
```


#### `promptpulse logout`

Clear authentication and log out.

```bash
promptpulse logout
```

#### `promptpulse whoami`

Show current user information.

```bash
promptpulse whoami
```

### Data Collection Commands

#### `promptpulse collect`

Collect and upload Claude Code usage data.

```bash
# Collect all available data
promptpulse collect

# Collect specific granularity
promptpulse collect --granularity daily
promptpulse collect --granularity session
promptpulse collect --granularity blocks
```

**Options:**
- `--granularity` - Data collection granularity (all, daily, session, blocks)

#### `promptpulse setup`

Configure automatic data collection with cron.

```bash
# Set up 15-minute collection (default)
promptpulse setup

# Set up 30-minute collection
promptpulse setup --interval 30

# Set up hourly collection
promptpulse setup --interval 60

# Set up daily collection (9 AM)
promptpulse setup --interval daily

# Remove automatic collection
promptpulse setup --remove
```

**Options:**
- `--interval` - Collection interval (15, 30, 60, daily)
- `--remove` - Remove automatic collection

### Monitoring Commands

#### `promptpulse status`

Show collection status and health information.

```bash
promptpulse status
```

#### `promptpulse doctor`

Diagnose common collection issues and system health.

```bash
promptpulse doctor
```

### Dashboard Command

#### `promptpulse dashboard`

Open the web dashboard in your browser.

```bash
promptpulse dashboard
```

## Environment Variables

### Privacy Controls

#### `PROJECT_PATH_PRIVACY`

Control project path collection privacy:

```bash
# Only project folder names (default)
export PROJECT_PATH_PRIVACY=basename

# Complete project paths
export PROJECT_PATH_PRIVACY=full

# Hashed paths for analytics
export PROJECT_PATH_PRIVACY=hash

# No project path collection
export PROJECT_PATH_PRIVACY=none
```

#### `MACHINE_ID`

Custom machine identifier:

```bash
export MACHINE_ID=my-work-laptop
```

## Configuration

Configuration is stored in `~/.promptpulse/config.json`:

```json
{
  "apiKey": "your-api-key",
  "userId": "user-id",
  "machine": "hostname"
}
```

## Data Collection Details

### Claude Code Data Sources

PromptPulse reads usage data from:
- `~/.claude/projects/**/*.jsonl`

### Collected Data

- **Usage Statistics**: Token counts, costs, timestamps
- **Project Paths**: Configurable privacy levels
- **Machine Identifiers**: Hostname or custom MACHINE_ID
- **Session Data**: Claude Code session information

### Privacy Guarantees

- **No Content Collection**: Prompts and conversations are NEVER collected
- **Isolated Data**: Each user's data is completely isolated
- **Configurable Privacy**: Control what project information is shared

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   ```bash
   promptpulse logout
   promptpulse login
   ```

2. **Collection Issues**
   ```bash
   promptpulse doctor
   promptpulse status
   ```

3. **Cron Setup Problems**
   ```bash
   promptpulse setup --remove
   promptpulse setup
   ```

### Debug Information

All operations log to `~/.promptpulse/collection.log` for debugging.