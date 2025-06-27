# PromptPulse Development Guide

## 🚀 Quick Start

The easiest way to get started with PromptPulse development:

```bash
# 1. Setup environment
make setup

# 2. Install dependencies  
make install

# 3. Start full development environment
make dev
```

That's it! Both services will be running and ready for development.

## 📋 Available Commands

### Development Commands

| Command | Description |
|---------|-------------|
| `make dev` | Start full development environment (API + Client) |
| `make start-api` | Start only Node.js API server |
| `make start-client` | Start only Next.js client |

### Setup Commands

| Command | Description |
|---------|-------------|
| `make setup` | Setup environment files and configuration |
| `make install` | Install all dependencies |
| `make check-deps` | Check system dependencies |

### Testing Commands

| Command | Description |
|---------|-------------|
| `make test` | Run all tests |
| `make test-api` | Test Node.js API only |

### Management Commands

| Command | Description |
|---------|-------------|
| `make health` | Check health of all services |
| `make logs` | Show logs from all services |
| `make stop` | Stop all running services |
| `make clean` | Clean up processes and temporary files |

## 🌐 Service URLs

When running the development environment:

- **API Server**: http://localhost:3000
- **Client Dashboard**: http://localhost:3001

## 🔗 Quick Links

- **Dashboard**: http://localhost:3001
- **API Health**: http://localhost:3000/health

## 📁 Project Structure

```
promptpulse/
├── bin/
│   └── promptpulse.js           # CLI entry point
├── lib/
│   ├── collect.js               # Core data collection
│   └── config.js               # Configuration utilities
├── server.js                   # Express API server
├── client/                     # Next.js dashboard
├── migrations/                 # Database migrations
├── scripts/
│   ├── start-dev.sh            # Development startup
│   ├── start-api.sh            # API server only
│   └── start-client.sh         # Client only
└── logs/
    ├── pids/                   # Process ID files
    ├── api-server.log
    └── client.log
```

## ⚙️ Configuration

### Environment Files

- **`.env`** - Main configuration (API server, database)
- **`client/.env.local`** - Next.js client configuration

### Required Environment Variables

```bash
# Database
DATABASE_URL=your_sqlite_cloud_url

# API Server
PORT=3000
NODE_ENV=development

# Optional
MACHINE_ID=your-machine-name
LOG_LEVEL=info
```

## 🐛 Troubleshooting

### Common Issues

1. **Port already in use**:
   ```bash
   make stop  # Stop all services
   make clean # Clean up processes
   ```

2. **Database connection issues**:
   - Check your `DATABASE_URL` in `.env`
   - Ensure SQLite Cloud database is accessible

3. **Services not starting**:
   ```bash
   make check-deps  # Check dependencies
   make health      # Check service status
   ```

## 🧪 Testing

### Running Tests

```bash
# All tests
make test

# API tests only  
make test-api

# Manual API test
curl http://localhost:3000/health
```

### Test Structure

- API endpoint tests
- Database integration tests
- CLI functionality tests

## 🚀 Deployment

### Building for Production

```bash
# Build both services
make build

# Or build individually
npm run build              # API server
cd client && npm run build # Dashboard
```

### Environment Setup

```bash
# Production environment variables
NODE_ENV=production
PORT=3000
DATABASE_URL=your_production_db_url
```

## 🔄 Development Workflow

### Making Changes

1. **API Changes**:
   - Edit `server.js` or files in `lib/`
   - Server auto-restarts with nodemon
   - Test with `curl` or dashboard

2. **Dashboard Changes**:
   - Edit files in `client/src/`
   - Client auto-reloads with Next.js
   - View changes at http://localhost:3001

3. **Database Changes**:
   - Create new migration in `migrations/`
   - Run `npm run migrate`

### CLI Development

```bash
# Link for global testing
npm link

# Test CLI commands
promptpulse collect
promptpulse dashboard
```

## 📝 Adding Features

### New API Endpoints

1. Add route to `server.js`
2. Add authentication if needed
3. Test with curl/Postman
4. Update dashboard if needed

### New Dashboard Pages

1. Create component in `client/src/app/`
2. Add navigation if needed
3. Connect to API endpoints
4. Test responsive design

## 📚 Additional Resources

- **API Documentation**: See inline JSDoc comments
- **Component Library**: Uses shadcn/ui components
- **Database**: SQLite Cloud hosted database

**Happy developing! 🚀 The PromptPulse development environment is designed to be simple and powerful.**