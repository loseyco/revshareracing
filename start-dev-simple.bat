@echo off
setlocal

REM Launches the Rev Share Racing local dev environment.
REM Opens separate windows for the frontend dev server and PC service.

set SCRIPT_DIR=%~dp0

echo Starting Rev Share Racing development environment...
echo.

REM Check if web-app directory exists
if not exist "%SCRIPT_DIR%web-app" (
    echo [ERROR] web-app directory not found at %SCRIPT_DIR%web-app
    pause
    exit /b 1
)

REM Check if pc-service directory exists
if not exist "%SCRIPT_DIR%pc-service" (
    echo [ERROR] pc-service directory not found at %SCRIPT_DIR%pc-service
    pause
    exit /b 1
)

REM Start the Next.js dev server in a new window
echo Launching frontend dev server at http://localhost:3000...
start "RevShare Racing - Dev Server" cmd /k "cd /d "%SCRIPT_DIR%web-app" && npm run dev"

REM Wait a moment before starting the next service
timeout /t 2 /nobreak >nul

REM Detect Python command (python3 or python)
echo Launching PC service...
where python3 >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    start "RevShare Racing - PC Service" cmd /k "cd /d "%SCRIPT_DIR%pc-service" && python3 start.py"
) else (
    start "RevShare Racing - PC Service" cmd /k "cd /d "%SCRIPT_DIR%pc-service" && python start.py"
)

echo.
echo Both services are starting in separate windows.
echo Close those windows to stop the services.
echo.
pause

