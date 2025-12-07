@echo off
echo ================================================================================
echo iRacing Commander V4 - Build Standalone Executable
echo ================================================================================
echo.

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH
    echo Please install Python 3.8 or higher
    pause
    exit /b 1
)

REM Check if PyInstaller is installed
python -c "import PyInstaller" >nul 2>&1
if errorlevel 1 (
    echo [*] PyInstaller not found. Installing...
    pip install pyinstaller
    if errorlevel 1 (
        echo [ERROR] Failed to install PyInstaller
        pause
        exit /b 1
    )
)

echo [*] Building standalone executable...
echo [*] This may take a few minutes...
echo.

REM Clean previous build artifacts to avoid permission issues
if exist build (
    echo [*] Cleaning previous build folder...
    rmdir /s /q build 2>nul
    if exist build (
        echo [WARN] Unable to remove build folder (files in use?). Close Explorer/OneDrive and try again.
        pause
        exit /b 1
    )
)

if exist dist (
    echo [*] Cleaning previous dist folder...
    rmdir /s /q dist 2>nul
    if exist dist (
        echo [WARN] Unable to remove dist folder (files in use?). Close Explorer/OneDrive and try again.
        pause
        exit /b 1
    )
)

REM Build using onefolder mode (easier to debug and distribute)
python build_exe_onefolder.py

if errorlevel 1 (
    echo.
    echo [ERROR] Build failed!
    pause
    exit /b 1
)

REM Copy .env configuration file if present
if exist "..\.env" (
    echo [*] Copying .env configuration to dist folder...
    copy "..\.env" "dist\GridPassCommander\.env" >nul
) else if exist "..\..\.env" (
    echo [*] Copying .env configuration to dist folder...
    copy "..\..\.env" "dist\GridPassCommander\.env" >nul
) else if exist "..\..\..\.env" (
    echo [*] Copying .env configuration to dist folder...
    copy "..\..\..\.env" "dist\GridPassCommander\.env" >nul
) else (
    echo [WARN] Could not find .env file to copy. Ensure Supabase config is present.
)

echo.
echo ================================================================================
echo Build completed successfully!
echo ================================================================================
echo.
echo The executable is in: dist\GridPassCommander\GridPassCommander.exe
echo.
echo You can distribute the entire 'dist\GridPassCommander' folder.
echo Users can run GridPassCommander.exe directly - no installation needed!
echo.
pause

