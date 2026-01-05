@echo off
cd /d "%~dp0"
echo Starting iRCommander in development mode (headless) with auto-reload...
python dev_reload.py --headless
pause


