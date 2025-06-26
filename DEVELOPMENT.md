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

That's it! All services will be running and ready for development.

## 📋 Available Commands

### Development Commands

| Command | Description |
|---------|-------------|
| `make dev` | Start full development environment (API + Client + Environmental) |
| `make start-env` | Start only environmental service |
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
| `make test` | Run tests for both services |
| `make test-env` | Test environmental service only |
| `make test-api` | Test Node.js API only |

### Management Commands

| Command | Description |
|---------|-------------|
| `make health` | Check health of all services |
| `make logs` | Show logs from all services |
| `make stop` | Stop all running services |
| `make clean` | Clean up processes and temporary files |

### Database Commands

| Command | Description |
|---------|-------------|
| `make migrate` | Run database migrations |
| `make db-reset` | Reset database (development only) |

## 🌐 Service URLs

When running the development environment:

- **Client Dashboard**: http://localhost:3001
- **API Server**: http://localhost:3000
- **Environmental Service**: http://localhost:5000

### Health Check URLs

- **API Health**: http://localhost:3000/health
- **Environmental Health**: http://localhost:5000/health
- **Environmental Methodology**: http://localhost:5000/methodology

## 📁 Project Structure

```
promptpulse/
├── Makefile                    # Main development commands
├── scripts/                    # Helper scripts
│   ├── start-dev.sh           # Start full environment
│   ├── start-environmental.sh # Start Python service
│   ├── start-api.sh           # Start Node.js API
│   ├── start-client.sh        # Start Next.js client
│   ├── stop-services.sh       # Stop all services
│   ├── check-health.sh        # Health check all services
│   ├── show-logs.sh           # Show service logs
│   ├── run-tests.sh           # Run test suite
│   ├── setup-env.sh           # Setup environment files
│   └── check-deps.sh          # Check dependencies
├── environmental-service/      # Python environmental service
│   ├── src/                   # Python source code
│   ├── Dockerfile            # Docker configuration
│   └── pyproject.toml        # Python dependencies
├── client/                    # Next.js dashboard
├── lib/                       # Node.js utilities
├── server.js                  # Express.js API server
└── logs/                      # Service logs
    ├── pids/                  # Process ID files
    ├── environmental-service.log
    ├── api-server.log
    └── client.log
```

## 🔧 Configuration

### Environment Files

The development environment uses several configuration files:

- **`.env`** - Main configuration (API server, database, environmental service)
- **`environmental-service/.env`** - Python service configuration
- **`client/.env.local`** - Next.js client configuration

### Key Configuration Variables

```bash
# Database
DATABASE_URL=libsql://your-database-url

# Environmental Service
ENVIRONMENTAL_TRACKING_ENABLED=true
ENVIRONMENTAL_SERVICE_URL=http://localhost:5000

# Email (optional)
RESEND_API_KEY=your_resend_key
EMAIL_FROM_DOMAIN=mail.promptpulse.dev

# Development
NODE_ENV=development
LOG_LEVEL=debug
```

## 🐛 Debugging

### View Logs

```bash
# All service logs
make logs

# Follow logs in real-time
./scripts/show-logs.sh -f

# Specific service logs
./scripts/show-logs.sh --env
./scripts/show-logs.sh --api
./scripts/show-logs.sh --client
```

### Health Checks

```bash
# Check all services
make health

# Manual health checks
curl http://localhost:5000/health
curl http://localhost:3000/health
curl http://localhost:3001
```

### Common Issues

1. **Port conflicts**: 
   ```bash
   make stop  # Stop all services
   make clean # Clean up processes
   ```

2. **Dependency issues**:
   ```bash
   make check-deps  # Verify dependencies
   make install     # Reinstall dependencies
   ```

3. **Environmental service not responding**:
   ```bash
   cd environmental-service
   uv run python test_service.py
   ```

4. **Database issues**:
   ```bash
   make migrate  # Run migrations
   ```

## 🧪 Testing

### Run All Tests

```bash
make test
```

This runs:
- Environmental service unit tests
- Node.js API tests (if configured)
- Integration tests
- Health checks
- Performance tests

### Individual Test Suites

```bash
# Environmental service only
make test-env

# API tests only
make test-api

# Manual environmental service test
cd environmental-service
uv run python test_service.py
```

## 🌱 Environmental Impact Testing

Test the environmental service integration:

```bash
# Start environmental service
make start-env

# Test calculation
curl -X POST http://localhost:5000/calculate-impact \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "input_tokens": 150,
    "output_tokens": 500,
    "location": "us-west-1"
  }'

# Test with PromptPulse CLI
promptpulse collect --granularity session
```

## 🐳 Docker Development (Optional)

For containerized development:

```bash
# Build and start all services
make docker-dev

# Stop Docker environment
make docker-stop

# Build Docker images
make docker-build
```

## 📊 Monitoring

### Real-time Monitoring

```bash
# Watch logs
make logs --follow

# Monitor health
watch make health

# Check processes
ps aux | grep -E "(node|python|npm)"
```

### Performance Monitoring

```bash
# Environmental service metrics
curl http://localhost:5000/cache-stats

# API performance
curl http://localhost:3000/health
```

## 🚀 Production Deployment

### Build for Production

```bash
make build
```

### Environment Variables for Production

```bash
# Required
DATABASE_URL=your_production_database_url
RESEND_API_KEY=your_resend_api_key

# Recommended
NODE_ENV=production
LOG_LEVEL=info
ENVIRONMENTAL_SERVICE_URL=https://your-env-service.com
```

## 💡 Development Tips

1. **Use `make dev` for full development** - starts all services with proper configuration

2. **Check health regularly** - `make health` shows the status of all services

3. **Monitor logs** - `make logs` shows real-time logs from all services

4. **Test environmental integration** - the environmental service adds CO2 tracking to usage data

5. **Use environment variables** - all services are configured via environment files

6. **Stop services cleanly** - `make stop` gracefully shuts down all services

## 🔄 Workflow Examples

### Typical Development Session

```bash
# Start development
make dev

# Check everything is working
make health

# Make code changes...

# View logs if needed
make logs

# Run tests
make test

# Stop when done
make stop
```

### Adding Environmental Features

```bash
# Start environmental service
make start-env

# Test environmental calculations
cd environmental-service
uv run python test_service.py

# Integrate with API
make start-api

# Test full integration
make test
```

### Debugging Issues

```bash
# Check dependencies
make check-deps

# View detailed health status
make health

# Check specific service logs
./scripts/show-logs.sh --env

# Restart everything
make stop && make dev
```

## 📚 Additional Resources

- **PromptPulse CLI**: Use `promptpulse --help` for CLI commands
- **Environmental Service**: See `environmental-service/README_complete.md`
- **API Documentation**: Check server.js for endpoint definitions
- **Client Development**: See client/ directory for Next.js dashboard

---

**Happy developing! 🌱 The PromptPulse development environment is designed to be simple, powerful, and environmentally conscious.**