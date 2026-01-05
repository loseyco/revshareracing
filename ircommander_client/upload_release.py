"""
Helper script to upload releases to Supabase Storage with progress tracking.
Usage: python upload_release.py <version> <exe_path> [release_notes]
"""

import sys
import json
import os
from pathlib import Path
from datetime import datetime
from supabase import create_client, Client
import requests
from typing import Optional, Tuple

# Get Supabase credentials from config
try:
    from config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VERCEL_BLOB_TOKEN, VERCEL_BLOB_STORE_ID, IRCOMMANDER_API_URL
except ImportError:
    print("ERROR: Cannot import config. Make sure you're running from ircommander_client directory.")
    sys.exit(1)

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("ERROR: Supabase credentials not configured in config.py")
    sys.exit(1)

BUCKET_NAME = "releases"
VERSION_FILE = "version.json"
EXE_FILENAME = "iRCommander.exe"
VERCEL_BLOB_API = "https://blob.vercel-storage.com"


class ProgressTracker:
    """Track and display upload progress."""
    
    def __init__(self, total_size: int, filename: str):
        self.total_size = total_size
        self.uploaded = 0
        self.filename = filename
        self.chunk_size = 1024 * 1024  # 1MB chunks for progress updates
        
    def update(self, chunk_size: int):
        """Update progress and display."""
        self.uploaded += chunk_size
        percent = (self.uploaded / self.total_size) * 100 if self.total_size > 0 else 0
        mb_uploaded = self.uploaded / (1024 * 1024)
        mb_total = self.total_size / (1024 * 1024)
        
        # Create progress bar (50 chars)
        bar_length = 50
        filled = int(bar_length * percent / 100)
        bar = '=' * filled + '-' * (bar_length - filled)
        
        # Print progress (overwrite same line)
        print(f"\r[{bar}] {percent:.1f}% ({mb_uploaded:.2f}/{mb_total:.2f} MB)", end='', flush=True)
    
    def complete(self):
        """Mark upload as complete."""
        print(f"\r{'=' * 50} 100.0% ({self.total_size / (1024 * 1024):.2f}/{self.total_size / (1024 * 1024):.2f} MB)")
        print(f"[OK] {self.filename} uploaded successfully!")


def upload_via_api_route(
    filepath: Path,
    version: str,
    release_notes: str = "",
    api_url: str = None
) -> Tuple[bool, Optional[str]]:
    """Upload a file via the Next.js API route (uses Vercel Blob server-side)."""
    
    if not api_url:
        api_url = IRCOMMANDER_API_URL or "https://ircommander.gridpass.app"
    
    file_size = filepath.stat().st_size
    tracker = ProgressTracker(file_size, filepath.name)
    
    try:
        # Read file in chunks and show progress
        print(f"Reading {filepath.name}...")
        chunk_size = 1024 * 1024  # 1MB chunks for progress display
        file_data = b''
        
        with open(filepath, 'rb') as f:
            while True:
                chunk = f.read(chunk_size)
                if not chunk:
                    break
                file_data += chunk
                tracker.update(len(chunk))
        
        tracker.complete()
        
        # Upload via API route
        upload_url = f"{api_url}/api/v1/releases/upload"
        print(f"Uploading to {upload_url}...", end='', flush=True)
        
        # Prepare multipart form data
        files = {
            'file': (filepath.name, file_data, 'application/x-msdownload')
        }
        
        data = {
            'version': version,
            'releaseNotes': release_notes
        }
        
        headers = {
            'Authorization': f'Bearer {SUPABASE_SERVICE_ROLE_KEY}'
        }
        
        response = requests.post(
            upload_url,
            files=files,
            data=data,
            headers=headers,
            timeout=600  # 10 minute timeout for large files
        )
        
        if response.status_code == 200:
            result = response.json()
            download_url = result.get('download_url')
            print(" Done!")
            print(f"[OK] Uploaded via API route: {download_url}")
            return True, download_url
        else:
            print(f"\nERROR: API route upload failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False, None
            
    except Exception as e:
        print(f"\nERROR: Failed to upload via API route: {e}")
        import traceback
        traceback.print_exc()
        return False, None


def upload_to_vercel_blob(
    filepath: Path,
    filename: str,
    content_type: str = "application/octet-stream"
) -> Tuple[bool, Optional[str]]:
    """Upload a file to Vercel Blob Storage with progress tracking."""
    
    if not VERCEL_BLOB_TOKEN:
        return False, None
    
    file_size = filepath.stat().st_size
    tracker = ProgressTracker(file_size, filename)
    
    try:
        # Read file in chunks and show progress
        print(f"Reading {filename}...")
        chunk_size = 1024 * 1024  # 1MB chunks for progress display
        file_data = b''
        
        with open(filepath, 'rb') as f:
            while True:
                chunk = f.read(chunk_size)
                if not chunk:
                    break
                file_data += chunk
                tracker.update(len(chunk))
        
        tracker.complete()
        
        # Upload to Vercel Blob
        print(f"Uploading to Vercel Blob Storage...", end='', flush=True)
        
        # Vercel Blob API endpoint
        upload_url = f"{VERCEL_BLOB_API}/put"
        
        # Prepare multipart form data
        files = {
            'file': (filename, file_data, content_type)
        }
        
        headers = {
            'Authorization': f'Bearer {VERCEL_BLOB_TOKEN}'
        }
        
        # Add store ID if provided
        data = {}
        if VERCEL_BLOB_STORE_ID:
            data['storeId'] = VERCEL_BLOB_STORE_ID
        
        response = requests.post(
            upload_url,
            files=files,
            headers=headers,
            data=data,
            timeout=600  # 10 minute timeout for large files
        )
        
        if response.status_code == 200:
            result = response.json()
            blob_url = result.get('url')
            print(" Done!")
            print(f"[OK] Uploaded to Vercel Blob: {blob_url}")
            return True, blob_url
        else:
            print(f"\nERROR: Vercel Blob upload failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False, None
            
    except Exception as e:
        print(f"\nERROR: Failed to upload to Vercel Blob: {e}")
        import traceback
        traceback.print_exc()
        return False, None


def upload_file_with_progress(
    supabase: Client,
    bucket: str,
    filepath: Path,
    filename: str,
    content_type: str = "application/octet-stream"
) -> Tuple[bool, Optional[str]]:
    """Upload a file with progress tracking using direct API calls."""
    
    file_size = filepath.stat().st_size
    tracker = ProgressTracker(file_size, filename)
    
    try:
        # Use Supabase Storage API directly for progress tracking
        upload_url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{filename}"
        headers = {
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": content_type,
            "x-upsert": "true"
        }
        
        # Read file in chunks and show progress
        print(f"Reading {filename}...")
        chunk_size = 1024 * 1024  # 1MB chunks for progress display
        file_data = b''
        
        with open(filepath, 'rb') as f:
            while True:
                chunk = f.read(chunk_size)
                if not chunk:
                    break
                file_data += chunk
                tracker.update(len(chunk))
        
        tracker.complete()
        
        # Upload to Supabase using direct API
        print(f"Uploading to Supabase Storage...", end='', flush=True)
        response = requests.put(
            upload_url,
            data=file_data,
            headers=headers,
            timeout=600  # 10 minute timeout for large files
        )
        
        if response.status_code in [200, 201]:
            print(" Done!")
            # Return Supabase public URL
            public_url = f"{SUPABASE_URL}/storage/v1/object/public/{bucket}/{filename}"
            return True, public_url
        else:
            print(f"\nERROR: Upload failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False, None
            
    except Exception as e:
        print(f"\nERROR: Failed to upload {filename}: {e}")
        import traceback
        traceback.print_exc()
        return False, None


def verify_upload(supabase: Client, bucket: str, filename: str) -> bool:
    """Verify that the file was uploaded successfully."""
    try:
        # Try to get file info
        files = supabase.storage.from_(bucket).list(filename)
        if files:
            print(f"[OK] Verified: {filename} exists in storage")
            return True
        else:
            # Alternative: try to get public URL
            public_url = f"{SUPABASE_URL}/storage/v1/object/public/{bucket}/{filename}"
            response = requests.head(public_url, timeout=10)
            if response.status_code == 200:
                print(f"[OK] Verified: {filename} is accessible at public URL")
                return True
            else:
                print(f"[WARN] Could not verify {filename} (status: {response.status_code})")
                return False
    except Exception as e:
        print(f"[WARN] Could not verify upload: {e}")
        return False


def upload_release(version: str, exe_path: Path, release_notes: str = "") -> str:
    """Upload a new release to Supabase Storage."""
    
    if not exe_path.exists():
        print(f"ERROR: Executable not found: {exe_path}")
        sys.exit(1)
    
    # Initialize Supabase client
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    except Exception as e:
        print(f"ERROR: Failed to connect to Supabase: {e}")
        sys.exit(1)
    
    # Get file size
    file_size = exe_path.stat().st_size
    
    # Create version.json
    version_data = {
        "version": version.lstrip("v"),  # Remove 'v' prefix if present
        "filename": EXE_FILENAME,
        "release_notes": release_notes,
        "published_at": datetime.utcnow().isoformat() + "Z",
        "size": file_size
    }
    
    print("=" * 60)
    print(f"Uploading release v{version_data['version']}")
    print("=" * 60)
    print(f"Executable: {exe_path}")
    print(f"Size: {file_size:,} bytes ({file_size / (1024 * 1024):.2f} MB)")
    print(f"Release notes: {release_notes[:50]}..." if release_notes else "Release notes: (none)")
    print()
    
    # Upload executable with progress
    # Try API route first (uses Vercel Blob server-side), then direct Vercel Blob, then Supabase
    print(f"[1/2] Uploading {EXE_FILENAME}...")
    download_url = None
    
    # Try API route first (recommended - handles Vercel Blob automatically)
    if IRCOMMANDER_API_URL:
        print("Attempting upload via API route (uses Vercel Blob server-side)...")
        success, api_url = upload_via_api_route(
            exe_path,
            version_data['version'],
            release_notes,
            IRCOMMANDER_API_URL
        )
        if success and api_url:
            download_url = api_url
        else:
            print("\nAPI route upload failed, trying direct methods...")
    
    # If API route failed, try direct Vercel Blob
    if not download_url and VERCEL_BLOB_TOKEN:
        print("Attempting direct upload to Vercel Blob...")
        success, blob_url = upload_to_vercel_blob(
            exe_path,
            EXE_FILENAME,
            "application/x-msdownload"
        )
        if success and blob_url:
            download_url = blob_url
        else:
            print("\nVercel Blob upload failed, trying Supabase Storage...")
    
    # If both failed, try Supabase (will fail for large files)
    if not download_url:
        success, supabase_url = upload_file_with_progress(
            supabase,
            BUCKET_NAME,
            exe_path,
            EXE_FILENAME,
            "application/x-msdownload"
        )
        
        if not success or not supabase_url:
            print("ERROR: Failed to upload executable")
        sys.exit(1)
        
        download_url = supabase_url
        
        # Verify Supabase upload
        print("\nVerifying upload...")
        verify_upload(supabase, BUCKET_NAME, EXE_FILENAME)
    
    # Upload version.json
    print(f"\n[2/2] Uploading {VERSION_FILE}...")
    try:
        version_json = json.dumps(version_data, indent=2)
        result = supabase.storage.from_(BUCKET_NAME).upload(
            VERSION_FILE,
            version_json.encode('utf-8'),
            file_options={"content-type": "application/json", "upsert": "true"}
        )
        print(f"[OK] {VERSION_FILE} uploaded successfully")
    except Exception as e:
        print(f"ERROR: Failed to upload version.json: {e}")
        sys.exit(1)
    
    # Final summary
    print("\n" + "=" * 60)
    print(f"[OK] Release v{version_data['version']} uploaded successfully!")
    print("=" * 60)
    print(f"\nPublic URLs:")
    print(f"  Version: {SUPABASE_URL}/storage/v1/object/public/{BUCKET_NAME}/{VERSION_FILE}")
    print(f"  Executable: {download_url}")
    print()
    
    # Return download URL for database update
    return download_url


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python upload_release.py <version> <exe_path> [release_notes]")
        print("Example: python upload_release.py 1.0.1 dist/iRCommander.exe \"Bug fixes\"")
        sys.exit(1)
    
    version = sys.argv[1]
    exe_path = Path(sys.argv[2])
    release_notes = sys.argv[3] if len(sys.argv) > 3 else ""
    
    download_url = upload_release(version, exe_path, release_notes)
    
    # Print the download URL for use in update_download_link.py
    print(f"\nDownload URL for database: {download_url}")

