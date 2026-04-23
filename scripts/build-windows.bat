@echo off
echo ============================================
echo  AI Agent Orchestrator - Windows Build
echo ============================================
echo.

REM Check for Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js 20+ from https://nodejs.org
    pause
    exit /b 1
)

echo [1/5] Installing dependencies...
call npm install
if errorlevel 1 (
    echo ERROR: npm install failed
    pause
    exit /b 1
)

echo [2/5] Building frontend and backend...
call npm run build
if errorlevel 1 (
    echo ERROR: Build failed
    pause
    exit /b 1
)

echo [3/5] Building Windows installer and portable app...
call npx electron-builder --win nsis portable --x64
if errorlevel 1 (
    echo ERROR: Electron build failed
    pause
    exit /b 1
)

echo.
echo ============================================
echo  BUILD SUCCESSFUL!
echo ============================================
echo.
echo Installer: release\AI Agent Orchestrator Setup.exe
echo Portable:  release\AI-Agent-Orchestrator-Portable.exe
echo.
pause
