#!/bin/bash

# Stop all TargetVision servers

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🛑 Stopping TargetVision Application..."
echo "======================================"

"$SCRIPT_DIR/targetvision.sh" stop