@echo off
REM Script to help create a GitHub release with the executable
REM This builds the exe and provides instructions for uploading to GitHub

echo ================================================================================
echo Rev Share Racing - Create GitHub Release
echo ================================================================================
echo.

cd /d "%~dp0"

REM Check if executable exists
if not exist "dist\RevShareRacing.exe" (
    echo [*] Executable not found. Building now...
    echo.
    call build.bat
    if errorlevel 1 (
        echo [ERROR] Build failed!
        pause
        exit /b 1
    )
    echo.
)

if not exist "dist\RevShareRacing.exe" (
    echo [ERROR] Executable still not found after build!
    pause
    exit /b 1
)

echo [OK] Executable found: dist\RevShareRacing.exe
echo.

REM Get file size
for %%A in ("dist\RevShareRacing.exe") do set SIZE=%%~zA
set /a SIZE_MB=%SIZE% / 1048576
echo [INFO] File size: %SIZE_MB% MB
echo.

echo ================================================================================
echo Next Steps:
echo ================================================================================
echo.
echo 1. Go to GitHub Releases:
echo    https://github.com/loseyco/revshareracing/releases/new
echo.
echo 2. Create a new release:
echo    - Tag: v1.0.0 (or your version)
echo    - Title: Rev Share Racing v1.0.0
echo    - Description: Add release notes
echo.
echo 3. Upload the executable:
echo    Drag and drop: %CD%\dist\RevShareRacing.exe
echo.
echo 4. Click "Publish release"
echo.
echo ================================================================================
echo.

REM Check if GitHub CLI is available
where gh >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] GitHub CLI detected!
    echo.
    echo Would you like to create the release using GitHub CLI? (Y/N)
    set /p USE_GH="> "
    if /i "%USE_GH%"=="Y" (
        echo.
        echo Enter version tag (e.g., v1.0.0):
        set /p VERSION="> "
        if "%VERSION%"=="" set VERSION=v1.0.0
        
        echo.
        echo Enter release title:
        set /p TITLE="> "
        if "%TITLE%"=="" set TITLE=Rev Share Racing %VERSION%
        
        echo.
        echo Creating release...
        
        REM Read release notes from template if it exists
        set NOTES_FILE=RELEASE_NOTES_TEMPLATE.md
        if exist "%NOTES_FILE%" (
            echo [INFO] Using release notes from %NOTES_FILE%
            gh release create %VERSION% ^
              dist\RevShareRacing.exe ^
              --title "%TITLE%" ^
              --notes-file "%NOTES_FILE%"
        ) else (
            echo [INFO] Using default release notes
            gh release create %VERSION% ^
              dist\RevShareRacing.exe ^
              --title "%TITLE%" ^
              --notes "Rev Share Racing PC Service %VERSION%

## Quick Start

1. **Download** `RevShareRacing.exe` from this release
2. **Run** the executable (double-click)
3. **Claim your rig** using the claim code shown in the console
4. **Start iRacing** and the service will automatically connect

## Features

- ✅ Automatic lap tracking from iRacing
- ✅ Remote control via web portal
- ✅ Real-time status updates
- ✅ Standalone executable (no installation required)

## Requirements

- Windows 10/11 (64-bit)
- iRacing installed
- Internet connection

See RELEASE_NOTES_TEMPLATE.md for full documentation."
        )
        
        if errorlevel 1 (
            echo [ERROR] Failed to create release. Make sure you're authenticated:
            echo   gh auth login
        ) else (
            echo.
            echo [OK] Release created successfully!
            echo View at: https://github.com/loseyco/revshareracing/releases/tag/%VERSION%
        )
    )
)

echo.
pause
