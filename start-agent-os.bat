@echo off
title Fast Agent OS
cd /d "%~dp0"

echo ========================================
echo   Fast Agent OS - starting...
echo ========================================

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js not found. Install from https://nodejs.org
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing dependencies...
  call npm install
)

echo Starting server at http://localhost:3000
start "" cmd /c "timeout /t 5 /nobreak >nul && start http://localhost:3000"

call npm run dev
