@echo off
REM Wrapper script that ensures the window stays open
REM Use this if double-clicking build.bat closes too quickly

cd /d "%~dp0"
call build.bat
if errorlevel 1 (
    echo.
    echo ================================================================================
    echo Build failed with error code: %ERRORLEVEL%
    echo ================================================================================
)

echo.
echo Press any key to close this window...
pause >nul
