"""
iRCommander API Client - Clean, API-first implementation
"""

import json
import time
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
import requests

from config import IRCOMMANDER_API_URL, DATA_DIR


@dataclass
class DeviceInfo:
    device_id: str
    api_key: str
    name: Optional[str] = None
    status: Optional[str] = None


@dataclass
class UserInfo:
    user_id: str
    email: str
    tenant_id: Optional[str] = None
    tenant_name: Optional[str] = None


class APIError(Exception):
    def __init__(self, message: str, status_code: int = None):
        super().__init__(message)
        self.status_code = status_code


class IRCommanderAPI:
    """Clean API client for iRCommander platform."""
    
    def __init__(self, api_url: str = None):
        self.api_url = (api_url or IRCOMMANDER_API_URL).rstrip("/")
        self.api_key: Optional[str] = None
        self.device_id: Optional[str] = None
        # Auth state
        self.access_token: Optional[str] = None
        self.refresh_token: Optional[str] = None
        self.user: Optional[UserInfo] = None
        
        self.config_path = DATA_DIR / "device_config.json"
        self._session = requests.Session()
        self._load_config()
    
    def _load_config(self):
        """Load saved device config."""
        if self.config_path.exists():
            try:
                config = json.loads(self.config_path.read_text())
                self.api_key = config.get("api_key")
                self.device_id = config.get("device_id")
                self.access_token = config.get("access_token")
                self.refresh_token = config.get("refresh_token")
                
                # Check if saved API URL differs from current - update if needed
                saved_api_url = config.get("api_url")
                if saved_api_url and saved_api_url != self.api_url:
                    print(f"[INFO] API URL changed from {saved_api_url} to {self.api_url}")
                    print(f"[INFO] Device will re-register with new API URL")
                    # Clear device registration to force re-registration with new URL
                    self.api_key = None
                    self.device_id = None
                
                # Restore user info
                if config.get("user_id"):
                    self.user = UserInfo(
                        user_id=config["user_id"],
                        email=config.get("email", ""),
                        tenant_id=config.get("tenant_id"),
                        tenant_name=config.get("tenant_name")
                    )
            except Exception as e:
                print(f"[WARN] Config load failed: {e}")
    
    def _save_config(self):
        """Save device config."""
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        config = {
            "device_id": self.device_id,
            "api_key": self.api_key,
            "access_token": self.access_token,
            "refresh_token": self.refresh_token,
            "api_url": self.api_url,
            "saved_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        }
        if self.user:
            config["user_id"] = self.user.user_id
            config["email"] = self.user.email
            config["tenant_id"] = self.user.tenant_id
            config["tenant_name"] = self.user.tenant_name
        self.config_path.write_text(json.dumps(config, indent=2))
    
    def _headers(self, auth: bool = True, use_bearer: bool = False) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if auth:
            if use_bearer:
                if self.access_token:
                    headers["Authorization"] = f"Bearer {self.access_token}"
                else:
                    # Debug: log when bearer is requested but token is missing
                    print(f"[WARN] Bearer auth requested but access_token is None or empty")
                    print(f"[DEBUG] access_token value: {repr(self.access_token)}")
                    print(f"[DEBUG] user: {self.user}")
            elif self.api_key:
                headers["X-Device-Key"] = self.api_key
            else:
                # Debug: log when auth is requested but no token/key available
                if auth and not use_bearer:
                    print(f"[DEBUG] Auth requested but no api_key available")
        return headers
    
    def _request(self, method: str, endpoint: str, data: Dict = None, auth: bool = True, use_bearer: bool = False) -> Dict:
        """Make API request with error handling."""
        url = f"{self.api_url}{endpoint}"
        headers = self._headers(auth, use_bearer)
        
        # Debug logging for authentication endpoints (first few times only)
        if endpoint in ["/api/v1/device/heartbeat", "/api/v1/device/status", "/api/v1/device/commands"]:
            if not hasattr(self, '_debug_count'):
                self._debug_count = 0
            if self._debug_count < 2:  # Only log first 2 times
                if "X-Device-Key" in headers:
                    key_preview = headers["X-Device-Key"][:20] + "..." if len(headers["X-Device-Key"]) > 20 else headers["X-Device-Key"]
                    print(f"[DEBUG] Request to {endpoint} with API key: {key_preview}")
                    print(f"[DEBUG] API URL: {url}")
                else:
                    print(f"[DEBUG] Request to {endpoint} - NO API KEY in headers!")
                self._debug_count += 1
        
        # Debug logging for registration endpoint
        if endpoint == "/api/v1/device/register":
            print(f"[DEBUG] Registration request:")
            print(f"  URL: {url}")
            print(f"  Method: {method}")
            print(f"  Auth: {auth}, UseBearer: {use_bearer}")
            print(f"  Headers: {list(headers.keys())}")
            if "Authorization" in headers:
                token_preview = headers["Authorization"][:20] + "..." if len(headers["Authorization"]) > 20 else headers["Authorization"]
                print(f"  Authorization: {token_preview}")
            if "X-Device-Key" in headers:
                key_preview = headers["X-Device-Key"][:10] + "..." if len(headers["X-Device-Key"]) > 10 else headers["X-Device-Key"]
                print(f"  X-Device-Key: {key_preview}")
            print(f"  Data: {data}")
        
        try:
            resp = self._session.request(
                method=method,
                url=url,
                headers=headers,
                json=data,
                timeout=30
            )
            
            # Debug: log response details for troubleshooting
            if not resp.text:
                print(f"[API] Empty response from {method} {url}")
                print(f"[API] Status: {resp.status_code}")
                print(f"[API] Headers: {dict(resp.headers)}")
                raise APIError(f"Empty response from server (status {resp.status_code})", resp.status_code)
            
            # Try to parse JSON, but handle non-JSON responses
            try:
                result = resp.json()
            except ValueError as json_err:
                # Response is not JSON - might be HTML (password protection) or error page
                print(f"[API] Non-JSON response from {method} {url}")
                print(f"[API] Status: {resp.status_code}")
                print(f"[API] Content-Type: {resp.headers.get('Content-Type', 'unknown')}")
                print(f"[API] Response preview (first 500 chars): {resp.text[:500]}")
                
                if resp.status_code == 401:
                    raise APIError("Authentication failed - invalid credentials", 401)
                elif resp.status_code == 403:
                    raise APIError("Access forbidden - deployment may be password protected", 403)
                elif "password" in resp.text.lower() or "vercel" in resp.text.lower():
                    raise APIError(
                        "Deployment appears to be password protected. "
                        "Please disable password protection in Vercel settings or use a different deployment URL.",
                        resp.status_code
                    )
                else:
                    raise APIError(
                        f"Server returned non-JSON response (status {resp.status_code}): {resp.text[:200]}",
                        resp.status_code
                    )
            
            if resp.status_code == 401:
                # Provide helpful message for authentication failures
                error_detail = result.get("error") or result.get("message") or "Authentication failed"
                if isinstance(error_detail, dict):
                    error_detail = error_detail.get("message", "Authentication failed")
                
                # Check if this is a device key issue
                if endpoint in ["/api/v1/device/heartbeat", "/api/v1/device/status", "/api/v1/device/commands"]:
                    enhanced_msg = (
                        f"Device authentication failed. Your API key may be invalid or expired.\n"
                        f"Try re-registering your device by:\n"
                        f"1. Delete the file: {self.config_path}\n"
                        f"2. Restart the application\n"
                        f"3. Login and register the device again"
                    )
                    raise APIError(enhanced_msg, 401)
                else:
                    raise APIError(str(error_detail), 401)
            if resp.status_code >= 400:
                # Extract error message - could be in different formats
                error_msg = result.get("error")
                if isinstance(error_msg, dict):
                    error_msg = error_msg.get("message", str(error_msg))
                elif not error_msg:
                    error_msg = result.get("message", resp.text or f"HTTP {resp.status_code}")
                
                print(f"[API] Request failed: {method} {url}")
                print(f"[API] Status: {resp.status_code}")
                print(f"[API] Response: {result}")
                
                # Provide helpful context for common errors
                if resp.status_code == 500 and "Invalid API key" in str(error_msg):
                    enhanced_msg = (
                        f"{error_msg}\n"
                        f"[NOTE] This is a server configuration issue. The server's SUPABASE_SERVICE_ROLE_KEY "
                        f"environment variable may be missing or invalid. Please contact the server administrator."
                    )
                    raise APIError(enhanced_msg, resp.status_code)
                
                raise APIError(error_msg or f"Request failed with status {resp.status_code}", resp.status_code)
            
            return result.get("data", result)
        except requests.exceptions.RequestException as e:
            print(f"[API] Request exception: {method} {url} - {e}")
            raise APIError(f"Request failed: {e}")
    
    @property
    def is_registered(self) -> bool:
        return bool(self.api_key and self.device_id)
    
    @property
    def is_logged_in(self) -> bool:
        return bool(self.access_token and self.user)
    
    # === Authentication ===
    def login(self, email: str, password: str) -> UserInfo:
        """Login with email and password."""
        # Debug logging for login
        print(f"[DEBUG] Login attempt:")
        print(f"  Email: {email}")
        print(f"  Password length: {len(password)} characters")
        print(f"  API URL: {self.api_url}")
        
        data = {"email": email.strip().lower(), "password": password}  # Normalize email
        print(f"[DEBUG] Sending login request to: {self.api_url}/api/v1/auth/login")
        
        try:
            result = self._request("POST", "/api/v1/auth/login", data, auth=False)
        except APIError as e:
            error_str = str(e)
            print(f"[ERROR] Login failed: {error_str}")
            print(f"[DEBUG] Error details: {error_str}")
            print(f"[DEBUG] Request URL: {self.api_url}/api/v1/auth/login")
            print(f"[DEBUG] Email sent: {email.strip().lower()}")
            print(f"[DEBUG] Password length: {len(password)} characters")
            
            # Re-raise with more context
            if "Invalid email or password" in error_str or "401" in error_str or "unauthorized" in error_str.lower():
                raise APIError(
                    f"Login failed: Invalid email or password.\n\n"
                    f"Troubleshooting:\n"
                    f"  1. Verify email: {email.strip().lower()}\n"
                    f"  2. Check password (length: {len(password)} chars)\n"
                    f"  3. Ensure account exists in Supabase\n"
                    f"  4. Try resetting password via 'Forgot Password?'\n"
                    f"  5. API URL: {self.api_url}\n\n"
                    f"If credentials are correct, the account may need to be created or the password reset."
                )
            raise
        
        self.access_token = result.get("access_token")
        self.refresh_token = result.get("refresh_token")
        
        # Debug: verify token was received
        if not self.access_token:
            print(f"[WARN] Login response did not include access_token")
            print(f"[DEBUG] Login response keys: {list(result.keys())}")
            print(f"[DEBUG] Full response: {result}")
            raise APIError("Login succeeded but no access token received")
        else:
            token_preview = self.access_token[:20] + "..." if len(self.access_token) > 20 else self.access_token
            print(f"[DEBUG] Received access_token: {token_preview}")
        
        # Get user info
        user_data = result.get("user", {})
        self.user = UserInfo(
            user_id=user_data.get("id", ""),
            email=user_data.get("email", email),
            tenant_id=user_data.get("tenant_id"),
            tenant_name=user_data.get("tenant_name")
        )
        
        self._save_config()
        
        # Verify saved state
        if not self.access_token:
            raise APIError("Login succeeded but no access token received")
        
        return self.user
    
    def logout(self):
        """Clear auth state."""
        self.access_token = None
        self.refresh_token = None
        self.user = None
        self._save_config()
    
    def get_me(self) -> UserInfo:
        """Get current user info including tenant."""
        result = self._request("GET", "/api/v1/auth/me", auth=True, use_bearer=True)
        
        self.user = UserInfo(
            user_id=result.get("id", ""),
            email=result.get("email", ""),
            tenant_id=result.get("tenant_id"),
            tenant_name=result.get("tenant_name")
        )
        self._save_config()
        return self.user
    
    # === Device Registration ===
    def register(self, hardware_id: str, name: str = None, tenant_id: str = None, force_new: bool = False) -> DeviceInfo:
        """Register device and get API key.
        
        Args:
            hardware_id: Hardware fingerprint
            name: Optional device name
            tenant_id: Optional tenant ID
            force_new: If True, adds random suffix to device_id to force new registration
        """
        import random
        import string
        
        data = {"hardware_id": hardware_id}
        if name:
            data["name"] = name
        
        # Force new device by adding random suffix to device_id
        if force_new:
            random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
            # Generate a unique device_id
            base_id = f"rig-{hardware_id[:12]}"
            data["device_id"] = f"{base_id}-{random_suffix}"
            print(f"[INFO] Forcing new device registration with ID: {data['device_id']}")
        
        # Use provided tenant_id or get from logged-in user (optional)
        tid = tenant_id or (self.user.tenant_id if self.user else None)
        if tid:
            data["tenant_id"] = tid
            data["owner_type"] = "tenant"
        
        # Use bearer token if logged in, otherwise no auth
        use_bearer = self.is_logged_in
        if use_bearer:
            print(f"[DEBUG] Registering with Bearer token (user: {self.user.email if self.user else 'unknown'})")
            if not self.access_token:
                print(f"[WARN] is_logged_in=True but access_token is None!")
        else:
            print(f"[DEBUG] Registering without authentication")
        
        result = self._request("POST", "/api/v1/device/register", data, auth=use_bearer, use_bearer=use_bearer)
        self.device_id = result["device_id"]
        self.api_key = result["api_key"]
        
        # Debug: Log registration details
        print(f"[DEBUG] Registration response:")
        print(f"  Device ID: {self.device_id}")
        print(f"  API Key (first 30 chars): {self.api_key[:30]}...")
        print(f"  API Key length: {len(self.api_key)}")
        print(f"  Full API Key: {self.api_key}")
        print(f"  Full response: {result}")
        
        self._save_config()
        
        # Verify the key was saved
        if self.config_path.exists():
            saved_config = json.loads(self.config_path.read_text())
            if saved_config.get("api_key") == self.api_key:
                print(f"[DEBUG] API key verified in saved config")
            else:
                print(f"[WARN] API key mismatch in saved config!")
                print(f"  Expected: {self.api_key[:30]}...")
                print(f"  Saved: {saved_config.get('api_key', 'None')[:30] if saved_config.get('api_key') else 'None'}...")
        
        return DeviceInfo(device_id=self.device_id, api_key=self.api_key)
    
    # === Heartbeat & Status ===
    def heartbeat(self) -> Dict:
        """Send heartbeat."""
        return self._request("POST", "/api/v1/device/heartbeat")
    
    def get_status(self) -> Dict:
        """Get device status."""
        return self._request("GET", "/api/v1/device/status")
    
    def update_status(self, status: str = None, car: str = None, track: str = None, **kwargs) -> Dict:
        """Update device status."""
        data = {k: v for k, v in {
            "status": status,
            "current_car": car,
            "current_track": track,
            **kwargs
        }.items() if v is not None}
        return self._request("PUT", "/api/v1/device/status", data)
    
    # === Laps ===
    def upload_lap(self, lap_time: float, track: str, car: str, lap_number: int = None, 
                   driver_name: str = None, **metadata) -> Dict:
        """Upload a lap."""
        data = {
            "lap_time": lap_time,
            "track_name": track,
            "car_name": car,
            "is_valid": True
        }
        if lap_number:
            data["lap_number"] = lap_number
        if driver_name:
            data["driver_name"] = driver_name
        if metadata:
            data["metadata"] = metadata
        
        return self._request("POST", "/api/v1/device/laps", data)
    
    # === Commands ===
    def get_commands(self) -> List[Dict]:
        """Poll for pending commands."""
        result = self._request("GET", "/api/v1/device/commands")
        return result.get("commands", [])
    
    def complete_command(self, command_id: str, status: str = "completed", result: Dict = None) -> Dict:
        """Mark command as completed."""
        data = {"status": status}
        if result:
            data["result"] = result
        return self._request("POST", f"/api/v1/device/commands/{command_id}/complete", data)
    
    # === Remote Desktop (WebRTC) ===
    def create_webrtc_offer(self, offer_sdp: str) -> Dict:
        """Create WebRTC offer and get answer from device."""
        data = {"offer": offer_sdp}
        return self._request("POST", "/api/v1/device/remote-desktop/offer", data)
    
    def send_ice_candidate(self, candidate: Dict) -> Dict:
        """Send ICE candidate to device."""
        return self._request("POST", "/api/v1/device/remote-desktop/ice-candidate", {"candidate": candidate})
    
    def close(self):
        """Close session."""
        self._session.close()


# Singleton
_api: Optional[IRCommanderAPI] = None

def get_api() -> IRCommanderAPI:
    global _api
    if _api is None:
        _api = IRCommanderAPI()
    return _api

