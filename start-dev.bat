@echo off
echo ==================================================
echo Starting HTN-2025 Development Environment
echo ==================================================

echo.
echo [1/3] Installing dependencies...
call npm install
cd qwen-api
call npm install
cd ..

echo.
echo [2/3] Starting Qwen API Server on port 3001...
start cmd /k "cd qwen-api && npm run dev"

echo.
echo Waiting for API server to start...
timeout /t 3 /nobreak > nul

echo.
echo [3/3] Starting Electron Desktop App...
npm run dev

echo.
echo ==================================================
echo Development environment is running!
echo - Desktop App: Running in Electron
echo - Qwen API: http://localhost:3001
echo ==================================================
pause