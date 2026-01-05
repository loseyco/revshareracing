# Building iRCommander Client as a Single Executable

This guide explains how to build iRCommander Client as a single `.exe` file that can be shared and run on any Windows PC without requiring Python to be installed.

**Important**: Credentials are embedded in the executable during build, so users don't need to configure anything.

## Prerequisites

- Python 3.8 or higher installed
- All dependencies installed (run `pip install -r requirements.txt`)
- Your Supabase credentials (URL, Anon Key, and optionally Service Role Key)

## Quick Build

### Option 1: Interactive Build (Recommended)

1. Open a command prompt in the `ircommander_client` directory
2. Run the build script:
   ```batch
   build_exe.bat
   ```
3. When prompted, enter your Supabase credentials:
   - Supabase URL
   - Supabase Anon Key
   - Supabase Service Role Key (optional but recommended)

The executable will be created in the `dist` folder as `iRCommander.exe`.

### Option 2: Build with Environment Variables

1. Set your credentials as environment variables:
   ```batch
   set SUPABASE_URL=https://your-project.supabase.co
   set SUPABASE_ANON_KEY=your-anon-key
   set SUPABASE_SERVICE_ROLE_KEY=your-service-key
   ```
2. Run the build script:
   ```batch
   build_exe_with_env.bat
   ```

This method is useful for automated builds or CI/CD pipelines.

## Manual Build

If you prefer to build manually:

```batch
# Install PyInstaller if not already installed
pip install pyinstaller>=5.0

# Build using the spec file
pyinstaller ircommander.spec --clean --noconfirm
```

## Distribution

After building, you'll have:

- `dist/iRCommander.exe` - The standalone executable with embedded credentials

### To distribute to other PCs:

1. **Copy the executable**: Share `dist/iRCommander.exe`
2. **That's it!** Users just need to:
   - Place `iRCommander.exe` in a folder
   - Run `iRCommander.exe`

**No configuration needed** - credentials are embedded in the executable during build.

### Security Note

- Credentials are compiled into the executable
- Users cannot see or modify the credentials
- The executable is self-contained and ready to use
- For development, you can still use a `.env` file (it will override embedded credentials)

## Build Options

### Console vs Windowed Mode

By default, the executable runs in windowed mode (no console). To show console output for debugging:

Edit `ircommander.spec` and change:
```python
console=False,  # Change to True to show console
```

Then rebuild.

### File Size

The executable will be large (50-100MB+) because it includes:
- Python runtime
- All dependencies (PyQt6, Supabase client, iRacing SDK, etc.)
- All required DLLs

This is normal for PyInstaller one-file executables.

## Troubleshooting

### Build Fails

- Make sure all dependencies are installed: `pip install -r requirements.txt`
- Try cleaning and rebuilding: `pyinstaller ircommander.spec --clean`
- Check for missing hidden imports in the spec file

### Executable Won't Run

- Make sure `.env` file exists in the same folder as the executable
- Check Windows Defender/Antivirus - it may flag new executables
- Try running from command prompt to see error messages (if console=True)

### Missing Modules

If you get "ModuleNotFoundError" at runtime:
1. Add the missing module to `hiddenimports` in `ircommander.spec`
2. Rebuild

### PyQt6 Issues

If PyQt6 GUI doesn't work:
- Make sure PyQt6 is properly installed: `pip install PyQt6>=6.4.0`
- Check that all PyQt6 modules are in `hiddenimports`

## Advanced: Custom Icon

To add a custom icon:

1. Create or obtain a `.ico` file
2. Edit `ircommander.spec`:
   ```python
   icon='path/to/your/icon.ico',  # Add path to your icon file
   ```
3. Rebuild

## Notes

- The executable is self-contained - no Python installation needed on target PCs
- First run may be slower as it extracts files to a temporary directory
- The `.env` file must be in the same directory as the executable
- All data files (device info, etc.) will be created in a `data` subfolder next to the executable
