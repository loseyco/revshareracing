@echo off
REM Best option - Simple, reliable build script
REM Just double-click this file or run from Command Prompt

REM Change to script directory
cd /d "%~dp0"

REM Keep window open and show all output
echo ================================================================================
echo Rev Share Racing - Building Executable
echo ================================================================================
echo.
echo This will take 5-15 minutes. Keep this window open!
echo.

REM Check for Python (try multiple ways)
where python >nul 2>&1
if %errorlevel% equ 0 (
    set PYTHON_CMD=python
    goto :found_python
)

where py >nul 2>&1
if %errorlevel% equ 0 (
    set PYTHON_CMD=py
    goto :found_python
)

echo ERROR: Python not found in PATH
echo.
echo Please:
echo 1. Open Command Prompt manually
echo 2. Navigate to: %CD%
echo 3. Run: python build_exe.py
echo.
pause
exit /b 1

:found_python
echo Using: %PYTHON_CMD%
%PYTHON_CMD% --version
echo.

REM Check/install PyInstaller
echo Checking PyInstaller...
%PYTHON_CMD% -c "import PyInstaller" 2>nul
if errorlevel 1 (
    echo Installing PyInstaller (this may take a minute)...
    %PYTHON_CMD% -m pip install pyinstaller --quiet
)
echo.

REM Run the build - this is what takes time
echo ================================================================================
echo Starting build process...
echo ================================================================================
echo.
%PYTHON_CMD% build_exe.py

REM Check result
echo.
echo ================================================================================
if exist "dist\RevShareRacing.exe" (
    echo SUCCESS! Build completed!
    echo.
    echo Executable created at:
    echo   %CD%\dist\RevShareRacing.exe
    echo.
) else (
    echo BUILD FAILED!
    echo.
    echo Check the error messages above.
    echo.
    echo Common fixes:
    echo   1. Close OneDrive sync for this folder (it locks files)
    echo   2. Close File Explorer windows showing this folder
    echo   3. Install dependencies: %PYTHON_CMD% -m pip install -r requirements.txt
    echo   4. Check antivirus isn't blocking PyInstaller
    echo   5. Try running Command Prompt as Administrator
    echo.
    echo If files are locked by OneDrive:
    echo   - Right-click the folder in OneDrive
    echo   - Choose "Always keep on this device"
    echo   - Or pause OneDrive sync temporarily
)
echo ================================================================================
echo.
echo Press any key to close this window...
pause >nul
