#!/usr/bin/env python3
"""
Run migration to add iracing_connected column via Supabase RPC
This script calls a database function that adds the column
"""

import sys
import os
from pathlib import Path

# Load .env the same way config.py does
base_path = Path(__file__).parent.parent / "pc-service"
env_path = base_path / ".env"
if env_path.exists():
    from dotenv import load_dotenv
    load_dotenv(env_path)
    print(f"✅ Loaded .env from {env_path}")

# Add pc-service/src to path
sys.path.insert(0, str(base_path / "src"))

try:
    # Import config which will load .env properly
    from config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
    from supabase import create_client
except ImportError as e:
    print(f"❌ Failed to import dependencies: {e}")
    print("Make sure you're running from the project root and have installed requirements.txt")
    sys.exit(1)

def run_migration():
    """Run migration via Supabase RPC"""
    
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("❌ Missing Supabase credentials!")
        print("Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in pc-service/.env")
        print(f"   Current SUPABASE_URL: {'Set' if SUPABASE_URL else 'NOT SET'}")
        print(f"   Current SUPABASE_SERVICE_ROLE_KEY: {'Set' if SUPABASE_SERVICE_ROLE_KEY else 'NOT SET'}")
        return False
    
    try:
        print("🔌 Connecting to Supabase...")
        supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        
        # First, check if column exists by trying to select it
        print("🔍 Checking if column exists...")
        try:
            result = supabase.table('irc_devices').select('iracing_connected').limit(1).execute()
            print("✅ Column 'iracing_connected' already exists!")
            return True
        except Exception as select_error:
            error_str = str(select_error).lower()
            if 'column' in error_str or 'does not exist' in error_str:
                print("📝 Column doesn't exist, attempting to add via RPC...")
            else:
                print(f"⚠️  Error checking column: {select_error}")
                # Continue anyway to try RPC
        
        # Column doesn't exist, try to add it via RPC
        try:
            # Call the database function
            print("🔄 Calling migration function...")
            result = supabase.rpc('add_iracing_connected_column').execute()
            print("✅ Migration function executed successfully!")
            print("   Column 'iracing_connected' should now be added")
            return True
        except Exception as rpc_error:
            error_str = str(rpc_error).lower()
            if 'function' in error_str and ('does not exist' in error_str or 'not found' in error_str):
                print("⚠️  Migration function doesn't exist yet")
                print("📋 Please run this SQL in Supabase SQL Editor first:")
                print()
                print("=" * 70)
                sql_file = Path(__file__).parent / "add_iracing_connected_via_function.sql"
                if sql_file.exists():
                    with open(sql_file, "r", encoding="utf-8") as f:
                        print(f.read())
                print("=" * 70)
                print()
                print("After running the SQL, run this script again.")
                return False
            else:
                print(f"❌ RPC call failed: {rpc_error}")
                print()
                print("💡 Alternative: Run SQL directly in Supabase SQL Editor")
                print("   File: migrations/add_iracing_connected_column.sql")
                return False
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("=" * 70)
    print("Migration: Add iracing_connected column to irc_devices table")
    print("=" * 70)
    print()
    
    success = run_migration()
    
    if not success:
        print()
        print("💡 Quick Fix: Run SQL directly in Supabase SQL Editor")
        print("   1. Go to https://supabase.com/dashboard")
        print("   2. Select your project")
        print("   3. Go to SQL Editor")
        print("   4. Copy SQL from: migrations/add_iracing_connected_column.sql")
        print("   5. Paste and click 'Run'")
    
    sys.exit(0 if success else 1)
