---
title: "Dashboard Guide"
linkTitle: "Dashboard"
weight: 3
description: "Web dashboard features and usage"
---

# Dashboard Guide

The PromptPulse dashboard provides a comprehensive web interface for viewing your Claude Code usage analytics, managing teams, and configuring settings.

## Accessing the Dashboard

Open the dashboard from the command line:

```bash
promptpulse dashboard
```

Or visit directly at your configured dashboard URL.

## Authentication

The dashboard requires your API key for authentication:

1. Enter your API key in the login form
2. The key is stored securely in your browser
3. Use `promptpulse whoami` to find your API key if needed

## Main Features

### Usage Statistics

View comprehensive usage analytics:

- **Token Usage**: Daily, weekly, and monthly token consumption
- **Cost Tracking**: Detailed cost analysis across models
- **Session Analytics**: Session duration and activity patterns
- **Model Breakdown**: Usage statistics by Claude model

### Usage Charts

Interactive charts showing:

- Time-series usage data
- Model usage distribution
- Cost trends over time
- Session activity patterns

### Machine Management

Manage multiple machines:

- View all connected machines
- See last collection times
- Monitor machine-specific usage
- Identify inactive machines

### Project Analytics

Project-level insights:

- Usage by project (respects privacy settings)
- Project activity timelines
- Session counts per project
- Popular project patterns

## Leaderboards

### Public Leaderboard

Optional participation in public rankings:

- Set a display name for privacy
- Compare with other users
- Track your ranking position
- Opt in/out at any time

### Team Leaderboards

Team-specific competitions:

- Create and join teams
- Team usage rankings
- Collaborative analytics
- Role-based permissions

## Team Management

### Creating Teams

1. Navigate to Teams section
2. Click "Create Team"
3. Set team name and description
4. Configure privacy settings

### Inviting Members

1. Generate invite links
2. Share with team members
3. Manage member roles
4. Monitor team activity

### Team Roles

- **Owner**: Full team management permissions
- **Admin**: Can invite members and manage settings
- **Member**: View team analytics and participate

## Settings

### Privacy Settings

Control your data sharing:

- **Public Leaderboard**: Opt in/out of public rankings
- **Display Name**: Set public display name
- **Team Display Name**: Separate name for team contexts
- **Project Privacy**: Configure project path sharing

### Email Preferences

Manage email notifications:

- Weekly usage reports
- Monthly summaries
- Team notifications
- Security alerts
- Product updates

### Account Management

- View account information
- Manage API keys
- Update profile settings
- Delete account (if needed)

## Analytics Features

### Usage Blocks

Detailed usage tracking:

- Individual coding blocks
- Block duration and token usage
- Cost per block
- Model usage per block

### Session Analysis

Session-level insights:

- Session start/end times
- Total session duration
- Blocks per session
- Session cost analysis

### Cost Management

Financial tracking:

- Daily/weekly/monthly costs
- Cost per model
- Usage efficiency metrics
- Budget tracking tools

## Mobile Responsiveness

The dashboard is fully responsive:

- Mobile-optimized layouts
- Touch-friendly interfaces
- Responsive charts and tables
- Mobile navigation menus

## Data Export

Export your data:

- CSV exports of usage data
- JSON data dumps
- Custom date ranges
- Filtered exports

## Troubleshooting

### Common Issues

1. **API Key Issues**
   - Ensure API key is correct
   - Try logging out and back in via CLI
   - Check `promptpulse whoami`

2. **Missing Data**
   - Run `promptpulse collect` to update data
   - Check collection status with `promptpulse status`
   - Verify automatic collection is working

3. **Team Problems**
   - Ensure you have proper permissions
   - Check invite link validity
   - Contact team owner if needed

### Browser Support

Supported browsers:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Performance

For optimal performance:
- Use modern browsers
- Clear browser cache if needed
- Ensure stable internet connection
- Close unused browser tabs