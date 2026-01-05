@echo off
echo ========================================
echo iRCommander - Remove Auto-Start
echo ========================================
echo.

set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "STARTUP_FILE=%STARTUP_FOLDER%\GridPassCommander.vbs"

if exist "%STARTUP_FILE%" (
    echo Removing iRCommander from Windows Startup...
    del "%STARTUP_FILE%"
    
    if %ERRORLEVEL% EQU 0 (
        echo [OK] Auto-start has been removed.
    ) else (
        echo [ERROR] Failed to remove. Please check permissions.
    )
) else (
    echo iRCommander is not set to auto-start.
)

echo.
pause
