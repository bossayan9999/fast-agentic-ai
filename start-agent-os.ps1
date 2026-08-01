# Fast Agent OS - auto start (PowerShell)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "Fast Agent OS starting..." -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js not found. Install from https://nodejs.org" -ForegroundColor Red
  Read-Host "Press Enter to exit"
  exit 1
}

if (-not (Test-Path "node_modules")) {
  Write-Host "Installing dependencies..."
  npm install
}

Start-Process powershell -ArgumentList "-NoProfile -Command `"Start-Sleep -Seconds 6; Start-Process 'http://localhost:3000'`"" -WindowStyle Hidden

Write-Host "Server: http://localhost:3000" -ForegroundColor Green
npm run dev
