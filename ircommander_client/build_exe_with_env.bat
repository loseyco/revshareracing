@echo off
REM Alternative build script that reads credentials from environment variables
REM Usage: Set SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
REM        then run this script

REM Change to the script's directory
cd /d "%~dp0"

echo ========================================
echo iRCommander Client - Build with Env Vars
echo ========================================
echo.

REM Check if environment variables are set
if not defined SUPABASE_URL (
    echo ERROR: SUPABASE_URL environment variable is not set
    echo.
    echo Usage:
    echo   set SUPABASE_URL=https://your-project.supabase.co
    echo   set SUPABASE_ANON_KEY=your-anon-key
    echo   set SUPABASE_SERVICE_ROLE_KEY=your-service-key
    echo   build_exe_with_env.bat
    echo.
    pause
    exit /b 1
)

if not defined SUPABASE_ANON_KEY (
    echo ERROR: SUPABASE_ANON_KEY environment variable is not set
    pause
    exit /b 1
)

echo Creating credentials.py from environment variables...
python -c "import os; open('credentials.py', 'w').write('''# Embedded Credentials\nSUPABASE_URL = r\"%SUPABASE_URL%\"\nSUPABASE_ANON_KEY = r\"%SUPABASE_ANON_KEY%\"\nSUPABASE_SERVICE_ROLE_KEY = r\"%SUPABASE_SERVICE_ROLE_KEY%\"\n''')"

if errorlevel 1 (
    echo ERROR: Failed to create credentials.py
    pause
    exit /b 1
)

echo Credentials file created.
echo.
echo Now running standard build...
echo.

call build_exe.bat
