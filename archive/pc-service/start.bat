@echo off
REM Rev Share Racing - PC Service Launcher
REM This batch file runs the PC service with optional arguments

REM Change to the script directory
cd /d "%~dp0"

REM Try python3 first, then python
where python3 >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    python3 start.py %*
) else (
    python start.py %*
)

REM Keep window open if there's an error
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Service exited with error code %ERRORLEVEL%
    pause
)

