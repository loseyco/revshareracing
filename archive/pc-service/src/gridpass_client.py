"""
GridPass API Client for PC Service

This module provides a Python client for communicating with the GridPass API.
It replaces direct Supabase database calls with secure API calls using per-device API keys.

Usage:
    client = GridPassClient(api_url="https://gridpass.app")
    client.register(hardware_id="abc123")  # First time - gets API key
    client.heartbeat()  # Update online status
    client.upload_lap(lap_data)  # Upload lap data
"""

import json
import time
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
import requests


@dataclass
class DeviceInfo:
    """Device information from GridPass."""
    device_id: str
    api_key: str
    name: Optional[str] = None
    status: Optional[str] = None
    owner_type: Optional[str] = None
    tenant_id: Optional[str] = None


class GridPassClientError(Exception):
    """Base exception for GridPass client errors."""
    def __init__(self, message: str, status_code: int = None, response: dict = None):
        super().__init__(message)
        self.status_code = status_code
        self.response = response


class GridPassAuthError(GridPassClientError):
    """Authentication error - invalid or expired API key."""
    pass


class GridPassClient:
    """
    Client for communicating with the GridPass API.
    
    This client handles:
    - Device registration and API key management
    - Device status updates and heartbeat
    - Lap data uploads
    - Command polling and completion
    """
    
    def __init__(
        self,
        api_url: str = "https://gridpass.app",
        api_key: Optional[str] = None,
        device_id: Optional[str] = None,
        config_path: Optional[Path] = None,
        timeout: int = 30
    ):
        """
        Initialize the GridPass client.
        
        Args:
            api_url: Base URL for the GridPass API
            api_key: Device API key (if already registered)
            device_id: Device ID (if already registered)
            config_path: Path to store device config (defaults to data/device_config.json)
            timeout: Request timeout in seconds
        """
        self.api_url = api_url.rstrip("/")
        self.api_key = api_key
        self.device_id = device_id
        self.timeout = timeout
        
        # Config file path
        if config_path:
            self.config_path = config_path
        else:
            # Default to data directory relative to this file
            self.config_path = Path(__file__).parent.parent / "data" / "gridpass_config.json"
        
        # Load saved config if available
        self._load_config()
        
        # Session for connection reuse
        self._session = requests.Session()
    
    def _load_config(self) -> None:
        """Load device configuration from file."""
        try:
            if self.config_path.exists():
                with open(self.config_path, "r") as f:
                    config = json.load(f)
                    if not self.api_key:
                        self.api_key = config.get("api_key")
                    if not self.device_id:
                        self.device_id = config.get("device_id")
        except Exception as e:
            print(f"[WARN] Could not load GridPass config: {e}")
    
    def _save_config(self) -> None:
        """Save device configuration to file."""
        try:
            self.config_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.config_path, "w") as f:
                json.dump({
                    "device_id": self.device_id,
                    "api_key": self.api_key,
                    "api_url": self.api_url,
                    "saved_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                }, f, indent=2)
        except Exception as e:
            print(f"[WARN] Could not save GridPass config: {e}")
    
    def _get_headers(self, include_auth: bool = True) -> Dict[str, str]:
        """Get request headers with optional authentication."""
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        if include_auth and self.api_key:
            headers["X-Device-Key"] = self.api_key
        return headers
    
    def _make_request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict] = None,
        include_auth: bool = True,
        retries: int = 2
    ) -> Dict[str, Any]:
        """
        Make an API request with error handling and retries.
        
        Args:
            method: HTTP method (GET, POST, PUT, etc.)
            endpoint: API endpoint (e.g., "/api/v1/device/heartbeat")
            data: Request body data (for POST/PUT)
            include_auth: Whether to include the API key header
            retries: Number of retries on failure
        
        Returns:
            Response data as dictionary
        
        Raises:
            GridPassAuthError: On authentication failures
            GridPassClientError: On other API errors
        """
        url = f"{self.api_url}{endpoint}"
        
        for attempt in range(retries + 1):
            try:
                response = self._session.request(
                    method=method,
                    url=url,
                    headers=self._get_headers(include_auth),
                    json=data if data else None,
                    timeout=self.timeout
                )
                
                # Parse response
                try:
                    result = response.json()
                except json.JSONDecodeError:
                    result = {"raw": response.text}
                
                # Handle errors
                if response.status_code == 401:
                    raise GridPassAuthError(
                        "Authentication failed - invalid or expired API key",
                        status_code=401,
                        response=result
                    )
                elif response.status_code >= 400:
                    raise GridPassClientError(
                        f"API error: {result.get('message', response.text)}",
                        status_code=response.status_code,
                        response=result
                    )
                
                return result.get("data", result)
                
            except requests.exceptions.Timeout:
                if attempt < retries:
                    time.sleep(1)
                    continue
                raise GridPassClientError(f"Request timed out after {self.timeout}s")
            
            except requests.exceptions.ConnectionError as e:
                if attempt < retries:
                    time.sleep(2)
                    continue
                raise GridPassClientError(f"Connection failed: {e}")
    
    @property
    def is_registered(self) -> bool:
        """Check if the device is registered (has API key)."""
        return bool(self.api_key and self.device_id)
    
    def register(
        self,
        hardware_id: str,
        device_id: Optional[str] = None,
        name: Optional[str] = None,
        tenant_id: Optional[str] = None,
        owner_type: str = "tenant"
    ) -> DeviceInfo:
        """
        Register this device with GridPass and get an API key.
        
        If already registered, returns the existing API key.
        
        Args:
            hardware_id: Unique hardware fingerprint
            device_id: Optional custom device ID
            name: Optional friendly name for the device
            tenant_id: Optional tenant ID to associate with
            owner_type: Ownership type (tenant, gridpass, operator)
        
        Returns:
            DeviceInfo with device_id and api_key
        """
        data = {
            "hardware_id": hardware_id,
            "owner_type": owner_type
        }
        if device_id:
            data["device_id"] = device_id
        if name:
            data["name"] = name
        if tenant_id:
            data["tenant_id"] = tenant_id
        
        result = self._make_request(
            "POST",
            "/api/v1/device/register",
            data=data,
            include_auth=False  # No auth needed for registration
        )
        
        # Save the API key
        self.device_id = result["device_id"]
        self.api_key = result["api_key"]
        self._save_config()
        
        print(f"[OK] Registered with GridPass: {self.device_id}")
        if result.get("is_new"):
            print("[INFO] This is a new device registration")
        
        return DeviceInfo(
            device_id=self.device_id,
            api_key=self.api_key
        )
    
    def heartbeat(self) -> Dict[str, Any]:
        """
        Send a heartbeat to update device online status.
        
        Returns:
            Response with device status and timestamp
        """
        if not self.is_registered:
            raise GridPassClientError("Device not registered - call register() first")
        
        return self._make_request("POST", "/api/v1/device/heartbeat")
    
    def get_status(self) -> Dict[str, Any]:
        """
        Get current device status from GridPass.
        
        Returns:
            Full device status including current user, car, track, etc.
        """
        if not self.is_registered:
            raise GridPassClientError("Device not registered - call register() first")
        
        return self._make_request("GET", "/api/v1/device/status")
    
    def update_status(
        self,
        status: Optional[str] = None,
        current_user_id: Optional[str] = None,
        current_driver_name: Optional[str] = None,
        current_car: Optional[str] = None,
        current_track: Optional[str] = None,
        session_type: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Update device status.
        
        Args:
            status: Device status (online, offline, busy, maintenance)
            current_user_id: ID of current user
            current_driver_name: Name of current driver
            current_car: Current car being used
            current_track: Current track
            session_type: Type of session (practice, race, etc.)
        
        Returns:
            Response confirming update
        """
        if not self.is_registered:
            raise GridPassClientError("Device not registered - call register() first")
        
        data = {}
        if status:
            data["status"] = status
        if current_user_id is not None:
            data["current_user_id"] = current_user_id
        if current_driver_name is not None:
            data["current_driver_name"] = current_driver_name
        if current_car is not None:
            data["current_car"] = current_car
        if current_track is not None:
            data["current_track"] = current_track
        if session_type is not None:
            data["session_type"] = session_type
        
        # Include any additional fields
        data.update(kwargs)
        
        return self._make_request("PUT", "/api/v1/device/status", data=data)
    
    def upload_lap(
        self,
        lap_time: float,
        track_name: str,
        car_name: str,
        user_id: Optional[str] = None,
        driver_name: Optional[str] = None,
        lap_number: Optional[int] = None,
        session_type: Optional[str] = None,
        is_valid: bool = True,
        sector_times: Optional[List[float]] = None,
        incident_count: Optional[int] = None,
        **metadata
    ) -> Dict[str, Any]:
        """
        Upload a single lap.
        
        Args:
            lap_time: Lap time in seconds
            track_name: Name of the track
            car_name: Name of the car
            user_id: Optional user ID
            driver_name: Optional driver name
            lap_number: Optional lap number
            session_type: Session type (practice, qualify, race)
            is_valid: Whether lap is valid (no cuts, etc.)
            sector_times: List of sector times
            incident_count: Number of incidents
            **metadata: Additional metadata fields
        
        Returns:
            Response with saved lap info
        """
        if not self.is_registered:
            raise GridPassClientError("Device not registered - call register() first")
        
        data = {
            "lap_time": lap_time,
            "track_name": track_name,
            "car_name": car_name,
            "is_valid": is_valid
        }
        
        if user_id:
            data["user_id"] = user_id
        if driver_name:
            data["driver_name"] = driver_name
        if lap_number is not None:
            data["lap_number"] = lap_number
        if session_type:
            data["session_type"] = session_type
        if sector_times:
            data["sector_times"] = sector_times
        if incident_count is not None:
            data["incident_count"] = incident_count
        if metadata:
            data["metadata"] = metadata
        
        return self._make_request("POST", "/api/v1/device/laps", data=data)
    
    def upload_laps(self, laps: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Upload multiple laps in a batch.
        
        Args:
            laps: List of lap data dictionaries
        
        Returns:
            Response with count of saved laps
        """
        if not self.is_registered:
            raise GridPassClientError("Device not registered - call register() first")
        
        return self._make_request("POST", "/api/v1/device/laps", data={"laps": laps})
    
    def get_commands(self) -> List[Dict[str, Any]]:
        """
        Poll for pending commands.
        
        Returns:
            List of pending commands
        """
        if not self.is_registered:
            raise GridPassClientError("Device not registered - call register() first")
        
        result = self._make_request("GET", "/api/v1/device/commands")
        return result.get("commands", [])
    
    def complete_command(
        self,
        command_id: str,
        status: str = "completed",
        result: Optional[Dict] = None,
        error_message: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Mark a command as completed or failed.
        
        Args:
            command_id: ID of the command to complete
            status: Completion status (completed, failed)
            result: Optional result data
            error_message: Optional error message for failed commands
        
        Returns:
            Response confirming completion
        """
        if not self.is_registered:
            raise GridPassClientError("Device not registered - call register() first")
        
        data = {"status": status}
        if result:
            data["result"] = result
        if error_message:
            data["error_message"] = error_message
        
        return self._make_request(
            "POST",
            f"/api/v1/device/commands/{command_id}/complete",
            data=data
        )
    
    def close(self) -> None:
        """Close the HTTP session."""
        self._session.close()


# Singleton instance for module-level access
_client_instance: Optional[GridPassClient] = None


def get_client() -> GridPassClient:
    """Get or create the singleton GridPass client instance."""
    global _client_instance
    if _client_instance is None:
        from config import GRIDPASS_API_URL
        _client_instance = GridPassClient(api_url=GRIDPASS_API_URL)
    return _client_instance


def set_client(client: GridPassClient) -> None:
    """Set the singleton GridPass client instance."""
    global _client_instance
    _client_instance = client

