@echo off
setlocal

REM Launches the Rev Share Racing local dev environment.
REM Opens separate PowerShell windows for the frontend and PC service.

set SCRIPT_DIR=%~dp0
set PS_SCRIPT=%SCRIPT_DIR%start-dev.ps1

if not exist "%PS_SCRIPT%" (
  echo Could not locate start-dev.ps1 in %SCRIPT_DIR%
  pause
  exit /b 1
)

PowerShell -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%"

echo.
echo Dev environment launched. Close this window if you are done.
pause

