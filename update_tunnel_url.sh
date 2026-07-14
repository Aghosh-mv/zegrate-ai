#!/bin/bash
# Monitors tunnel URL, updates GitHub Gist when URL changes
# Runs every 30 seconds via cron

GIST_ID="78eb3a0b4db48c73b1276974bd156008"
GIST_TOKEN="${GIST_TOKEN}"
TUNNEL_LOG="/tmp/tunnel.log"
LAST_URL_FILE="/tmp/last_tunnel_url.txt"

# Get current tunnel URL from log
CURRENT_URL=$(grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" 2>/dev/null | tail -1)

if [ -z "$CURRENT_URL" ]; then
    echo "No tunnel URL found, tunnel might not be running"
    exit 1
fi

# Check if URL changed since last time
if [ -f "$LAST_URL_FILE" ]; then
    LAST_URL=$(cat "$LAST_URL_FILE")
    if [ "$CURRENT_URL" = "$LAST_URL" ]; then
        exit 0  # Same URL, no update needed
    fi
fi

# Update gist with new URL
echo "Updating tunnel URL to: $CURRENT_URL"
curl -s -X PATCH "https://api.github.com/gists/$GIST_ID" \
  -H "Authorization: token $GIST_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"files\":{\"tunnel-url.txt\":{\"content\":\"$CURRENT_URL\"}}}" \
  --max-time 15 -o /dev/null -w "%{http_code}"

echo "$CURRENT_URL" > "$LAST_URL_FILE"
echo "Done"
