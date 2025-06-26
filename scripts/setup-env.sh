#!/bin/bash
# Setup environment files and configuration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}⚙️  Setting up environment configuration...${NC}"

# Create logs directory
mkdir -p logs

# Setup main .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}📝 Creating main .env file...${NC}"
    cat > .env << EOF
# PromptPulse Environment Configuration

# Database
DATABASE_URL=

# Node.js API Configuration
PORT=3000
NODE_ENV=development
LOG_LEVEL=debug

# Environmental Service Configuration
ENVIRONMENTAL_TRACKING_ENABLED=true
ENVIRONMENTAL_SERVICE_URL=http://localhost:5000

# Email Configuration (optional)
RESEND_API_KEY=
EMAIL_FROM_DOMAIN=mail.promptpulse.dev

# Dashboard Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000

# Development settings
MACHINE_ID=development-machine
EOF
    echo -e "${GREEN}✅ Created .env file${NC}"
else
    echo -e "${GREEN}✅ .env file already exists${NC}"
fi

# Setup environmental service .env if it doesn't exist
if [ ! -f "environmental-service/.env" ]; then
    echo -e "${YELLOW}📝 Creating environmental service .env file...${NC}"
    cp environmental-service/.env.example environmental-service/.env
    echo -e "${GREEN}✅ Created environmental-service/.env file${NC}"
else
    echo -e "${GREEN}✅ Environmental service .env file already exists${NC}"
fi

# Setup client .env.local if it doesn't exist
if [ ! -f "client/.env.local" ]; then
    echo -e "${YELLOW}📝 Creating client .env.local file...${NC}"
    cat > client/.env.local << EOF
# Next.js Client Environment Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=development-secret-key
NODE_ENV=development
EOF
    echo -e "${GREEN}✅ Created client/.env.local file${NC}"
else
    echo -e "${GREEN}✅ Client .env.local file already exists${NC}"
fi

# Update environmental service URL in main .env if needed
if grep -q "ENVIRONMENTAL_SERVICE_URL=" .env; then
    if ! grep -q "ENVIRONMENTAL_SERVICE_URL=http://localhost:5000" .env; then
        sed -i 's|ENVIRONMENTAL_SERVICE_URL=.*|ENVIRONMENTAL_SERVICE_URL=http://localhost:5000|' .env
        echo -e "${GREEN}✅ Updated ENVIRONMENTAL_SERVICE_URL in .env${NC}"
    fi
else
    echo "ENVIRONMENTAL_SERVICE_URL=http://localhost:5000" >> .env
    echo -e "${GREEN}✅ Added ENVIRONMENTAL_SERVICE_URL to .env${NC}"
fi

# Check if DATABASE_URL needs to be set
if ! grep -q "DATABASE_URL=.*[^[:space:]]" .env; then
    echo -e "${YELLOW}⚠️  DATABASE_URL is not set in .env${NC}"
    echo -e "${YELLOW}   Please configure your SQLite Cloud or local database URL${NC}"
    echo -e "${YELLOW}   Example: DATABASE_URL=libsql://your-database-url${NC}"
fi

# Create PID files directory
mkdir -p logs/pids

echo -e "${GREEN}🎉 Environment setup complete!${NC}"
echo ""
echo -e "${BLUE}📋 Configuration summary:${NC}"
echo "  Main API: http://localhost:3000"
echo "  Client: http://localhost:3001"
echo "  Environmental Service: http://localhost:5000"
echo ""
echo -e "${BLUE}📁 Files created/updated:${NC}"
echo "  .env (main configuration)"
echo "  environmental-service/.env (Python service)"
echo "  client/.env.local (Next.js client)"
echo "  logs/ (log directory)"
echo ""
echo -e "${YELLOW}💡 Next steps:${NC}"
echo "  1. Configure DATABASE_URL in .env"
echo "  2. Run 'make install' to install dependencies"
echo "  3. Run 'make dev' to start development environment"