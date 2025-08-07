#!/bin/bash

# TargetVision Control Script
# Main control center for managing the application

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_PORT=7050
FRONTEND_PORT=3000
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
PID_DIR="$PROJECT_ROOT/.pids"
LOG_DIR="$PROJECT_ROOT/logs"

# Create necessary directories
mkdir -p "$PID_DIR" "$LOG_DIR"

# Functions
print_header() {
    echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║       TargetVision Control Center      ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
    echo
}

check_port() {
    lsof -i :$1 >/dev/null 2>&1
}

start_backend() {
    echo -e "${YELLOW}Starting backend server...${NC}"
    
    if check_port $BACKEND_PORT; then
        echo -e "${RED}✗ Backend port $BACKEND_PORT is already in use${NC}"
        return 1
    fi
    
    cd "$BACKEND_DIR"
    source venv/bin/activate 2>/dev/null || {
        echo -e "${RED}✗ Virtual environment not found. Run setup first.${NC}"
        return 1
    }
    
    nohup python app_simple.py > "$LOG_DIR/backend.log" 2>&1 &
    echo $! > "$PID_DIR/backend.pid"
    
    sleep 3
    if check_port $BACKEND_PORT; then
        echo -e "${GREEN}✓ Backend started on port $BACKEND_PORT${NC}"
        echo -e "  API: http://localhost:$BACKEND_PORT"
        echo -e "  Docs: http://localhost:$BACKEND_PORT/docs"
    else
        echo -e "${RED}✗ Backend failed to start${NC}"
        return 1
    fi
}

start_frontend() {
    echo -e "${YELLOW}Starting frontend server...${NC}"
    
    if check_port $FRONTEND_PORT; then
        echo -e "${RED}✗ Frontend port $FRONTEND_PORT is already in use${NC}"
        return 1
    fi
    
    cd "$FRONTEND_DIR"
    nohup npm run dev > "$LOG_DIR/frontend.log" 2>&1 &
    echo $! > "$PID_DIR/frontend.pid"
    
    sleep 5
    if check_port $FRONTEND_PORT; then
        echo -e "${GREEN}✓ Frontend started on port $FRONTEND_PORT${NC}"
        echo -e "  Web UI: http://localhost:$FRONTEND_PORT"
    else
        echo -e "${RED}✗ Frontend failed to start${NC}"
        return 1
    fi
}

stop_backend() {
    echo -e "${YELLOW}Stopping backend server...${NC}"
    
    if [ -f "$PID_DIR/backend.pid" ]; then
        PID=$(cat "$PID_DIR/backend.pid")
        if kill $PID 2>/dev/null; then
            echo -e "${GREEN}✓ Backend stopped${NC}"
        fi
        rm "$PID_DIR/backend.pid"
    fi
    
    # Also kill by port if needed
    lsof -ti:$BACKEND_PORT | xargs kill 2>/dev/null
}

stop_frontend() {
    echo -e "${YELLOW}Stopping frontend server...${NC}"
    
    if [ -f "$PID_DIR/frontend.pid" ]; then
        PID=$(cat "$PID_DIR/frontend.pid")
        if kill $PID 2>/dev/null; then
            echo -e "${GREEN}✓ Frontend stopped${NC}"
        fi
        rm "$PID_DIR/frontend.pid"
    fi
    
    # Also kill by port if needed
    lsof -ti:$FRONTEND_PORT | xargs kill 2>/dev/null
}

show_status() {
    echo -e "${BLUE}═══ Server Status ═══${NC}"
    echo
    
    if check_port $BACKEND_PORT; then
        echo -e "${GREEN}✓ Backend:  RUNNING${NC} (port $BACKEND_PORT)"
        # Test health endpoint
        if curl -s http://localhost:$BACKEND_PORT/api/health >/dev/null; then
            echo -e "  ${GREEN}Health check: OK${NC}"
        else
            echo -e "  ${YELLOW}Health check: Failed${NC}"
        fi
    else
        echo -e "${RED}✗ Backend:  STOPPED${NC}"
    fi
    
    echo
    
    if check_port $FRONTEND_PORT; then
        echo -e "${GREEN}✓ Frontend: RUNNING${NC} (port $FRONTEND_PORT)"
    else
        echo -e "${RED}✗ Frontend: STOPPED${NC}"
    fi
    
    echo
    echo -e "${BLUE}═══ Quick Links ═══${NC}"
    echo -e "Web Interface: http://localhost:$FRONTEND_PORT"
    echo -e "API Docs:      http://localhost:$BACKEND_PORT/docs"
    echo -e "Health Check:  http://localhost:$BACKEND_PORT/api/health"
}

show_logs() {
    echo -e "${BLUE}═══ Recent Logs ═══${NC}"
    
    if [ "$1" == "backend" ] || [ -z "$1" ]; then
        echo -e "\n${YELLOW}Backend logs:${NC}"
        tail -n 20 "$LOG_DIR/backend.log" 2>/dev/null || echo "No backend logs yet"
    fi
    
    if [ "$1" == "frontend" ] || [ -z "$1" ]; then
        echo -e "\n${YELLOW}Frontend logs:${NC}"
        tail -n 20 "$LOG_DIR/frontend.log" 2>/dev/null || echo "No frontend logs yet"
    fi
}

run_tests() {
    echo -e "${BLUE}═══ Running API Tests ═══${NC}\n"
    
    # Health check
    echo -e "${YELLOW}Testing health endpoint...${NC}"
    if curl -s http://localhost:$BACKEND_PORT/api/health | python -m json.tool; then
        echo -e "${GREEN}✓ Health check passed${NC}\n"
    else
        echo -e "${RED}✗ Health check failed${NC}\n"
    fi
    
    # Upload test
    echo -e "${YELLOW}Testing photo upload...${NC}"
    # Create a test image if it doesn't exist
    if [ ! -f "test_image.jpg" ]; then
        python -c "
from PIL import Image
img = Image.new('RGB', (100, 100), color='red')
img.save('test_image.jpg')
"
    fi
    
    UPLOAD_RESPONSE=$(curl -s -X POST http://localhost:$BACKEND_PORT/api/photos/upload \
        -F "file=@test_image.jpg")
    
    if echo "$UPLOAD_RESPONSE" | grep -q "analyzed"; then
        echo -e "${GREEN}✓ Upload test passed${NC}"
        echo "$UPLOAD_RESPONSE" | python -m json.tool | head -10
    else
        echo -e "${RED}✗ Upload test failed${NC}"
    fi
    
    echo
    
    # Chat test
    echo -e "${YELLOW}Testing chat endpoint...${NC}"
    CHAT_RESPONSE=$(curl -s -X POST http://localhost:$BACKEND_PORT/api/chat/message \
        -H "Content-Type: application/json" \
        -d '{"message": "Hello, what photos do you have?"}')
    
    if echo "$CHAT_RESPONSE" | grep -q "response"; then
        echo -e "${GREEN}✓ Chat test passed${NC}"
        echo "$CHAT_RESPONSE" | python -m json.tool | head -15
    else
        echo -e "${RED}✗ Chat test failed${NC}"
    fi
}

clean_up() {
    echo -e "${YELLOW}Cleaning up...${NC}"
    rm -f "$PID_DIR"/*.pid
    rm -f test_image.jpg test_landscape.jpg
    echo -e "${GREEN}✓ Cleanup complete${NC}"
}

# Main menu
case "$1" in
    start)
        print_header
        start_backend
        echo
        start_frontend
        echo
        show_status
        ;;
    
    stop)
        print_header
        stop_backend
        stop_frontend
        clean_up
        ;;
    
    restart)
        print_header
        stop_backend
        stop_frontend
        sleep 2
        start_backend
        echo
        start_frontend
        echo
        show_status
        ;;
    
    status)
        print_header
        show_status
        ;;
    
    test)
        print_header
        run_tests
        ;;
    
    logs)
        print_header
        show_logs "$2"
        ;;
    
    clean)
        print_header
        stop_backend
        stop_frontend
        clean_up
        rm -rf "$LOG_DIR"/*.log
        echo -e "${GREEN}✓ All cleaned up${NC}"
        ;;
    
    *)
        print_header
        echo "Usage: $0 {start|stop|restart|status|test|logs|clean}"
        echo
        echo "Commands:"
        echo "  start    - Start both backend and frontend servers"
        echo "  stop     - Stop all servers"
        echo "  restart  - Restart all servers"
        echo "  status   - Show server status and health"
        echo "  test     - Run API tests"
        echo "  logs     - Show recent logs (optional: backend|frontend)"
        echo "  clean    - Stop servers and clean up files"
        echo
        echo "Examples:"
        echo "  $0 start           # Start everything"
        echo "  $0 status          # Check what's running"
        echo "  $0 logs backend    # View backend logs"
        echo "  $0 test            # Test the API"
        ;;
esac