#!/bin/bash
LOG="/tmp/auto_deploy.log"
TRAIN_LOG="/tmp/train_langsec.log"
CONFIG="ollama-training/configs/zegrate-langsec.yaml"
OUTPUT_DIR="/home/tinkerspace/ollama-training/outputs/zegrate-langsec-14b"
ADAPTER_PATH="$OUTPUT_DIR/checkpoint-500"

echo "[$(date)] Auto-deploy started" | tee "$LOG"

# Wait for training
while true; do
    STEP=$(tail -5 "$TRAIN_LOG" 2>/dev/null | grep -oP '\d+/500' | tail -1 | cut -d/ -f1)
    [ "$STEP" = "500" ] && break
    echo "[$(date)] Training at ${STEP:-?}/500..." | tee -a "$LOG"
    sleep 60
done

echo "[$(date)] Training complete!" | tee -a "$LOG"

# Step 1: Merge adapter (CPU)
echo "[$(date)] Merging adapter..." | tee -a "$LOG"
cd /home/tinkerspace/ollama-training

# We need to tell merge script the right adapter path
# Create a temp copy of config pointing to the checkpoint
TMP_CONFIG=$(mktemp)
sed "s|output_dir:.*|output_dir: $ADAPTER_PATH|" "$CONFIG" > "$TMP_CONFIG"

python3 scripts/merge_and_deploy.py --config "$TMP_CONFIG" --tag zegrate-langsec 2>&1 | tee -a "$LOG"
rm "$TMP_CONFIG"

# Step 2: Upload adapter to HF
echo "[$(date)] Uploading to HF..." | tee -a "$LOG"
export HF_TOKEN="${HF_TOKEN}"
python3 -c "
from huggingface_hub import HfApi, upload_folder
import os
api = HfApi(token=os.environ['HF_TOKEN'])
api.create_repo('yimn-Aghosh/zegrate-langsec', exist_ok=True)
upload_folder(folder_path='$ADAPTER_PATH', repo_id='yimn-Aghosh/zegrate-langsec', token=os.environ['HF_TOKEN'])
print('HF upload done')
" 2>&1 | tee -a "$LOG"

# Step 3: Restart server + tunnel
echo "[$(date)] Restarting services..." | tee -a "$LOG"
pkill -f "uvicorn.*api.index" 2>/dev/null; sleep 1
cd /home/tinkerspace/zegrate-ai
nohup ~/.local/bin/uvicorn api.index:app --host 0.0.0.0 --port 8000 > /tmp/server.log 2>&1 &
pkill -f cloudflared 2>/dev/null; sleep 1
nohup /tmp/cloudflared tunnel --url http://localhost:8000 > /tmp/tunnel.log 2>&1 &
sleep 5
TUNNEL_URL=$(grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/tunnel.log | tail -1)
echo "[$(date)] Tunnel: $TUNNEL_URL" | tee -a "$LOG"

# Step 5: Push to GitHub
GIT_PAT="${GIT_PAT}"
git add -A && git diff --cached --quiet || git commit -m "auto: add langsec model" 
git push https://x-access-token:${GIT_PAT}@github.com/Aghosh-mv/zegrate-ai HEAD:main 2>&1 | tee -a "$LOG"

echo "[$(date)] ALL DONE! Model zegrate-langsec is live." | tee -a "$LOG"
