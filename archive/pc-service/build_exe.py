#!/usr/bin/env python3
"""
Build script for creating standalone single-file executable
Creates a single .exe file with all dependencies bundled - no installation required
Run: python build_exe.py
"""

import PyInstaller.__main__
import os
import sys
from pathlib import Path

# Get the directory of this script
script_dir = Path(__file__).parent
src_dir = script_dir / 'src'

# Clean build and dist directories before building (prevents permission errors)
import shutil
build_dir = script_dir / 'build'
dist_dir = script_dir / 'dist'

print("[*] Cleaning previous build artifacts...")
if build_dir.exists():
    try:
        shutil.rmtree(build_dir, ignore_errors=True)
        print("[OK] Cleaned build directory")
    except Exception as e:
        print(f"[WARN] Could not fully clean build directory: {e}")
        print("[INFO] Continuing anyway - PyInstaller will try to clean...")

if dist_dir.exists():
    try:
        # Only remove old executable, keep the directory
        old_exe = dist_dir / 'RevShareRacing.exe'
        if old_exe.exists():
            try:
                old_exe.unlink()
                print("[OK] Removed old executable")
            except Exception as e:
                print(f"[WARN] Could not remove old executable: {e}")
    except Exception as e:
        print(f"[WARN] Could not clean dist directory: {e}")

# PyInstaller arguments for single-file standalone executable
args = [
    'start.py',  # Main script
    '--name=RevShareRacing',  # Name of executable
    '--onefile',  # Create a single executable file (all dependencies bundled)
    # Hide console window - runs in background
    '--windowed',  # Hide console window (no console window when running)
    # Don't use --clean since we cleaned manually and it causes permission errors
    '--noconfirm',  # Overwrite output directory without asking
    
    # Add data files (src directory will be bundled)
    '--add-data', f'{src_dir}{os.pathsep}src',  # Include src directory
    
    # Hidden imports (packages that might not be auto-detected)
    '--hidden-import=supabase',
    '--hidden-import=postgrest',
    '--hidden-import=realtime',
    '--hidden-import=storage',
    '--hidden-import=gotrue',
    '--hidden-import=functions',
    '--hidden-import=urllib3',
    '--hidden-import=certifi',
    '--hidden-import=requests',
    '--hidden-import=websocket',
    '--hidden-import=websockets',
    '--hidden-import=tkinter.ttk',
    '--hidden-import=python_dotenv',
    '--hidden-import=dotenv',
    '--hidden-import=Flask',
    '--hidden-import=flask_cors',
    '--hidden-import=PySide6',
    '--hidden-import=PIL',
    '--hidden-import=PIL._tkinter_finder',
    '--hidden-import=pyirsdk',  # iRacing SDK (pyirsdk package)
    '--hidden-import=irsdk',  # iRacing SDK (alternative name)
    
    # Collect all submodules
    '--collect-all=supabase',
    '--collect-all=postgrest',
    '--collect-all=realtime',
    '--collect-all=storage',
    '--collect-all=gotrue',
    '--collect-all=functions',
    
    # Icon (if you have one)
    # '--icon=icon.ico',
    
    # Output directory
    '--distpath=dist',  # Output directory
    '--workpath=build',  # Temp files directory
    '--specpath=.',  # Where to save the .spec file
    
    # Additional options
    '--noupx',  # Don't use UPX compression (can cause issues with antivirus)
]

print("=" * 80)
print("Building standalone single-file executable...")
print("=" * 80)
print()
print("This will create a single .exe file with all dependencies bundled.")
print("The executable can be run from any folder - no installation required!")
print()
print("This may take a few minutes...")
print()

try:
    PyInstaller.__main__.run(args)
    print()
    print("=" * 80)
    print("Build completed successfully!")
    print("=" * 80)
    print()
    exe_path = script_dir / 'dist' / 'RevShareRacing.exe'
    print(f"Executable location: {exe_path}")
    print()
    print("The executable is a standalone file with all dependencies included.")
    print("Users can:")
    print("  - Run it from any folder")
    print("  - No Python installation required")
    print("  - No dependencies to install")
    print("  - No configuration needed - production credentials are built-in")
    print()
    print("Just double-click RevShareRacing.exe and it will run!")
    print()
except Exception as e:
    print()
    print("=" * 80)
    print("Build failed!")
    print("=" * 80)
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

