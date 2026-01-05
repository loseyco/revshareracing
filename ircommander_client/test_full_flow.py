"""
Full flow test: Login -> Register -> Heartbeat
This will help identify the API key authentication issue.
"""
import sys
import io
import json
from pathlib import Path
from api_client import IRCommanderAPI, APIError
from config import IRCOMMANDER_API_URL, DATA_DIR

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

def test_full_flow(email: str, password: str):
    """Test the complete flow: login, register, heartbeat."""
    print("=" * 70)
    print("iRCommander Full Flow Test")
    print("=" * 70)
    print()
    
    # Clean up any existing config
    config_path = DATA_DIR / "device_config.json"
    if config_path.exists():
        print(f"[INFO] Found existing config, backing up...")
        backup_path = config_path.with_suffix('.json.backup')
        if backup_path.exists():
            backup_path.unlink()
        config_path.rename(backup_path)
        print(f"[INFO] Backed up to: {backup_path}")
    
    api = IRCommanderAPI()
    print(f"[1] API Client Created")
    print(f"    API URL: {api.api_url}")
    print()
    
    # Step 1: Login
    print("[2] Testing Login...")
    try:
        user = api.login(email, password)
        print(f"    ✅ Login successful!")
        print(f"    User ID: {user.user_id}")
        print(f"    Email: {user.email}")
        print()
    except APIError as e:
        print(f"    [ERROR] Login failed: {e}")
        return False
    except Exception as e:
        print(f"    ❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # Step 2: Register Device
    print("[3] Testing Device Registration...")
    try:
        import hashlib
        import platform
        
        # Generate hardware ID
        machine_info = f"{platform.node()}{platform.machine()}{platform.processor()}"
        hardware_id = hashlib.sha256(machine_info.encode()).hexdigest()
        
        device_info = api.register(hardware_id, name="Test Device")
        print(f"    [OK] Registration successful!")
        print(f"    Device ID: {device_info.device_id}")
        print(f"    API Key (first 30): {device_info.api_key[:30]}...")
        print(f"    API Key length: {len(device_info.api_key)}")
        print(f"    Full API Key: {device_info.api_key}")
        print()
        
        # Verify saved config
        if config_path.exists():
            saved_config = json.loads(config_path.read_text())
            print(f"    [VERIFY] Saved config:")
            print(f"      Device ID: {saved_config.get('device_id')}")
            print(f"      API Key saved: {saved_config.get('api_key', '')[:30]}...")
            print(f"      Keys match: {saved_config.get('api_key') == device_info.api_key}")
            print()
    except APIError as e:
        print(f"    [ERROR] Registration failed: {e}")
        return False
    except Exception as e:
        print(f"    ❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # Step 3: Test Heartbeat
    print("[4] Testing Heartbeat (this is where it's failing)...")
    try:
        result = api.heartbeat()
        print(f"    [OK] Heartbeat successful!")
        print(f"    Response: {result}")
        print()
        return True
    except APIError as e:
        print(f"    [ERROR] Heartbeat failed: {e}")
        print()
        print("    [DEBUG] Current API state:")
        print(f"      Device ID: {api.device_id}")
        print(f"      API Key: {api.api_key[:30] if api.api_key else 'None'}...")
        print(f"      API Key length: {len(api.api_key) if api.api_key else 0}")
        print()
        
        # Try to manually test the API key
        print("    [DEBUG] Testing API key directly...")
        import requests
        headers = {
            "X-Device-Key": api.api_key,
            "Content-Type": "application/json"
        }
        try:
            resp = requests.post(
                f"{api.api_url}/api/v1/device/heartbeat",
                headers=headers,
                json={},
                timeout=10
            )
            print(f"      Status: {resp.status_code}")
            print(f"      Response: {resp.text[:500]}")
            if resp.status_code == 401:
                try:
                    error_data = resp.json()
                    print(f"      Error data: {error_data}")
                except:
                    pass
        except Exception as e:
            print(f"      Request error: {e}")
        
        return False
    except Exception as e:
        print(f"    ❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python test_full_flow.py <email> <password>")
        print()
        print("Example:")
        print("  python test_full_flow.py pjlosey@outlook.com '!Google1!'")
        sys.exit(1)
    
    email = sys.argv[1]
    password = sys.argv[2]
    
    success = test_full_flow(email, password)
    sys.exit(0 if success else 1)
