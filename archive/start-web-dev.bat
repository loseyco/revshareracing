@echo off
REM Start the Next.js web app in development mode for local testing
REM This runs the web app on http://localhost:3000

echo ================================================================================
echo Starting Rev Share Racing Web App (Development Mode)
echo ================================================================================
echo.

cd web-app

echo [*] Installing dependencies (if needed)...
call npm install
if errorlevel 1 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo [*] Starting Next.js development server...
echo [*] Web app will be available at: http://localhost:3000
echo.
echo Press Ctrl+C to stop the server
echo.

call npm run dev

pause
