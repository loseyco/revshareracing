# Building Standalone Executable

This guide explains how to build a standalone executable that requires no installation and includes all dependencies.

## Prerequisites

1. **Python 3.8 or higher** installed
2. **All dependencies installed**:
   ```bash
   pip install -r requirements.txt
   pip install pyinstaller
   ```

## Building the Executable

### Option 1: Using the Batch Script (Windows)

Simply run:
```bash
build.bat
```

This will:
- Check if Python and PyInstaller are installed
- Install PyInstaller if needed
- Build the executable in `onedir` mode (folder with exe + dependencies)

### Option 2: Using Python Scripts Directly

**For onefolder mode** (recommended - easier to debug):
```bash
python build_exe_onefolder.py
```

**For onefile mode** (single executable):
```bash
python build_exe.py
```

## Output

After building, you'll find:

- **Onefolder mode**: `dist/RevShareRacing/RevShareRacing.exe`
  - Contains the exe and all dependencies in one folder
  - Easier to debug and troubleshoot
  - Recommended for distribution

- **Onefile mode**: `dist/RevShareRacing.exe`
  - Single executable file
  - Slower startup (extracts to temp folder)
  - Cleaner distribution

## Distribution

### Onefolder Mode (Recommended)

1. Copy the entire `dist/RevShareRacing` folder
2. Users can run `RevShareRacing.exe` directly
3. No installation required
4. All dependencies are included

### Onefile Mode

1. Copy `dist/RevShareRacing.exe`
2. Users can run it directly
3. No installation required
4. All dependencies are bundled inside

## Notes

- The executable includes all Python dependencies
- No Python installation needed on target machines
- The `src/` folder is included as data
- Console window is visible by default (for debugging)
- To hide console window, uncomment `--windowed` in the build script

## Troubleshooting

### Build Fails

1. Make sure all dependencies are installed:
   ```bash
   pip install -r requirements.txt
   pip install pyinstaller
   ```

2. Check Python version:
   ```bash
   python --version
   ```
   Should be 3.8 or higher

3. Try cleaning and rebuilding:
   ```bash
   rmdir /s /q build dist
   python build_exe_onefolder.py
   ```

### Executable Doesn't Run

1. Check if all DLLs are included (onefolder mode)
2. Try running from command line to see error messages
3. Check Windows Defender/antivirus isn't blocking it
4. Ensure the `src/` folder is included in the distribution

### Missing Modules

If you get "ModuleNotFoundError":
1. Add the module to `--hidden-import` in the build script
2. Rebuild the executable

## File Structure After Build

```
dist/
└── RevShareRacing/
    ├── RevShareRacing.exe
    ├── src/
    │   ├── config.py
    │   ├── core/
    │   ├── gui/
    │   └── service.py
    ├── _internal/  (PyInstaller internal files)
    └── [various DLLs and dependencies]
```

