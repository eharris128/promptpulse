#!/bin/bash
# Start the Python environmental service

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Service configuration
SERVICE_NAME="environmental-service"
SERVICE_PORT=5000
PID_FILE="logs/pids/environmental-service.pid"
LOG_FILE="logs/environmental-service.log"

echo -e "${BLUE}🌱 Starting Environmental Service...${NC}"

# Check if service is already running
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Environmental service is already running (PID: $PID)${NC}"
        echo -e "${BLUE}📡 Service URL: http://localhost:$SERVICE_PORT${NC}"
        exit 0
    else
        # PID file exists but process is not running
        rm "$PID_FILE"
    fi
fi

# Check if environmental service directory exists
if [ ! -d "environmental-service" ]; then
    echo -e "${RED}❌ Environmental service directory not found${NC}"
    echo -e "${RED}   Please ensure you're running this from the repository root${NC}"
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "environmental-service/.venv" ]; then
    echo -e "${YELLOW}📦 Installing environmental service dependencies...${NC}"
    cd environmental-service
    uv sync
    cd ..
fi

# Ensure log directory exists
mkdir -p logs/pids
mkdir -p logs

# Start the service
echo -e "${BLUE}🚀 Starting environmental service on port $SERVICE_PORT...${NC}"

cd environmental-service

# Start the service in background
PYTHONPATH=. uv run python -m src.app > "../$LOG_FILE" 2>&1 &
SERVICE_PID=$!

# Save PID
echo "$SERVICE_PID" > "../$PID_FILE"

cd ..

# Wait a moment for service to start
sleep 2

# Check if service started successfully
if ps -p "$SERVICE_PID" > /dev/null 2>&1; then
    # Test if service is responding
    if curl -f http://localhost:$SERVICE_PORT/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Environmental service started successfully!${NC}"
        echo -e "${BLUE}📡 Service URL: http://localhost:$SERVICE_PORT${NC}"
        echo -e "${BLUE}📋 Health check: http://localhost:$SERVICE_PORT/health${NC}"
        echo -e "${BLUE}📄 Logs: $LOG_FILE${NC}"
        echo -e "${BLUE}🆔 PID: $SERVICE_PID${NC}"
        
        # Show recent logs
        echo -e "${BLUE}📋 Recent logs:${NC}"
        tail -n 5 "$LOG_FILE" | sed 's/^/   /'
        
    else
        echo -e "${YELLOW}⚠️  Service started but not responding to health checks${NC}"
        echo -e "${YELLOW}   Check logs: $LOG_FILE${NC}"
    fi
else
    echo -e "${RED}❌ Failed to start environmental service${NC}"
    echo -e "${RED}   Check logs: $LOG_FILE${NC}"
    rm -f "$PID_FILE"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 Environmental service is ready!${NC}"
echo -e "${BLUE}💡 Use 'make logs' to view real-time logs${NC}"
echo -e "${BLUE}💡 Use 'make stop' to stop the service${NC}"