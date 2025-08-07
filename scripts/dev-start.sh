#!/bin/bash

# TargetVision Development Start Script
# This script starts both backend and frontend with proper error handling

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[TargetVision]${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Function to check if a port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        return 0
    else
        return 1
    fi
}

# Function to kill process on port
kill_port() {
    if check_port $1; then
        print_warning "Port $1 is in use. Attempting to kill process..."
        lsof -ti:$1 | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
}

# Cleanup function
cleanup() {
    print_status "Shutting down services..."
    
    # Kill backend if running
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    
    # Kill frontend if running
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    
    # Clean up any remaining processes on ports
    kill_port 7050
    kill_port 3000
    
    print_success "Cleanup complete"
    exit 0
}

# Set up trap for cleanup on exit
trap cleanup EXIT INT TERM

# Check if we're in the project root
if [ ! -d "frontend" ] || [ ! -d "backend" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

print_status "Starting TargetVision Development Environment..."
echo ""

# Check and install backend dependencies if needed
print_status "Checking backend dependencies..."
cd backend

if [ ! -d "venv" ]; then
    print_warning "Virtual environment not found. Creating..."
    python3 -m venv venv
    print_success "Virtual environment created"
fi

# Activate virtual environment
source venv/bin/activate

# Check if requirements are installed
if ! python -c "import fastapi" 2>/dev/null; then
    print_warning "Installing backend dependencies..."
    pip install -r requirements.txt
    print_success "Backend dependencies installed"
else
    print_success "Backend dependencies OK"
fi

# Check for .env file
if [ ! -f ".env" ]; then
    print_warning "Backend .env file not found. Copying from .env.example..."
    cp .env.example .env
    print_warning "Please update backend/.env with your API keys"
fi

# Kill any existing processes on backend port
kill_port 7050

# Start backend
print_status "Starting backend server on port 7050..."
python app_simple.py &
BACKEND_PID=$!

# Wait for backend to start
sleep 5
if check_port 7050; then
    print_success "Backend started successfully"
    echo "  → API: http://localhost:7050"
    echo "  → Docs: http://localhost:7050/docs"
else
    print_error "Backend failed to start"
    exit 1
fi

cd ..
echo ""

# Check and install frontend dependencies
print_status "Checking frontend dependencies..."
cd frontend

if [ ! -d "node_modules" ]; then
    print_warning "Node modules not found. Installing..."
    npm install
    print_success "Frontend dependencies installed"
else
    print_success "Frontend dependencies OK"
fi

# Check for TypeScript errors
print_status "Checking TypeScript..."
if npm run type-check 2>/dev/null; then
    print_success "TypeScript check passed"
else
    print_warning "TypeScript errors detected (non-blocking)"
fi

# Kill any existing processes on frontend port
kill_port 3000

# Build frontend in development mode
print_status "Starting frontend server on port 3000..."
npm run dev &
FRONTEND_PID=$!

# Wait for frontend to start
sleep 5
if check_port 3000; then
    print_success "Frontend started successfully"
    echo "  → URL: http://localhost:3000"
else
    print_error "Frontend failed to start"
    exit 1
fi

echo ""
print_success "TargetVision is running!"
echo ""
echo "┌─────────────────────────────────────────┐"
echo "│  🚀 TargetVision Development Server     │"
echo "├─────────────────────────────────────────┤"
echo "│  Frontend:  http://localhost:3000      │"
echo "│  Backend:   http://localhost:7050      │"
echo "│  API Docs:  http://localhost:7050/docs │"
echo "└─────────────────────────────────────────┘"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Keep script running and show logs
tail -f /dev/null