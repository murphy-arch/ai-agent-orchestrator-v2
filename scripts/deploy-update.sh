#!/bin/bash
# Quick update script for Digital Ocean deployment
set -e

APP_DIR="/opt/ai-orchestrator"
cd "$APP_DIR"

echo "[1/4] Pulling latest code..."
git pull origin main 2>/dev/null || echo "Not a git repo — skipping pull"

echo "[2/4] Installing dependencies..."
npm install

echo "[3/4] Building..."
npm run build

echo "[4/4] Reloading PM2..."
pm2 reload ai-orchestrator

echo "Done! Checking status..."
pm2 status
pm2 logs ai-orchestrator --lines 10
