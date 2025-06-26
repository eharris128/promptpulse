# PromptPulse Development Makefile
# Manages both Node.js API/Client and Python Environmental Service

.PHONY: help install dev start-env start-api start-client test clean logs health stop setup check-deps

# Default target
help:
	@echo "🌱 PromptPulse Development Commands"
	@echo "=================================="
	@echo ""
	@echo "Development:"
	@echo "  make dev         - Start full development environment (API + Client + Environmental)"
	@echo "  make start-env   - Start only environmental service"
	@echo "  make start-api   - Start only Node.js API server"
	@echo "  make start-client- Start only Next.js client"
	@echo "  make restart-client - Restart only Next.js client"
	@echo "  make restart-api - Restart only Node.js API server"
	@echo "  make restart-env - Restart only environmental service"
	@echo ""
	@echo "Setup:"
	@echo "  make install     - Install all dependencies"
	@echo "  make setup       - Setup environment files and configuration"
	@echo "  make check-deps  - Check system dependencies"
	@echo ""
	@echo "Testing:"
	@echo "  make test        - Run tests for both services"
	@echo "  make test-env    - Test environmental service only"
	@echo "  make test-api    - Test Node.js API only"
	@echo ""
	@echo "Management:"
	@echo "  make health      - Check health of all services"
	@echo "  make logs        - Show logs from all services"
	@echo "  make stop        - Stop all running services"
	@echo "  make clean       - Clean up processes and temporary files"
	@echo ""
	@echo "Database:"
	@echo "  make migrate     - Run database migrations"
	@echo "  make db-reset    - Reset database (development only)"
	@echo ""

# Check system dependencies
check-deps:
	@echo "🔍 Checking system dependencies..."
	@./scripts/check-deps.sh

# Install all dependencies
install: check-deps
	@echo "📦 Installing dependencies..."
	@echo "Installing Node.js dependencies..."
	@npm install
	@echo "Installing Python dependencies..."
	@cd environmental-service && uv sync
	@echo "✅ All dependencies installed"

# Setup environment files
setup:
	@echo "⚙️  Setting up environment..."
	@./scripts/setup-env.sh

# Start full development environment
dev: setup
	@echo "🚀 Starting full development environment..."
	@./scripts/start-dev.sh

# Start environmental service only
start-env:
	@echo "🌱 Starting environmental service..."
	@./scripts/start-environmental.sh

# Start Node.js API only
start-api:
	@echo "🔧 Starting Node.js API server..."
	@./scripts/start-api.sh

# Start Next.js client only
start-client:
	@echo "💻 Starting Next.js client..."
	@./scripts/start-client.sh

# Run all tests
test:
	@echo "🧪 Running all tests..."
	@./scripts/run-tests.sh

# Test environmental service only
test-env:
	@echo "🧪 Testing environmental service..."
	@cd environmental-service && uv run python test_service.py

# Test Node.js API only
test-api:
	@echo "🧪 Testing Node.js API..."
	@npm test

# Check health of all services
health:
	@echo "🏥 Checking service health..."
	@./scripts/check-health.sh

# Show logs from all services
logs:
	@echo "📋 Showing service logs..."
	@./scripts/show-logs.sh

# Stop all services
stop:
	@echo "🛑 Stopping all services..."
	@./scripts/stop-services.sh

# Clean up processes and temporary files
clean: stop
	@echo "🧹 Cleaning up..."
	@rm -f logs/*.pid
	@rm -f logs/*.log
	@echo "✅ Cleanup complete"

# Run database migrations
migrate:
	@echo "🗄️  Running database migrations..."
	@npm run migrate

# Reset database (development only)
db-reset:
	@echo "⚠️  Resetting database (development only)..."
	@read -p "Are you sure? This will delete all data [y/N]: " confirm && [ "$$confirm" = "y" ]
	@rm -f promptpulse.db
	@npm run migrate
	@echo "✅ Database reset complete"

# Development shortcuts
api: start-api
client: start-client
env: start-env

# Restart individual services
restart-env:
	@echo "🔄 Restarting environmental service..."
	@echo "🛑 Killing processes on port 5000..."
	@lsof -ti:5000 | xargs kill -9 2>/dev/null || true
	@if [ -f "logs/pids/environmental-service.pid" ]; then rm -f logs/pids/environmental-service.pid; fi
	@./scripts/start-environmental.sh

restart-api:
	@echo "🔄 Restarting API server..."
	@echo "🛑 Killing processes on port 3000..."
	@lsof -ti:3000 | xargs kill -9 2>/dev/null || true
	@if [ -f "logs/pids/api-server.pid" ]; then rm -f logs/pids/api-server.pid; fi
	@./scripts/start-api.sh

restart-client:
	@echo "🔄 Restarting client..."
	@echo "🛑 Killing processes on port 3001..."
	@lsof -ti:3001 | xargs kill -9 2>/dev/null || true
	@if [ -f "logs/pids/client.pid" ]; then rm -f logs/pids/client.pid; fi
	@./scripts/start-client.sh

# Kill processes on specific ports
kill-ports:
	@echo "🛑 Killing processes on PromptPulse ports..."
	@echo "   Port 3000 (API)..."
	@lsof -ti:3000 | xargs kill -9 2>/dev/null || true
	@echo "   Port 3001 (Client)..."
	@lsof -ti:3001 | xargs kill -9 2>/dev/null || true
	@echo "   Port 5000 (Environmental)..."
	@lsof -ti:5000 | xargs kill -9 2>/dev/null || true
	@echo "✅ All ports cleared"

# Production deployment helpers
build:
	@echo "🏗️  Building for production..."
	@npm run build
	@cd environmental-service && uv build

deploy: build
	@echo "🚀 Deploying to production..."
	@echo "⚠️  Production deployment not yet configured"

# Docker commands
docker-build:
	@echo "🐳 Building Docker images..."
	@docker build -t promptpulse-api .
	@docker build -t promptpulse-env-service ./environmental-service

docker-dev:
	@echo "🐳 Starting Docker development environment..."
	@docker-compose -f docker-compose.dev.yml up -d

docker-stop:
	@echo "🐳 Stopping Docker environment..."
	@docker-compose -f docker-compose.dev.yml down

# Information commands
status:
	@echo "📊 Service Status:"
	@./scripts/check-status.sh

info:
	@echo "ℹ️  PromptPulse Information:"
	@echo "  Repository: $(shell pwd)"
	@echo "  Node.js version: $(shell node --version 2>/dev/null || echo 'Not installed')"
	@echo "  Python version: $(shell python3 --version 2>/dev/null || echo 'Not installed')"
	@echo "  uv version: $(shell uv --version 2>/dev/null || echo 'Not installed')"
	@echo "  API URL: http://localhost:3000"
	@echo "  Client URL: http://localhost:3001"
	@echo "  Environmental Service URL: http://localhost:5000"