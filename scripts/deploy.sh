#!/bin/bash
# Safe deployment script that preserves .env
set -e

APP_DIR="/opt/ai-orchestrator"
TAR_FILE="${1:-/tmp/ai-orchestrator-deploy.tar.gz}"

echo "[1/4] Backing up .env..."
if [ -f "$APP_DIR/.env" ]; then
  cp "$APP_DIR/.env" /tmp/.env.backup
  echo "  .env backed up"
fi

echo "[2/4] Extracting new code..."
sudo tar -xzf "$TAR_FILE" -C /tmp/
sudo cp -a /tmp/AI-Agent-Orchestrator-Deploy-Ready/. "$APP_DIR/"
sudo rm -rf /tmp/AI-Agent-Orchestrator-Deploy-Ready
sudo chown -R "$(whoami):$(whoami)" "$APP_DIR"

echo "[3/4] Restoring .env..."
if [ -f /tmp/.env.backup ]; then
  cp /tmp/.env.backup "$APP_DIR/.env"
  rm /tmp/.env.backup
  echo "  .env restored"
fi

echo "[4/4] Rebuilding and restarting..."
cd "$APP_DIR"
sudo docker compose up -d --build app
sleep 10
sudo docker compose ps

echo ""
echo "=== App logs (last 10 lines) ==="
sudo docker compose logs --tail 10 app || true

echo ""
echo "Deployment complete!"
