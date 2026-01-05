"""
Detailed login test script to diagnose authentication issues.
"""
import sys
import os
from api_client import IRCommanderAPI, APIError
from config import IRCOMMANDER_API_URL

def test_login(email: str, password: str):
    """Test login with detailed diagnostics."""
    print("=" * 60)
    print("iRCommander Login Diagnostic Test")
    print("=" * 60)
    print()
    
    # Check API URL
    print(f"[1] API URL Configuration:")
    print(f"    URL: {IRCOMMANDER_API_URL}")
    print()
    
    # Create API client
    api = IRCommanderAPI()
    print(f"[2] API Client Created:")
    print(f"    Client API URL: {api.api_url}")
    print()
    
    # Normalize email
    normalized_email = email.strip().lower()
    print(f"[3] Email Normalization:")
    print(f"    Original: {email}")
    print(f"    Normalized: {normalized_email}")
    print()
    
    # Test connection
    print(f"[4] Testing API Connection:")
    try:
        import requests
        test_url = f"{api.api_url}/api/v1/auth/login"
        print(f"    Testing: {test_url}")
        resp = requests.get(test_url, timeout=5)
        print(f"    Status: {resp.status_code}")
        print(f"    Response type: {type(resp.text)}")
        if resp.text:
            print(f"    Response preview: {resp.text[:200]}")
    except Exception as e:
        print(f"    ⚠️  Connection test failed: {e}")
        print(f"    This might indicate the API server is not running or unreachable.")
    print()
    
    # Attempt login
    print(f"[5] Attempting Login:")
    print(f"    Email: {normalized_email}")
    print(f"    Password length: {len(password)} characters")
    print()
    
    try:
        user = api.login(email, password)
        print("    ✅ LOGIN SUCCESSFUL!")
        print(f"    User ID: {user.user_id}")
        print(f"    Email: {user.email}")
        print(f"    Tenant ID: {user.tenant_id}")
        print(f"    Tenant Name: {user.tenant_name}")
        return True
    except APIError as e:
        print(f"    ❌ LOGIN FAILED")
        print(f"    Error: {e}")
        print()
        print("    Troubleshooting Steps:")
        print("    1. Verify the API server is running:")
        print(f"       cd ircommander && npm run dev")
        print("    2. Check your email and password are correct")
        print("    3. Try resetting your password via 'Forgot Password?'")
        print("    4. Verify your account exists in Supabase dashboard")
        print("    5. Check the API URL is correct in .env file")
        return False
    except Exception as e:
        print(f"    ❌ UNEXPECTED ERROR")
        print(f"    Error type: {type(e).__name__}")
        print(f"    Error message: {e}")
        import traceback
        print()
        print("    Full traceback:")
        traceback.print_exc()
        return False

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python test_login_detailed.py <email> <password>")
        print()
        print("Example:")
        print("  python test_login_detailed.py pjlosey@outlook.com '!Google1!'")
        sys.exit(1)
    
    email = sys.argv[1]
    password = sys.argv[2]
    
    success = test_login(email, password)
    sys.exit(0 if success else 1)
