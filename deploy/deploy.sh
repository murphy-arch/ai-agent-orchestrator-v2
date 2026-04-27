#!/bin/bash
set -e

# =============================================================================
# AI Agent Orchestrator — Deploy Script
# =============================================================================
# Usage: ./deploy/deploy.sh user@your-droplet-ip
# =============================================================================

DROPLET="${1:-}"
APP_DIR="/var/www/agent-stack"

if [ -z "$DROPLET" ]; then
  echo "Usage: ./deploy/deploy.sh user@your-droplet-ip"
  echo ""
  echo "Example:"
  echo "  ./deploy/deploy.sh root@123.456.789.0"
  exit 1
fi

echo "==============================================="
echo "  Deploying to $DROPLET"
echo "==============================================="
echo ""

# ─── Build locally ───
echo "[1/4] Building for production..."
npm run build

# ─── Sync files to droplet ───
echo "[2/4] Syncing files to droplet..."
rsync -avz --delete \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='logs' \
  --exclude='.env' \
  --exclude='*.test.ts' \
  --exclude='coverage' \
  ./ "$DROPLET:$APP_DIR/"

# ─── Install deps and run migrations on droplet ───
echo "[3/4] Installing dependencies and running migrations..."
ssh "$DROPLET" "cd $APP_DIR && npm install --production && npx drizzle-kit migrate"

# ─── Restart service ───
echo "[4/4] Restarting service..."
ssh "$DROPLET" "sudo systemctl restart agent-stack"

echo ""
echo "==============================================="
echo "  DEPLOY COMPLETE"
echo "==============================================="
echo ""
echo "Checking service status..."
ssh "$DROPLET" "sudo systemctl status agent-stack --no-pager"
echo ""
