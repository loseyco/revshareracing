#!/usr/bin/env python3
"""
Migration script to add iracing_connected column to irc_devices table
Run this from the project root: python migrations/add_iracing_connected_column.py
"""

import sys
import requests
from pathlib import Path

# Add pc-service to path
sys.path.insert(0, str(Path(__file__).parent.parent / "pc-service" / "src"))

try:
    from config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
except ImportError as e:
    print(f"❌ Failed to import dependencies: {e}")
    print("Make sure you're running from the project root and have installed requirements.txt")
    sys.exit(1)

def add_iracing_connected_column():
    """Add iracing_connected column to irc_devices table via Supabase REST API"""
    
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("❌ Missing Supabase credentials!")
        print("Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in pc-service/.env")
        return False
    
    try:
        print("🔌 Connecting to Supabase...")
        
        # First, check if column already exists by trying to query it
        headers = {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
        }
        
        # Try to select the column to see if it exists
        check_url = f"{SUPABASE_URL}/rest/v1/irc_devices?select=iracing_connected&limit=1"
        try:
            response = requests.get(check_url, headers=headers, timeout=10)
            if response.status_code == 200:
                print("✅ Column 'iracing_connected' already exists in irc_devices table")
                return True
        except requests.exceptions.RequestException:
            pass
        
        # Column doesn't exist, try to add it using PostgREST RPC
        # Note: Supabase REST API doesn't support ALTER TABLE directly
        # We need to use the SQL Editor or create a database function
        
        print("⚠️  Supabase REST API doesn't support ALTER TABLE directly")
        print("📋 Please run this SQL in Supabase SQL Editor:")
        print()
        print("=" * 60)
        print("ALTER TABLE irc_devices")
        print("ADD COLUMN IF NOT EXISTS iracing_connected BOOLEAN DEFAULT NULL;")
        print("=" * 60)
        print()
        print("📝 Steps to add column via Supabase Dashboard:")
        print("1. Go to https://supabase.com/dashboard")
        print("2. Select your project")
        print("3. Go to SQL Editor (left sidebar)")
        print("4. Paste the SQL above")
        print("5. Click 'Run'")
        print()
        print("Or via Table Editor:")
        print("1. Go to Table Editor → irc_devices")
        print("2. Click 'Add Column' button")
        print("3. Name: iracing_connected")
        print("4. Type: boolean")
        print("5. Default: NULL (optional)")
        print("6. Click 'Save'")
        
        return False
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("Migration: Add iracing_connected column")
    print("=" * 60)
    print()
    
    success = add_iracing_connected_column()
    
    if not success:
        print()
        print("💡 Alternative: Use the SQL file directly")
        print("   File: migrations/add_iracing_connected_column.sql")
        print("   Copy the SQL and run it in Supabase SQL Editor")
    
    sys.exit(0 if success else 1)
