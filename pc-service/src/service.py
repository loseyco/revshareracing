"""
GridPass PC Service
Lightweight service for PC operations: lap collection, rig registration, keystrokes, configs
Communicates with GridPass API - secure per-device authentication
"""

import sys
import time
import threading
from pathlib import Path
from typing import Dict, Optional

# Add src to path
sys.path.insert(0, str(Path(__file__).parent))

from core import device, telemetry, laps, controls, command_queue, graphics, updater
from config import GRIDPASS_API_URL, USE_LEGACY_SUPABASE, DATA_DIR

# Initialize GridPass API client
print("[*] Connecting to GridPass API...")
gridpass_client = None
try:
    from gridpass_client import GridPassClient, GridPassClientError
    gridpass_client = GridPassClient(api_url=GRIDPASS_API_URL)
    if gridpass_client.is_registered:
        print(f"[OK] GridPass API connected (device: {gridpass_client.device_id})")
    else:
        print("[INFO] GridPass API ready - device not yet registered")
except Exception as e:
    print(f"[WARN] Failed to initialize GridPass client: {e}")
    gridpass_client = None

# Legacy Supabase support (for migration period)
supabase = None
supabase_service = None
if USE_LEGACY_SUPABASE:
    print("[INFO] Legacy Supabase mode enabled - using direct database access")
    try:
        from supabase import create_client
        from config import SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
        supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
        supabase_service = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) if SUPABASE_SERVICE_ROLE_KEY else supabase
        print("[OK] Legacy Supabase connected!")
        # Configure modules for legacy mode
        device.set_supabase(supabase)
        laps.set_supabase(supabase_service)
    except Exception as e:
        print(f"[WARN] Legacy Supabase connection failed: {e}")


class RigService:
    """Lightweight service for PC operations"""
    
    def __init__(self):
        self.running = False
        self.telemetry_thread = None
        self.device_id = None
        self.device_portal_url = None
        self.claim_code = None
        self.claimed = False
        self.hardware_fingerprint = None
        self.last_logged_lap = 0
        self.last_session_time = None
        self.last_session_unique_id = None
        self.laps_recorded_session = 0
        self.laps_total_recorded = 0
        self.last_lap_time = None
        self.last_supabase_sync = None
        self.api_connected = False
        self.on_lap_recorded = None
        self.on_command_received = None
        self.start_time = time.time()
        self.iracing_connected_time = None
        self._last_lap_current = 0
        self._last_lap_debug = 0
        self._pending_lap_completion = None
        self.device_metadata = {}
        self._last_metadata_fetch = 0
        self.metadata_refresh_interval = 60
        self._last_heartbeat = 0
        self.heartbeat_interval = 30
        self._last_ip_update = 0
        self.ip_update_interval = 300
        self._last_geolocation_update = 0
        self.geolocation_update_interval = 3600
        self._last_telemetry_values = {}
        self._last_state_update = 0
        self._state_update_throttle = 1.0
        self.controls_manager = controls.get_manager()
        self.graphics_config = graphics.get_graphics_config()
        self.command_queue = None
        self.timed_reset_enabled = False
        self.timed_reset_interval = 0
        self.timed_reset_grace_period = 30
        self.timed_reset_thread = None
        self._last_reset_time = 0
        self.timed_session_state = None
        self.updater = updater.get_updater()
        self._setup_updater()
        self._setup_device()
    
    def _setup_updater(self):
        """Setup updater callbacks for automatic download and installation"""
        from core import updater
        print(f"[UPDATER] Current PC Service version: {updater.CURRENT_VERSION}")
        
        def on_update_available(update_info):
            print(f"[UPDATER] ========================================")
            print(f"[UPDATER] UPDATE AVAILABLE!")
            print(f"[UPDATER] Current version: {update_info['currentVersion']}")
            print(f"[UPDATER] Latest version: {update_info['version']}")
            print(f"[UPDATER] Starting automatic download and installation...")
            print(f"[UPDATER] ========================================")
            
            if self.updater.download_update():
                print("[UPDATER] Download complete. Preparing to install...")
                def install_after_delay():
                    time.sleep(5)
                    print("[UPDATER] Installing update and restarting service...")
                    if getattr(sys, 'frozen', False):
                        exe_path = Path(sys.executable)
                        update_file = exe_path.parent / "RevShareRacing_new.exe"
                        if update_file.exists():
                            self.updater.install_update(str(update_file), restart=True)
                        else:
                            print(f"[UPDATER] ERROR: Update file not found at {update_file}")
                    else:
                        print("[UPDATER] Auto-update only works for compiled executables")
                
                threading.Thread(target=install_after_delay, daemon=True).start()
            else:
                print("[UPDATER] ERROR: Download failed. Please update manually.")
        
        def on_download_progress(progress, downloaded, total):
            if int(progress) % 10 == 0:
                mb_downloaded = downloaded / (1024 * 1024)
                mb_total = total / (1024 * 1024) if total > 0 else 0
                print(f"[UPDATER] Download progress: {progress:.1f}% ({mb_downloaded:.1f}/{mb_total:.1f} MB)")
        
        def on_update_complete(update_file_path):
            print(f"[UPDATER] Update downloaded successfully: {update_file_path}")
        
        self.updater.on_update_available = on_update_available
        self.updater.on_download_progress = on_download_progress
        self.updater.on_update_complete = on_update_complete
    
    def _setup_device(self):
        """Ensure a device identifier is available and register with GridPass if needed."""
        manager = device.get_manager()
        
        # Get hardware fingerprint first
        device_info = manager.get_info()
        self.hardware_fingerprint = device_info.get('fingerprint')
        
        # Try to register/sync with GridPass API
        if gridpass_client and self.hardware_fingerprint:
            try:
                if not gridpass_client.is_registered:
                    print("[*] Registering device with GridPass...")
                    result = gridpass_client.register(
                        hardware_id=self.hardware_fingerprint,
                        name=device_info.get('device_name'),
                    )
                    self.device_id = result.device_id
                    print(f"[OK] Registered with GridPass: {self.device_id}")
                else:
                    self.device_id = gridpass_client.device_id
                    print(f"[OK] Using existing GridPass registration: {self.device_id}")
                
                self.api_connected = True
            except Exception as e:
                print(f"[WARN] GridPass registration failed: {e}")
                # Fall back to legacy mode if available
                if USE_LEGACY_SUPABASE:
                    self._setup_device_legacy()
        elif USE_LEGACY_SUPABASE:
            self._setup_device_legacy()
        
        # Update local device info
        device_info = manager.get_info()
        if not self.device_id:
            self.device_id = device_info.get('device_id')
        self.device_portal_url = device_info.get('portal_url')
        self.claim_code = device_info.get('claim_code')
        self.claimed = bool(device_info.get('claimed'))
        
        if self.device_id:
            print(f"[OK] Device ID: {self.device_id}")
            if self.device_portal_url:
                print(f"[*] Manage this rig at: {self.device_portal_url}")
            if not self.claimed and self.claim_code:
                claim_url = f"{self.device_portal_url}/claim?claimCode={self.claim_code}"
                print(f"[*] Claim this rig: {claim_url}")
        else:
            print("[!] Unable to determine device ID.")
    
    def _setup_device_legacy(self):
        """Legacy device setup using direct Supabase access"""
        manager = device.get_manager()
        try:
            remote_record = manager.sync_with_supabase(supabase_service)
            if remote_record:
                self.device_metadata = remote_record
                self._last_metadata_fetch = time.time()
        except Exception as exc:
            print(f"[WARN] Legacy device sync failed: {exc}")
        
        device_info = manager.get_info()
        self.device_id = device_info.get('device_id')
    
    def get_config(self):
        """Get rig configuration"""
        if not self.device_id:
            return {'success': False, 'error': 'Device not registered'}
        
        # Try GridPass API first
        if gridpass_client and self.api_connected:
            try:
                status = gridpass_client.get_status()
                return {'success': True, 'config': status}
            except Exception as e:
                print(f"[WARN] GridPass config fetch failed: {e}")
        
        # Fall back to legacy Supabase
        if USE_LEGACY_SUPABASE and supabase:
            try:
                result = supabase.table('irc_devices')\
                    .select('*')\
                    .eq('device_id', self.device_id)\
                    .single()\
                    .execute()
                
                if result.data:
                    return {'success': True, 'config': result.data}
            except Exception as e:
                return {'success': False, 'error': str(e)}
        
        return {'success': False, 'error': 'No connection available'}
    
    def send_keystroke(self, key: str):
        """Send keystroke to iRacing"""
        try:
            if telemetry.is_connected():
                manager = telemetry.get_manager()
                if manager and manager.ir:
                    controls_manager = controls.get_manager()
                    controls_manager.set_iracing(manager.ir)
                    result = controls_manager.execute_action(key)
                    return result
            
            return {'success': False, 'error': 'iRacing not connected'}
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def _record_lap_api(self, lap_time: float, lap_number: int, telemetry_data: dict) -> dict:
        """Record lap using GridPass API"""
        if not gridpass_client or not self.api_connected:
            return {'success': False, 'error': 'API not connected'}
        
        try:
            result = gridpass_client.upload_lap(
                lap_time=lap_time,
                track_name=telemetry_data.get('track_name', 'Unknown'),
                car_name=telemetry_data.get('car_name', 'Unknown'),
                user_id=telemetry_data.get('driver_id'),
                driver_name=telemetry_data.get('driver_name'),
                lap_number=lap_number,
                session_type=telemetry_data.get('session_type'),
            )
            return {'success': True, 'data': result}
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def _telemetry_callback(self, data):
        """Callback for telemetry updates - records laps and pushes state changes"""
        if not isinstance(data, dict):
            return
        
        if data.get('connected') and self.iracing_connected_time is None:
            self.iracing_connected_time = time.time()
            print(f"[OK] iRacing connected")
        
        # Check for state changes and push updates
        self._check_and_push_state_changes(data)
        
        # Check timed session
        self._check_timed_session(data)
        
        # Ignore telemetry for first 3 seconds
        if time.time() - self.start_time < 3:
            return
        
        # Lap tracking logic (same as before, but uses API for recording)
        lap_current_raw = data.get('lap')
        try:
            lap_current = int(lap_current_raw) if lap_current_raw is not None else 0
        except (TypeError, ValueError):
            lap_current = 0
        
        if not hasattr(self, '_session_checked'):
            session_unique_id = data.get('session_unique_id')
            if session_unique_id is not None:
                self.last_session_unique_id = session_unique_id
            self._session_checked = True
        
        if lap_current <= 1:
            self._last_lap_current = lap_current
            return
        
        # Session change detection
        session_unique_id = data.get('session_unique_id')
        session_time = data.get('session_time')
        session_changed = False
        
        if session_unique_id is not None:
            if self.last_session_unique_id is not None and session_unique_id != self.last_session_unique_id:
                session_changed = True
                print(f"[INFO] New session detected")
            self.last_session_unique_id = session_unique_id
        
        if session_changed:
            self.last_logged_lap = 0
            self._last_recorded_lap_time = None
            self._last_lap_current = lap_current
            self._pending_lap_completion = None
            self.laps_recorded_session = 0
        
        if session_time is not None:
            self.last_session_time = session_time
        
        # Process pending lap completion
        if self._pending_lap_completion is not None:
            pending_lap_num, pending_timestamp = self._pending_lap_completion
            lap_time_raw = data.get('lap_last_time')
            
            if pending_lap_num <= self.last_logged_lap:
                self._pending_lap_completion = None
            else:
                has_valid_time = lap_time_raw and lap_time_raw > 0
                time_since_pending = time.time() - pending_timestamp
                
                if has_valid_time:
                    lap_time_changed = (not hasattr(self, '_last_recorded_lap_time') or 
                                       self._last_recorded_lap_time is None or 
                                       lap_time_raw != self._last_recorded_lap_time)
                    
                    if lap_time_changed or time_since_pending > 2:
                        lap_completed = pending_lap_num
                        self._pending_lap_completion = None
                        
                        try:
                            lap_time = float(lap_time_raw)
                        except (TypeError, ValueError):
                            lap_time = None
                        
                        if lap_time and lap_time > 0 and self.device_id:
                            self.last_logged_lap = lap_completed
                            
                            # Try GridPass API first
                            if gridpass_client and self.api_connected:
                                result = self._record_lap_api(lap_time, lap_completed, data)
                            elif USE_LEGACY_SUPABASE:
                                # Fall back to legacy
                                driver_id = data.get('driver_id') or None
                                telemetry_snapshot = {
                                    'driver_name': data.get('driver_name'),
                                    'car_name': data.get('car_name'),
                                    'track_name': data.get('track_name'),
                                }
                                result = laps.record_lap(
                                    lap_time=lap_time,
                                    driver_id=driver_id,
                                    device_id=self.device_id,
                                    track_id=data.get('track_name'),
                                    car_id=data.get('car_name'),
                                    telemetry=telemetry_snapshot,
                                    lap_number=lap_completed,
                                )
                            else:
                                result = {'success': False, 'error': 'No connection'}
                            
                            if result and result.get('success'):
                                print(f"[laps] Recorded lap {lap_completed} at {lap_time:.3f}s")
                                self.laps_recorded_session += 1
                                self.laps_total_recorded += 1
                                self._last_recorded_lap_time = lap_time_raw
                                if self.on_lap_recorded:
                                    try:
                                        self.on_lap_recorded(lap_completed, lap_time, result.get('data'))
                                    except Exception:
                                        pass
                elif time_since_pending > 3:
                    self._pending_lap_completion = None
        
        # Check for new lap increment
        if lap_current > self._last_lap_current and self._last_lap_current > 0:
            lap_completed = self._last_lap_current
            self._pending_lap_completion = (lap_completed, time.time())
            self._last_lap_current = lap_current
            return
        
        if lap_current != self._last_lap_current:
            self._last_lap_current = lap_current
    
    def _telemetry_loop(self):
        """Background thread for telemetry collection"""
        while self.running:
            try:
                if (time.time() - self._last_heartbeat) >= self.heartbeat_interval:
                    self._update_heartbeat()
                
                if not telemetry.is_connected():
                    try:
                        if self.controls_manager and self.controls_manager.iracing_window_exists():
                            self.controls_manager.focus_iracing_window()
                            time.sleep(0.2)
                    except Exception:
                        pass
                    
                    telemetry.connect()
                
                if telemetry.is_connected():
                    data = telemetry.get_current()
                    if data:
                        self._telemetry_callback(data)
                
                time.sleep(0.1)
            except Exception as e:
                print(f"[WARN] Telemetry error: {e}")
                time.sleep(1)
    
    def start(self):
        """Start the service"""
        if self.running:
            return
        
        self.running = True
        
        # Test API connection
        if gridpass_client and gridpass_client.is_registered:
            try:
                gridpass_client.heartbeat()
                self.api_connected = True
                print("[OK] GridPass API heartbeat successful")
            except Exception as e:
                print(f"[WARN] GridPass API heartbeat failed: {e}")
                self.api_connected = False
        
        # Legacy Supabase connection test
        if USE_LEGACY_SUPABASE and supabase:
            try:
                supabase.table('irc_devices').select('device_id').limit(1).execute()
                self.last_supabase_sync = time.time()
                if self.device_id:
                    self._initialize_lap_tracking()
            except Exception as e:
                print(f"[WARN] Legacy Supabase test failed: {e}")
        
        # Load controls
        try:
            self.controls_manager.load_bindings(force=True)
        except Exception as exc:
            print(f"[WARN] Failed to load controls: {exc}")
        
        # Register telemetry callback
        telemetry.add_callback(self._telemetry_callback)
        
        # Start telemetry thread
        self.telemetry_thread = threading.Thread(target=self._telemetry_loop, daemon=True)
        self.telemetry_thread.start()
        
        # Start command queue
        if self.device_id and self.claimed:
            self._start_command_queue()
        
        # Load graphics config
        try:
            self.graphics_config.load_config(force=True)
        except Exception:
            pass
        
        print("[OK] Rig service started")
        print(f"[*] Collecting laps for device: {self.device_id or 'Not registered'}")
        
        # Send initial heartbeat
        self._update_heartbeat()
        
        # Auto-update check
        if getattr(sys, 'frozen', False):
            print("[UPDATER] Auto-update enabled")
            def check_updates_on_startup():
                time.sleep(15)
                update_info = self.updater.check_for_updates()
                if update_info:
                    print(f"[UPDATER] New version: {update_info['version']}")
            
            threading.Thread(target=check_updates_on_startup, daemon=True).start()
            self.updater.start_periodic_check()
    
    def get_status(self):
        """Get service status for GUI"""
        telemetry_data = telemetry.get_current()
        telemetry_mgr = telemetry.get_manager()
        
        local_info = device.get_info()
        metadata = self.device_metadata or {}
        
        api_info = {
            'connected': self.api_connected,
            'last_sync': self.last_supabase_sync,
            'laps_session': self.laps_recorded_session,
            'laps_total': self.laps_total_recorded,
            'device_id': self.device_id or 'Not registered',
            'device_name': metadata.get('device_name') or local_info.get('device_name'),
            'portal_url': self.device_portal_url or local_info.get('portal_url'),
            'claim_code': self.claim_code or local_info.get('claim_code'),
            'claimed': self.claimed or local_info.get('claimed'),
            'fingerprint': self.hardware_fingerprint or local_info.get('fingerprint'),
        }
        
        return {
            'iracing': {
                'connected': telemetry_mgr.is_connected if telemetry_mgr else False,
                'current_lap': telemetry_data.get('lap', 0) if telemetry_data else 0,
                'speed_kph': telemetry_data.get('speed_kph', 0) if telemetry_data else 0,
                'rpm': telemetry_data.get('rpm', 0) if telemetry_data else 0,
                'track_name': telemetry_data.get('track_name', 'N/A') if telemetry_data else 'N/A',
                'car_name': telemetry_data.get('car_name', 'N/A') if telemetry_data else 'N/A',
                'in_car': telemetry_data.get('is_on_track_car', False) if telemetry_data else False,
            },
            'api': api_info,
            'supabase': api_info,  # Backward compatibility
        }
    
    def _check_and_push_state_changes(self, telemetry_data, force_update=False):
        """Check for state changes and push updates via API"""
        if not self.device_id:
            return
        
        now = time.time()
        if now - self._last_state_update < self._state_update_throttle:
            return
        
        try:
            is_on_track_car = telemetry_data.get('is_on_track_car', False)
            is_on_track = telemetry_data.get('is_on_track', False)
            in_car = bool(is_on_track_car) and is_on_track
            
            current_state = {
                'in_car': in_car,
                'track_name': telemetry_data.get('track_name'),
                'car_name': telemetry_data.get('car_name'),
            }
            
            state_changed = force_update or not self._last_telemetry_values
            if not state_changed:
                if current_state['in_car'] != self._last_telemetry_values.get('in_car'):
                    state_changed = True
            
            if state_changed:
                # Push via GridPass API
                if gridpass_client and self.api_connected:
                    try:
                        gridpass_client.update_status(
                            status='online' if in_car else 'idle',
                            current_car=current_state['car_name'],
                            current_track=current_state['track_name'],
                        )
                    except Exception as e:
                        print(f"[WARN] API status update failed: {e}")
                
                # Legacy Supabase fallback
                elif USE_LEGACY_SUPABASE and supabase_service:
                    try:
                        from datetime import datetime
                        now_iso = datetime.utcnow().isoformat() + 'Z'
                        supabase_service.table('irc_devices')\
                            .update({
                                'last_seen': now_iso,
                                'in_car': in_car,
                                'track_name': current_state['track_name'],
                                'car_name': current_state['car_name'],
                            })\
                            .eq('device_id', self.device_id)\
                            .execute()
                    except Exception as e:
                        print(f"[WARN] Legacy status update failed: {e}")
                
                self._last_telemetry_values = current_state.copy()
                self._last_state_update = now
        except Exception as e:
            print(f"[ERROR] State update error: {e}")
    
    def _check_timed_session(self, telemetry_data):
        """Check timed session movement detection and timer expiration"""
        if not self.timed_session_state:
            return
        
        speed_kph = telemetry_data.get('speed_kph', 0) or 0
        
        if self.timed_session_state.get('waitingForMovement') and not self.timed_session_state.get('active'):
            if speed_kph > 5:
                print(f"[INFO] Timed session: Car moving, starting timer")
                self.timed_session_state['active'] = True
                self.timed_session_state['waitingForMovement'] = False
                self.timed_session_state['startTime'] = int(time.time() * 1000)
        
        if self.timed_session_state.get('active') and self.timed_session_state.get('startTime'):
            start_time_ms = self.timed_session_state['startTime']
            duration_seconds = self.timed_session_state['duration']
            elapsed_seconds = (time.time() * 1000 - start_time_ms) / 1000
            
            if elapsed_seconds >= duration_seconds:
                print(f"[INFO] Timed session expired, resetting car")
                self._complete_timed_session()
    
    def _complete_timed_session(self):
        """Complete timed session: reset car, clear state"""
        self.timed_session_state = None
    
    def _update_heartbeat(self):
        """Update heartbeat via API"""
        if not self.device_id:
            return
        
        try:
            if gridpass_client and self.api_connected:
                gridpass_client.heartbeat()
                self._last_heartbeat = time.time()
            elif USE_LEGACY_SUPABASE and supabase_service:
                from datetime import datetime
                now = datetime.utcnow().isoformat() + 'Z'
                supabase_service.table('irc_devices')\
                    .update({'last_seen': now})\
                    .eq('device_id', self.device_id)\
                    .execute()
                self._last_heartbeat = time.time()
        except Exception as e:
            print(f"[WARN] Heartbeat failed: {e}")
    
    def _initialize_lap_tracking(self):
        """Initialize lap counts from database"""
        if USE_LEGACY_SUPABASE:
            try:
                last_lap = laps.get_last_lap_number(self.device_id)
                if last_lap is not None:
                    self.last_logged_lap = last_lap
                    print(f"[INFO] Last recorded lap: {last_lap}")
            except Exception as e:
                print(f"[WARN] Failed to init lap tracking: {e}")
    
    def execute_control_action(self, action: str, params: Dict = None, source: str = "manual"):
        """Execute a control action"""
        try:
            if not self.controls_manager.focus_iracing_window():
                return {'success': False, 'message': 'Unable to focus iRacing'}
            time.sleep(0.1)
            
            if params is None:
                params = {}
            
            if action == "reset_car":
                grace_period = params.get('grace_period', 0.0)
                telemetry_data = telemetry.get_current() or {}
                return self._execute_reset_sequence(telemetry_data, grace_period=grace_period)
            
            return self.controls_manager.execute_action(action, source=source)
        except Exception as exc:
            return {'success': False, 'message': str(exc)}
    
    def _execute_reset_sequence(self, telemetry_data, grace_period: float = 0.0):
        """Execute reset sequence"""
        if not self.controls_manager.focus_iracing_window():
            return {'success': False, 'message': 'Unable to focus iRacing'}
        
        bindings = self.controls_manager.get_bindings()
        reset_combo = bindings.get('reset_car', {}).get('combo')
        if not reset_combo:
            return {'success': False, 'message': 'Reset not configured'}
        
        ignition_combo = bindings.get('ignition', {}).get('combo')
        
        if ignition_combo:
            self.controls_manager.execute_combo(ignition_combo)
            time.sleep(0.3)
        
        # Wait for car to stop
        for _ in range(30):
            current = telemetry.get_current()
            if not current or current.get('speed_kph', 0) <= 1.5:
                break
            time.sleep(0.2)
        
        # Execute reset
        self.controls_manager.execute_combo(reset_combo)
        time.sleep(1.0)
        
        if ignition_combo:
            self.controls_manager.execute_combo(ignition_combo)
        
        return {'success': True, 'message': 'Reset completed'}
    
    def _start_command_queue(self):
        """Start command queue"""
        if not self.device_id:
            return
        
        try:
            # Use GridPass API for commands when available
            if gridpass_client and self.api_connected:
                # Poll for commands via API
                def poll_commands():
                    while self.running:
                        try:
                            commands = gridpass_client.get_commands()
                            for cmd in commands:
                                result = self._handle_command({
                                    'type': cmd.get('command_type'),
                                    'action': cmd.get('command_action'),
                                    'params': cmd.get('command_params', {}),
                                })
                                gridpass_client.complete_command(
                                    cmd['id'],
                                    status='completed' if result.get('success') else 'failed',
                                    result=result
                                )
                        except Exception as e:
                            print(f"[WARN] Command poll error: {e}")
                        time.sleep(2)
                
                threading.Thread(target=poll_commands, daemon=True).start()
                print("[OK] Command queue started (API mode)")
            
            # Legacy Supabase realtime
            elif USE_LEGACY_SUPABASE and supabase:
                device_info = device.get_info()
                portal_url = device_info.get('portal_url', '')
                if '/device/' in portal_url:
                    portal_base = portal_url.rsplit('/device/', 1)[0]
                else:
                    portal_base = portal_url.rstrip('/')
                
                self.command_queue = command_queue.create_queue(
                    self.device_id,
                    supabase_client=supabase,
                    portal_base_url=portal_base
                )
                self.command_queue.set_execute_callback(self._handle_command)
                self.command_queue.start()
                print("[OK] Command queue started (legacy mode)")
        except Exception as e:
            print(f"[ERROR] Failed to start command queue: {e}")
    
    def _handle_command(self, command: Dict) -> Dict:
        """Handle a command"""
        cmd_action = command.get('action')
        cmd_params = command.get('params', {})
        source = "queue"
        
        if cmd_action == 'reset_car':
            grace_period = cmd_params.get('grace_period', 0.0)
            telemetry_data = telemetry.get_current() or {}
            return self._execute_reset_sequence(telemetry_data, grace_period=grace_period)
        
        elif cmd_action == 'enter_car':
            return self.controls_manager.execute_action("enter_car", source=source)
        
        elif cmd_action in ['starter', 'ignition', 'pit_speed_limiter']:
            return self.execute_control_action(cmd_action, source=source)
        
        return {'success': False, 'message': f'Unknown action: {cmd_action}'}
    
    def stop(self):
        """Stop the service"""
        self.running = False
        
        if self.command_queue:
            self.command_queue.stop()
        
        if self.telemetry_thread:
            self.telemetry_thread.join(timeout=2)
        
        if gridpass_client:
            gridpass_client.close()
        
        print("[OK] Rig service stopped")


# Global service instance
_service = None

def get_service():
    """Get or create service instance"""
    global _service
    if _service is None:
        _service = RigService()
    return _service


if __name__ == '__main__':
    print("=" * 80)
    print("GridPass PC Service")
    print("=" * 80)
    print()
    
    service = get_service()
    service.start()
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[*] Shutting down...")
        service.stop()
        print("[OK] Service stopped")
