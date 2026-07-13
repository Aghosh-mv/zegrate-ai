#!/bin/bash
# Ensure server + tunnel stay running

# Kill any stale processes
pkill -f "uvicorn.*api.index" 2>/dev/null
pkill -f cloudflared 2>/dev/null
sleep 1

# Start server
cd /home/tinkerspace/zegrate-ai
nohup ~/.local/bin/uvicorn api.index:app --host 0.0.0.0 --port 8000 > /tmp/server.log 2>&1 &
echo "Server PID: $!"

# Start tunnel
nohup /tmp/cloudflared tunnel --url http://localhost:8000 > /tmp/tunnel.log 2>&1 &
sleep 4
TUNNEL_URL=$(grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/tunnel.log | tail -1)
echo "Tunnel: $TUNNEL_URL"

# Start auto-deploy watcher (runs in background)
nohup bash /home/tinkerspace/zegrate-ai/auto_deploy.sh &
echo "Auto-deploy watcher started"
