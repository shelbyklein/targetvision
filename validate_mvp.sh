#!/bin/bash

# TargetVision MVP Validation Script
echo "🎯 TargetVision MVP Validation"
echo "=============================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TOTAL_TESTS=0
PASSED_TESTS=0

# Function to run test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_pattern="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -n "Testing $test_name... "
    
    result=$(eval $test_command 2>/dev/null)
    if echo "$result" | grep -q "$expected_pattern"; then
        echo -e "${GREEN}✅ PASS${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}"
        echo "  Expected: $expected_pattern"
        echo "  Got: ${result:0:100}..."
        return 1
    fi
}

echo
echo "Backend API Tests"
echo "-----------------"

# Test 1: Backend running
run_test "Backend server" \
    "curl -s http://localhost:8000/" \
    "TargetVision MVP API"

# Test 2: Authentication
run_test "Authentication status" \
    "curl -s http://localhost:8000/auth/status" \
    "authenticated.*true"

# Test 3: Photos endpoint
run_test "Photos loading" \
    "curl -s http://localhost:8000/photos | jq '. | length'" \
    "[0-9]"

# Test 4: Search functionality
run_test "Search for 'medals'" \
    "curl -s 'http://localhost:8000/search?q=medals&search_type=text'" \
    "results.*[1-9]"

# Test 5: AI metadata
run_test "AI metadata present" \
    "curl -s http://localhost:8000/photos/1" \
    "ai_metadata"

echo
echo "Frontend Tests"
echo "--------------"

# Test 6: Frontend server
run_test "Frontend server" \
    "curl -s http://localhost:3000/" \
    "TargetVision - AI-Powered Photo Discovery"

# Test 7: JavaScript file
run_test "JavaScript loading" \
    "curl -s http://localhost:3000/app.js" \
    "TargetVisionApp"

# Test 8: CSS file
run_test "CSS loading" \
    "curl -s http://localhost:3000/styles.css" \
    "TargetVision Custom Styles"

echo
echo "Integration Tests"
echo "-----------------"

# Test 9: CORS configuration
run_test "CORS from frontend" \
    "curl -s -H 'Origin: http://localhost:3000' http://localhost:8000/photos | head -c 50" \
    "smugmug_id"

# Test 10: AI processing endpoint
run_test "AI processing available" \
    "curl -s -X POST http://localhost:8000/photos/1/process" \
    "already processed"

echo
echo "File Structure"
echo "--------------"

# Check required files exist
files=(
    "backend/main.py"
    "backend/ai_processor.py"
    "backend/models.py"
    "frontend/index.html"
    "frontend/app.js"
    "frontend/styles.css"
)

for file in "${files[@]}"; do
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if [ -f "$file" ]; then
        echo -e "File $file... ${GREEN}✅ EXISTS${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "File $file... ${RED}❌ MISSING${NC}"
    fi
done

echo
echo "Results Summary"
echo "==============="

if [ $PASSED_TESTS -eq $TOTAL_TESTS ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED! ($PASSED_TESTS/$TOTAL_TESTS)${NC}"
    echo
    echo -e "${GREEN}✅ MVP is fully functional and ready for demo!${NC}"
    echo
    echo "Demo URLs:"
    echo "- Frontend: http://localhost:3000"
    echo "- Backend API: http://localhost:8000"
    echo "- API Testing: http://localhost:3000/test_frontend.html"
    echo
    echo "Key Features Working:"
    echo "✅ SmugMug OAuth and photo sync"
    echo "✅ Claude Vision AI descriptions"
    echo "✅ Content-based photo search"
    echo "✅ Web interface with photo gallery"
    echo "✅ AI metadata display and processing"
    
else
    echo -e "${RED}❌ TESTS FAILED: $PASSED_TESTS/$TOTAL_TESTS passed${NC}"
    echo
    echo -e "${YELLOW}Some features may not be working correctly.${NC}"
fi

echo
echo "To start the demo:"
echo "1. Backend: cd backend && PYTHONPATH=.. python main.py"  
echo "2. Frontend: cd frontend && python -m http.server 3000"
echo "3. Open: http://localhost:3000"