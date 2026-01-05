@echo off
cd /d "%~dp0"
echo Resetting device configuration...
python reset_device.py
pause
