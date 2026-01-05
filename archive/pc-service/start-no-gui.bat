@echo off
REM Rev Share Racing - PC Service Launcher (no GUI)
REM Runs the service without GUI window

cd /d "%~dp0"

where python3 >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    python3 start.py --no-gui %*
) else (
    python start.py --no-gui %*
)

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Service exited with error code %ERRORLEVEL%
    pause
)

