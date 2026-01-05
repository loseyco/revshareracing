"""
Comprehensive test script for all authentication features.
"""
import sys
import io
import requests
import json
from api_client import IRCommanderAPI, APIError
from config import IRCOMMANDER_API_URL

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def test_api_endpoint(name, method, endpoint, data=None, expected_status=None):
    """Test an API endpoint directly."""
    print(f"\n{'='*60}")
    print(f"Testing: {name}")
    print(f"{'='*60}")
    url = f"{IRCOMMANDER_API_URL}{endpoint}"
    print(f"URL: {url}")
    print(f"Method: {method}")
    if data:
        print(f"Data: {json.dumps({k: v if k != 'password' else '***' for k, v in data.items()}, indent=2)}")
    
    try:
        if method == "POST":
            resp = requests.post(url, json=data, timeout=10)
        elif method == "GET":
            resp = requests.get(url, timeout=10)
        else:
            print(f"❌ Unsupported method: {method}")
            return False
        
        print(f"Status: {resp.status_code}")
        
        try:
            result = resp.json()
            print(f"Response: {json.dumps(result, indent=2)}")
        except:
            print(f"Response (non-JSON): {resp.text[:500]}")
        
        if expected_status:
            if resp.status_code == expected_status:
                print(f"✅ Expected status {expected_status} received")
                return True
            else:
                print(f"❌ Expected status {expected_status}, got {resp.status_code}")
                return False
        else:
            if resp.status_code < 400:
                print(f"✅ Success (status {resp.status_code})")
                return True
            else:
                print(f"⚠️  Status {resp.status_code} (may be expected)")
                return resp.status_code < 500  # Accept client errors as "working"
    except requests.exceptions.ConnectionError:
        print(f"❌ Connection failed - is the API server running?")
        print(f"   Start it with: cd ircommander && npm run dev")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_client_login(email, password):
    """Test login using the API client."""
    print(f"\n{'='*60}")
    print("Testing: Client Login")
    print(f"{'='*60}")
    
    api = IRCommanderAPI()
    print(f"Client API URL: {api.api_url}")
    print(f"Email: {email}")
    print(f"Password length: {len(password)} characters")
    
    try:
        user = api.login(email, password)
        print(f"✅ Login successful!")
        print(f"   User ID: {user.user_id}")
        print(f"   Email: {user.email}")
        print(f"   Tenant ID: {user.tenant_id}")
        print(f"   Tenant Name: {user.tenant_name}")
        return True
    except APIError as e:
        print(f"❌ Login failed: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

def main():
    print("="*60)
    print("iRCommander Authentication Test Suite")
    print("="*60)
    print(f"\nAPI URL: {IRCOMMANDER_API_URL}")
    print(f"Testing against: {IRCOMMANDER_API_URL}")
    
    results = {}
    
    # Test 1: API Server Connection
    print(f"\n{'='*60}")
    print("Test 1: API Server Connection")
    print(f"{'='*60}")
    try:
        resp = requests.get(f"{IRCOMMANDER_API_URL}/api/v1/auth/login", timeout=5)
        print(f"✅ API server is reachable (status: {resp.status_code})")
        results["api_connection"] = True
    except requests.exceptions.ConnectionError:
        print(f"❌ API server is NOT reachable")
        print(f"   Please start the Next.js server: cd ircommander && npm run dev")
        results["api_connection"] = False
        print("\n⚠️  Cannot continue tests - API server is not running")
        return
    except Exception as e:
        print(f"⚠️  Connection test error: {e}")
        results["api_connection"] = False
    
    # Test 2: Login Endpoint (should return 401 for invalid credentials)
    results["login_endpoint"] = test_api_endpoint(
        "Login Endpoint",
        "POST",
        "/api/v1/auth/login",
        {"email": "test@example.com", "password": "wrongpassword"},
        expected_status=401
    )
    
    # Test 3: Register Endpoint (should validate input)
    results["register_endpoint"] = test_api_endpoint(
        "Register Endpoint",
        "POST",
        "/api/v1/auth/register",
        {"email": "test@example.com", "password": "short"},  # Too short
        expected_status=400  # Validation error
    )
    
    # Test 4: Forgot Password Endpoint
    results["forgot_password_endpoint"] = test_api_endpoint(
        "Forgot Password Endpoint",
        "POST",
        "/api/v1/auth/forgot-password",
        {"email": "test@example.com"},
        expected_status=200  # Should return success even if email doesn't exist
    )
    
    # Test 5: Client Login (if credentials provided)
    if len(sys.argv) >= 3:
        email = sys.argv[1]
        password = sys.argv[2]
        results["client_login"] = test_client_login(email, password)
    else:
        print(f"\n{'='*60}")
        print("Skipping Client Login Test")
        print(f"{'='*60}")
        print("To test client login, run:")
        print(f"  python test_all_auth.py <email> <password>")
        results["client_login"] = None
    
    # Summary
    print(f"\n{'='*60}")
    print("Test Summary")
    print(f"{'='*60}")
    for test_name, result in results.items():
        if result is True:
            print(f"✅ {test_name}: PASSED")
        elif result is False:
            print(f"❌ {test_name}: FAILED")
        else:
            print(f"⏭️  {test_name}: SKIPPED")
    
    passed = sum(1 for r in results.values() if r is True)
    failed = sum(1 for r in results.values() if r is False)
    total = len([r for r in results.values() if r is not None])
    
    print(f"\nResults: {passed}/{total} passed, {failed} failed")
    
    if failed == 0:
        print("\n✅ All tests passed!")
        return 0
    else:
        print(f"\n⚠️  {failed} test(s) failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())
