#!/usr/bin/env bash
set -euo pipefail

echo "=========================================="
echo "  Zegrate AI - Startup Script"
echo "=========================================="

# Kill any existing server
pkill -f "uvicorn api.index:app" 2>/dev/null || true
sleep 1

# Start the FastAPI server
cd "$(dirname "$0")"
nohup python3.10 -m uvicorn api.index:app --host 0.0.0.0 --port 8000 --reload > server.log 2>&1 &
echo "Server PID: $!"
sleep 2

# Verify
if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
    echo "✓ Server running at http://localhost:8000"
    echo "✓ Ollama: $(curl -s http://localhost:8000/api/health | python3.10 -c 'import sys,json; print(json.load(sys.stdin)[\"status\"])')"
else
    echo "✗ Server failed to start. Check server.log"
    exit 1
fi

echo ""
echo "  Open http://localhost:8000 in your browser"
echo ""
