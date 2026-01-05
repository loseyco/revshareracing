"""
Auto-Update Module
Checks for updates and handles downloading and installing new versions
"""

import sys
import os
import time
import shutil
import subprocess
import requests
from pathlib import Path
from typing import Optional, Dict
import threading

# Current version - update this when releasing
CURRENT_VERSION = "1.0.2"


class Updater:
    """Handles checking for and installing updates"""
    
    def __init__(self):
        self.current_version = CURRENT_VERSION
        self.update_check_interval = 3600  # Check every hour
        self.last_check_time = 0
        self.update_available = False
        self.latest_version = None
        self.download_url = None
        self.checking = False
        self.downloading = False
        self.on_update_available = None  # Callback when update is found
        self.on_download_progress = None  # Callback for download progress
        self.on_update_complete = None  # Callback when update is ready to install
        self.portal_base_url = self._get_portal_base_url()
    
    def _get_portal_base_url(self) -> str:
        """
        Get the portal base URL for update checking
        Uses the same logic as device module to detect the portal URL
        """
        # Try to use device module's portal URL detection
        try:
            from core import device
            portal_base = device.DEVICE_PORTAL_BASE_URL
            # Extract base URL (remove /device suffix if present)
            if portal_base.endswith('/device'):
                base_url = portal_base[:-7]  # Remove '/device'
            elif '/device/' in portal_base:
                base_url = portal_base.split('/device/')[0]
            else:
                base_url = portal_base
            
            # Ensure it's a valid URL
            if base_url and (base_url.startswith('http://') or base_url.startswith('https://')):
                return base_url.rstrip('/')
        except Exception as e:
            print(f"[UPDATER] Could not detect portal URL from device module: {e}")
        
        # Fallback to environment variable
        explicit = os.getenv("REVSHARERACING_PORTAL_BASE_URL")
        if explicit:
            return explicit.rstrip("/")
        
        # Default to production URL
        return "https://revshareracing.com"
        
    def check_for_updates(self) -> Optional[Dict]:
        """
        Check for available updates
        Returns dict with update info if available, None otherwise
        """
        if self.checking:
            return None
            
        self.checking = True
        try:
            # Use the portal's API endpoint to get latest release
            # Portal URL is auto-detected from device config or environment
            api_url = f"{self.portal_base_url}/api/github/latest-release"
            
            response = requests.get(api_url, timeout=10)
            if response.status_code != 200:
                print(f"[UPDATER] Failed to check for updates: HTTP {response.status_code}")
                return None
                
            data = response.json()
            latest_version = data.get('version')
            download_url = data.get('downloadUrl')
            
            if not latest_version or not download_url:
                print("[UPDATER] Invalid update response")
                return None
            
            # Remove 'v' prefix if present for comparison
            latest_clean = latest_version.lstrip('v')
            current_clean = self.current_version.lstrip('v')
            
            # Simple version comparison (assumes semantic versioning)
            if self._is_newer_version(latest_clean, current_clean):
                self.update_available = True
                self.latest_version = latest_version
                self.download_url = download_url
                
                update_info = {
                    'version': latest_version,
                    'downloadUrl': download_url,
                    'currentVersion': self.current_version,
                    'releaseUrl': data.get('releaseUrl'),
                }
                
                print(f"[UPDATER] Update available: {latest_version} (current: {self.current_version})")
                
                if self.on_update_available:
                    self.on_update_available(update_info)
                    
                return update_info
            else:
                self.update_available = False
                print(f"[UPDATER] Already on latest version: {self.current_version}")
                return None
                
        except Exception as e:
            print(f"[UPDATER] Error checking for updates: {e}")
            return None
        finally:
            self.checking = False
            self.last_check_time = time.time()
    
    def _is_newer_version(self, latest: str, current: str) -> bool:
        """Compare version strings (simple semantic versioning)"""
        try:
            latest_parts = [int(x) for x in latest.split('.')]
            current_parts = [int(x) for x in current.split('.')]
            
            # Pad to same length
            max_len = max(len(latest_parts), len(current_parts))
            latest_parts.extend([0] * (max_len - len(latest_parts)))
            current_parts.extend([0] * (max_len - len(current_parts)))
            
            # Compare from left to right
            for l, c in zip(latest_parts, current_parts):
                if l > c:
                    return True
                elif l < c:
                    return False
            return False  # Same version
        except:
            # If parsing fails, do string comparison
            return latest > current
    
    def download_update(self, download_url: Optional[str] = None) -> bool:
        """
        Download the update
        Returns True if successful, False otherwise
        """
        if self.downloading:
            print("[UPDATER] Download already in progress")
            return False
            
        if not download_url:
            download_url = self.download_url
            
        if not download_url:
            print("[UPDATER] No download URL available")
            return False
        
        self.downloading = True
        try:
            print(f"[UPDATER] Downloading update from: {download_url}")
            
            # Determine where to save the update
            if getattr(sys, 'frozen', False):
                # Running as executable
                exe_path = Path(sys.executable)
                update_dir = exe_path.parent
                update_file = update_dir / f"RevShareRacing_new.exe"
            else:
                # Running as script
                update_dir = Path(__file__).parent.parent.parent
                update_file = update_dir / "RevShareRacing_new.exe"
            
            # Download with progress
            response = requests.get(download_url, stream=True, timeout=60)
            response.raise_for_status()
            
            total_size = int(response.headers.get('content-length', 0))
            downloaded = 0
            
            with open(update_file, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        
                        if total_size > 0 and self.on_download_progress:
                            progress = (downloaded / total_size) * 100
                            self.on_download_progress(progress, downloaded, total_size)
            
            print(f"[UPDATER] Download complete: {update_file}")
            
            if self.on_update_complete:
                self.on_update_complete(str(update_file))
                
            return True
            
        except Exception as e:
            print(f"[UPDATER] Error downloading update: {e}")
            return False
        finally:
            self.downloading = False
    
    def install_update(self, update_file_path: str, restart: bool = True) -> bool:
        """
        Install the update by replacing the current executable
        Returns True if successful, False otherwise
        """
        try:
            if getattr(sys, 'frozen', False):
                # Running as executable
                current_exe = Path(sys.executable)
                update_file = Path(update_file_path)
                
                if not update_file.exists():
                    print(f"[UPDATER] Update file not found: {update_file}")
                    return False
                
                # Create backup of current executable
                backup_file = current_exe.parent / f"RevShareRacing_backup_{int(time.time())}.exe"
                print(f"[UPDATER] Creating backup: {backup_file}")
                shutil.copy2(current_exe, backup_file)
                
                # Replace current executable with new one
                print(f"[UPDATER] Installing update: {current_exe}")
                shutil.move(update_file, current_exe)
                
                print("[UPDATER] Update installed successfully")
                
                if restart:
                    print("[UPDATER] Restarting service in 3 seconds...")
                    time.sleep(3)
                    self._restart_service()
                
                return True
            else:
                print("[UPDATER] Auto-update only works for compiled executables")
                return False
                
        except Exception as e:
            print(f"[UPDATER] Error installing update: {e}")
            return False
    
    def _restart_service(self):
        """Restart the service by launching the new executable and exiting"""
        try:
            if getattr(sys, 'frozen', False):
                current_exe = Path(sys.executable)
                
                # Launch new executable
                subprocess.Popen([str(current_exe)], cwd=current_exe.parent)
                
                # Exit current process
                sys.exit(0)
        except Exception as e:
            print(f"[UPDATER] Error restarting service: {e}")
    
    def start_periodic_check(self, interval: Optional[int] = None):
        """Start a background thread that periodically checks for updates"""
        if interval:
            self.update_check_interval = interval
        
        def check_loop():
            while True:
                try:
                    time.sleep(self.update_check_interval)
                    self.check_for_updates()
                except Exception as e:
                    print(f"[UPDATER] Error in periodic check: {e}")
                    time.sleep(60)  # Wait a minute before retrying
        
        thread = threading.Thread(target=check_loop, daemon=True)
        thread.start()
        print(f"[UPDATER] Started periodic update check (every {self.update_check_interval}s)")


# Global updater instance
_updater_instance = None

def get_updater() -> Updater:
    """Get the global updater instance"""
    global _updater_instance
    if _updater_instance is None:
        _updater_instance = Updater()
    return _updater_instance

