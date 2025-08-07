#!/bin/bash

# Quick test to verify everything is working

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Quick TargetVision Test${NC}"
echo "======================="
echo

# 1. Backend health
echo -n "Backend API: "
if curl -s http://localhost:7050/api/health | grep -q "healthy"; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${RED}✗ Not responding${NC}"
fi

# 2. Frontend
echo -n "Frontend UI: "
if curl -s http://localhost:3000 | grep -q "TargetVision"; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${RED}✗ Not responding${NC}"
fi

# 3. Claude API
echo -n "Claude API:  "
if [ -f ~/.env ] && grep -q "ANTHROPIC_API_KEY" ~/.env; then
    echo -e "${GREEN}✓ Configured${NC}"
elif [ -f ../.env ] && grep -q "ANTHROPIC_API_KEY" ../.env; then
    echo -e "${GREEN}✓ Configured${NC}"
else
    echo -e "${YELLOW}⚠ Check API key${NC}"
fi

echo
echo "Quick Links:"
echo "  Web UI: http://localhost:3000"
echo "  API Docs: http://localhost:7050/docs"