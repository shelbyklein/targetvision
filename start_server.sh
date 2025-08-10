#!/bin/bash
# Script to start the TargetVision server

echo "Starting TargetVision MVP Server..."

# Activate virtual environment
source venv/bin/activate

# Kill any existing servers on our ports
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

echo "Starting backend server at http://localhost:8000"
echo "Starting frontend server at http://localhost:3000"
echo "API docs available at http://localhost:8000/docs"
echo "Press Ctrl+C to stop both servers"

# Start frontend server in background
cd frontend
python -m http.server 3000 > server.log 2>&1 &
FRONTEND_PID=$!
cd ..

# Start backend server (this will block)
python backend/main.py &
BACKEND_PID=$!

# Function to cleanup background processes
cleanup() {
    echo "Shutting down servers..."
    kill $FRONTEND_PID 2>/dev/null || true
    kill $BACKEND_PID 2>/dev/null || true
    exit
}

# Set trap to cleanup on script exit
trap cleanup INT TERM

# Wait for backend server (frontend runs in background)
wait $BACKEND_PID