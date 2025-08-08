#!/bin/bash
# Script to start the TargetVision server

echo "Starting TargetVision MVP Server..."

# Activate virtual environment
source venv/bin/activate

# Run the FastAPI server
echo "Server starting at http://localhost:8000"
echo "API docs available at http://localhost:8000/docs"
echo "Press Ctrl+C to stop the server"

python backend/main.py