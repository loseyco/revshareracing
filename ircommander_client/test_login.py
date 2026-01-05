"""
Test login directly to debug authentication issues.
"""

import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from api_client import IRCommanderAPI, APIError
from config import IRCOMMANDER_API_URL

def test_login():
    """Test login with credentials."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Test iRCommander login")
    parser.add_argument("--email", "-e", help="Email address")
    parser.add_argument("--password", "-p", help="Password")
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("iRCommander - Login Test")
    print("=" * 60)
    print()
    
    # Get credentials
    if args.email and args.password:
        email = args.email.strip()
        password = args.password.strip()
    else:
        email = input("Email: ").strip()
        password = input("Password: ").strip()
    
    print()
    print(f"Testing login to: {IRCOMMANDER_API_URL}")
    print(f"Email: {email}")
    print(f"Password length: {len(password)} characters")
    print()
    
    # Create API client
    api = IRCommanderAPI()
    
    try:
        print("[*] Attempting login...")
        user = api.login(email, password)
        print()
        print("[OK] Login successful!")
        print(f"  User ID: {user.user_id}")
        print(f"  Email: {user.email}")
        print(f"  Tenant ID: {user.tenant_id or 'None'}")
        print(f"  Tenant Name: {user.tenant_name or 'None'}")
        print()
        print("Access token received and saved.")
    except APIError as e:
        print()
        print(f"[FAIL] Login failed: {e}")
        print()
        print("Possible issues:")
        print("  1. Email or password is incorrect")
        print("  2. Account doesn't exist in Supabase")
        print("  3. API URL is incorrect")
        print("  4. Network connectivity issue")
        sys.exit(1)
    except Exception as e:
        print()
        print(f"[ERROR] Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    test_login()
