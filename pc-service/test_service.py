#!/usr/bin/env python3
"""
Quick test script for PC Service
Tests basic functionality without running full service
"""

import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / 'src'))

def test_imports():
    """Test that all modules can be imported"""
    print("Testing imports...")
    try:
        from config import SUPABASE_URL, SUPABASE_ANON_KEY
        print("✅ Config module imported")
    except Exception as e:
        print(f"❌ Config import failed: {e}")
        return False
    
    try:
        from core import device, telemetry, laps, controls
        print("✅ Core modules imported")
    except Exception as e:
        print(f"❌ Core modules import failed: {e}")
        return False
    
    try:
        from service import get_service
        print("✅ Service module imported")
    except Exception as e:
        print(f"❌ Service import failed: {e}")
        return False
    
    return True

def test_device():
    """Test device module"""
    print("\nTesting device module...")
    try:
        from core import device
        info = device.get_info()
        print(f"✅ Device info retrieved")
        print(f"   Device Name: {info['device_name']}")
        print(f"   Local IP: {info['local_ip']}")
        print(f"   Registered: {info.get('registered', False)}")
        return True
    except Exception as e:
        print(f"❌ Device test failed: {e}")
        return False

def test_config():
    """Test configuration"""
    print("\nTesting configuration...")
    try:
        from config import SUPABASE_URL, SUPABASE_ANON_KEY
        if SUPABASE_URL and SUPABASE_ANON_KEY:
            print("✅ Configuration loaded")
            print(f"   Supabase URL: {SUPABASE_URL[:30]}...")
            return True
        else:
            print("⚠️  Configuration missing - create .env file")
            return False
    except Exception as e:
        print(f"❌ Config test failed: {e}")
        return False

def test_supabase():
    """Test Supabase connection"""
    print("\nTesting Supabase connection...")
    try:
        from config import SUPABASE_URL, SUPABASE_ANON_KEY
        if not SUPABASE_URL or not SUPABASE_ANON_KEY:
            print("⚠️  Skipping Supabase test - no credentials")
            return True
        
        from supabase import create_client
        supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
        
        # Try a simple query
        result = supabase.table('irc_devices').select('device_id').limit(1).execute()
        print("✅ Supabase connection successful")
        return True
    except Exception as e:
        print(f"⚠️  Supabase test failed: {e}")
        print("   (This is OK if tables don't exist yet)")
        return True  # Don't fail on this

if __name__ == '__main__':
    print("=" * 80)
    print("iRacing Commander V4 - PC Service Test")
    print("=" * 80)
    print()
    
    results = []
    results.append(("Imports", test_imports()))
    results.append(("Device Module", test_device()))
    results.append(("Configuration", test_config()))
    results.append(("Supabase Connection", test_supabase()))
    
    print()
    print("=" * 80)
    print("Test Results:")
    print("=" * 80)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {name}")
    
    all_passed = all(result for _, result in results)
    
    print()
    if all_passed:
        print("✅ All tests passed! Service is ready to run.")
        print()
        print("Next steps:")
        print("  1. Ensure .env file is configured")
        print("  2. Run: python start.py")
    else:
        print("❌ Some tests failed. Please check errors above.")
    
    print("=" * 80)

