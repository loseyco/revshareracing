# iRCommander Client

A lightweight PC service for iRacing telemetry and rig control. **Works directly with Supabase - no API needed!**

## Features

- **iRacing Telemetry**: Real-time lap tracking and telemetry
- **Lap Recording**: Automatic lap upload directly to Supabase
- **Remote Control**: Execute commands from the web dashboard
- **Simple GUI**: Clean PyQt6 interface
- **Direct Database Access**: No API dependency - works even if API is down

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Run with GUI
python main.py

# Run headless
python main.py --headless
```

## Development Mode (Auto-Reload)

For development, use the auto-reload feature that watches for code changes and automatically restarts:

```bash
# Development mode with GUI (auto-reload on code changes)
python dev_reload.py
# or use the batch file:
dev_start.bat

# Development mode headless (auto-reload on code changes)
python dev_reload.py --headless
# or use the batch file:
dev_start_headless.bat
```

The auto-reload watcher monitors all `.py` files in the `ircommander_client` directory and automatically restarts the application when changes are detected. This makes development much faster - just save your changes and the app will restart automatically!

## Architecture

```
ircommander_client/
├── main.py              # Entry point
├── config.py            # Configuration
├── supabase_client.py   # Direct Supabase client (no API needed!)
├── service.py           # Main service orchestrator
├── gui.py               # PyQt6 GUI
└── core/
    ├── device.py        # Device fingerprinting
    ├── telemetry.py     # iRacing SDK integration
    └── controls.py      # Key bindings & window control
```

## Direct Supabase Integration

The client works **directly with Supabase** - no API middleman needed! This means:
- ✅ **More reliable** - works even if API is down
- ✅ **Faster** - direct database access
- ✅ **Simpler** - one less layer to troubleshoot

Operations:
- User authentication (login/register) via Supabase Auth
- Device registration directly to `irc_devices` table
- Lap uploads directly to `irc_laps` table
- Heartbeat updates directly to `irc_devices` table
- Command polling from `irc_device_commands` table

## Configuration

### Supabase Configuration

The client needs your Supabase credentials. 

**Quick Setup:**
1. Copy the example config file:
   ```bash
   cp config.example.env .env
   ```

2. Edit `.env` and fill in your Supabase credentials:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key-here
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   ```

**Get these values from:**
1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to Settings → API
4. Copy the URL and keys into your `.env` file

**Why service role key?**
- The service role key bypasses RLS policies
- Makes device operations simpler
- If not provided, the client uses the anon key (may require additional RLS policies)

**Troubleshooting:** If the client can't connect, verify:
1. The Supabase URL and keys are correct in `ircommander_client/.env`
2. Your Supabase project is active and accessible
3. The service role key has proper permissions (if using it)

## Building Executable

```bash
pip install pyinstaller
pyinstaller --onefile --windowed --name iRCommander main.py
```

## Windows Autostart Setup

To make iRCommander start automatically when Windows boots:

### Option 1: Using Batch File (Recommended)
Double-click `setup_autostart.bat` and follow the prompts. This works with both:
- Python script mode (current development)
- Compiled .exe (future production builds)

### Option 2: Using Python Script
```bash
# Check status
python setup_autostart.py status

# Enable autostart
python setup_autostart.py enable

# Disable autostart
python setup_autostart.py disable
```

**Note:** The Python script requires `pywin32` (install with `pip install pywin32`), but the batch file method doesn't require any additional dependencies.

The autostart setup creates a shortcut in the Windows Startup folder, so the application will launch automatically when you log in to Windows.

