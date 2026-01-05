# Distribution Guide - Standalone Executable

This guide explains how to build and distribute Rev Share Racing as a single standalone executable.

## Building the Executable

### Windows

1. Open a terminal in the `pc-service` directory
2. Run the build script:
   ```batch
   build.bat
   ```

The build will create a single `.exe` file at:
- `dist/RevShareRacing.exe`

### Manual Build

If you prefer to build manually:
```bash
python build_exe.py
```

## What Gets Built

The build creates a **single standalone executable** that:
- ✅ Contains all Python dependencies bundled inside
- ✅ Requires no Python installation
- ✅ Requires no additional dependencies
- ✅ Can be run from any folder
- ✅ Works on any Windows 10/11 PC (64-bit)

## Distribution

### For End Users

1. **Copy the executable**:
   - Copy `RevShareRacing.exe` to the desired location
   - Users can place it anywhere (Desktop, Program Files, etc.)

2. **Run the executable**:
   - Double-click `RevShareRacing.exe`
   - The service will start and connect to iRacing

### File Structure for Users

```
RevShareRacing/
└── RevShareRacing.exe    # Single executable file (that's it!)
```

That's it! No installation, no dependencies, no configuration needed - just double-click and run!

**Optional:** You can create a `.env` file to override the default Supabase settings for development/testing, but it's not required for normal use.

## Features

- **Single File**: Everything is bundled in one `.exe` file
- **Portable**: Run from any folder or USB drive
- **Self-Contained**: All dependencies included
- **No Installation**: Just copy and run
- **No Configuration**: Works immediately - production Supabase credentials are built-in

## Troubleshooting

### Antivirus False Positives

Some antivirus software may flag PyInstaller executables as suspicious. This is a false positive. You may need to:
- Add an exception for the executable
- Or code-sign the executable (requires a code signing certificate)

### Logs

When running, the executable creates a `logs` folder next to itself with detailed log files for debugging.

### Connection Issues

If the service can't connect to Supabase:
1. Check your internet connection
2. Check the logs folder for detailed error messages
3. If you're using a custom Supabase instance, create a `.env` file to override the default settings

## Build Requirements

To build the executable, you need:
- Python 3.8 or higher
- All dependencies from `requirements.txt`
- PyInstaller (installed automatically by `build.bat`)

## Notes

- The executable extracts temporary files when run (PyInstaller behavior)
- First run may be slightly slower as files are extracted
- The executable is Windows 64-bit only
- File size is typically 50-100MB (includes Python interpreter + dependencies)

