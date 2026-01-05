@echo off
REM Build and Release Script for iRCommander
REM Builds the executable, uploads to Supabase, and updates the download link

cd /d "%~dp0"

echo ========================================
echo iRCommander - Build and Release
echo ========================================
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH
    pause
    exit /b 1
)

REM Get version from config.py
for /f "tokens=2 delims==" %%a in ('findstr /C:"VERSION = " config.py') do set VERSION=%%a
set VERSION=%VERSION:"=%
set VERSION=%VERSION: =%
echo [INFO] Building version: %VERSION%
echo.

REM Step 1: Clean previous builds
echo [1/6] Cleaning previous builds...
if exist build rmdir /s /q build
if exist dist rmdir /s /q dist
echo [OK] Cleanup complete
echo.

REM Step 2: Check credentials
echo [2/6] Checking credentials...
if not exist "credentials.py" (
    echo [ERROR] credentials.py not found!
    echo Please run build_exe.bat first to set up credentials.
    pause
    exit /b 1
)
python -c "import sys; sys.path.insert(0, '.'); from credentials import SUPABASE_URL, SUPABASE_ANON_KEY; sys.exit(0 if (SUPABASE_URL and SUPABASE_ANON_KEY) else 1)" 2>nul
if errorlevel 1 (
    echo [ERROR] credentials.py has empty values!
    echo Please run build_exe.bat first to set up credentials.
    pause
    exit /b 1
)
echo [OK] Credentials found
echo.

REM Step 3: Build executable
echo [3/6] Building executable...
echo This may take 5-10 minutes...
echo Building with PyInstaller...
echo.
python -m PyInstaller ircommander.spec --clean --noconfirm 2>&1 | findstr /C:"INFO:" /C:"WARNING:" /C:"ERROR:" /C:"Building"
if errorlevel 1 (
    echo [ERROR] Build failed!
    echo Check the error messages above
    pause
    exit /b 1
)

if not exist "dist\iRCommander.exe" (
    echo [ERROR] Executable not found after build!
    pause
    exit /b 1
)

for %%A in ("dist\iRCommander.exe") do set EXE_SIZE=%%~zA
set /a EXE_SIZE_MB=%EXE_SIZE% / 1048576
echo [OK] Build complete! Size: %EXE_SIZE_MB% MB
echo.

REM Step 4: Upload to Supabase
echo [4/6] Uploading to Supabase Storage...
python upload_release.py %VERSION% dist\iRCommander.exe "Auto-released build"
if errorlevel 1 (
    echo [ERROR] Upload failed!
    pause
    exit /b 1
)
echo [OK] Upload complete
echo.

REM Step 5: Update download link in database
echo [5/6] Updating download link in database...
python update_download_link.py %VERSION%
if errorlevel 1 (
    echo [WARN] Failed to update download link in database
    echo The file is uploaded, but the website may need manual update
) else (
    echo [OK] Download link updated in database
)
echo.

REM Step 6: Summary
echo [6/6] Release Summary
echo ========================================
echo Version: %VERSION%
echo Executable: dist\iRCommander.exe (%EXE_SIZE_MB% MB)
echo Status: Ready for distribution
echo.
echo The download link on the website will be updated automatically!
echo.
pause
