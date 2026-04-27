# AI Agent Orchestrator — Windows Deploy Script
# Usage: .\deploy\deploy.ps1 root@YOUR_DROPLET_IP

param(
    [Parameter(Mandatory=$true)]
    [string]$Droplet,

    [string]$AppDir = "/var/www/agent-stack"
)

$ErrorActionPreference = "Stop"

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  Deploying to $Droplet" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Check for required tools
$hasScp = Get-Command scp -ErrorAction SilentlyContinue
$hasSsh = Get-Command ssh -ErrorAction SilentlyContinue

if (-not $hasScp -or -not $hasSsh) {
    Write-Host "ERROR: ssh and scp are required. Install OpenSSH or use Git Bash." -ForegroundColor Red
    exit 1
}

# ─── Build locally ───
Write-Host "[1/4] Building for production..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed. Aborting." -ForegroundColor Red
    exit 1
}

# ─── Create archive ───
Write-Host "[2/4] Creating deployment archive..." -ForegroundColor Yellow
$tempDir = [System.IO.Path]::GetTempPath()
$archive = Join-Path $tempDir "agent-stack-deploy.zip"

# Exclude files not needed in production
$exclude = @(
    "node_modules", ".git", "logs", ".env", 
    "*.test.ts", "coverage",
    "deploy", ".vscode", ".idea"
)

# Use Compress-Archive
$items = Get-ChildItem -Path "." -Exclude $exclude
if (Test-Path $archive) { Remove-Item $archive -Force }
Compress-Archive -Path $items -DestinationPath $archive -Force

# ─── Upload and extract ───
Write-Host "[3/4] Uploading to droplet..." -ForegroundColor Yellow
scp $archive "${Droplet}:${AppDir}/deploy.zip"

Write-Host "[3/4] Extracting and installing..." -ForegroundColor Yellow
ssh $Droplet @"
    set -e
    cd $AppDir
    # Backup current dist
    if [ -d dist ]; then mv dist dist.bak.\$(date +%s); fi
    # Extract
    unzip -o deploy.zip -d . >/dev/null 2>&1
    rm deploy.zip
    # Install production deps
    npm install --production
    # Run migrations
    npx drizzle-kit migrate
    # Fix permissions
    chown -R www-data:www-data .
"@

# ─── Restart service ───
Write-Host "[4/4] Restarting service..." -ForegroundColor Yellow
ssh $Droplet "sudo systemctl restart agent-stack"

Write-Host ""
Write-Host "===============================================" -ForegroundColor Green
Write-Host "  DEPLOY COMPLETE" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Checking service status..." -ForegroundColor Cyan
ssh $Droplet "sudo systemctl status agent-stack --no-pager"
Write-Host ""
Write-Host "Health check:" -ForegroundColor Cyan
$ip = ($Droplet -split "@")[1]
Start-Sleep -Seconds 2
try {
    $health = Invoke-RestMethod -Uri "http://${ip}/health" -TimeoutSec 10
    Write-Host "  Status: $($health.status)" -ForegroundColor Green
    Write-Host "  DB: $($health.db)" -ForegroundColor Green
    Write-Host "  Version: $($health.version)" -ForegroundColor Green
} catch {
    Write-Host "  Health check failed (may need a few more seconds)" -ForegroundColor Yellow
}
