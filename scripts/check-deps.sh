#!/bin/bash
# Check system dependencies for PromptPulse

set -e

echo "🔍 Checking system dependencies..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track if all dependencies are met
ALL_DEPS_OK=true

# Check Node.js
if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✅ Node.js: $NODE_VERSION${NC}"
    
    # Check if version is >= 18
    NODE_MAJOR=$(echo $NODE_VERSION | sed 's/v\([0-9]*\).*/\1/')
    if [ "$NODE_MAJOR" -lt 18 ]; then
        echo -e "${YELLOW}⚠️  Node.js version should be >= 18.0.0${NC}"
    fi
else
    echo -e "${RED}❌ Node.js not found. Please install Node.js >= 18.0.0${NC}"
    ALL_DEPS_OK=false
fi

# Check npm
if command -v npm >/dev/null 2>&1; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✅ npm: v$NPM_VERSION${NC}"
else
    echo -e "${RED}❌ npm not found. Please install npm${NC}"
    ALL_DEPS_OK=false
fi

# Check Python
if command -v python3 >/dev/null 2>&1; then
    PYTHON_VERSION=$(python3 --version)
    echo -e "${GREEN}✅ Python: $PYTHON_VERSION${NC}"
    
    # Check if version is >= 3.13
    PYTHON_VERSION_NUM=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
    if [ "$(echo "$PYTHON_VERSION_NUM < 3.13" | bc -l 2>/dev/null || echo 1)" -eq 1 ]; then
        echo -e "${YELLOW}⚠️  Python version should be >= 3.13 (current: $PYTHON_VERSION_NUM)${NC}"
        echo -e "${YELLOW}   Environmental service may still work but 3.13 is recommended${NC}"
    fi
else
    echo -e "${RED}❌ Python3 not found. Please install Python >= 3.13${NC}"
    ALL_DEPS_OK=false
fi

# Check uv
if command -v uv >/dev/null 2>&1; then
    UV_VERSION=$(uv --version)
    echo -e "${GREEN}✅ uv: $UV_VERSION${NC}"
else
    echo -e "${YELLOW}⚠️  uv not found. Installing uv for Python dependency management...${NC}"
    if command -v pip3 >/dev/null 2>&1; then
        pip3 install uv
        echo -e "${GREEN}✅ uv installed successfully${NC}"
    else
        echo -e "${RED}❌ pip3 not found. Please install uv manually: https://github.com/astral-sh/uv${NC}"
        ALL_DEPS_OK=false
    fi
fi

# Check git
if command -v git >/dev/null 2>&1; then
    GIT_VERSION=$(git --version)
    echo -e "${GREEN}✅ Git: $GIT_VERSION${NC}"
else
    echo -e "${YELLOW}⚠️  Git not found. Some features may not work properly${NC}"
fi

# Check curl (for health checks)
if command -v curl >/dev/null 2>&1; then
    echo -e "${GREEN}✅ curl: available${NC}"
else
    echo -e "${YELLOW}⚠️  curl not found. Health checks may not work${NC}"
fi

# Check if DATABASE_URL is configured
if [ -f ".env" ] && grep -q "DATABASE_URL" .env; then
    echo -e "${GREEN}✅ DATABASE_URL configured${NC}"
else
    echo -e "${YELLOW}⚠️  DATABASE_URL not configured in .env${NC}"
fi

# Check if environmental service directory exists
if [ -d "environmental-service" ]; then
    echo -e "${GREEN}✅ Environmental service directory found${NC}"
else
    echo -e "${RED}❌ Environmental service directory not found${NC}"
    ALL_DEPS_OK=false
fi

echo ""

if [ "$ALL_DEPS_OK" = true ]; then
    echo -e "${GREEN}🎉 All required dependencies are installed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some dependencies are missing. Please install them before continuing.${NC}"
    echo ""
    echo "Installation help:"
    echo "  Node.js: https://nodejs.org/ (or use nvm)"
    echo "  Python 3.13: https://www.python.org/downloads/"
    echo "  uv: pip install uv"
    exit 1
fi