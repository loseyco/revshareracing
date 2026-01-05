"""
Update the download link in Supabase database.
This allows the website to fetch the current download URL dynamically.
"""

import sys
import json
from datetime import datetime
from supabase import create_client, Client

# Get Supabase credentials from config
try:
    from config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
except ImportError:
    print("ERROR: Cannot import config. Make sure you're running from ircommander_client directory.")
    sys.exit(1)

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("ERROR: Supabase credentials not configured in config.py")
    sys.exit(1)

BUCKET_NAME = "releases"
EXE_FILENAME = "iRCommander.exe"
TABLE_NAME = "app_releases"  # Table to store release info


def update_download_link(version: str, download_url: str = None):
    """Update the download link in the database."""
    
    # Initialize Supabase client
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    except Exception as e:
        print(f"ERROR: Failed to connect to Supabase: {e}")
        sys.exit(1)
    
    # Use provided download URL or construct default Supabase URL
    if not download_url:
        download_url = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET_NAME}/{EXE_FILENAME}"
    
    # Get version.json to get release notes
    try:
        version_url = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET_NAME}/version.json"
        import requests
        response = requests.get(version_url, timeout=5)
        if response.status_code == 200:
            version_data = response.json()
            release_notes = version_data.get("release_notes", "")
            published_at = version_data.get("published_at", datetime.utcnow().isoformat() + "Z")
        else:
            release_notes = ""
            published_at = datetime.utcnow().isoformat() + "Z"
    except Exception as e:
        print(f"WARNING: Could not fetch version.json: {e}")
        release_notes = ""
        published_at = datetime.utcnow().isoformat() + "Z"
    
    # Prepare release data
    release_data = {
        "version": version.lstrip("v"),  # Remove 'v' prefix if present
        "download_url": download_url,
        "filename": EXE_FILENAME,
        "release_notes": release_notes,
        "published_at": published_at,
        "is_latest": True,
        "updated_at": datetime.utcnow().isoformat() + "Z"
    }
    
    print(f"Updating download link for version {release_data['version']}...")
    print(f"  URL: {download_url}")
    
    try:
        # Upsert the release (insert or update if version exists)
        # First, set all other releases to is_latest = false
        try:
            supabase.table(TABLE_NAME).update({"is_latest": False}).neq("version", release_data["version"]).execute()
        except Exception as e:
            # Table might not exist yet - that's okay, we'll create it on insert
            print(f"Note: Could not update existing releases (table may not exist): {e}")
        
        # Upsert the new release
        result = supabase.table(TABLE_NAME).upsert(
            release_data,
            on_conflict="version"
        ).execute()
        
        # Ensure this one is marked as latest
        supabase.table(TABLE_NAME).update({"is_latest": True}).eq("version", release_data["version"]).execute()
        
        print(f"[OK] Download link updated in database")
        print(f"\nWebsite will fetch this link automatically from: {TABLE_NAME} table")
        return True
        
    except Exception as e:
        print(f"ERROR: Failed to update database: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python update_download_link.py <version> [download_url]")
        print("Example: python update_download_link.py 1.0.1")
        print("Example: python update_download_link.py 1.0.1 https://blob.vercel-storage.com/...")
        sys.exit(1)
    
    version = sys.argv[1]
    download_url = sys.argv[2] if len(sys.argv) > 2 else None
    success = update_download_link(version, download_url)
    sys.exit(0 if success else 1)
