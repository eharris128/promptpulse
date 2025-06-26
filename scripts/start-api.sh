#!/bin/bash
# Start the Node.js API server

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Service configuration
SERVICE_NAME="api-server"
SERVICE_PORT=3000
PID_FILE="logs/pids/api-server.pid"
LOG_FILE="logs/api-server.log"

echo -e "${BLUE}🔧 Starting Node.js API Server...${NC}"

# Check if service is already running
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  API server is already running (PID: $PID)${NC}"
        echo -e "${BLUE}📡 Service URL: http://localhost:$SERVICE_PORT${NC}"
        exit 0
    else
        # PID file exists but process is not running
        rm "$PID_FILE"
    fi
fi

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ package.json not found${NC}"
    echo -e "${RED}   Please ensure you're running this from the repository root${NC}"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing Node.js dependencies...${NC}"
    npm install
fi

# Ensure log directory exists
mkdir -p logs/pids
mkdir -p logs

# Load environment variables
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Ensure environmental service URL is set
export ENVIRONMENTAL_SERVICE_URL=${ENVIRONMENTAL_SERVICE_URL:-http://localhost:5000}

echo -e "${BLUE}🚀 Starting API server on port $SERVICE_PORT...${NC}"
echo -e "${BLUE}🌱 Environmental service URL: $ENVIRONMENTAL_SERVICE_URL${NC}"

# Start the API server in background
npm run server:dev > "$LOG_FILE" 2>&1 &
API_PID=$!

# Save PID
echo "$API_PID" > "$PID_FILE"

# Wait a moment for service to start
sleep 3

# Check if service started successfully
if ps -p "$API_PID" > /dev/null 2>&1; then
    # Test if service is responding (simple check)
    if curl -f http://localhost:$SERVICE_PORT/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ API server started successfully!${NC}"
        echo -e "${BLUE}📡 Service URL: http://localhost:$SERVICE_PORT${NC}"
        echo -e "${BLUE}📋 Health check: http://localhost:$SERVICE_PORT/health${NC}"
        echo -e "${BLUE}📄 Logs: $LOG_FILE${NC}"
        echo -e "${BLUE}🆔 PID: $API_PID${NC}"
        
        # Show recent logs
        echo -e "${BLUE}📋 Recent logs:${NC}"
        tail -n 5 "$LOG_FILE" | sed 's/^/   /'
        
    else
        echo -e "${YELLOW}⚠️  Service started but health check not available yet${NC}"
        echo -e "${YELLOW}   The API server may still be starting up${NC}"
        echo -e "${BLUE}📄 Check logs: $LOG_FILE${NC}"
    fi
else
    echo -e "${RED}❌ Failed to start API server${NC}"
    echo -e "${RED}   Check logs: $LOG_FILE${NC}"
    rm -f "$PID_FILE"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 API server is ready!${NC}"
echo -e "${BLUE}💡 Use 'make logs' to view real-time logs${NC}"
echo -e "${BLUE}💡 Use 'make stop' to stop the service${NC}"
echo ""
echo -e "${BLUE}🔗 Available endpoints:${NC}"
echo "   http://localhost:$SERVICE_PORT/health"
echo "   http://localhost:$SERVICE_PORT/api/usage/daily"
echo "   http://localhost:$SERVICE_PORT/api/user/test-email"