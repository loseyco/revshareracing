"""
GridPass API Client - Clean, API-first implementation
"""

import json
import time
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
import requests

from config import GRIDPASS_API_URL, DATA_DIR


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


class GridPassAPI:
    """Clean API client for GridPass platform."""
    
    def __init__(self, api_url: str = None):
        self.api_url = (api_url or GRIDPASS_API_URL).rstrip("/")
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
            if use_bearer and self.access_token:
                headers["Authorization"] = f"Bearer {self.access_token}"
            elif self.api_key:
                headers["X-Device-Key"] = self.api_key
        return headers
    
    def _request(self, method: str, endpoint: str, data: Dict = None, auth: bool = True, use_bearer: bool = False) -> Dict:
        """Make API request with error handling."""
        url = f"{self.api_url}{endpoint}"
        try:
            resp = self._session.request(
                method=method,
                url=url,
                headers=self._headers(auth, use_bearer),
                json=data,
                timeout=30
            )
            result = resp.json() if resp.text else {}
            
            if resp.status_code == 401:
                raise APIError("Authentication failed", 401)
            if resp.status_code >= 400:
                raise APIError(result.get("error", result.get("message", resp.text)), resp.status_code)
            
            return result.get("data", result)
        except requests.exceptions.RequestException as e:
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
        data = {"email": email, "password": password}
        result = self._request("POST", "/api/v1/auth/login", data, auth=False)
        
        self.access_token = result.get("access_token")
        self.refresh_token = result.get("refresh_token")
        
        # Get user info
        user_data = result.get("user", {})
        self.user = UserInfo(
            user_id=user_data.get("id", ""),
            email=user_data.get("email", email),
            tenant_id=user_data.get("tenant_id"),
            tenant_name=user_data.get("tenant_name")
        )
        
        self._save_config()
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
    def register(self, hardware_id: str, name: str = None, tenant_id: str = None) -> DeviceInfo:
        """Register device and get API key."""
        data = {"hardware_id": hardware_id, "owner_type": "tenant"}
        if name:
            data["name"] = name
        # Use provided tenant_id or get from logged-in user
        tid = tenant_id or (self.user.tenant_id if self.user else None)
        if tid:
            data["tenant_id"] = tid
        
        result = self._request("POST", "/api/v1/device/register", data, auth=False)
        self.device_id = result["device_id"]
        self.api_key = result["api_key"]
        self._save_config()
        
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
    
    def close(self):
        """Close session."""
        self._session.close()


# Singleton
_api: Optional[GridPassAPI] = None

def get_api() -> GridPassAPI:
    global _api
    if _api is None:
        _api = GridPassAPI()
    return _api

