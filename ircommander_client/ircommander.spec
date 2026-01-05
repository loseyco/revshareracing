# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file for iRCommander Client
Creates a single executable file
"""

# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file for iRCommander Client
Creates a single executable file
"""

block_cipher = None

# Collect all Python files
# Note: Run this from the ircommander_client directory
a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=[
        # No external config files needed - credentials are embedded
    ],
    hiddenimports=[
        # PyQt6 modules
        'PyQt6.QtCore',
        'PyQt6.QtGui',
        'PyQt6.QtWidgets',
        # Supabase
        'supabase',
        'supabase.client',
        'supabase.lib.client_options',
        # iRacing SDK
        'pyirsdk',
        # Other dependencies
        'requests',
        'dotenv',
        'psutil',
        'watchdog',
        # WebRTC (optional, but include if available)
        'aiortc',
        'cv2',
        'mss',
        'numpy',
        'aiohttp',
        'pyautogui',
        # Core modules
        'core.device',
        'core.telemetry',
        'core.controls',
        'core.joystick_config',
        'core.joystick_monitor',
        'core.remote_desktop',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'matplotlib',
        'pandas',
        'scipy',
        'IPython',
        'jupyter',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='iRCommander',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # Set to True if you want to see console output
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,  # Add path to .ico file if you have one
)
