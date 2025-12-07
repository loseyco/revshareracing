#!/usr/bin/env python3
"""
Build script for creating standalone executable
Run: python build_exe.py
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
    '--onefile',  # Create a single executable file
    '--windowed',  # No console window (GUI only)
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

print("Building standalone executable...")
print("This may take a few minutes...")
print()

try:
    PyInstaller.__main__.run(args)
    print()
    print("=" * 80)
    print("Build completed successfully!")
    print("=" * 80)
    print()
    print(f"Executable location: {script_dir / 'dist' / 'GridPassCommander.exe'}")
    print()
    print("You can now distribute the executable from the 'dist' folder.")
    print("It includes all dependencies and requires no installation.")
except Exception as e:
    print()
    print("=" * 80)
    print("Build failed!")
    print("=" * 80)
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

