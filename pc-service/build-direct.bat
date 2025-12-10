@echo off
REM Simple direct build script that shows output and stays open
REM This version doesn't pause at the start, just runs

cd /d "%~dp0"
echo ================================================================================
echo Rev Share Racing - Direct Build (No Pauses)
echo ================================================================================
echo.
echo Building executable... This may take several minutes.
echo.
echo Press Ctrl+C to cancel
echo.

REM Find Python
set PYTHON_CMD=python
python --version >nul 2>&1
if errorlevel 1 (
    py --version >nul 2>&1
    if not errorlevel 1 set PYTHON_CMD=py
)

echo Using: %PYTHON_CMD%
%PYTHON_CMD% --version
echo.

REM Check PyInstaller
%PYTHON_CMD% -c "import PyInstaller" >nul 2>&1
if errorlevel 1 (
    echo Installing PyInstaller...
    %PYTHON_CMD% -m pip install pyinstaller
)

echo.
echo Starting build...
echo.

REM Run the build
%PYTHON_CMD% build_exe.py

echo.
echo ================================================================================
if exist "dist\RevShareRacing.exe" (
    echo Build completed successfully!
    echo Executable: %CD%\dist\RevShareRacing.exe
) else (
    echo Build may have failed - executable not found.
    echo Check error messages above.
)
echo ================================================================================
echo.
echo Press any key to close this window...
pause >nul
