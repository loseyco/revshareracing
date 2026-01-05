"""
iRCommander Client Connection Test
Tests that the client can connect to the API
"""

import sys
import io
from pathlib import Path

# Fix Windows encoding issues
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from config import IRCOMMANDER_API_URL, VERSION
from api_client import get_api, APIError

def test_connection():
    """Test basic API connection."""
    print("=" * 60)
    print(f"iRCommander Client Test v{VERSION}")
    print("=" * 60)
    print()
    
    api = get_api()
    print(f"[*] API URL: {api.api_url}")
    print()
    
    # Test 1: Health Check
    print("[1/4] Testing Health Endpoint...")
    try:
        result = api._request("GET", "/api/v1/health", auth=False)
        if result.get("status") == "healthy" and result.get("api") == "iRCommander API":
            print("  [OK] Health check passed")
            print(f"     API: {result.get('api')}")
            print(f"     Version: {result.get('version')}")
        else:
            print("  [FAIL] Health check failed - unexpected response")
            print(f"     Response: {result}")
    except Exception as e:
        print(f"  [FAIL] Health check failed: {e}")
        return False
    print()
    
    # Test 2: Check if already registered
    print("[2/4] Checking Device Registration Status...")
    if api.is_registered:
        print(f"  [OK] Device already registered")
        print(f"     Device ID: {api.device_id}")
        print(f"     API Key: {api.api_key[:10]}...")
    else:
        print("  [INFO] Device not registered")
        print("     (Registration requires user login)")
    print()
    
    # Test 3: Test API URL configuration
    print("[3/4] Testing API URL Configuration...")
    if "ircommander" in api.api_url.lower():
        print(f"  [OK] API URL correctly configured: {api.api_url}")
    else:
        print(f"  [WARN] API URL might be incorrect: {api.api_url}")
        print("     Expected: ircommander-dqtp5bc6q-pj-loseys-projects.vercel.app or ircommander.gridpass.app")
    print()
    
    # Test 4: Test authentication (if logged in)
    print("[4/4] Testing Authentication...")
    if api.is_logged_in:
        print(f"  [OK] User logged in")
        print(f"     User: {api.user.email if api.user else 'Unknown'}")
        try:
            user_info = api.get_me()
            print(f"     User ID: {user_info.user_id}")
        except Exception as e:
            print(f"  [WARN] Could not fetch user info: {e}")
    else:
        print("  [INFO] Not logged in (this is OK for device registration)")
        print("     Login required for: device registration with tenant")
    print()
    
    print("=" * 60)
    print("Test Complete!")
    print("=" * 60)
    return True

if __name__ == "__main__":
    try:
        success = test_connection()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n[*] Test interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n[!] Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
