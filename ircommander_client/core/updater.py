"""
Auto-Updater Module
Checks for updates and downloads new versions from Supabase Storage.
"""

import os
import sys
import json
import time
import shutil
import requests
import subprocess
from pathlib import Path
from typing import Optional, Dict, Tuple
from packaging import version

# Supabase Storage configuration
# Storage bucket name for releases
STORAGE_BUCKET = "releases"
# File names in the bucket
VERSION_FILE = "version.json"
EXE_FILENAME = "iRCommander.exe"


class Updater:
    """Handles checking for and downloading updates."""
    
    def __init__(self, current_version: str, exe_path: Optional[Path] = None, supabase_url: Optional[str] = None):
        """
        Initialize updater.
        
        Args:
            current_version: Current version string (e.g., "1.0.0")
            exe_path: Path to the executable (for frozen apps)
            supabase_url: Supabase project URL (e.g., "https://xxx.supabase.co")
        """
        self.current_version = current_version
        self.supabase_url = supabase_url or self._get_supabase_url()
        
        if exe_path:
            self.exe_path = exe_path
            self.exe_dir = exe_path.parent
        elif getattr(sys, 'frozen', False):
            self.exe_path = Path(sys.executable)
            self.exe_dir = self.exe_path.parent
        else:
            # Development mode - no updates
            self.exe_path = None
            self.exe_dir = Path(__file__).parent.parent
    
    def _get_supabase_url(self) -> Optional[str]:
        """Get Supabase URL from config."""
        try:
            from config import SUPABASE_URL
            return SUPABASE_URL if SUPABASE_URL else None
        except ImportError:
            return None
    
    def _get_version_url(self) -> Optional[str]:
        """Get URL to version.json file."""
        if not self.supabase_url:
            return None
        return f"{self.supabase_url}/storage/v1/object/public/{STORAGE_BUCKET}/{VERSION_FILE}"
    
    def _get_download_url(self, filename: str = EXE_FILENAME) -> Optional[str]:
        """Get URL to download executable."""
        if not self.supabase_url:
            return None
        return f"{self.supabase_url}/storage/v1/object/public/{STORAGE_BUCKET}/{filename}"
    
    def check_for_updates(self) -> Tuple[bool, Optional[Dict]]:
        """
        Check if a new version is available from Supabase Storage.
        
        Returns:
            Tuple of (update_available, release_info)
            release_info contains: version, download_url, release_notes, etc.
        """
        version_url = self._get_version_url()
        if not version_url:
            print("[UPDATE] Cannot check for updates - Supabase URL not configured")
            return False, None
        
        try:
            # Fetch version.json from Supabase Storage
            response = requests.get(version_url, timeout=10)
            response.raise_for_status()
            
            version_data = response.json()
            latest_version = version_data.get("version", "").lstrip("v")  # Remove 'v' prefix if present
            
            if not latest_version:
                print("[UPDATE] Version file missing 'version' field")
                return False, None
            
            # Compare versions
            try:
                current_ver = version.parse(self.current_version)
                latest_ver = version.parse(latest_version)
                
                if latest_ver > current_ver:
                    # Get download URL (use filename from version.json or default)
                    exe_filename = version_data.get("filename", EXE_FILENAME)
                    download_url = self._get_download_url(exe_filename)
                    
                    if download_url:
                        return True, {
                            "version": latest_version,
                            "current_version": self.current_version,
                            "download_url": download_url,
                            "release_notes": version_data.get("release_notes", ""),
                            "published_at": version_data.get("published_at", ""),
                            "asset_name": exe_filename,
                            "asset_size": version_data.get("size", 0)
                        }
                    else:
                        print("[UPDATE] Cannot generate download URL")
                        return False, None
                else:
                    return False, None
                    
            except version.InvalidVersion as e:
                print(f"[UPDATE] Invalid version format: {latest_version} - {e}")
                return False, None
                
        except requests.RequestException as e:
            print(f"[UPDATE] Failed to check for updates: {e}")
            return False, None
        except json.JSONDecodeError as e:
            print(f"[UPDATE] Invalid JSON in version file: {e}")
            return False, None
        except Exception as e:
            print(f"[UPDATE] Error checking for updates: {e}")
            import traceback
            traceback.print_exc()
            return False, None
    
    def download_update(self, download_url: str, target_path: Optional[Path] = None) -> bool:
        """
        Download the update file.
        
        Args:
            download_url: URL to download from
            target_path: Where to save the file (default: exe_dir/iRCommander_new.exe)
        
        Returns:
            True if download successful
        """
        if not self.exe_dir:
            print("[UPDATE] Cannot download - not running as executable")
            return False
        
        if target_path is None:
            target_path = self.exe_dir / "iRCommander_new.exe"
        
        try:
            print(f"[UPDATE] Downloading update from {download_url}...")
            response = requests.get(download_url, stream=True, timeout=60)
            response.raise_for_status()
            
            total_size = int(response.headers.get('content-length', 0))
            downloaded = 0
            
            with open(target_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        if total_size > 0:
                            percent = (downloaded / total_size) * 100
                            print(f"\r[UPDATE] Downloading: {percent:.1f}%", end='', flush=True)
            
            print(f"\n[UPDATE] Download complete: {target_path}")
            return True
            
        except requests.RequestException as e:
            print(f"\n[UPDATE] Download failed: {e}")
            if target_path.exists():
                target_path.unlink()  # Clean up partial download
            return False
        except Exception as e:
            print(f"\n[UPDATE] Error downloading update: {e}")
            if target_path.exists():
                target_path.unlink()
            return False
    
    def install_update(self, new_exe_path: Path) -> bool:
        """
        Install the update by replacing the current executable.
        
        Args:
            new_exe_path: Path to the new executable
        
        Returns:
            True if installation successful
        """
        if not self.exe_path:
            print("[UPDATE] Cannot install - not running as executable")
            return False
        
        if not new_exe_path.exists():
            print(f"[UPDATE] New executable not found: {new_exe_path}")
            return False
        
        try:
            # Create backup of current executable
            backup_path = self.exe_path.with_suffix('.exe.backup')
            if self.exe_path.exists():
                print(f"[UPDATE] Creating backup: {backup_path}")
                shutil.copy2(self.exe_path, backup_path)
            
            # Replace current executable
            print(f"[UPDATE] Installing update...")
            print(f"[UPDATE]   Old: {self.exe_path}")
            print(f"[UPDATE]   New: {new_exe_path}")
            
            # On Windows, we need to rename the old exe first, then copy the new one
            old_exe_temp = self.exe_path.with_suffix('.exe.old')
            if self.exe_path.exists():
                # Try to rename the old exe
                try:
                    self.exe_path.rename(old_exe_temp)
                except PermissionError:
                    # If we can't rename (file in use), we'll need to schedule deletion on next restart
                    print("[UPDATE] Current executable is in use. Update will be applied on next restart.")
                    # Create a batch file to handle the update on next run
                    self._create_update_script(new_exe_path, old_exe_temp)
                    return True
            
            # Copy new exe to target location
            shutil.copy2(new_exe_path, self.exe_path)
            
            # Delete temporary old exe (if it exists)
            if old_exe_temp.exists():
                try:
                    old_exe_temp.unlink()
                except:
                    pass  # Will be cleaned up later
            
            print(f"[UPDATE] Update installed successfully!")
            print(f"[UPDATE] Restart the application to use the new version.")
            return True
            
        except Exception as e:
            print(f"[UPDATE] Installation failed: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def _create_update_script(self, new_exe: Path, old_exe: Path):
        """Create a batch script to complete the update on next restart."""
        script_path = self.exe_dir / "apply_update.bat"
        script_content = f"""@echo off
REM Auto-generated update script
timeout /t 2 /nobreak >nul
del /f "{old_exe}" 2>nul
del /f "{new_exe}" 2>nul
del /f "%~f0" 2>nul
"""
        script_path.write_text(script_content)
        print(f"[UPDATE] Created update script: {script_path}")
    
    def update_available(self) -> Optional[Dict]:
        """Convenience method to check and return update info if available."""
        has_update, info = self.check_for_updates()
        return info if has_update else None


def get_updater(current_version: str, supabase_url: Optional[str] = None) -> Optional[Updater]:
    """Get updater instance if running as executable."""
    if getattr(sys, 'frozen', False):
        return Updater(current_version, supabase_url=supabase_url)
    return None
