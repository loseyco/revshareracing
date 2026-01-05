@echo off
REM Rev Share Racing - PC Service Launcher (with API server)
REM Runs the service with the --api flag enabled

cd /d "%~dp0"

where python3 >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    python3 start.py --api %*
) else (
    python start.py --api %*
)

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Service exited with error code %ERRORLEVEL%
    pause
)

