# GridPass Commander Client

A lightweight, API-first PC service for iRacing telemetry and rig control.

## Features

- **iRacing Telemetry**: Real-time lap tracking and telemetry
- **Lap Recording**: Automatic lap upload to GridPass API
- **Remote Control**: Execute commands from the web dashboard
- **Simple GUI**: Clean PyQt6 interface

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Run with GUI
python main.py

# Run headless
python main.py --headless
```

## Architecture

```
commander_client/
├── main.py           # Entry point
├── config.py         # Configuration
├── api_client.py     # GridPass API client
├── service.py        # Main service orchestrator
├── gui.py            # PyQt6 GUI
└── core/
    ├── device.py     # Device fingerprinting
    ├── telemetry.py  # iRacing SDK integration
    └── controls.py   # Key bindings & window control
```

## API Integration

The client communicates with GridPass API for:
- Device registration (`POST /api/v1/device/register`)
- Heartbeat (`POST /api/v1/device/heartbeat`)
- Status updates (`PUT /api/v1/device/status`)
- Lap uploads (`POST /api/v1/device/laps`)
- Command polling (`GET /api/v1/device/commands`)

## Configuration

Set `GRIDPASS_API_URL` environment variable or create a `.env` file:

```
GRIDPASS_API_URL=https://gridpass.app
```

## Building Executable

```bash
pip install pyinstaller
pyinstaller --onefile --windowed --name GridPassCommander main.py
```

