"""
Reset Device - Force Fresh Registration
This script clears all device configuration and forces a new registration.
"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from config import DATA_DIR

def reset_device():
    """Reset device configuration to force fresh registration."""
    print("=" * 60)
    print("iRCommander - Device Reset")
    print("=" * 60)
    print()
    
    config_path = DATA_DIR / "device_config.json"
    
    if config_path.exists():
        print(f"[*] Found device config: {config_path}")
        
        # Read current config to show what we're deleting
        import json
        try:
            config = json.loads(config_path.read_text())
            print(f"    Device ID: {config.get('device_id', 'N/A')}")
            print(f"    API Key: {config.get('api_key', 'N/A')[:20]}..." if config.get('api_key') else "    API Key: N/A")
            print(f"    API URL: {config.get('api_url', 'N/A')}")
        except:
            pass
        
        # Delete the config
        config_path.unlink()
        print()
        print("[OK] Device config deleted!")
    else:
        print("[INFO] No device config found - already reset")
    
    print()
    print("=" * 60)
    print("Device Reset Complete!")
    print("=" * 60)
    print()
    print("Next steps:")
    print("  1. Restart the application: python main.py")
    print("  2. Login when prompted")
    print("  3. Device will register as a NEW device")
    print()
    print("The device will get a new device_id and API key.")
    print()

if __name__ == "__main__":
    try:
        reset_device()
    except Exception as e:
        print(f"\n[ERROR] Reset failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
