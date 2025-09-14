Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Starting HTN-2025 Development Environment" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/3] Installing dependencies..." -ForegroundColor Yellow
npm install
Set-Location qwen-api
npm install
Set-Location ..

Write-Host ""
Write-Host "[2/3] Starting Qwen API Server on port 3001..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd qwen-api; npm run dev"

Write-Host ""
Write-Host "Waiting for API server to start..." -ForegroundColor Gray
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "[3/3] Starting Electron Desktop App..." -ForegroundColor Yellow
npm run dev

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host "Development environment is running!" -ForegroundColor Green
Write-Host "- Desktop App: Running in Electron" -ForegroundColor Green
Write-Host "- Qwen API: http://localhost:3001" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green