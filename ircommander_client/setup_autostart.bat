@echo off
REM iRCommander - Autostart Setup
REM Adds/removes the application from Windows Startup

setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
set "APP_NAME=iRCommander"
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_PATH=%STARTUP_FOLDER%\%APP_NAME%.lnk"

echo ============================================================
echo iRCommander - Autostart Configuration
echo ============================================================
echo.

REM Check if shortcut exists
if exist "%SHORTCUT_PATH%" (
    echo [INFO] Autostart is currently ENABLED
    echo.
    set /p "choice=Disable autostart? (Y/N): "
    if /i "!choice!"=="Y" (
        del "%SHORTCUT_PATH%"
        echo [OK] Autostart disabled
    ) else (
        echo [INFO] Autostart remains enabled
    )
) else (
    echo [INFO] Autostart is currently DISABLED
    echo.
    
    REM Determine what to run (check for .exe first, then start.bat, then Python)
    if exist "%SCRIPT_DIR%GridPassCommander.exe" (
        set "TARGET=%SCRIPT_DIR%GridPassCommander.exe"
        set "WORK_DIR=%SCRIPT_DIR%"
        set "ARGS="
        echo [INFO] Found executable: GridPassCommander.exe
    ) else if exist "%SCRIPT_DIR%start.bat" (
        set "TARGET=%SCRIPT_DIR%start.bat"
        set "WORK_DIR=%SCRIPT_DIR%"
        set "ARGS="
        echo [INFO] Using start.bat
    ) else (
        REM Try to find Python
        where python >nul 2>&1
        if !errorlevel! equ 0 (
            set "TARGET=python"
            set "ARGS=%SCRIPT_DIR%main.py"
            set "WORK_DIR=%SCRIPT_DIR%"
            echo [INFO] Using Python script
        ) else (
            echo [ERROR] Could not find GridPassCommander.exe, start.bat, or Python
            echo        Please ensure the application files are in: %SCRIPT_DIR%
            pause
            exit /b 1
        )
    )
    
    echo.
    set /p "choice=Enable autostart? (Y/N): "
    if /i "!choice!"=="Y" (
        REM Create shortcut using PowerShell
        if defined ARGS (
            powershell -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%SHORTCUT_PATH%'); $Shortcut.TargetPath = '%TARGET%'; $Shortcut.WorkingDirectory = '%WORK_DIR%'; $Shortcut.Arguments = '%ARGS%'; $Shortcut.Save()"
        ) else (
            powershell -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%SHORTCUT_PATH%'); $Shortcut.TargetPath = '%TARGET%'; $Shortcut.WorkingDirectory = '%WORK_DIR%'; $Shortcut.Save()"
        )
        
        if exist "%SHORTCUT_PATH%" (
            echo [OK] Autostart enabled
            echo      Shortcut: %SHORTCUT_PATH%
            echo      Target: %TARGET%
        ) else (
            echo [ERROR] Failed to create shortcut
            exit /b 1
        )
    ) else (
        echo [INFO] Autostart not enabled
    )
)

echo.
pause
