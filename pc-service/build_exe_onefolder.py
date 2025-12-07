#!/usr/bin/env python3
"""
Build script for creating standalone executable in a folder (onefolder mode)
This creates a folder with the exe and all dependencies - easier to debug
Run: python build_exe_onefolder.py
"""

import PyInstaller.__main__
import os
import sys
from pathlib import Path

# Get the directory of this script
script_dir = Path(__file__).parent
src_dir = script_dir / 'src'

# PyInstaller arguments
args = [
    'start.py',  # Main script
    '--name=GridPassCommander',  # Name of executable
    '--onedir',  # Create a folder with executable and dependencies
    # Keep console visible for debugging - shows errors
    # Uncomment next line to hide console (only if everything works):
    # '--windowed',  # Hides console window (GUI only)
    '--clean',  # Clean PyInstaller cache before building
    '--noconfirm',  # Overwrite output directory without asking
    
    # Add data files
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
    
    # Additional options
    '--noupx',  # Don't use UPX compression (can cause issues)
]

print("Building standalone executable (onefolder mode)...")
print("This may take a few minutes...")
print()

try:
    PyInstaller.__main__.run(args)
    print()
    print("=" * 80)
    print("Build completed successfully!")
    print("=" * 80)
    print()
    print(f"Executable location: {script_dir / 'dist' / 'GridPassCommander' / 'GridPassCommander.exe'}")
    print()
    print("The 'dist/GridPassCommander' folder contains:")
    print("  - GridPassCommander.exe (main executable)")
    print("  - All required DLLs and dependencies")
    print("  - src/ folder with your code")
    print()
    print("You can distribute the entire 'GridPassCommander' folder.")
    print("Users can run GridPassCommander.exe directly - no installation needed!")
except Exception as e:
    print()
    print("=" * 80)
    print("Build failed!")
    print("=" * 80)
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

