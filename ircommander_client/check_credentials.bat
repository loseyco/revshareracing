@echo off
REM Quick script to check if credentials.py has valid values

cd /d "%~dp0"

if not exist "credentials.py" (
    echo ERROR: credentials.py does not exist!
    echo Run build_exe.bat to create it.
    pause
    exit /b 1
)

python -c "import sys; sys.path.insert(0, '.'); from credentials import SUPABASE_URL, SUPABASE_ANON_KEY; print('SUPABASE_URL:', 'SET' if SUPABASE_URL else 'EMPTY'); print('SUPABASE_ANON_KEY:', 'SET' if SUPABASE_ANON_KEY else 'EMPTY')"

pause
