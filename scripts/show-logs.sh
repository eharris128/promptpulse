#!/bin/bash
# Show logs from all services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Default options
FOLLOW=false
LINES=50
SERVICE=""

# Parse command line options
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--follow)
            FOLLOW=true
            shift
            ;;
        -n|--lines)
            LINES="$2"
            shift 2
            ;;
        --env|--environmental)
            SERVICE="environmental"
            shift
            ;;
        --api)
            SERVICE="api"
            shift
            ;;
        --client)
            SERVICE="client"
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -f, --follow      Follow log output (like tail -f)"
            echo "  -n, --lines N     Show last N lines (default: 50)"
            echo "  --env             Show only environmental service logs"
            echo "  --api             Show only API server logs"
            echo "  --client          Show only client logs"
            echo "  -h, --help        Show this help"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Log files
ENV_LOG="logs/environmental-service.log"
API_LOG="logs/api-server.log"
CLIENT_LOG="logs/client.log"

# Function to show logs for a service
show_service_logs() {
    local service_name=$1
    local log_file=$2
    local color=$3
    
    if [ -f "$log_file" ]; then
        echo -e "${color}=== $service_name Logs ===${NC}"
        if [ "$FOLLOW" = true ]; then
            tail -f -n "$LINES" "$log_file" | sed "s/^/$(echo -e "${color}")[$service_name]$(echo -e "${NC}") /"
        else
            tail -n "$LINES" "$log_file" | sed "s/^/$(echo -e "${color}")[$service_name]$(echo -e "${NC}") /"
        fi
        echo ""
    else
        echo -e "${YELLOW}⚠️  $service_name log file not found: $log_file${NC}"
    fi
}

# Function to show all logs in parallel (for follow mode)
show_all_logs_follow() {
    echo -e "${PURPLE}📋 Following logs from all services (Ctrl+C to stop)...${NC}"
    echo ""
    
    # Start tail processes in background
    if [ -f "$ENV_LOG" ]; then
        tail -f -n "$LINES" "$ENV_LOG" | sed "s/^/$(echo -e "${GREEN}")[ENV]$(echo -e "${NC}") /" &
        ENV_PID=$!
    fi
    
    if [ -f "$API_LOG" ]; then
        tail -f -n "$LINES" "$API_LOG" | sed "s/^/$(echo -e "${BLUE}")[API]$(echo -e "${NC}") /" &
        API_PID=$!
    fi
    
    if [ -f "$CLIENT_LOG" ]; then
        tail -f -n "$LINES" "$CLIENT_LOG" | sed "s/^/$(echo -e "${YELLOW}")[CLIENT]$(echo -e "${NC}") /" &
        CLIENT_PID=$!
    fi
    
    # Wait for interrupt
    trap 'echo -e "\n${BLUE}Stopping log monitoring...${NC}"; kill $ENV_PID $API_PID $CLIENT_PID 2>/dev/null; exit 0' INT
    wait
}

echo -e "${BLUE}📋 PromptPulse Service Logs${NC}"
echo -e "${BLUE}==========================${NC}"

# Show specific service or all services
case "$SERVICE" in
    "environmental")
        show_service_logs "Environmental Service" "$ENV_LOG" "$GREEN"
        ;;
    "api")
        show_service_logs "API Server" "$API_LOG" "$BLUE"
        ;;
    "client")
        show_service_logs "Client" "$CLIENT_LOG" "$YELLOW"
        ;;
    *)
        if [ "$FOLLOW" = true ]; then
            show_all_logs_follow
        else
            show_service_logs "Environmental Service" "$ENV_LOG" "$GREEN"
            show_service_logs "API Server" "$API_LOG" "$BLUE"
            show_service_logs "Client" "$CLIENT_LOG" "$YELLOW"
        fi
        ;;
esac

if [ "$FOLLOW" = false ]; then
    echo -e "${BLUE}💡 Use 'make logs --follow' or './scripts/show-logs.sh -f' to follow logs in real-time${NC}"
    echo -e "${BLUE}💡 Use '--env', '--api', or '--client' to show specific service logs${NC}"
fi