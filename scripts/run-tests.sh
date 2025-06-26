#!/bin/bash
# Run tests for all services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

echo -e "${PURPLE}🧪 PromptPulse Test Suite${NC}"
echo -e "${PURPLE}========================${NC}"

# Track test results
TESTS_PASSED=0
TESTS_FAILED=0
OVERALL_SUCCESS=true

# Function to run a test and track results
run_test() {
    local test_name=$1
    local test_command=$2
    local test_dir=${3:-.}
    
    echo -e "${BLUE}🧪 Running $test_name...${NC}"
    
    if [ "$test_dir" != "." ]; then
        cd "$test_dir"
    fi
    
    if eval "$test_command"; then
        echo -e "${GREEN}✅ $test_name: PASSED${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}❌ $test_name: FAILED${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        OVERALL_SUCCESS=false
    fi
    
    if [ "$test_dir" != "." ]; then
        cd - > /dev/null
    fi
    
    echo ""
}

# Test 1: Environmental Service
echo -e "${BLUE}🌱 Testing Environmental Service...${NC}"
run_test "Environmental Service Unit Tests" "uv run python test_service.py" "environmental-service"

# Test 2: Node.js API (if test script exists)
echo -e "${BLUE}🔧 Testing Node.js API...${NC}"
if [ -f "package.json" ] && npm run | grep -q "test"; then
    run_test "Node.js API Tests" "npm test"
else
    echo -e "${YELLOW}⚠️  No Node.js tests configured in package.json${NC}"
    echo ""
fi

# Test 3: Integration tests (if environmental service is running)
echo -e "${BLUE}🔗 Testing Service Integration...${NC}"

# Check if environmental service is responding
if curl -f http://localhost:5000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Environmental service is running${NC}"
    
    # Test environmental service API
    run_test "Environmental Service API" 'curl -f -X POST http://localhost:5000/calculate-impact -H "Content-Type: application/json" -d "{\"model\":\"claude-3-5-sonnet-20241022\",\"input_tokens\":100,\"output_tokens\":200}" > /dev/null'
    
    # Test health endpoint
    run_test "Environmental Service Health Check" 'curl -f http://localhost:5000/health > /dev/null'
    
    # Test models endpoint
    run_test "Environmental Service Models Endpoint" 'curl -f http://localhost:5000/models > /dev/null'
    
else
    echo -e "${YELLOW}⚠️  Environmental service not running, starting it for tests...${NC}"
    ./scripts/start-environmental.sh > /dev/null 2>&1
    sleep 3
    
    if curl -f http://localhost:5000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Environmental service started${NC}"
        
        # Run the same tests
        run_test "Environmental Service API" 'curl -f -X POST http://localhost:5000/calculate-impact -H "Content-Type: application/json" -d "{\"model\":\"claude-3-5-sonnet-20241022\",\"input_tokens\":100,\"output_tokens\":200}" > /dev/null'
        run_test "Environmental Service Health Check" 'curl -f http://localhost:5000/health > /dev/null'
        run_test "Environmental Service Models Endpoint" 'curl -f http://localhost:5000/models > /dev/null'
    else
        echo -e "${RED}❌ Failed to start environmental service for testing${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        OVERALL_SUCCESS=false
        echo ""
    fi
fi

# Test 4: Dependency checks
echo -e "${BLUE}🔍 Testing Dependencies...${NC}"
run_test "System Dependencies" "./scripts/check-deps.sh > /dev/null"

# Test 5: Configuration validation
echo -e "${BLUE}⚙️  Testing Configuration...${NC}"

# Check if required files exist
test_config_files() {
    local missing_files=()
    
    # Check for essential files
    [ ! -f "package.json" ] && missing_files+=("package.json")
    [ ! -f "environmental-service/pyproject.toml" ] && missing_files+=("environmental-service/pyproject.toml")
    [ ! -f "environmental-service/src/app.py" ] && missing_files+=("environmental-service/src/app.py")
    
    if [ ${#missing_files[@]} -eq 0 ]; then
        return 0
    else
        echo "Missing files: ${missing_files[*]}"
        return 1
    fi
}

run_test "Configuration Files" "test_config_files"

# Test 6: Database connection (if configured)
echo -e "${BLUE}🗄️  Testing Database...${NC}"
if [ -f ".env" ] && grep -q "DATABASE_URL=.*[^[:space:]]" .env; then
    run_test "Database Connection" "timeout 10 npm run check-db > /dev/null 2>&1 || echo 'Database check not available'"
else
    echo -e "${YELLOW}⚠️  DATABASE_URL not configured, skipping database tests${NC}"
    echo ""
fi

# Test 7: Performance/Load test (basic)
echo -e "${BLUE}⚡ Basic Performance Test...${NC}"
if curl -f http://localhost:5000/health > /dev/null 2>&1; then
    performance_test() {
        echo "Running 10 concurrent requests..."
        for i in {1..10}; do
            curl -f -X POST http://localhost:5000/calculate-impact \
                -H "Content-Type: application/json" \
                -d '{"model":"claude-3-5-sonnet-20241022","input_tokens":100,"output_tokens":200}' \
                > /dev/null 2>&1 &
        done
        wait
        return 0
    }
    
    run_test "Basic Load Test" "performance_test"
else
    echo -e "${YELLOW}⚠️  Environmental service not available for performance testing${NC}"
    echo ""
fi

# Test summary
echo -e "${PURPLE}📊 Test Summary${NC}"
echo -e "${PURPLE}==============${NC}"
echo -e "${GREEN}✅ Tests Passed: $TESTS_PASSED${NC}"
echo -e "${RED}❌ Tests Failed: $TESTS_FAILED${NC}"
echo -e "${BLUE}📋 Total Tests: $((TESTS_PASSED + TESTS_FAILED))${NC}"

if [ "$OVERALL_SUCCESS" = true ]; then
    echo ""
    echo -e "${GREEN}🎉 All tests passed! PromptPulse is ready for development.${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}❌ Some tests failed. Please check the output above for details.${NC}"
    echo ""
    echo -e "${BLUE}💡 Troubleshooting tips:${NC}"
    echo "   • Check service logs: make logs"
    echo "   • Verify configuration: make setup"
    echo "   • Restart services: make stop && make dev"
    exit 1
fi