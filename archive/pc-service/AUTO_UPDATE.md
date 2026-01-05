# Auto-Update System

The PC Service includes an automatic update system that checks for new versions and can automatically download and install them.

## How It Works

1. **Version Checking**: The service checks for updates every hour by querying the portal's API endpoint (`/api/github/latest-release`)
2. **Version Comparison**: Compares the current version (defined in `src/core/updater.py`) with the latest GitHub release
3. **Automatic Download**: When an update is available, it automatically downloads the new executable
4. **Automatic Installation**: After download completes, it waits 10 seconds then:
   - Creates a backup of the current executable
   - Replaces the current executable with the new one
   - Restarts the service automatically

## Configuration

### Current Version
The current version is defined in `src/core/updater.py`:
```python
CURRENT_VERSION = "1.0.0"
```

**Important**: Update this value when creating a new release!

### Update Check Interval
By default, the service checks for updates every hour (3600 seconds). This can be changed in the updater initialization.

## Update Process

1. **Check for Updates**: 
   - On startup: Checks after 30 seconds (to not slow down startup)
   - Periodically: Every hour while running

2. **Download Update**:
   - Downloads to `RevShareRacing_new.exe` in the same directory as the current executable
   - Shows progress during download

3. **Install Update**:
   - Creates backup: `RevShareRacing_backup_{timestamp}.exe`
   - Replaces current executable with new one
   - Restarts the service automatically

## Manual Update Check

You can also manually trigger an update check by calling:
```python
from core import updater
updater_instance = updater.get_updater()
update_info = updater_instance.check_for_updates()
```

## Disabling Auto-Update

To disable automatic updates, you can:
1. Comment out the updater initialization in `service.py`
2. Or modify the callbacks to not auto-download/install

## Requirements

- The service must be running as a compiled executable (`.exe`) for auto-update to work
- Internet connection required for checking and downloading updates
- The portal API endpoint must be accessible

## Logging

Update-related messages are logged with the `[UPDATER]` prefix:
- `[UPDATER] Update available: v1.1.0`
- `[UPDATER] Downloading update...`
- `[UPDATER] Download progress: 50.0%`
- `[UPDATER] Download complete`
- `[UPDATER] Installing update...`
- `[UPDATER] Update installed successfully`

## Notes

- The updater only works when running as a compiled executable (PyInstaller)
- Updates are downloaded to the same directory as the executable
- Backups are kept with timestamps for recovery if needed
- The service will automatically restart after installation


