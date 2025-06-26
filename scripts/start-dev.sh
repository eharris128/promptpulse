#!/bin/bash
# Start full development environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

echo -e "${PURPLE}🚀 Starting PromptPulse Development Environment${NC}"
echo -e "${PURPLE}=============================================${NC}"

# Function to check if a service is running
check_service() {
    local service_name=$1
    local pid_file=$2
    local port=$3
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p "$pid" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ $service_name is already running (PID: $pid)${NC}"
            return 0
        else
            rm -f "$pid_file"
        fi
    fi
    return 1
}

# Check what's already running
echo -e "${BLUE}🔍 Checking current services...${NC}"

ENV_RUNNING=false
API_RUNNING=false
CLIENT_RUNNING=false

if check_service "Environmental Service" "logs/pids/environmental-service.pid" "5000"; then
    ENV_RUNNING=true
fi

if check_service "API Server" "logs/pids/api-server.pid" "3000"; then
    API_RUNNING=true
fi

if check_service "Client" "logs/pids/client.pid" "3001"; then
    CLIENT_RUNNING=true
fi

echo ""

# Start services in order
echo -e "${BLUE}🌱 Starting Environmental Service...${NC}"
if [ "$ENV_RUNNING" = false ]; then
    ./scripts/start-environmental.sh
    echo ""
else
    echo -e "${GREEN}✅ Environmental service already running${NC}"
    echo ""
fi

echo -e "${BLUE}🔧 Starting API Server...${NC}"
if [ "$API_RUNNING" = false ]; then
    ./scripts/start-api.sh
    echo ""
else
    echo -e "${GREEN}✅ API server already running${NC}"
    echo ""
fi

echo -e "${BLUE}💻 Starting Client...${NC}"
if [ "$CLIENT_RUNNING" = false ]; then
    ./scripts/start-client.sh
    echo ""
else
    echo -e "${GREEN}✅ Client already running${NC}"
    echo ""
fi

# Wait a moment for all services to stabilize
echo -e "${BLUE}⏳ Waiting for services to stabilize...${NC}"
sleep 3

# Health check all services
echo -e "${BLUE}🏥 Performing health checks...${NC}"

# Check environmental service
if curl -f http://localhost:5000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Environmental Service: Healthy${NC}"
else
    echo -e "${YELLOW}⚠️  Environmental Service: Not responding${NC}"
fi

# Check API server (basic check)
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ API Server: Healthy${NC}"
elif curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ API Server: Running${NC}"
else
    echo -e "${YELLOW}⚠️  API Server: Not responding${NC}"
fi

# Check client
if curl -f http://localhost:3001 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Client: Healthy${NC}"
else
    echo -e "${YELLOW}⚠️  Client: Not responding (may still be starting)${NC}"
fi

echo ""
echo -e "${PURPLE}🎉 Development Environment Ready!${NC}"
echo -e "${PURPLE}================================${NC}"
echo ""
echo -e "${BLUE}📡 Service URLs:${NC}"
echo "   🌱 Environmental Service: http://localhost:5000"
echo "   🔧 API Server:           http://localhost:3000"
echo "   💻 Client Dashboard:     http://localhost:3001"
echo ""
echo -e "${BLUE}🔗 Useful Links:${NC}"
echo "   📊 Dashboard:            http://localhost:3001"
echo "   🏥 API Health:           http://localhost:3000/health"
echo "   🌱 Env Health:           http://localhost:5000/health"
echo "   📚 Env Methodology:      http://localhost:5000/methodology"
echo ""
echo -e "${BLUE}💡 Development Commands:${NC}"
echo "   make logs     - View real-time logs"
echo "   make health   - Check service health"
echo "   make stop     - Stop all services"
echo "   make test     - Run tests"
echo ""
echo -e "${BLUE}📄 Log Files:${NC}"
echo "   Environmental: logs/environmental-service.log"
echo "   API Server:    logs/api-server.log"
echo "   Client:        logs/client.log"
echo ""
echo -e "${GREEN}✨ Happy coding! The full PromptPulse stack is now running.${NC}"