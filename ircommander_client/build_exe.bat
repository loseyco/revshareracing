@echo off
REM Build script for creating iRCommander single executable
REM This creates a standalone .exe file that can be shared

REM Change to the script's directory
cd /d "%~dp0"

echo ========================================
echo iRCommander Client - Build Executable
echo ========================================
echo.
echo Building from: %CD%
echo.

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.8+ and try again
    pause
    exit /b 1
)

echo [1/5] Setting up credentials...
echo.

REM Check if credentials.py already exists and has valid values
if exist "credentials.py" (
    REM Validate that credentials are not empty
    python -c "import sys; sys.path.insert(0, '.'); from credentials import SUPABASE_URL, SUPABASE_ANON_KEY; sys.exit(0 if (SUPABASE_URL and SUPABASE_ANON_KEY) else 1)" 2>nul
    if errorlevel 1 (
        echo WARNING: credentials.py exists but has empty values!
        echo.
        echo Please provide your Supabase credentials:
        echo.
        set /p SUPABASE_URL_INPUT="Supabase URL: "
        set /p SUPABASE_ANON_KEY_INPUT="Supabase Anon Key: "
        set /p SUPABASE_SERVICE_KEY_INPUT="Supabase Service Role Key (optional): "
        echo.
        
        REM Create credentials.py file using Python helper script
        python create_credentials.py "%SUPABASE_URL_INPUT%" "%SUPABASE_ANON_KEY_INPUT%" "%SUPABASE_SERVICE_KEY_INPUT%"
        
        if errorlevel 1 (
            echo ERROR: Failed to create credentials.py
            pause
            exit /b 1
        )
        
        echo Credentials saved to credentials.py
        echo.
    ) else (
        echo Using existing credentials.py (credentials are set)
        echo.
    )
) else (
    echo Credentials will be embedded in the executable.
    echo.
    echo Please provide your Supabase credentials:
    echo.
    set /p SUPABASE_URL_INPUT="Supabase URL: "
    set /p SUPABASE_ANON_KEY_INPUT="Supabase Anon Key: "
    set /p SUPABASE_SERVICE_KEY_INPUT="Supabase Service Role Key (optional): "
    echo.
    
    REM Create credentials.py file using Python helper script
    python create_credentials.py "%SUPABASE_URL_INPUT%" "%SUPABASE_ANON_KEY_INPUT%" "%SUPABASE_SERVICE_KEY_INPUT%"
    
    if errorlevel 1 (
        echo ERROR: Failed to create credentials.py
        pause
        exit /b 1
    )
    
    echo Credentials saved to credentials.py
    echo.
)

REM Check if credentials are set via environment variables (takes precedence)
if defined SUPABASE_URL (
    echo Using credentials from environment variables...
    python create_credentials.py "%SUPABASE_URL%" "%SUPABASE_ANON_KEY%" "%SUPABASE_SERVICE_ROLE_KEY%"
    echo Credentials updated from environment variables.
    echo.
)

echo [2/5] Checking dependencies...
python -m pip show pyinstaller >nul 2>&1
if errorlevel 1 (
    echo Installing PyInstaller...
    python -m pip install pyinstaller>=5.0
    if errorlevel 1 (
        echo ERROR: Failed to install PyInstaller
        pause
        exit /b 1
    )
)

echo [3/5] Installing/updating requirements...
python -m pip install -r requirements.txt --quiet
if errorlevel 1 (
    echo WARNING: Some requirements may have failed to install
    echo Continuing anyway...
)

echo [4/5] Building executable...
echo This may take a few minutes...
echo.

REM Build using the spec file
python -m PyInstaller ircommander.spec --clean --noconfirm

if errorlevel 1 (
    echo.
    echo ERROR: Build failed!
    echo Check the error messages above
    pause
    exit /b 1
)

echo.
echo [5/5] Cleaning up...
REM Optionally remove credentials.py after build (for security)
REM Uncomment the next line if you want to auto-delete credentials.py after build
REM del /q credentials.py 2>nul

echo.
echo Build complete!
echo.
echo ========================================
echo Executable location:
echo   dist\iRCommander.exe
echo ========================================
echo.
echo Next steps:
echo   1. Copy iRCommander.exe to the target PC
echo   2. Run iRCommander.exe (no configuration needed!)
echo.
echo Note: Credentials are embedded in the executable.
echo       No .env file is required.
echo.
pause
