# Rev Share Racing PC Service v1.0.0

## 🎮 What is This?

Rev Share Racing PC Service is a standalone application that connects your iRacing simulator to the Rev Share Racing platform. It automatically collects lap times, tracks your sessions, and enables remote control of your rig from the web portal.

## ✨ Features

- ✅ **Automatic Lap Tracking** - Automatically records lap times from iRacing
- ✅ **Remote Control** - Control your rig remotely from the web portal (enter car, reset car, ignition, etc.)
- ✅ **Real-time Status** - Monitor your rig's status in real-time
- ✅ **Standalone Executable** - No Python installation required
- ✅ **Zero Configuration** - Works immediately out of the box

## 📥 Download

**Download the latest release:**
- Click the **"RevShareRacing.exe"** file above to download
- File size: ~60 MB
- No installation required!

## 🚀 Quick Start Guide

### Step 1: Download and Run
1. Download `RevShareRacing.exe` from this release
2. Place it in any folder (Desktop, Documents, etc.)
3. Double-click `RevShareRacing.exe` to run

### Step 2: Claim Your Rig
1. The application will start and show a console window
2. Look for a message like: `[*] Claim this rig: https://revshareracing.com/device/rig-XXXXXX/claim?claimCode=XXXXXX`
3. **Click that link** (or copy it to your browser)
4. Sign up or log in if needed
5. The claim page will automatically load with your device information and claim code
6. Click "Claim This Device"
7. Done! Your rig is now connected

### Step 4: Start iRacing
1. Launch iRacing and join a session
2. The PC service will automatically:
   - Connect to iRacing
   - Start collecting lap times
   - Update your status on the web portal

## 📋 Requirements

- **Windows 10/11** (64-bit)
- **iRacing** installed and running
- **Internet connection** (for Supabase sync)
- **No Python installation needed** - everything is bundled!

## 🎯 What It Does

### Automatic Features
- **Lap Collection**: Automatically records lap times when you complete laps
- **Session Tracking**: Tracks your iRacing sessions and resets lap counters between sessions
- **Status Updates**: Updates your rig status (in car, speed, RPM, etc.) in real-time

### Remote Control (via Web Portal)
Once your rig is claimed, you can control it remotely from https://revshareracing.com:
- **Enter Car** - Automatically enter the car in iRacing
- **Reset Car** - Reset to pits (with optional grace period)
- **Ignition** - Turn engine on/off
- **Pit Speed Limiter** - Toggle pit speed limiter

## 📁 File Structure

After first run, the application creates:
```
RevShareRacing.exe
├── logs/              (Log files for debugging)
└── data/              (Device configuration - auto-created)
```

## 🔧 Troubleshooting

### "iRacing not connected"
- Make sure iRacing is running and you're in a session (not just the UI)
- The service needs iRacing to be actively running to connect

### "Device not found" when claiming
- Make sure the PC service is running
- Wait a few seconds after starting the service for it to register
- Check that the device ID and claim code match what's shown in the console

### Commands not working
- Ensure iRacing is running and in focus
- Check the console window for error messages
- Verify your key bindings are configured in iRacing settings

### Antivirus Warning
Some antivirus software may flag PyInstaller executables. This is a false positive. You may need to:
- Add an exception for `RevShareRacing.exe`
- Or temporarily disable antivirus during download/extraction

## 📊 Monitoring Your Rig

Once claimed, you can monitor your rig at:
- **Dashboard**: https://revshareracing.com/dashboard
- **Device Details**: https://revshareracing.com/device/rig-XXXXXX/details

The dashboard shows:
- Real-time connection status
- Total laps recorded
- Best lap times
- Recent lap history

## 🆘 Getting Help

- **Logs**: Check the `logs/` folder next to the executable for detailed error messages
- **Console Window**: The console shows real-time status and any errors
- **Web Portal**: Check your device status on the web portal

## 🔄 Updates

To update to a new version:
1. Download the latest `RevShareRacing.exe` from the releases page
2. Replace your old executable
3. Your device configuration and lap history are preserved

## 📝 Notes

- The service runs in the background while you race
- You can minimize the console window (but don't close it)
- Logs are automatically saved for troubleshooting
- First run may take a few seconds to initialize

---

**Enjoy racing! 🏁**

For issues or questions, check the logs folder or contact support.
