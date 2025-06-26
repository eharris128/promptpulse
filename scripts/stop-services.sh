#!/bin/bash
# Stop all running services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🛑 Stopping PromptPulse Services...${NC}"

# Function to stop a service
stop_service() {
    local service_name=$1
    local pid_file=$2
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p "$pid" > /dev/null 2>&1; then
            echo -e "${YELLOW}🛑 Stopping $service_name (PID: $pid)...${NC}"
            kill "$pid"
            
            # Wait for graceful shutdown
            local count=0
            while ps -p "$pid" > /dev/null 2>&1 && [ $count -lt 10 ]; do
                sleep 1
                count=$((count + 1))
            done
            
            # Force kill if still running
            if ps -p "$pid" > /dev/null 2>&1; then
                echo -e "${RED}💀 Force killing $service_name...${NC}"
                kill -9 "$pid"
            fi
            
            echo -e "${GREEN}✅ $service_name stopped${NC}"
        else
            echo -e "${YELLOW}⚠️  $service_name was not running${NC}"
        fi
        rm -f "$pid_file"
    else
        echo -e "${YELLOW}⚠️  $service_name PID file not found${NC}"
    fi
}

# Stop services in reverse order
stop_service "Client" "logs/pids/client.pid"
stop_service "API Server" "logs/pids/api-server.pid"
stop_service "Environmental Service" "logs/pids/environmental-service.pid"

# Also try to kill any remaining processes on known ports
echo -e "${BLUE}🔍 Checking for remaining processes on ports...${NC}"

# Check port 3001 (client)
if lsof -ti:3001 > /dev/null 2>&1; then
    echo -e "${YELLOW}🛑 Killing remaining processes on port 3001...${NC}"
    lsof -ti:3001 | xargs kill -9 2>/dev/null || true
fi

# Check port 3000 (API)
if lsof -ti:3000 > /dev/null 2>&1; then
    echo -e "${YELLOW}🛑 Killing remaining processes on port 3000...${NC}"
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
fi

# Check port 5000 (environmental service)
if lsof -ti:5000 > /dev/null 2>&1; then
    echo -e "${YELLOW}🛑 Killing remaining processes on port 5000...${NC}"
    lsof -ti:5000 | xargs kill -9 2>/dev/null || true
fi

echo ""
echo -e "${GREEN}🎉 All services stopped successfully!${NC}"

# Optionally show what's still running on our ports
echo -e "${BLUE}🔍 Final port check:${NC}"
for port in 3000 3001 5000; do
    if lsof -ti:$port > /dev/null 2>&1; then
        echo -e "${RED}⚠️  Port $port still in use${NC}"
    else
        echo -e "${GREEN}✅ Port $port is free${NC}"
    fi
done