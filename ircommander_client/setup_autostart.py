"""
Windows Autostart Setup Utility
Adds/removes iRCommander from Windows startup.
Works with both Python script and compiled .exe.
"""

import os
import sys
import winreg
from pathlib import Path


def get_app_path():
    """Get the path to the application (works for both .exe and .py)."""
    if getattr(sys, 'frozen', False):
        # Running as compiled executable
        return sys.executable
    else:
        # Running as Python script
        script_dir = Path(__file__).parent.absolute()
        # Use start.bat if it exists, otherwise main.py
        start_bat = script_dir / "start.bat"
        if start_bat.exists():
            return str(start_bat)
        return str(script_dir / "main.py")


def get_startup_folder():
    """Get the Windows Startup folder path."""
    startup = Path(os.environ.get('APPDATA')) / 'Microsoft' / 'Windows' / 'Start Menu' / 'Programs' / 'Startup'
    return startup


def is_autostart_enabled():
    """Check if autostart is currently enabled."""
    startup_folder = get_startup_folder()
    shortcut = startup_folder / "iRCommander.lnk"
    return shortcut.exists()


def enable_autostart():
    """Enable autostart by creating a shortcut in the Startup folder."""
    try:
        import win32com.client
        
        app_path = get_app_path()
        startup_folder = get_startup_folder()
        shortcut_path = startup_folder / "GridPass Commander.lnk"
        
        # Create shortcut
        shell = win32com.client.Dispatch("WScript.Shell")
        shortcut = shell.CreateShortCut(str(shortcut_path))
        shortcut.Targetpath = app_path
        
        # Set working directory
        if app_path.endswith('.exe'):
            shortcut.WorkingDirectory = str(Path(app_path).parent)
        elif app_path.endswith('.bat'):
            shortcut.WorkingDirectory = str(Path(app_path).parent)
        else:
            # Python script
            shortcut.WorkingDirectory = str(Path(app_path).parent)
        
        # Set icon if .exe
        if app_path.endswith('.exe'):
            shortcut.IconLocation = app_path
        
        shortcut.save()
        
        print(f"[OK] Autostart enabled")
        print(f"     Shortcut created: {shortcut_path}")
        print(f"     Target: {app_path}")
        return True
        
    except ImportError:
        print("[ERROR] pywin32 is required for autostart setup")
        print("        Install with: pip install pywin32")
        return False
    except Exception as e:
        print(f"[ERROR] Failed to enable autostart: {e}")
        return False


def disable_autostart():
    """Disable autostart by removing the shortcut."""
    try:
        startup_folder = get_startup_folder()
        shortcut_path = startup_folder / "GridPass Commander.lnk"
        
        if shortcut_path.exists():
            shortcut_path.unlink()
            print(f"[OK] Autostart disabled")
            print(f"     Removed: {shortcut_path}")
            return True
        else:
            print("[INFO] Autostart was not enabled")
            return True
            
    except Exception as e:
        print(f"[ERROR] Failed to disable autostart: {e}")
        return False


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Configure iRCommander Windows autostart"
    )
    parser.add_argument(
        "action",
        choices=["enable", "disable", "status"],
        help="Action to perform"
    )
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("iRCommander - Autostart Configuration")
    print("=" * 60)
    print()
    
    if args.action == "status":
        enabled = is_autostart_enabled()
        app_path = get_app_path()
        print(f"Autostart: {'ENABLED' if enabled else 'DISABLED'}")
        print(f"App path: {app_path}")
        if enabled:
            shortcut = get_startup_folder() / "GridPass Commander.lnk"
            print(f"Shortcut: {shortcut}")
    elif args.action == "enable":
        if is_autostart_enabled():
            print("[INFO] Autostart is already enabled")
            response = input("Disable and re-enable? (y/n): ")
            if response.lower() == 'y':
                disable_autostart()
                enable_autostart()
        else:
            enable_autostart()
    elif args.action == "disable":
        disable_autostart()
    
    print()


if __name__ == "__main__":
    main()
