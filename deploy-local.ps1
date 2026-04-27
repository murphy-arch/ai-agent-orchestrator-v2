# AI Agent Orchestrator — Local Deploy Script
# Usage: .\deploy-local.ps1

$ErrorActionPreference = "Stop"
$Droplet = "orchestrator-builder-os"
$AppDir = "/var/www/agent-stack"

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  Deploying to $Droplet" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# 1. Build
Write-Host "[1/4] Building..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed. Aborting." -ForegroundColor Red
    exit 1
}

# 2. Create tarball
Write-Host "[2/4] Creating archive..." -ForegroundColor Yellow
$TempFile = "$env:TEMP\agent-stack-deploy.tar.gz"
if (Test-Path $TempFile) { Remove-Item $TempFile -Force }

tar -czf "$TempFile" `
  --exclude=node_modules `
  --exclude=.git `
  --exclude=logs `
  --exclude=.env `
  --exclude=coverage `
  --exclude=dist-build-test `
  --exclude=uploads `
  --exclude=*.tar.gz `
  --exclude=*.zip `
  -C "$PSScriptRoot" .

# 3. Upload and deploy
Write-Host "[3/4] Uploading and deploying..." -ForegroundColor Yellow
$Key = "$env:USERPROFILE\.ssh\black_knights_deploy"

scp -i "$Key" -o StrictHostKeyChecking=accept-new "$TempFile" "root@${Droplet}:/tmp/agent-stack-deploy.tar.gz"

ssh -i "$Key" -o StrictHostKeyChecking=accept-new "root@$Droplet" @"
set -e
echo '[remote] Stopping service...'
systemctl stop agent-stack

echo '[remote] Extracting...'
cd $AppDir
tar -xzf /tmp/agent-stack-deploy.tar.gz --overwrite
rm /tmp/agent-stack-deploy.tar.gz

echo '[remote] Installing deps...'
npm install

echo '[remote] Running migrations...'
npx drizzle-kit migrate || true

echo '[remote] Fixing permissions...'
chown -R www-data:www-data $AppDir

echo '[remote] Starting service...'
systemctl start agent-stack
sleep 3
systemctl status agent-stack --no-pager || true

echo '[remote] Done'
"@

# 4. Cleanup and verify
Remove-Item "$TempFile" -Force

Write-Host "[4/4] Checking health..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
$Health = Invoke-RestMethod -Uri "https://orchestrator.website/api/health" -TimeoutSec 10
Write-Host "  Status: $($Health.status)" -ForegroundColor Green
Write-Host "  DB: $($Health.db)" -ForegroundColor Green

Write-Host ""
Write-Host "===============================================" -ForegroundColor Green
Write-Host "  DEPLOY COMPLETE" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
Write-Host ""
Write-Host "URL: https://orchestrator.website" -ForegroundColor Cyan
