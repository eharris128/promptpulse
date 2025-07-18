# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PromptPulse v1.1.2 is a comprehensive analytics and leaderboard platform for Claude Code usage tracking. It provides:
- CLI tool for data collection and management
- Web dashboard for analytics and team collaboration
- API server for data processing and storage
- Team management with role-based permissions
- Privacy-focused usage analytics

## Build Commands

- `npm start` - Start the API server (production)
- `npm run dev` - Start both server and client in development mode
- `npm run server:dev` - Start only the API server with watch mode
- `npm run server:test` - Start API server with test environment
- `npm run client:dev` - Start only the Next.js dashboard in development
- `npm run migrate` - Run database migrations 
- `npm test` - Run E2E test suite
- `npm run test:e2e` - Run E2E tests with Playwright
- `npm run test:e2e:ui` - Run E2E tests with Playwright UI
- `npm run test:e2e:debug` - Run E2E tests in debug mode
- `npm pack` - Create package tarball for testing
- `npm publish` - Publish public package to npm

## Database Migration Commands (Goose)

### Installation
```bash
go install github.com/pressly/goose/v3/cmd/goose@latest
```

### Core Migration Commands
- `goose sqlite3 database.db status` - Show migration status
- `goose sqlite3 database.db up` - Apply all pending migrations
- `goose sqlite3 database.db up-by-one` - Apply next migration only
- `goose sqlite3 database.db down` - Rollback last migration
- `goose sqlite3 database.db down-to VERSION` - Rollback to specific version
- `goose sqlite3 database.db reset` - Rollback all migrations
- `goose sqlite3 database.db version` - Show current migration version
- `goose sqlite3 database.db create MIGRATION_NAME sql` - Create new migration

### Migration Directory
- Migration files are located in `goose_migrations/`
- Files follow format: `YYYYMMDDHHMMSS_description.sql`
- Each file contains `-- +goose Up` and `-- +goose Down` sections

### SQLite Cloud Migration Support
For SQLite Cloud deployments, use the custom migration runner:
```bash
# Run migrations on SQLite Cloud (recommended)
npm run migrate

# Show migration status
make migrate-status

# Create new migration file
make migrate-create
```

### Legacy System Migration (One-time)
If migrating from the old custom migration system to Goose:
```bash
# Transfer migration tracking data to Goose
node scripts/migrate-to-goose.js

# Verify successful transfer
npm run migrate

# Archive old migration system (after verification)
mv migrations migrations.old
```

## CLI Commands

### Core Commands
- `promptpulse` or `ppulse` - Main CLI tool for usage tracking
- `promptpulse login` - Create new account (interactive) or login with API key
- `promptpulse logout` - Clear authentication and log out
- `promptpulse whoami` - Show current user information
- `promptpulse collect` - Collect and upload Claude Code usage data
- `promptpulse setup` - Configure automatic data collection with cron
- `promptpulse status` - Show collection status and health information
- `promptpulse doctor` - Diagnose common collection issues and system health
- `promptpulse dashboard` - Open web dashboard in browser

### Team Management (Dashboard Only)
Team features are managed through the web dashboard:
- Create and manage teams with customizable names and descriptions
- Invite team members via shareable invite links
- Role-based permissions (owner, admin, member)
- Team usage leaderboards and collaboration analytics
- Join teams using invite codes

## Development Environment

### Full Development Setup
```bash
npm run dev  # Starts both server (port 3000) and client (port 3001)
```

### Individual Components
```bash
npm run server:dev  # API server only at http://localhost:3000
npm run client:dev  # Dashboard only at http://localhost:3001
```

### Database Management
```bash
npm run migrate     # Apply database migrations
node check-db.js    # Test database connectivity
```

### CLI Diagnostic Commands
```bash
promptpulse status   # Check collection status and health
promptpulse doctor   # Diagnose issues and system health
promptpulse setup    # Set up automatic collection with cron
```

## Code Style Guidelines

- Use ES modules (type: "module" in package.json)
- Node.js version requirement (>=18.0.0)
- Prefer async/await for asynchronous operations
- Use consistent error handling with proper HTTP status codes
- Follow Express.js middleware patterns for API routes
- Use React/Next.js conventions for dashboard components
- Implement proper authentication checks for all API endpoints

## Project Architecture

### Core Components
- **CLI Tool** (`bin/promptpulse.js`) - Command-line interface
- **API Server** (`server.js`) - Express.js backend with authentication
- **Dashboard** (`client/`) - Next.js frontend application with team management
- **Library** (`lib/`) - Shared utilities and core logic

### Key Directories
- `lib/` - Core CLI and server utilities
- `bin/` - CLI entry point and executable
- `client/src/` - Next.js application source
- `goose_migrations/` - Goose database schema migrations with Up/Down sections
- `logs/` - Application logs and upload tracking

### Database Schema (Modernized)
- **Users**: KSUID-based user IDs with secure API key authentication
- **Usage Data**: Token usage, costs, sessions, and billing blocks
- **Email Preferences**: Granular notification controls (5 separate preferences)
- **Teams**: KSUID-based team system with role hierarchy
- **Team Members**: Many-to-many relationships with owner/admin/member roles
- **Team Invitations**: Secure invitation system with expiring tokens

## Project Conventions

### Authentication & Security
- All API endpoints require X-API-Key header authentication
- User data is completely isolated by API key
- No sensitive data in logs or error messages
- API keys are generated securely and stored in ~/.promptpulse/config.json

### Data Collection & Privacy
- **Usage Statistics**: Token counts, costs, timestamps, model usage
- **Project Paths**: Derived from Claude Code session IDs (configurable privacy levels)
- **Machine Identifiers**: Hostname or custom MACHINE_ID for multi-device tracking
- **Team Data**: Team membership, roles, and aggregated team usage (no individual data shared)
- **No Content Collection**: Prompts and conversation content are NEVER uploaded or stored

#### Project Path Privacy Controls
Set `PROJECT_PATH_PRIVACY` environment variable to control project path collection:
- `basename` (default): Only project folder names (e.g., `/my-project`)
- `full`: Complete project paths (e.g., `/home/user/work/company/my-project`)
- `hash`: Hashed paths for analytics without revealing structure
- `none`: No project path collection

```bash
# Examples
export PROJECT_PATH_PRIVACY=basename  # Most private, still useful
export PROJECT_PATH_PRIVACY=none      # Maximum privacy
export PROJECT_PATH_PRIVACY=hash      # Analytics-friendly privacy
```

### Data Collection
- Reads Claude Code usage from ~/.claude/projects/**/*.jsonl
- Supports multiple granularities: daily, session, blocks, all
- Implements deduplication to prevent duplicate uploads
- Maintains upload logs for debugging and tracking
- Automatic collection via cron with configurable intervals (15, 30, 60 minutes, or daily)
- Collection logs stored in ~/.promptpulse/collection.log

### Multi-User Support
- Each user has isolated data access
- Support for multiple machines per user
- Leaderboard participation is opt-in (both public and team leaderboards)
- Display names for privacy in public rankings
- Separate team display names for team contexts
- Team-based collaboration with role management
- Team invite system with secure invite codes

### Database Patterns
- Use SQLite Cloud for hosted database access
- All tables include user_id for data isolation
- KSUID-based primary keys for teams (string IDs instead of integers)
- Goose migration system with rollback support and sequential migration files
- Implement proper indexes for query performance
- Use migrations for schema changes with rollback support

### API Design
- RESTful endpoints with consistent response formats
- Proper HTTP status codes for all responses
- Rate limiting for production deployment
- CORS configuration for dashboard access

### Dashboard Features
- Authentication via API key input
- Real-time usage statistics and charts
- Machine management and session tracking
- Privacy-controlled leaderboard participation
- **Team Management**: Create teams, invite members, manage roles
- **Team Leaderboards**: Compare usage within teams
- **Team Collaboration**: Share invite links, role-based permissions
- **Granular Email Preferences**: 5 separate notification controls
- Dark mode support


## Development Workflow

### Adding New Features
1. Update database schema with migration if needed
2. Implement API endpoints with authentication
3. Add CLI commands if applicable
4. Update dashboard UI components
5. Test end-to-end functionality

### E2E API Testing
```bash
npm test                    # Run full E2E test suite
npm run test:e2e           # Run E2E tests with Playwright
npm run test:e2e:ui        # Run tests with Playwright UI
npm run test:e2e:debug     # Run tests in debug mode
```

#### Test Coverage
The E2E test suite covers all 35+ API endpoints:
- **Authentication**: API key validation, user lookup
- **Health & Metrics**: Server health, database connectivity, metrics
- **User Management**: User creation, settings, email preferences
- **Usage Data**: Collection, aggregation, sessions, projects, analytics
- **Team Management**: Creation, invitations, member management, roles
- **Leaderboards**: Public and team leaderboards with privacy controls
- **Machines**: Multi-device usage tracking

#### Test Environment Setup
1. Configure `.env.test` with test database credentials
2. Tests automatically set up/tear down test database
3. Isolated test users with known API keys
4. Database migrations applied automatically
5. Test data seeded for consistent scenarios

#### Adding New Tests
When adding new API endpoints:
1. Add test cases to appropriate file in `tests/e2e/api/`
2. Follow existing patterns for authentication and validation
3. Test both success and error scenarios
4. Verify user data isolation
5. Run full test suite to ensure no regressions

### Testing Data Collection
```bash
promptpulse collect --granularity all  # Test full collection
promptpulse whoami                      # Verify authentication
promptpulse status                      # Check collection health
promptpulse doctor                      # Diagnose any issues
```

### Automatic Collection Setup
```bash
promptpulse setup                       # Set up 15-minute collection (default)
promptpulse setup --interval 30         # Set up 30-minute collection
promptpulse setup --interval 60         # Set up hourly collection
promptpulse setup --interval daily      # Set up daily collection (9 AM)
promptpulse setup --remove              # Remove automatic collection
```

### Package Management
- Published as `promptpulse` (public unscoped package)
- Use .npmignore to exclude development files
- Test packaging with `npm pack` before publishing

## Environment Variables

### Required
- `DATABASE_URL` - SQLite Cloud connection string

### Optional Server Configuration
- `MACHINE_ID` - Custom machine identifier (defaults to hostname)
- `PORT` - API server port (defaults to 3000)
- `NODE_ENV` - Environment mode (development/production)

### Database Connection Pool
- `DB_MAX_CONNECTIONS` - Maximum database connections (default: 10)
- `DB_IDLE_TIMEOUT` - Connection idle timeout in ms (default: 30000)
- `DB_RETRY_ATTEMPTS` - Database retry attempts on failure (default: 3)
- `DB_RETRY_DELAY` - Base retry delay in ms (default: 1000)

### Logging Configuration
- `LOG_LEVEL` - Logging level: error, warn, info, debug (default: info in production, debug in development)

### Email Configuration
- `RESEND_API_KEY` - Resend API key for email functionality (required for email features)
- `EMAIL_FROM_DOMAIN` - Domain for sender email addresses (default: mail.promptpulse.dev)
  - Uses format: `PromptPulse <noreply@{EMAIL_FROM_DOMAIN}>`
  - Recommended: Set up a Resend subdomain like `mail.promptpulse.dev`

### Team Configuration
- Teams use KSUID string IDs for better scalability
- Invite codes are automatically generated for team sharing
- Role hierarchy: owner > admin > member
- Team leaderboards are separate from public leaderboards


## Common Tasks

### Local Development
1. Set up .env file with DATABASE_URL
2. Run `npm run migrate` to set up database
3. Use `npm run dev` for full development environment
4. Test CLI with `npm link` for global installation


### Deployment
- API server can be deployed to any Node.js platform (Railway recommended)
- Dashboard can be deployed to Railway, Netlify, or self-hosted
- Ensure environment variables are configured
- Run migrations before first deployment