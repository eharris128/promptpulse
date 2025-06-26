#!/bin/bash
# Start the Next.js client

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Service configuration
SERVICE_NAME="client"
SERVICE_PORT=3001
PID_FILE="logs/pids/client.pid"
LOG_FILE="logs/client.log"

echo -e "${BLUE}💻 Starting Next.js Client...${NC}"

# Check if service is already running
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Client is already running (PID: $PID)${NC}"
        echo -e "${BLUE}📡 Service URL: http://localhost:$SERVICE_PORT${NC}"
        exit 0
    else
        # PID file exists but process is not running
        rm "$PID_FILE"
    fi
fi

# Check if client directory exists
if [ ! -d "client" ]; then
    echo -e "${RED}❌ Client directory not found${NC}"
    echo -e "${RED}   Please ensure you're running this from the repository root${NC}"
    exit 1
fi

# Check if client dependencies are installed
if [ ! -d "client/node_modules" ]; then
    echo -e "${YELLOW}📦 Installing client dependencies...${NC}"
    cd client
    npm install
    cd ..
fi

# Ensure log directory exists
mkdir -p logs/pids
mkdir -p logs

# Set environment variables for client
export NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-http://localhost:3000}
export PORT=$SERVICE_PORT

echo -e "${BLUE}🚀 Starting client on port $SERVICE_PORT...${NC}"
echo -e "${BLUE}🔗 API URL: $NEXT_PUBLIC_API_URL${NC}"

# Start the client in background
cd client
npm run dev > "../$LOG_FILE" 2>&1 &
CLIENT_PID=$!
cd ..

# Save PID
echo "$CLIENT_PID" > "$PID_FILE"

# Wait a moment for service to start
sleep 5

# Check if service started successfully
if ps -p "$CLIENT_PID" > /dev/null 2>&1; then
    # Test if service is responding
    if curl -f http://localhost:$SERVICE_PORT > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Client started successfully!${NC}"
        echo -e "${BLUE}📡 Service URL: http://localhost:$SERVICE_PORT${NC}"
        echo -e "${BLUE}📄 Logs: $LOG_FILE${NC}"
        echo -e "${BLUE}🆔 PID: $CLIENT_PID${NC}"
        
        # Show recent logs
        echo -e "${BLUE}📋 Recent logs:${NC}"
        tail -n 5 "$LOG_FILE" | sed 's/^/   /'
        
    else
        echo -e "${YELLOW}⚠️  Service started but not responding yet${NC}"
        echo -e "${YELLOW}   Next.js may still be compiling...${NC}"
        echo -e "${BLUE}📄 Check logs: $LOG_FILE${NC}"
    fi
else
    echo -e "${RED}❌ Failed to start client${NC}"
    echo -e "${RED}   Check logs: $LOG_FILE${NC}"
    rm -f "$PID_FILE"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 Client is ready!${NC}"
echo -e "${BLUE}💡 Use 'make logs' to view real-time logs${NC}"
echo -e "${BLUE}💡 Use 'make stop' to stop the service${NC}"
echo ""
echo -e "${BLUE}🌐 Open in browser:${NC}"
echo "   http://localhost:$SERVICE_PORT"