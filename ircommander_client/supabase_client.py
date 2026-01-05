"""
iRCommander Supabase Client - Direct database access
No API middleman - client talks directly to Supabase
"""

import json
import time
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from supabase import create_client, Client

from config import SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DATA_DIR


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


class SupabaseError(Exception):
    def __init__(self, message: str, status_code: int = None):
        super().__init__(message)
        self.status_code = status_code


class IRCommanderSupabaseClient:
    """Direct Supabase client - no API needed."""
    
    def __init__(self):
        if not SUPABASE_URL or not SUPABASE_ANON_KEY:
            raise SupabaseError(
                "Missing Supabase configuration. Credentials should be embedded in the executable, "
                "or set SUPABASE_URL and SUPABASE_ANON_KEY in .env file (for development)"
            )
        
        print(f"[DB] Connecting to Supabase: {SUPABASE_URL}")
        
        # Create Supabase client with anon key for user auth
        # Using default options - the client handles session persistence automatically
        self.supabase: Client = create_client(
            SUPABASE_URL,
            SUPABASE_ANON_KEY
        )
        
        # Service role client for device operations (bypasses RLS)
        self.service_client: Optional[Client] = None
        if SUPABASE_SERVICE_ROLE_KEY:
            self.service_client = create_client(
                SUPABASE_URL,
                SUPABASE_SERVICE_ROLE_KEY
            )
            print("[DB] Service role client created")
        else:
            print("[DB] Service role key not provided - using anon key (may have limited permissions)")
        
        # Device state
        self.api_key: Optional[str] = None
        self.device_id: Optional[str] = None
        self.user: Optional[UserInfo] = None
        
        # Config file
        self.config_path = DATA_DIR / "device_config.json"
        self._load_config()
    
    def _recreate_clients(self):
        """Recreate Supabase clients to recover from connection errors."""
        try:
            self.supabase = create_client(
                SUPABASE_URL,
                SUPABASE_ANON_KEY
            )
            if SUPABASE_SERVICE_ROLE_KEY:
                self.service_client = create_client(
                    SUPABASE_URL,
                    SUPABASE_SERVICE_ROLE_KEY
                )
        except Exception as e:
            print(f"[WARN] Failed to recreate Supabase clients: {e}")
    
    def _is_connection_error(self, error: Exception) -> bool:
        """Check if an error is a connection error that might be recoverable."""
        error_msg = str(error).lower()
        return ("server disconnected" in error_msg or 
                "connection" in error_msg or 
                "timeout" in error_msg or
                "broken pipe" in error_msg or
                "connection reset" in error_msg or
                "network" in error_msg)
    
    def _retry_with_recovery(self, func, max_retries: int = 2, *args, **kwargs):
        """Execute a function with retry logic and connection recovery."""
        for attempt in range(max_retries):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                if self._is_connection_error(e) and attempt < max_retries - 1:
                    # Only log first attempt to avoid spam
                    if attempt == 0:
                        print(f"[DB] Connection error to Supabase (attempt {attempt + 1}/{max_retries}): {e}")
                        print(f"[DB] Retrying with new connection...")
                    try:
                        self._recreate_clients()
                        time.sleep(0.5 * (attempt + 1))  # Exponential backoff: 0.5s, 1s, etc.
                    except Exception as recreate_error:
                        print(f"[WARN] Failed to recreate clients: {recreate_error}")
                    continue  # Retry
                else:
                    # Either not a connection error, or we've exhausted retries
                    raise
    
    def _load_config(self):
        """Load saved device config."""
        if self.config_path.exists():
            try:
                config = json.loads(self.config_path.read_text())
                self.api_key = config.get("api_key")
                self.device_id = config.get("device_id")
                
                # Restore user info
                if config.get("user_id"):
                    self.user = UserInfo(
                        user_id=config["user_id"],
                        email=config.get("email", ""),
                        tenant_id=config.get("tenant_id"),
                        tenant_name=config.get("tenant_name")
                    )
                
                # Restore Supabase session if available
                if config.get("supabase_session"):
                    try:
                        # Supabase client handles session restoration automatically
                        pass
                    except Exception as e:
                        print(f"[WARN] Failed to restore session: {e}")
            except Exception as e:
                print(f"[WARN] Config load failed: {e}")
    
    def _save_config(self):
        """Save device config."""
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        config = {
            "device_id": self.device_id,
            "api_key": self.api_key,
            "saved_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        }
        if self.user:
            config["user_id"] = self.user.user_id
            config["email"] = self.user.email
            config["tenant_id"] = self.user.tenant_id
            config["tenant_name"] = self.user.tenant_name
        
        # Save Supabase session if available
        if hasattr(self.supabase.auth, '_storage') and self.supabase.auth._storage:
            try:
                session = self.supabase.auth.get_session()
                if session:
                    config["supabase_session"] = {
                        "access_token": session.access_token,
                        "refresh_token": session.refresh_token,
                        "expires_at": session.expires_at
                    }
            except Exception:
                pass
        
        self.config_path.write_text(json.dumps(config, indent=2))
    
    @property
    def is_registered(self) -> bool:
        return bool(self.api_key and self.device_id)
    
    @property
    def is_logged_in(self) -> bool:
        try:
            session = self.supabase.auth.get_session()
            return session is not None
        except Exception:
            return False
    
    # === Authentication ===
    def login(self, email: str, password: str) -> UserInfo:
        """Login with email and password using Supabase Auth."""
        try:
            response = self.supabase.auth.sign_in_with_password({
                "email": email.strip().lower(),
                "password": password
            })
            
            if not response.user:
                raise SupabaseError("Login failed: No user returned")
            
            # Get user profile with tenant info
            profile = self._get_user_profile(response.user.id)
            
            self.user = UserInfo(
                user_id=response.user.id,
                email=response.user.email or email,
                tenant_id=profile.get("tenant_id") if profile else None,
                tenant_name=profile.get("tenant_name") if profile else None
            )
            
            self._save_config()
            return self.user
            
        except Exception as e:
            error_msg = str(e)
            if "Invalid login credentials" in error_msg or "Email not confirmed" in error_msg:
                raise SupabaseError(
                    f"Login failed: Invalid email or password.\n\n"
                    f"Troubleshooting:\n"
                    f"  1. Verify email: {email.strip().lower()}\n"
                    f"  2. Check password\n"
                    f"  3. Ensure account exists in Supabase\n"
                    f"  4. Try resetting password via Supabase dashboard"
                )
            raise SupabaseError(f"Login failed: {error_msg}")
    
    def register(self, email: str, password: str, name: str = None) -> UserInfo:
        """Register new user with Supabase Auth."""
        try:
            response = self.supabase.auth.sign_up({
                "email": email.strip().lower(),
                "password": password,
                "options": {
                    "data": {
                        "name": name or email.split("@")[0]
                    }
                }
            })
            
            if not response.user:
                raise SupabaseError("Registration failed: No user returned")
            
            # Create user profile
            self._create_user_profile(response.user.id, email, name)
            
            self.user = UserInfo(
                user_id=response.user.id,
                email=response.user.email or email,
                tenant_id=None,
                tenant_name=None
            )
            
            self._save_config()
            return self.user
            
        except Exception as e:
            error_msg = str(e)
            if "User already registered" in error_msg or "already exists" in error_msg.lower():
                raise SupabaseError("Registration failed: User already exists. Please login instead.")
            raise SupabaseError(f"Registration failed: {error_msg}")
    
    def logout(self):
        """Logout and clear auth state."""
        try:
            self.supabase.auth.sign_out()
        except Exception:
            pass
        self.user = None
        self._save_config()
    
    def get_me(self) -> UserInfo:
        """Get current user info."""
        try:
            session = self.supabase.auth.get_session()
            if not session:
                raise SupabaseError("Not logged in")
            
            profile = self._get_user_profile(session.user.id)
            
            self.user = UserInfo(
                user_id=session.user.id,
                email=session.user.email or "",
                tenant_id=profile.get("tenant_id") if profile else None,
                tenant_name=profile.get("tenant_name") if profile else None
            )
            self._save_config()
            return self.user
        except Exception as e:
            raise SupabaseError(f"Failed to get user info: {str(e)}")
    
    def _get_user_profile(self, user_id: str) -> Optional[Dict]:
        """Get user profile from irc_user_profiles table."""
        try:
            result = self.supabase.table("irc_user_profiles").select("*").eq("id", user_id).execute()
            if result.data and len(result.data) > 0:
                return result.data[0]
            return None
        except Exception as e:
            print(f"[WARN] Failed to get user profile: {e}")
            return None
    
    def _create_user_profile(self, user_id: str, email: str, name: str = None):
        """Create user profile in irc_user_profiles table."""
        try:
            self.supabase.table("irc_user_profiles").insert({
                "id": user_id,
                "email": email,
                "name": name or email.split("@")[0],
                "role": "user"
            }).execute()
        except Exception as e:
            print(f"[WARN] Failed to create user profile (may already exist): {e}")
    
    # === Device Registration ===
    def register_device(self, hardware_id: str, name: str = None, tenant_id: str = None, 
                       force_new: bool = False) -> DeviceInfo:
        """Register device directly in Supabase."""
        import random
        import string
        from core import device as device_module
        
        # Generate device_id
        if force_new:
            random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
            device_id = f"rig-{hardware_id[:12]}-{random_suffix}"
        else:
            device_id = f"rig-{hardware_id[:12]}"
        
        # Use service client for device operations (bypasses RLS)
        client = self.service_client or self.supabase
        
        # Check if device already exists
        existing = client.table("irc_devices").select("device_id").eq("device_id", device_id).execute()
        
        is_new_device = len(existing.data) == 0
        
        if is_new_device:
            # Gather system info
            system_info = {}
            try:
                system_info = device_module.get_system_info()
            except Exception as e:
                print(f"[WARN] Failed to gather system info during registration: {e}")
            
            # Create new device
            device_data = {
                "device_id": device_id,
                "name": name or f"Rig {device_id[4:12]}",
                "hardware_id": hardware_id,
                "company_id": tenant_id or (self.user.tenant_id if self.user else None),
                "assigned_tenant_id": tenant_id or (self.user.tenant_id if self.user else None),
                "owner_type": "tenant" if tenant_id or (self.user and self.user.tenant_id) else "gridpass",
                "status": "inactive",
                "local_ip": system_info.get("local_ip"),
                "os_name": system_info.get("os_name"),
                "os_version": system_info.get("os_version"),
                "os_arch": system_info.get("os_arch"),
                "cpu_name": system_info.get("cpu_name"),
                "cpu_count": system_info.get("cpu_count"),
                "cpu_cores": system_info.get("cpu_cores"),
                "ram_total_gb": system_info.get("ram_total_gb"),
                "ram_available_gb": system_info.get("ram_available_gb"),
                "ram_used_percent": system_info.get("ram_used_percent"),
                "gpu_name": system_info.get("gpu_name"),
                "disk_total_gb": system_info.get("disk_total_gb"),
                "disk_used_gb": system_info.get("disk_used_gb"),
                "disk_free_gb": system_info.get("disk_free_gb"),
                "disk_used_percent": system_info.get("disk_used_percent"),
                "disk_low_space": system_info.get("disk_low_space"),
                "iracing_process_running": system_info.get("iracing_process_running"),
                "iracing_processes": system_info.get("iracing_processes"),
                "python_version": system_info.get("python_version"),
            }
            
            result = client.table("irc_devices").insert(device_data).execute()
            if not result.data:
                raise SupabaseError("Failed to create device")
        else:
            # Device exists - update name if provided and different
            if name:
                try:
                    client.table("irc_devices").update({
                        "name": name
                    }).eq("device_id", device_id).execute()
                except Exception as e:
                    print(f"[WARN] Failed to update device name: {e}")
        
        # Check for existing active API key
        key_result = client.table("irc_device_api_keys").select("*").eq("device_id", device_id).eq("is_active", True).is_("revoked_at", "null").execute()
        
        if key_result.data and len(key_result.data) > 0:
            existing_key = key_result.data[0]
            self.device_id = device_id
            self.api_key = existing_key["api_key"]
            self._save_config()
            return DeviceInfo(
                device_id=device_id,
                api_key=existing_key["api_key"],
                name=name
            )
        
        # Generate new API key
        random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=16))
        api_key = f"irc_device_{device_id[:12]}_{random_suffix}"
        
        # Insert API key
        key_data = {
            "device_id": device_id,
            "api_key": api_key,
            "name": "Auto-generated key",
            "is_active": True
        }
        
        key_insert = client.table("irc_device_api_keys").insert(key_data).execute()
        if not key_insert.data:
            raise SupabaseError("Failed to create API key")
        
        self.device_id = device_id
        self.api_key = api_key
        self._save_config()
        
        return DeviceInfo(device_id=device_id, api_key=api_key, name=name)
    
    # === Device Operations (using API key) ===
    def _get_device_by_api_key(self) -> Optional[Dict]:
        """Get device info using API key - query directly (more reliable than RPC)."""
        if not self.api_key:
            return None
        
        # Retry once with connection recovery
        for attempt in range(2):
            try:
                # Query directly - more reliable than using the RPC function
                # First, get the device_id from the API key
                client = self.service_client or self.supabase
                key_result = client.table("irc_device_api_keys").select("device_id").eq("api_key", self.api_key).eq("is_active", True).is_("revoked_at", "null").execute()
                
                if not key_result.data or len(key_result.data) == 0:
                    return None
                
                device_id = key_result.data[0]["device_id"]
                
                # Update last_used_at
                try:
                    client.table("irc_device_api_keys").update({
                        "last_used_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                    }).eq("api_key", self.api_key).execute()
                except Exception:
                    pass  # Non-critical - continue even if update fails
                
                # Get the device info
                device_result = client.table("irc_devices").select("*").eq("device_id", device_id).execute()
                
                if device_result.data and len(device_result.data) > 0:
                    return device_result.data[0]
                
                return None
            except Exception as e:
                error_msg = str(e).lower()
                # Check if it's a connection error that might be recoverable
                if ("server disconnected" in error_msg or 
                    "connection" in error_msg or 
                    "timeout" in error_msg or
                    "broken pipe" in error_msg) and attempt == 0:
                    # Try to recover by recreating the client
                    print(f"[WARN] Connection error detected, attempting to recover... ({e})")
                    try:
                        self._recreate_clients()
                        time.sleep(0.5)  # Brief delay before retry
                    except Exception as recreate_error:
                        print(f"[WARN] Failed to recreate clients: {recreate_error}")
                    continue  # Retry once
                else:
                    # Log error but don't retry if it's not a connection error or we've already retried
                    if attempt > 0 or "server disconnected" not in error_msg:
                        print(f"[WARN] Failed to get device by API key: {e}")
                    return None
        
        return None
    
    def heartbeat(self) -> Dict:
        """Send heartbeat - update last_seen timestamp and system info."""
        from core import device as device_module
        
        device_info = self._get_device_by_api_key()
        if not device_info:
            raise SupabaseError("Device not found or API key invalid")
        
        client = self.service_client or self.supabase
        
        # Get system info (only update periodically to avoid overhead)
        import time as time_module
        update_system_info = not hasattr(self, '_last_system_info_update') or \
                            (time_module.time() - getattr(self, '_last_system_info_update', 0)) > 3600  # Update every hour
        
        update_data = {
            "last_seen": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "name": device_module.get_hostname()  # Update name on heartbeat too
        }
        
        if update_system_info:
            try:
                system_info = device_module.get_system_info()
                update_data.update({
                    "os_name": system_info.get("os_name"),
                    "os_version": system_info.get("os_version"),
                    "os_arch": system_info.get("os_arch"),
                    "cpu_name": system_info.get("cpu_name"),
                    "cpu_count": system_info.get("cpu_count"),
                    "cpu_cores": system_info.get("cpu_cores"),
                    "ram_total_gb": system_info.get("ram_total_gb"),
                    "ram_available_gb": system_info.get("ram_available_gb"),
                    "ram_used_percent": system_info.get("ram_used_percent"),
                    "gpu_name": system_info.get("gpu_name"),
                    "disk_total_gb": system_info.get("disk_total_gb"),
                    "disk_used_gb": system_info.get("disk_used_gb"),
                    "disk_free_gb": system_info.get("disk_free_gb"),
                    "disk_used_percent": system_info.get("disk_used_percent"),
                    "disk_low_space": system_info.get("disk_low_space"),
                    "iracing_process_running": system_info.get("iracing_process_running"),
                    "iracing_processes": system_info.get("iracing_processes"),
                    "python_version": system_info.get("python_version"),
                    "local_ip": system_info.get("local_ip"),
                })
                self._last_system_info_update = time_module.time()
            except Exception as e:
                print(f"[WARN] Failed to gather system info: {e}")
        
        # Only update last_seen - don't change status (status has constraints)
        result = client.table("irc_devices").update(update_data).eq("device_id", device_info["device_id"]).execute()
        
        return {
            "device_id": device_info["device_id"],
            "status": device_info.get("status", "unknown"),
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        }
    
    def get_status(self) -> Dict:
        """Get device status."""
        device_info = self._get_device_by_api_key()
        if not device_info:
            raise SupabaseError("Device not found or API key invalid")
        
        client = self.service_client or self.supabase
        result = client.table("irc_devices").select("*").eq("device_id", device_info["device_id"]).execute()
        
        if not result.data or len(result.data) == 0:
            raise SupabaseError("Device not found")
        
        return result.data[0]
    
    def update_status(self, status: str = None, car: str = None, track: str = None, **kwargs) -> Dict:
        """Update device status."""
        device_info = self._get_device_by_api_key()
        if not device_info:
            raise SupabaseError("Device not found or API key invalid")
        
        update_data = {}
        if status:
            update_data["status"] = status
        if car:
            update_data["current_car"] = car
        if track:
            update_data["current_track"] = track
        update_data.update(kwargs)
        
        client = self.service_client or self.supabase
        result = client.table("irc_devices").update(update_data).eq("device_id", device_info["device_id"]).execute()
        
        return result.data[0] if result.data else {}
    
    # === Laps ===
    def get_average_lap_time(self, track: str, car: str, min_laps: int = 3) -> Optional[float]:
        """Get average lap time for a car/track combination from historical data.
        
        Args:
            track: Track name/ID
            car: Car name/ID
            min_laps: Minimum number of laps required to calculate average (default: 3)
        
        Returns:
            Average lap time in seconds, or None if insufficient data
        """
        try:
            client = self.service_client or self.supabase
            if not client:
                return None
            
            # Query laps for this car/track combination
            response = client.table("irc_laps").select("lap_time").eq("track_id", track).eq("car_id", car).order("timestamp", desc=True).limit(100).execute()
            
            if not response.data or len(response.data) < min_laps:
                return None
            
            # Calculate average of valid lap times
            lap_times = []
            for lap in response.data:
                lap_time = lap.get("lap_time")
                if lap_time and 5.0 <= lap_time <= 600.0:  # Valid lap time range
                    lap_times.append(lap_time)
            
            if len(lap_times) < min_laps:
                return None
            
            # Return average
            avg_time = sum(lap_times) / len(lap_times)
            return avg_time
            
        except Exception as e:
            print(f"[WARN] Error calculating average lap time: {e}")
            return None

    def upload_lap(self, lap_time: float, track: str, car: str, lap_number: int = None,
                   driver_name: str = None, **metadata) -> Dict:
        """Upload a lap directly to Supabase."""
        device_info = self._get_device_by_api_key()
        if not device_info:
            raise SupabaseError("Device not found or API key invalid")
        
        client = self.service_client or self.supabase
        
        # Check for duplicate lap before inserting
        # Match on device_id, lap_number, lap_time, track, and car to prevent duplicates
        existing_data = []
        try:
            # Select any column that exists (lap_time is safe since we're inserting it)
            query = client.table("irc_laps").select("lap_time").eq("device_id", device_info["device_id"]).eq("lap_time", lap_time).eq("track_id", track).eq("car_id", car).limit(1)
            if lap_number is not None:
                query = query.eq("lap_number", lap_number)
            else:
                # If no lap_number, check for laps with null lap_number and same time/track/car
                query = query.is_("lap_number", "null")
            
            existing = query.execute()
            existing_data = existing.data if existing.data else []
        except Exception as e:
            # If query fails, log and continue (better to upload duplicate than fail completely)
            print(f"[WARN] Duplicate check query failed: {e}, proceeding with upload")
            existing_data = []
        
        if existing_data and len(existing_data) > 0:
            # Lap already exists, return the existing record
            print(f"[INFO] Lap {lap_number or 'N/A'}: {lap_time:.3f}s already exists in database, skipping upload")
            # Return a dict indicating duplicate (we don't need the actual ID)
            return {"duplicate": True}
        
        # Map to correct database column names
        lap_data = {
            "device_id": device_info["device_id"],
            "lap_time": lap_time,
            "track_id": track,  # track_name maps to track_id in DB
            "car_id": car,  # car_name maps to car_id in DB
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        
        if lap_number:
            lap_data["lap_number"] = lap_number
        if driver_name:
            # driver_name is a string, but driver_id in DB is UUID
            # For now, we'll leave it null if driver_name is provided
            # TODO: Look up driver_id from driver_name if needed
            pass
        if metadata:
            lap_data["telemetry"] = metadata  # metadata maps to telemetry jsonb field
        
        result = client.table("irc_laps").insert(lap_data).execute()
        
        if not result.data:
            raise SupabaseError("Failed to insert lap")
        
        return result.data[0]
    
    # === Commands ===
    def get_commands(self) -> List[Dict]:
        """Poll for pending commands."""
        device_info = self._get_device_by_api_key()
        if not device_info:
            raise SupabaseError("Device not found or API key invalid")
        
        def _execute_query():
            client = self.service_client or self.supabase
            result = client.table("irc_device_commands").select("*").eq("device_id", device_info["device_id"]).eq("status", "pending").order("created_at", desc=False).limit(10).execute()
            return result.data or []
        
        try:
            return self._retry_with_recovery(_execute_query)
        except Exception as e:
            if self._is_connection_error(e):
                # If retry failed, return empty list instead of raising to avoid breaking the command loop
                print(f"[WARN] Failed to get commands after retries: {e}")
                return []
            raise
    
    def complete_command(self, command_id: str, status: str = "completed", result: Dict = None) -> Dict:
        """Mark command as completed."""
        update_data = {"status": status}
        if result:
            update_data["result"] = result
        update_data["completed_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        
        client = self.service_client or self.supabase
        command_result = client.table("irc_device_commands").update(update_data).eq("id", command_id).execute()
        
        return command_result.data[0] if command_result.data else {}
    
    def clear_pending_commands(self) -> int:
        """Mark all pending commands as ignored (called on startup to skip old commands)."""
        device_info = self._get_device_by_api_key()
        if not device_info:
            return 0
        
        def _execute_update():
            client = self.service_client or self.supabase
            # Get all pending commands
            pending = client.table("irc_device_commands").select("id").eq("device_id", device_info["device_id"]).eq("status", "pending").execute()
            
            if not pending.data:
                return 0
            
            # Mark them all as ignored
            command_ids = [cmd["id"] for cmd in pending.data]
            update_data = {
                "status": "ignored",
                "result": json.dumps({"reason": "Skipped on application startup - command was pending when app launched"}),
                "completed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            }
            
            # Update all pending commands in a single query using .in_() filter
            if command_ids:
                client.table("irc_device_commands").update(update_data).in_("id", command_ids).execute()
            
            return len(command_ids)
        
        try:
            count = self._retry_with_recovery(_execute_update)
            return count
        except Exception as e:
            if self._is_connection_error(e):
                print(f"[WARN] Failed to clear pending commands after retries: {e}")
                return 0
            raise
    
    def close(self):
        """Close client (no-op for Supabase, but kept for compatibility)."""
        pass


# Singleton
_client: Optional[IRCommanderSupabaseClient] = None

def get_client() -> IRCommanderSupabaseClient:
    global _client
    if _client is None:
        _client = IRCommanderSupabaseClient()
    return _client
