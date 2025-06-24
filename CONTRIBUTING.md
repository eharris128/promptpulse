# Contributing to PromptPulse

Thank you for your interest in contributing to PromptPulse! This guide will help you get started with contributing to our Claude Code usage analytics platform.

## Quick Start

PromptPulse is a SaaS service with three main components:
- **CLI Package** - Published to npm for end users
- **API Server** - Hosted on Railway for data collection
- **Dashboard** - Hosted on Vercel for analytics visualization

## Ways to Contribute

### Bug Reports
- Use GitHub Issues to report bugs
- Include steps to reproduce, expected vs actual behavior
- Mention your environment (OS, Node version, CLI version)

### Feature Requests
- Open an issue with the "enhancement" label
- Describe the use case and expected benefit
- Consider implementation complexity and user impact

### Code Contributions
- Fix bugs, improve performance, or add features
- Follow our coding standards and testing practices
- Submit pull requests with clear descriptions

### Documentation
- Improve README, add examples, or fix typos
- Update CLI help text or error messages
- Create tutorials or usage guides

## Development Setup

### Prerequisites
- Node.js 18+ 
- Git
- SQLite Cloud account (for database access)
- Basic knowledge of TypeScript/React

### 1. Fork and Clone
```bash
git clone https://github.com/your-username/promptpulse.git
cd promptpulse
npm install
```

### 2. Environment Setup
```bash
# Copy example environment file
cp .env.example .env

# Set up your development database URL
# Get a free SQLite Cloud account at: https://sqlitecloud.io
export DATABASE_URL="sqlitecloud://your-connection-string"
```

### 3. Database Setup
```bash
# Run migrations to set up tables
npm run migrate
```

### 4. Development Workflow
```bash
# Start both API server and dashboard
npm run dev

# Or start individually:
npm start                    # API server on :3000
cd client && npm run dev     # Dashboard on :3001
```

### 5. CLI Development
```bash
# Link CLI globally for testing
npm link

# Test CLI commands
promptpulse --help
promptpulse user init
```

## Project Structure

```
promptpulse/
├── bin/                     # CLI entry points
├── lib/                     # Core CLI library code
│   ├── auth.js             # Authentication utilities
│   ├── collect.js          # Data collection logic
│   ├── config.js           # Service configuration
│   └── user-cli.js         # User management
├── client/                  # Next.js dashboard
│   ├── src/
│   │   ├── app/            # Next.js app directory
│   │   ├── components/     # React components
│   │   ├── lib/            # Client utilities
│   │   └── types/          # TypeScript definitions
│   └── package.json
├── migrations/              # Database schema migrations
├── server.js               # Express API server
├── package.json            # Main package configuration
└── README.md
```

## Development Guidelines

### Code Style
- **TypeScript**: Use strict typing for new code
- **ESLint**: Follow existing linting rules
- **Formatting**: Use consistent indentation (2 spaces)
- **Comments**: Add JSDoc for public APIs

### Naming Conventions
- **Files**: Use kebab-case for files (`api-client.ts`)
- **Components**: Use PascalCase (`LoginForm.tsx`)
- **Functions**: Use camelCase (`sanitizeApiKey`)
- **Constants**: Use SCREAMING_SNAKE_CASE (`API_ENDPOINT`)

### Security Standards
- **Input Sanitization**: Always sanitize user inputs
- **API Keys**: Never log or expose API keys
- **SQL Injection**: Use parameterized queries
- **CORS**: Maintain strict CORS policies

### Testing
- Test CLI commands with sample data
- Verify API endpoints with different inputs
- Check dashboard functionality across browsers
- Test error handling and edge cases

## Pull Request Process

### 1. Create a Feature Branch
```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

### 2. Make Your Changes
- Follow coding standards
- Add tests for new functionality
- Update documentation as needed
- Ensure all existing tests pass

### 3. Commit Your Changes
```bash
# Use descriptive commit messages
git commit -m "Add API key sanitization for login form

- Implement sanitizeApiKey() utility function
- Add real-time input sanitization
- Include security protections against XSS"
```

### 4. Submit Pull Request
- Push your branch and create a PR
- Fill out the PR template completely
- Link any related issues
- Request review from maintainers

### PR Requirements
- **Tests**: All tests pass  
- **Linting**: No ESLint errors  
- **Documentation**: Updated if needed  
- **Security**: No sensitive data exposed  
- **Backwards Compatibility**: CLI changes don't break existing usage  

## Testing

### CLI Testing
```bash
# Test data collection
promptpulse collect --granularity daily

# Test user management
promptpulse user whoami
promptpulse user config show
```

### API Testing
```bash
# Health check
curl https://exciting-patience-production.up.railway.app/health

# Test with API key
curl -H "X-API-Key: your-key" \
  https://exciting-patience-production.up.railway.app/api/machines
```

### Dashboard Testing
1. Open http://localhost:3001
2. Test login with valid/invalid API keys
3. Verify all dashboard features work
4. Test responsive design on mobile

## Release Process

### Version Bumping
```bash
# Patch release (bug fixes)
npm version patch

# Minor release (new features)
npm version minor

# Major release (breaking changes)
npm version major
```

### Publishing
1. Update CHANGELOG.md with changes
2. Test CLI package locally: `npm pack && npm install -g ./promptpulse-x.x.x.tgz`
3. Publish to npm: `npm publish`
4. Create GitHub release with changelog

## Recognition

Contributors will be:
- Added to the contributors list in README.md
- Mentioned in release notes for significant contributions
- Invited to join the core team for sustained contributions

## Getting Help

### Development Questions
- Open a GitHub Discussion for design questions
- Join our Discord community (link in README)
- Tag maintainers in issues for urgent questions

### Stuck on Setup?
1. Check the troubleshooting section in README.md
2. Search existing issues for similar problems
3. Create a new issue with your environment details

## Code of Conduct

- **Be Respectful**: Treat all contributors with respect
- **Be Constructive**: Provide helpful feedback on PRs
- **Be Patient**: Remember maintainers are volunteers
- **Be Inclusive**: Welcome contributors of all skill levels

## Design Philosophy

### User Experience First
- CLI should be intuitive and helpful
- Dashboard should be fast and beautiful
- Error messages should be clear and actionable

### Privacy by Default
- Users opt-in to leaderboards
- No personal data beyond usage stats
- Transparent about data collection

### Performance & Cost
- Efficient API usage to control hosting costs
- Fast dashboard loading times
- Minimal resource usage for CLI

---

**Ready to contribute?** Start by checking our [good first issue](https://github.com/eharris128/promptpulse/labels/good%20first%20issue) label!

Thank you for helping make PromptPulse better!