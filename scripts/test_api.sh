#!/bin/bash

# Test TargetVision API endpoints

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

API_URL="http://localhost:7050"
FRONTEND_URL="http://localhost:3000"

echo -e "${CYAN}═══════════════════════════════════════════${NC}"
echo -e "${CYAN}     TargetVision API Test Suite${NC}"
echo -e "${CYAN}═══════════════════════════════════════════${NC}\n"

# Function to test endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local description=$3
    local data=$4
    
    echo -e "${YELLOW}Testing: $description${NC}"
    echo -e "Endpoint: $method $endpoint"
    
    if [ "$method" == "GET" ]; then
        response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$API_URL$endpoint")
    elif [ "$method" == "POST" ]; then
        if [ -n "$data" ]; then
            response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST \
                -H "Content-Type: application/json" \
                -d "$data" \
                "$API_URL$endpoint")
        else
            response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$API_URL$endpoint")
        fi
    fi
    
    http_status=$(echo "$response" | grep "HTTP_STATUS" | cut -d: -f2)
    body=$(echo "$response" | sed -n '1,/HTTP_STATUS/p' | sed '$d')
    
    if [ "$http_status" == "200" ]; then
        echo -e "${GREEN}✓ Status: $http_status OK${NC}"
        echo "$body" | python -m json.tool 2>/dev/null | head -20 || echo "$body" | head -20
    else
        echo -e "${RED}✗ Status: $http_status FAILED${NC}"
        echo "$body"
    fi
    echo -e "-------------------------------------------\n"
}

# 1. Test server health
test_endpoint "GET" "/api/health" "Server Health Check"

# 2. Test root endpoint
test_endpoint "GET" "/" "Root Endpoint"

# 3. Create test image
echo -e "${YELLOW}Creating test image...${NC}"
python3 << EOF
from PIL import Image, ImageDraw
import random

img = Image.new('RGB', (400, 300), color=(135, 206, 235))
draw = ImageDraw.Draw(img)

# Draw some shapes
for _ in range(5):
    x1 = random.randint(0, 350)
    y1 = random.randint(0, 250)
    x2 = x1 + random.randint(20, 50)
    y2 = y1 + random.randint(20, 50)
    color = (random.randint(0, 255), random.randint(0, 255), random.randint(0, 255))
    draw.rectangle([x1, y1, x2, y2], fill=color)

img.save('test_api_image.jpg')
print("✓ Test image created: test_api_image.jpg")
EOF
echo

# 4. Test photo upload
echo -e "${YELLOW}Testing: Photo Upload${NC}"
echo -e "Endpoint: POST /api/photos/upload"
upload_response=$(curl -s -X POST "$API_URL/api/photos/upload" \
    -F "file=@test_api_image.jpg")

if echo "$upload_response" | grep -q "analyzed"; then
    echo -e "${GREEN}✓ Photo uploaded and analyzed by Claude${NC}"
    echo "$upload_response" | python -m json.tool | head -20
else
    echo -e "${RED}✗ Photo upload failed${NC}"
    echo "$upload_response"
fi
echo -e "-------------------------------------------\n"

# 5. Test chat
test_endpoint "POST" "/api/chat/message" "Chat Endpoint" \
    '{"message": "What photos do you have?", "session_id": "test-session"}'

# 6. Test search
test_endpoint "GET" "/api/photos/search?query=colorful&limit=5" "Search Photos"

# 7. Test list photos
test_endpoint "GET" "/api/photos/list" "List All Photos"

# 8. Check frontend
echo -e "${YELLOW}Testing: Frontend Status${NC}"
if curl -s "$FRONTEND_URL" | grep -q "TargetVision"; then
    echo -e "${GREEN}✓ Frontend is running at $FRONTEND_URL${NC}"
else
    echo -e "${RED}✗ Frontend is not accessible${NC}"
fi
echo

# Summary
echo -e "${CYAN}═══════════════════════════════════════════${NC}"
echo -e "${CYAN}              Test Summary${NC}"
echo -e "${CYAN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}✓${NC} API URL: $API_URL"
echo -e "${GREEN}✓${NC} API Docs: $API_URL/docs"
echo -e "${GREEN}✓${NC} Frontend: $FRONTEND_URL"
echo
echo -e "Run ${BLUE}./scripts/targetvision.sh status${NC} for server status"

# Cleanup
rm -f test_api_image.jpg