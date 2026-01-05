"""
Setup script to create the releases storage bucket in Supabase.
This will create the bucket, make it public, and upload an initial version.json.
"""

import sys
import json
import os
from pathlib import Path
from datetime import datetime

# Set UTF-8 encoding for Windows console
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

from supabase import create_client, Client
from supabase.lib.client_options import ClientOptions

# Get Supabase credentials from config
try:
    from config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
except ImportError:
    print("ERROR: Cannot import config. Make sure you're running from ircommander_client directory.")
    sys.exit(1)

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("ERROR: Supabase credentials not configured in config.py")
    print("Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.")
    sys.exit(1)

BUCKET_NAME = "releases"
VERSION_FILE = "version.json"
EXE_FILENAME = "iRCommander.exe"


def create_bucket(supabase: Client) -> bool:
    """Create the releases bucket if it doesn't exist."""
    try:
        # List existing buckets
        buckets = supabase.storage.list_buckets()
        bucket_names = [b.name for b in buckets]
        
        if BUCKET_NAME in bucket_names:
            print(f"✓ Bucket '{BUCKET_NAME}' already exists")
            return True
        
        # Create the bucket
        print(f"Creating bucket '{BUCKET_NAME}'...")
        result = supabase.storage.create_bucket(
            BUCKET_NAME,
            options={
                "public": True,  # Make it public so clients can download
                "file_size_limit": None,  # No file size limit
                "allowed_mime_types": None  # Allow all file types
            }
        )
        
        print(f"✓ Bucket '{BUCKET_NAME}' created successfully")
        return True
        
    except Exception as e:
        # Check if bucket already exists (might be a different error format)
        if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
            print(f"✓ Bucket '{BUCKET_NAME}' already exists")
            return True
        print(f"ERROR: Failed to create bucket: {e}")
        return False


def make_bucket_public(supabase: Client) -> bool:
    """Ensure the bucket is public."""
    try:
        # Update bucket to be public
        print(f"Making bucket '{BUCKET_NAME}' public...")
        # Note: The Python client might not have a direct update_bucket method
        # We'll try to set it via the API or check if it's already public
        buckets = supabase.storage.list_buckets()
        for bucket in buckets:
            if bucket.name == BUCKET_NAME:
                if bucket.public:
                    print(f"[OK] Bucket '{BUCKET_NAME}' is already public")
                else:
                    print(f"[WARN] Bucket '{BUCKET_NAME}' is not public. Please make it public in the Supabase Dashboard:")
                    print(f"   Storage -> {BUCKET_NAME} -> Settings -> Make Public")
                return True
        return False
    except Exception as e:
        print(f"WARNING: Could not verify bucket public status: {e}")
        print(f"Please verify the bucket is public in the Supabase Dashboard")
        return True  # Continue anyway


def upload_initial_version(supabase: Client) -> bool:
    """Upload initial version.json file."""
    try:
        # Check if version.json already exists
        try:
            existing = supabase.storage.from_(BUCKET_NAME).list(VERSION_FILE)
            if existing:
                print(f"[WARN] {VERSION_FILE} already exists in bucket. Skipping initial upload.")
                print(f"   If you want to update it, use upload_release.py instead.")
                return True
        except:
            pass  # File doesn't exist, continue to upload
        
        # Create initial version.json
        version_data = {
            "version": "1.0.0",
            "filename": EXE_FILENAME,
            "release_notes": "Initial release setup",
            "published_at": datetime.utcnow().isoformat() + "Z",
            "size": 0
        }
        
        version_json = json.dumps(version_data, indent=2)
        
        print(f"Uploading initial {VERSION_FILE}...")
        result = supabase.storage.from_(BUCKET_NAME).upload(
            VERSION_FILE,
            version_json.encode('utf-8'),
            file_options={"content-type": "application/json", "upsert": "true"}
        )
        
        print(f"[OK] Initial {VERSION_FILE} uploaded successfully")
        print(f"\nVersion file content:")
        print(json.dumps(version_data, indent=2))
        return True
        
    except Exception as e:
        print(f"ERROR: Failed to upload {VERSION_FILE}: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Main setup function."""
    print("=" * 60)
    print("Supabase Storage Setup for Auto-Updater")
    print("=" * 60)
    print(f"\nSupabase URL: {SUPABASE_URL}")
    print(f"Bucket name: {BUCKET_NAME}")
    print()
    
    # Initialize Supabase client
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        print("✓ Connected to Supabase")
    except Exception as e:
        print(f"ERROR: Failed to connect to Supabase: {e}")
        sys.exit(1)
    
    # Step 1: Create bucket
    if not create_bucket(supabase):
        print("\n❌ Failed to create bucket. Please check your Supabase credentials and permissions.")
        sys.exit(1)
    
    # Step 2: Make bucket public (or verify it is)
    make_bucket_public(supabase)
    
    # Step 3: Upload initial version.json
    if not upload_initial_version(supabase):
        print("\n⚠ Failed to upload initial version.json, but bucket is ready.")
        print("   You can upload it manually or use upload_release.py")
    
    print("\n" + "=" * 60)
    print("[OK] Setup Complete!")
    print("=" * 60)
    print(f"\nPublic URLs:")
    print(f"  Version: {SUPABASE_URL}/storage/v1/object/public/{BUCKET_NAME}/{VERSION_FILE}")
    print(f"  Executable: {SUPABASE_URL}/storage/v1/object/public/{BUCKET_NAME}/{EXE_FILENAME}")
    print("\nNext steps:")
    print("  1. Build your executable: build_exe.bat")
    print("  2. Upload your first release: python upload_release.py 1.0.0 dist/iRCommander.exe \"Initial release\"")
    print()


if __name__ == "__main__":
    main()
