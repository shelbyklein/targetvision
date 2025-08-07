#!/bin/bash

# Start all TargetVision servers

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 Starting TargetVision Application..."
echo "======================================"

"$SCRIPT_DIR/targetvision.sh" start