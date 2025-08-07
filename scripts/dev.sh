#!/bin/bash

# Development helper script

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

show_menu() {
    echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║     TargetVision Developer Tools      ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
    echo
    echo "1) Install/Update Dependencies"
    echo "2) Watch Backend Logs"
    echo "3) Watch Frontend Logs"
    echo "4) Monitor Processes"
    echo "5) Quick Restart"
    echo "6) Check API Health"
    echo "7) Open API Docs"
    echo "8) Open Web Interface"
    echo "9) Database Status"
    echo "0) Exit"
    echo
}

install_deps() {
    echo -e "${YELLOW}Installing dependencies...${NC}\n"
    
    # Backend
    echo -e "${BLUE}Backend dependencies:${NC}"
    cd "$BACKEND_DIR"
    if [ ! -d "venv" ]; then
        python3 -m venv venv
    fi
    source venv/bin/activate
    pip install -r requirements-core.txt
    echo -e "${GREEN}✓ Backend dependencies installed${NC}\n"
    
    # Frontend
    echo -e "${BLUE}Frontend dependencies:${NC}"
    cd "$FRONTEND_DIR"
    npm install
    echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
}

watch_logs() {
    case $1 in
        backend)
            echo -e "${YELLOW}Watching backend logs (Ctrl+C to stop)...${NC}"
            tail -f "$PROJECT_ROOT/logs/backend.log"
            ;;
        frontend)
            echo -e "${YELLOW}Watching frontend logs (Ctrl+C to stop)...${NC}"
            tail -f "$PROJECT_ROOT/logs/frontend.log"
            ;;
    esac
}

monitor_processes() {
    echo -e "${YELLOW}Monitoring TargetVision processes (q to quit)...${NC}\n"
    
    while true; do
        clear
        echo -e "${BLUE}═══ TargetVision Process Monitor ═══${NC}\n"
        
        # Backend process
        if lsof -i :7050 >/dev/null 2>&1; then
            echo -e "${GREEN}✓ Backend:  RUNNING${NC}"
            ps aux | grep -v grep | grep "python.*app_simple" | head -1
        else
            echo -e "${RED}✗ Backend:  STOPPED${NC}"
        fi
        
        echo
        
        # Frontend process
        if lsof -i :3000 >/dev/null 2>&1; then
            echo -e "${GREEN}✓ Frontend: RUNNING${NC}"
            ps aux | grep -v grep | grep "next dev" | head -1
        else
            echo -e "${RED}✗ Frontend: STOPPED${NC}"
        fi
        
        echo
        echo -e "${YELLOW}Press 'q' to quit, 'r' to restart servers${NC}"
        
        read -t 2 -n 1 key
        if [[ $key = "q" ]]; then
            break
        elif [[ $key = "r" ]]; then
            "$PROJECT_ROOT/scripts/targetvision.sh" restart
            sleep 3
        fi
    done
}

quick_restart() {
    echo -e "${YELLOW}Quick restarting servers...${NC}"
    "$PROJECT_ROOT/scripts/targetvision.sh" restart
}

check_health() {
    echo -e "${YELLOW}Checking API health...${NC}\n"
    curl -s http://localhost:7050/api/health | python -m json.tool || echo -e "${RED}API is not responding${NC}"
}

open_docs() {
    echo -e "${YELLOW}Opening API documentation...${NC}"
    if command -v open >/dev/null; then
        open http://localhost:7050/docs
    elif command -v xdg-open >/dev/null; then
        xdg-open http://localhost:7050/docs
    else
        echo "Visit: http://localhost:7050/docs"
    fi
}

open_web() {
    echo -e "${YELLOW}Opening web interface...${NC}"
    if command -v open >/dev/null; then
        open http://localhost:3000
    elif command -v xdg-open >/dev/null; then
        xdg-open http://localhost:3000
    else
        echo "Visit: http://localhost:3000"
    fi
}

db_status() {
    echo -e "${YELLOW}Database Status:${NC}\n"
    
    # Check PostgreSQL
    if command -v psql >/dev/null 2>&1; then
        echo -e "${GREEN}✓ PostgreSQL installed${NC}"
        if pg_isready >/dev/null 2>&1; then
            echo -e "${GREEN}✓ PostgreSQL running${NC}"
        else
            echo -e "${RED}✗ PostgreSQL not running${NC}"
        fi
    else
        echo -e "${YELLOW}⚠ PostgreSQL not installed${NC}"
    fi
    
    # Check SQLite test database
    if [ -f "$BACKEND_DIR/targetvision_test.db" ]; then
        echo -e "${GREEN}✓ SQLite test database exists${NC}"
        size=$(ls -lh "$BACKEND_DIR/targetvision_test.db" | awk '{print $5}')
        echo "  Size: $size"
    else
        echo -e "${YELLOW}⚠ No SQLite test database${NC}"
    fi
}

# Main loop
while true; do
    show_menu
    read -p "Select option: " choice
    echo
    
    case $choice in
        1) install_deps ;;
        2) watch_logs backend ;;
        3) watch_logs frontend ;;
        4) monitor_processes ;;
        5) quick_restart ;;
        6) check_health ;;
        7) open_docs ;;
        8) open_web ;;
        9) db_status ;;
        0) echo "Goodbye!"; exit 0 ;;
        *) echo -e "${RED}Invalid option${NC}" ;;
    esac
    
    echo
    read -p "Press Enter to continue..."
    clear
done