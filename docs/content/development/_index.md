---
title: "Development"
linkTitle: "Development"
weight: 6
description: "Contributing to PromptPulse development"
---

# Development Guide

Welcome to PromptPulse development! This guide covers everything you need to know about contributing to the project.

## Quick Start

### Prerequisites

- Node.js 18.0.0 or higher
- npm or yarn
- Git
- SQLite Cloud account (for database)

### Development Setup

```bash
# Clone the repository
git clone https://github.com/eharris128/promptpulse.git
cd promptpulse

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
npm run migrate

# Start development environment
npm run dev
```

This starts both the API server (port 3000) and the dashboard (port 3001).

## Project Architecture

### Core Components

- **CLI Tool** (`bin/promptpulse.js`) - Command-line interface
- **API Server** (`server.js`) - Express.js backend
- **Dashboard** (`client/`) - Next.js frontend
- **Library** (`lib/`) - Shared utilities

### Directory Structure

```
promptpulse/
├── bin/                    # CLI executable
├── lib/                    # Core libraries
├── client/                 # Next.js dashboard
├── routes/                 # API routes
├── migrations/             # Database migrations
├── scripts/                # Development scripts
└── docs/                   # Hugo documentation
```

## Development Commands

### Core Development

```bash
# Full development (API + dashboard)
npm run dev

# API server only
npm run server:dev

# Dashboard only
npm run client:dev

# Run tests
npm test

# Database migrations
npm run migrate
```

### CLI Development

```bash
# Link CLI for global testing
npm link

# Test CLI commands
promptpulse --help
promptpulse doctor
```

### Documentation

```bash
# Build documentation
cd docs && hugo

# Serve documentation locally
cd docs && hugo server

# Build for production
cd docs && hugo --minify
```

## Code Style

### JavaScript/Node.js

- Use ES modules (`type: "module"` in package.json)
- Prefer async/await over callbacks
- Use consistent error handling
- Follow Express.js middleware patterns

### React/Next.js

- Use TypeScript for type safety
- Follow React hooks patterns
- Use Tailwind CSS for styling
- Implement proper error boundaries

### Database

- Use modular migrations
- Implement proper indexes
- Use KSUID for primary keys
- Follow data isolation patterns

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test files
npm test -- --grep "auth"

# Run with coverage
npm run test:coverage
```

### Test Structure

- Unit tests in `__tests__/` directories
- Integration tests for API endpoints
- End-to-end tests for CLI commands
- Browser tests for dashboard features

## Database Development

### Migrations

Create new migrations:

```bash
# Create new migration file
touch migrations/007_new_feature.sql
```

Migration file structure:

```sql
-- Migration: 007_new_feature.sql
-- Description: Add new feature support

-- Up migration
CREATE TABLE new_feature (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Down migration (for rollbacks)
-- DROP TABLE new_feature;
```

### Database Schema

Key tables:

- `users` - User accounts with KSUID IDs
- `usage_data` - Token usage and costs
- `teams` - Team information
- `team_members` - Team membership
- `email_preferences` - Notification settings

## API Development

### Adding New Endpoints

1. Create route file in `routes/`
2. Implement authentication middleware
3. Add proper error handling
4. Update API documentation

Example route:

```javascript
// routes/new-feature.js
import express from 'express';
import { authenticateUser } from '../lib/server-auth.js';

const router = express.Router();

router.get('/new-feature', authenticateUser, async (req, res) => {
    try {
        // Implementation here
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
```

### Authentication

All API endpoints require authentication:

```javascript
import { authenticateUser } from '../lib/server-auth.js';

// Apply to routes
router.use(authenticateUser);
```

## Dashboard Development

### Adding New Pages

1. Create page in `client/src/app/`
2. Add navigation links
3. Implement authentication checks
4. Add responsive design

### Component Structure

```typescript
// client/src/components/feature/new-component.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/auth-context';

export default function NewComponent() {
    const { user, apiKey } = useAuth();
    
    // Component implementation
    
    return (
        <div className="space-y-4">
            {/* Component JSX */}
        </div>
    );
}
```

## CLI Development

### Adding New Commands

1. Add command in `bin/promptpulse.js`
2. Implement logic in `lib/` modules
3. Add proper error handling
4. Update help documentation

Example command:

```javascript
// bin/promptpulse.js
program
    .command('new-feature')
    .description('Description of new feature')
    .option('-v, --verbose', 'Verbose output')
    .action(async (options) => {
        try {
            await newFeatureHandler(options);
        } catch (error) {
            console.error('Error:', error.message);
            process.exit(1);
        }
    });
```

## Deployment

### API Server Deployment

The API server can be deployed to:

- Railway
- Heroku
- DigitalOcean App Platform
- AWS/GCP/Azure

Environment variables required:

```bash
DATABASE_URL=your_sqlite_cloud_url
NODE_ENV=production
PORT=3000
```

### Dashboard Deployment

The dashboard can be deployed to:

- Vercel (recommended)
- Netlify
- AWS Amplify

Configure build settings:

```json
{
    "buildCommand": "npm run build",
    "outputDirectory": ".next",
    "installCommand": "npm install"
}
```

## Contributing

### Pull Request Process

1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Update documentation
5. Submit pull request

### Code Review Guidelines

- All code must pass CI/CD checks
- Include tests for new features
- Update documentation as needed
- Follow existing code patterns
- Ensure backward compatibility

### Issue Reporting

When reporting issues:

1. Use issue templates
2. Provide reproduction steps
3. Include environment details
4. Add relevant logs/screenshots

## Security

### Security Considerations

- Never commit API keys or secrets
- Use proper input validation
- Implement rate limiting
- Follow OWASP guidelines
- Regular dependency updates

### Reporting Security Issues

Report security vulnerabilities to:

- Email: security@promptpulse.dev
- Follow responsible disclosure
- Provide detailed reproduction steps

## Release Process

### Version Management

```bash
# Update version
npm version patch|minor|major

# Build and test
npm run build
npm test

# Publish to npm
npm publish

# Tag release on GitHub
git push --tags
```

### Release Checklist

- [ ] Update version numbers
- [ ] Update CHANGELOG.md
- [ ] Run full test suite
- [ ] Update documentation
- [ ] Test deployment
- [ ] Publish to npm
- [ ] Create GitHub release
- [ ] Announce release

## Getting Help

### Development Questions

- Check existing documentation
- Search GitHub issues
- Ask in discussions
- Contact maintainers

### Resources

- [Project README](https://github.com/eharris128/promptpulse#readme)
- [Contributing Guidelines](https://github.com/eharris128/promptpulse/blob/master/CONTRIBUTING.md)
- [Code of Conduct](https://github.com/eharris128/promptpulse/blob/master/CODE_OF_CONDUCT.md)