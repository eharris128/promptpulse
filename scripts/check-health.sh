#!/bin/bash
# Check health of all services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🏥 PromptPulse Health Check${NC}"
echo -e "${BLUE}=========================${NC}"

# Function to check service health
check_service_health() {
    local service_name=$1
    local url=$2
    local pid_file=$3
    
    echo -e "${BLUE}🔍 Checking $service_name...${NC}"
    
    # Check if PID file exists and process is running
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p "$pid" > /dev/null 2>&1; then
            echo -e "   ${GREEN}✅ Process running (PID: $pid)${NC}"
            
            # Check HTTP response
            if curl -f "$url" > /dev/null 2>&1; then
                echo -e "   ${GREEN}✅ HTTP response OK${NC}"
                
                # Try to get response time
                local response_time=$(curl -o /dev/null -s -w "%{time_total}" "$url" 2>/dev/null || echo "unknown")
                echo -e "   ${BLUE}⏱️  Response time: ${response_time}s${NC}"
                
                return 0
            else
                echo -e "   ${RED}❌ HTTP request failed${NC}"
                return 1
            fi
        else
            echo -e "   ${RED}❌ Process not running${NC}"
            rm -f "$pid_file"
            return 1
        fi
    else
        echo -e "   ${RED}❌ PID file not found${NC}"
        return 1
    fi
}

# Function to check service with detailed health endpoint
check_detailed_health() {
    local service_name=$1
    local health_url=$2
    
    echo -e "${BLUE}🔍 Detailed health check for $service_name...${NC}"
    
    local health_response=$(curl -s "$health_url" 2>/dev/null || echo "error")
    
    if [ "$health_response" != "error" ]; then
        echo -e "   ${GREEN}✅ Health endpoint responding${NC}"
        
        # Try to parse JSON response (if it's JSON)
        if echo "$health_response" | jq . > /dev/null 2>&1; then
            local status=$(echo "$health_response" | jq -r '.status // empty' 2>/dev/null)
            if [ "$status" = "healthy" ]; then
                echo -e "   ${GREEN}✅ Service reports healthy${NC}"
            elif [ "$status" = "unhealthy" ]; then
                echo -e "   ${RED}❌ Service reports unhealthy${NC}"
            else
                echo -e "   ${YELLOW}⚠️  Unknown health status${NC}"
            fi
            
            # Show additional info if available
            local timestamp=$(echo "$health_response" | jq -r '.timestamp // empty' 2>/dev/null)
            if [ -n "$timestamp" ] && [ "$timestamp" != "null" ]; then
                echo -e "   ${BLUE}🕒 Last check: $timestamp${NC}"
            fi
        else
            echo -e "   ${BLUE}📄 Response: $health_response${NC}"
        fi
    else
        echo -e "   ${RED}❌ Health endpoint not responding${NC}"
    fi
}

# Check Environmental Service
echo ""
if check_service_health "Environmental Service" "http://localhost:5000/health" "logs/pids/environmental-service.pid"; then
    check_detailed_health "Environmental Service" "http://localhost:5000/health"
fi

# Check API Server
echo ""
if check_service_health "API Server" "http://localhost:3000" "logs/pids/api-server.pid"; then
    # Try health endpoint if it exists
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        check_detailed_health "API Server" "http://localhost:3000/health"
    else
        echo -e "   ${BLUE}ℹ️  No dedicated health endpoint${NC}"
    fi
fi

# Check Client
echo ""
if check_service_health "Client" "http://localhost:3001" "logs/pids/client.pid"; then
    echo -e "   ${BLUE}ℹ️  Next.js development server${NC}"
fi

# Overall system health
echo ""
echo -e "${BLUE}🖥️  System Resources:${NC}"

# Check memory usage
if command -v free >/dev/null 2>&1; then
    local memory_info=$(free -h | grep '^Mem:')
    echo -e "   ${BLUE}💾 Memory: $memory_info${NC}"
fi

# Check disk space
local disk_usage=$(df -h . | tail -1 | awk '{print $5}')
echo -e "   ${BLUE}💿 Disk usage: $disk_usage${NC}"

# Check load average
if command -v uptime >/dev/null 2>&1; then
    local load_avg=$(uptime | awk -F'load average:' '{print $2}')
    echo -e "   ${BLUE}⚡ Load average:$load_avg${NC}"
fi

# Port usage summary
echo ""
echo -e "${BLUE}🔌 Port Usage:${NC}"
for port in 3000 3001 5000; do
    if lsof -ti:$port > /dev/null 2>&1; then
        local process=$(lsof -ti:$port | head -1)
        local process_name=$(ps -p "$process" -o comm= 2>/dev/null || echo "unknown")
        echo -e "   ${GREEN}✅ Port $port: $process_name (PID: $process)${NC}"
    else
        echo -e "   ${RED}❌ Port $port: Not in use${NC}"
    fi
done

# Network connectivity check
echo ""
echo -e "${BLUE}🌐 Network Connectivity:${NC}"

# Check if we can reach external services
if curl -f https://api.promptpulse.dev/health > /dev/null 2>&1; then
    echo -e "   ${GREEN}✅ External API reachable${NC}"
else
    echo -e "   ${YELLOW}⚠️  External API not reachable${NC}"
fi

# Service integration test
echo ""
echo -e "${BLUE}🔗 Service Integration:${NC}"

# Test if API can reach environmental service
if curl -f http://localhost:3000 > /dev/null 2>&1 && curl -f http://localhost:5000/health > /dev/null 2>&1; then
    echo -e "   ${GREEN}✅ API ↔ Environmental Service: Connected${NC}"
else
    echo -e "   ${RED}❌ API ↔ Environmental Service: Not connected${NC}"
fi

# Test if client can reach API
if curl -f http://localhost:3001 > /dev/null 2>&1 && curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo -e "   ${GREEN}✅ Client ↔ API: Connected${NC}"
else
    echo -e "   ${RED}❌ Client ↔ API: Not connected${NC}"
fi

echo ""
echo -e "${GREEN}🏥 Health check complete!${NC}"
echo ""
echo -e "${BLUE}💡 Troubleshooting tips:${NC}"
echo "   • Use 'make logs' to view service logs"
echo "   • Use 'make stop' and 'make dev' to restart services"
echo "   • Check .env files for configuration issues"