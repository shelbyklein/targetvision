#!/bin/bash

# TargetVision Development Watch Script
# Runs both services with hot reload and watches for changes

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

print_header() {
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}     TargetVision Development Mode (Watch)     ${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Check for tmux
if ! command -v tmux &> /dev/null; then
    echo -e "${YELLOW}Installing tmux for better development experience...${NC}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install tmux
    else
        echo "Please install tmux: sudo apt-get install tmux (Ubuntu) or equivalent"
        exit 1
    fi
fi

# Function to setup backend with hot reload
setup_backend() {
    cd backend
    
    # Create/activate venv
    if [ ! -d "venv" ]; then
        python3 -m venv venv
    fi
    source venv/bin/activate
    
    # Install deps if needed
    pip install -q watchdog uvicorn[standard]
    
    # Run with auto-reload
    echo -e "${GREEN}Starting backend with hot reload...${NC}"
    uvicorn app_simple:app --reload --host 0.0.0.0 --port 7050
}

# Function to setup frontend with hot reload
setup_frontend() {
    cd frontend
    
    # Install deps if needed
    if [ ! -d "node_modules" ]; then
        npm install
    fi
    
    echo -e "${GREEN}Starting frontend with hot reload...${NC}"
    npm run dev
}

# Kill existing sessions
tmux kill-session -t targetvision 2>/dev/null || true

print_header

# Create new tmux session with split panes
echo -e "${BLUE}Starting development environment in tmux...${NC}"
echo ""

# Create session and split window
tmux new-session -d -s targetvision -n 'TargetVision Dev'
tmux send-keys -t targetvision:0.0 'cd backend && source venv/bin/activate 2>/dev/null || python3 -m venv venv && source venv/bin/activate && pip install -q watchdog && uvicorn app_simple:app --reload --host 0.0.0.0 --port 7050' C-m

tmux split-window -h -t targetvision:0
tmux send-keys -t targetvision:0.1 'cd frontend && npm run dev' C-m

# Create a third pane for logs
tmux split-window -v -t targetvision:0.0
tmux send-keys -t targetvision:0.2 'echo "Logs will appear here..."; tail -f backend/*.log 2>/dev/null || echo "No logs yet"' C-m

# Set pane titles
tmux select-pane -t targetvision:0.0 -T "Backend (FastAPI)"
tmux select-pane -t targetvision:0.1 -T "Frontend (Next.js)"
tmux select-pane -t targetvision:0.2 -T "Logs"

# Display instructions
clear
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}   Development Environment Started!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${BLUE}Frontend:${NC}  http://localhost:3000"
echo -e "  ${BLUE}Backend:${NC}   http://localhost:7050"
echo -e "  ${BLUE}API Docs:${NC}  http://localhost:7050/docs"
echo ""
echo -e "${YELLOW}Hot Reload:${NC} Both servers will auto-restart on file changes"
echo ""
echo -e "${CYAN}Tmux Commands:${NC}"
echo -e "  • Attach to session:  ${GREEN}tmux attach -t targetvision${NC}"
echo -e "  • Detach:             ${GREEN}Ctrl+B, D${NC}"
echo -e "  • Switch panes:       ${GREEN}Ctrl+B, Arrow Keys${NC}"
echo -e "  • Kill session:       ${GREEN}tmux kill-session -t targetvision${NC}"
echo ""

# Attach to session
tmux attach -t targetvision