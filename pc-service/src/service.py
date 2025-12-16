"""
Rev Share Racing - PC Service
Lightweight service for PC operations: lap collection, rig registration, keystrokes, configs
Communicates directly with Supabase - no web server needed
"""

import sys
import time
import threading
from pathlib import Path
from typing import Dict, Optional

# Add src to path
sys.path.insert(0, str(Path(__file__).parent))

from core import device, telemetry, laps, controls, command_queue, graphics
from config import SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
from supabase import create_client

# Initialize Supabase
print("[*] Connecting to database...")
try:
    supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    supabase_service = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) if SUPABASE_SERVICE_ROLE_KEY else supabase
    print("[OK] Database connected!")
except Exception as e:
    print(f"[ERROR] Failed to initialize Supabase client: {e}")
    print("[ERROR] The application may not function correctly without database connection")
    # Create dummy clients to prevent crashes, but service will likely fail later
    supabase = None
    supabase_service = None

# Configure modules (only if Supabase clients were created)
if supabase:
    device.set_supabase(supabase)
if supabase_service:
    laps.set_supabase(supabase_service)
if supabase:
    print("[OK] Modules configured")
else:
    print("[WARN] Modules not fully configured - Supabase connection failed")


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
        self.last_session_unique_id = None  # Track session using iRacing's SessionUniqueID
        self.laps_recorded_session = 0
        self.laps_total_recorded = 0
        self.last_lap_time = None
        self.last_supabase_sync = None
        self.supabase_connected = False
        self.on_lap_recorded = None  # Callback for GUI
        self.on_command_received = None  # Callback for command notifications
        self.start_time = time.time()  # Track when service started
        self.iracing_connected_time = None  # Track when iRacing first connected
        self._last_lap_current = 0  # Track previous Lap value to detect increments
        self._last_lap_debug = 0  # Track last debug log time
        self._pending_lap_completion = None  # Track pending lap completion (lap_number, timestamp)
        self.device_metadata = {}
        self._last_metadata_fetch = 0
        self.metadata_refresh_interval = 60  # seconds
        self._last_heartbeat = 0
        self.heartbeat_interval = 30  # Update last_seen every 30 seconds (just for service health)
        self._last_ip_update = 0
        self.ip_update_interval = 300  # Update IP addresses every 5 minutes
        self._last_geolocation_update = 0
        self.geolocation_update_interval = 3600  # Update geolocation every hour
        # Store last telemetry values to detect state changes
        self._last_telemetry_values = {}
        self._last_state_update = 0
        self._state_update_throttle = 1.0  # Minimum 1 second between state updates
        self.controls_manager = controls.get_manager()
        self.graphics_config = graphics.get_graphics_config()
        self.command_queue = None
        self.timed_reset_enabled = False
        self.timed_reset_interval = 0  # seconds
        self.timed_reset_grace_period = 30  # seconds
        self.timed_reset_thread = None
        self._last_reset_time = 0
        # Timed session state for queue drivers
        self.timed_session_state = None  # {active: bool, waitingForMovement: bool, startTime: int, duration: int, driver_user_id: str}
        self._setup_device()
    
    def _setup_device(self):
        """Ensure a device identifier is available and log management URL."""
        manager = device.get_manager()
        try:
            # Sync remote metadata so we retain lap history across reinstalls.
            remote_record = manager.sync_with_supabase(supabase_service)
            if remote_record:
                self.device_metadata = remote_record
                self._last_metadata_fetch = time.time()
        except Exception as exc:
            print(f"[WARN] Device sync failed: {exc}")
        
        device_info = manager.get_info()
        self.device_id = device_info.get('device_id')
        self.device_portal_url = device_info.get('portal_url')
        self.claim_code = device_info.get('claim_code')
        self.claimed = bool(device_info.get('claimed'))
        self.hardware_fingerprint = device_info.get('fingerprint')
        if self.device_id:
            print(f"[OK] Device ID: {self.device_id}")
            if self.device_portal_url:
                print(f"[*] Manage this rig at: {self.device_portal_url}")
            if not self.claimed and self.claim_code:
                # Output claim URL with claim code for easy clicking
                claim_url = f"{self.device_portal_url}/claim?claimCode={self.claim_code}"
                print(f"[*] Claim this rig: {claim_url}")
                print(f"[*] (Or use claim code: {self.claim_code})")
        else:
            print("[!] Unable to determine device ID. Regeneration will be attempted on next start.")
    
    def register_rig(self, user_id: str, rig_name: str, location: str = None):
        """Registration is now handled via the web portal."""
        result = device.get_manager().register_device(
            user_id=user_id,
            device_name=rig_name,
            location=location,
        )
        if result.get('device', {}).get('device_id'):
            self.device_id = result['device']['device_id']
            self.device_portal_url = result['device'].get('portal_url', self.device_portal_url)
        return result
    
    def get_config(self):
        """Get rig configuration from Supabase"""
        if not self.device_id:
            return {'success': False, 'error': 'Device not registered'}
        
        try:
            result = supabase.table('irc_devices')\
                .select('*')\
                .eq('device_id', self.device_id)\
                .single()\
                .execute()
            
            if result.data:
                return {'success': True, 'config': result.data}
            else:
                return {'success': False, 'error': 'Config not found'}
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def send_keystroke(self, key: str):
        """Send keystroke to iRacing (for controls)"""
        try:
            if telemetry.is_connected():
                manager = telemetry.get_manager()
                if manager and manager.ir:
                    controls_manager = controls.get_manager()
                    controls_manager.set_iracing(manager.ir)
                    result = controls_manager.execute_action(key)
                    return result
            
            return {'success': False, 'error': 'iRacing not connected or key not mapped'}
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def _telemetry_callback(self, data):
        """Callback for telemetry updates - records laps and pushes state changes"""
        if not isinstance(data, dict):
            return
        
        # Track when iRacing first connects
        if data.get('connected') and self.iracing_connected_time is None:
            self.iracing_connected_time = time.time()
            print(f"[OK] iRacing connected - will only process commands queued after this time")
        
        # Log telemetry values periodically for debugging (reduced frequency)
        # Show both raw SDK values and corrected state
        if not hasattr(self, '_last_telemetry_log') or time.time() - self._last_telemetry_log > 30:
            is_on_track_car = data.get('is_on_track_car', False)
            is_on_track = data.get('is_on_track', False)
            speed = data.get('speed_kph', 0)
            rpm = data.get('rpm', 0)
            # Calculate what in_car will be (corrected state)
            corrected_in_car = is_on_track_car and is_on_track
            print(f"[DEBUG] Telemetry: SDK says is_on_track_car={is_on_track_car}, is_on_track={is_on_track} → corrected in_car={corrected_in_car}, speed={speed:.6f}kph, rpm={rpm}")
            self._last_telemetry_log = time.time()
        
        # Check for state changes and push updates immediately
        self._check_and_push_state_changes(data)
        
        # Check timed session movement detection and timer
        self._check_timed_session(data)
        
        # Ignore telemetry for first 3 seconds after startup to prevent recording stale laps
        if time.time() - self.start_time < 3:
            return
        
        # Use Lap (current lap number) to determine completed lap
        # In iRacing: Lap increments when you cross finish line, so Lap-1 is the last completed lap
        # LapLastLapTime is set exactly when Lap increments, so this gives us accurate timing
        lap_current_raw = data.get('lap')
        try:
            lap_current = int(lap_current_raw) if lap_current_raw is not None else 0
        except (TypeError, ValueError):
            lap_current = 0
        
        # On first telemetry update after startup, initialize session tracking
        if not hasattr(self, '_session_checked'):
            session_unique_id = data.get('session_unique_id')
            if session_unique_id is not None:
                self.last_session_unique_id = session_unique_id
                print(f"[INFO] Initialized session tracking: SessionUniqueID={session_unique_id}")
            
            # If current lap is lower than last logged lap, we're probably in a new session
            # (fallback check in case SessionUniqueID is not available)
            if lap_current > 0 and self.last_logged_lap > 0:
                if lap_current < self.last_logged_lap - 1:
                    # Current lap is lower than last logged lap - probably a new session
                    print(f"[INFO] New session detected on startup (lap_current={lap_current} < last_logged_lap={self.last_logged_lap}) - resetting lap tracking")
                    self.last_logged_lap = 0
                    self._last_recorded_lap_time = None
                    self._pending_lap_completion = None
                    self.laps_recorded_session = 0
            self._session_checked = True
        
        # Debug: Log lap values periodically to see what's happening
        if not hasattr(self, '_last_lap_debug') or time.time() - self._last_lap_debug > 10:
            lap_last_time = data.get('lap_last_time')
            lap_completed = data.get('lap_completed')
            print(f"[DEBUG] Lap tracking: lap_current={lap_current}, _last_lap_current={self._last_lap_current}, lap_last_time={lap_last_time}, lap_completed={lap_completed}, last_logged_lap={self.last_logged_lap}")
            self._last_lap_debug = time.time()
        
        if lap_current <= 1:
            # Need at least lap 2 (meaning 1 completed lap) to record
            # Track the current lap but don't record until we have at least 1 completed lap
            if lap_current != self._last_lap_current:
                print(f"[DEBUG] Lap tracking: lap_current={lap_current} (need >1 to record), _last_lap_current={self._last_lap_current}")
            self._last_lap_current = lap_current
            return
        
        # Check for session reset/changes FIRST - before processing pending laps
        # This prevents skipping laps from a new session
        session_unique_id = data.get('session_unique_id')
        session_time = data.get('session_time')
        
        # Detect session changes using iRacing's SessionUniqueID (most reliable)
        session_changed = False
        
        # Method 1: SessionUniqueID changed (primary method - most reliable)
        if session_unique_id is not None:
            if self.last_session_unique_id is not None and session_unique_id != self.last_session_unique_id:
                session_changed = True
                print(f"[INFO] New session detected (SessionUniqueID changed: {self.last_session_unique_id} -> {session_unique_id}) - resetting lap tracking")
            # Update to current session ID
            self.last_session_unique_id = session_unique_id
        else:
            # Fallback methods if SessionUniqueID is not available
            # Method 2: Session time reset (went backwards significantly)
            if session_time is not None and self.last_session_time is not None:
                if session_time < self.last_session_time - 1.0:  # Allow 1 second tolerance
                    session_changed = True
                    print(f"[INFO] Session reset detected (session_time {self.last_session_time:.1f} -> {session_time:.1f}) - resetting lap tracking")
            
            # Method 3: Current lap is lower than last logged lap (new session, lap numbers reset)
            if lap_current > 0 and self.last_logged_lap > 0 and lap_current < self.last_logged_lap - 1:
                # If current lap is lower than last logged lap, it's likely a new session
                session_changed = True
                print(f"[INFO] New session detected (lap_current={lap_current} < last_logged_lap={self.last_logged_lap}) - resetting lap tracking")
        
        # Reset tracking if session changed
        if session_changed:
            self.last_logged_lap = 0
            self._last_recorded_lap_time = None
            self._last_lap_current = lap_current
            self._pending_lap_completion = None
            self.laps_recorded_session = 0
        
        # Update session time tracking (for fallback methods)
        if session_time is not None:
            self.last_session_time = session_time
        
        # FIRST: Process any pending lap completion BEFORE checking for new increments
        # This prevents new increments from overwriting pending completions
        if self._pending_lap_completion is not None:
            pending_lap_num, pending_timestamp = self._pending_lap_completion
            lap_time_raw = data.get('lap_last_time')
            
            # Check if this is a new session using SessionUniqueID (most reliable)
            session_unique_id = data.get('session_unique_id')
            is_new_session = False
            if session_unique_id is not None and self.last_session_unique_id is not None:
                is_new_session = (session_unique_id != self.last_session_unique_id)
            else:
                # Fallback: check if lap_current is lower than last_logged_lap
                is_new_session = (lap_current > 0 and self.last_logged_lap > 0 and 
                                lap_current < self.last_logged_lap)
            
            # Skip if we've already logged this completed lap AND it's not a new session
            if pending_lap_num <= self.last_logged_lap and not is_new_session:
                print(f"[DEBUG] Lap {pending_lap_num} already logged (last_logged_lap={self.last_logged_lap}), clearing pending")
                self._pending_lap_completion = None
            elif is_new_session and pending_lap_num <= self.last_logged_lap:
                # New session detected - reset last_logged_lap to allow this lap
                if session_unique_id:
                    print(f"[DEBUG] New session detected (SessionUniqueID changed) - allowing pending lap {pending_lap_num}")
                else:
                    print(f"[DEBUG] New session detected (lap_current={lap_current} < last_logged_lap={self.last_logged_lap}) - allowing pending lap {pending_lap_num}")
                self.last_logged_lap = 0
                # Continue processing the pending lap
            else:
                # Check if we have a valid lap time (> 0, not -1.0)
                has_valid_time = lap_time_raw and lap_time_raw > 0
                time_since_pending = time.time() - pending_timestamp
                
                if has_valid_time:
                    # Check if lap_last_time has changed (new lap time available)
                    lap_time_changed = (not hasattr(self, '_last_recorded_lap_time') or 
                                       self._last_recorded_lap_time is None or 
                                       lap_time_raw != self._last_recorded_lap_time)
                    
                    if lap_time_changed or time_since_pending > 2:
                        # Ready to record - process this lap NOW before checking for new increments
                        print(f"[DEBUG] Processing pending lap {pending_lap_num}: lap_time={lap_time_raw:.3f}s")
                        # Continue to recording code below (don't return)
                        lap_completed = pending_lap_num
                        # Clear pending so we don't process it twice
                        self._pending_lap_completion = None
                        
                        # Jump to recording code
                        try:
                            lap_time = float(lap_time_raw)
                        except (TypeError, ValueError):
                            lap_time = None
                        
                        if lap_time and lap_time > 0:
                            if not self.device_id:
                                print(f"[WARN] Cannot record lap {lap_completed} - device_id is not set")
                                return
                            # Update tracking BEFORE recording
                            self.last_logged_lap = lap_completed
                            if session_time is not None:
                                self.last_session_time = session_time
                            
                            driver_id = data.get('driver_id') or None
                            
                            telemetry_snapshot = {
                                'driver_name': data.get('driver_name'),
                                'car_name': data.get('car_name'),
                                'car_class': data.get('car_class'),
                                'car_number': data.get('car_number'),
                                'track_name': data.get('track_name'),
                                'track_config': data.get('track_config'),
                                'lap_best_time': data.get('lap_best_time'),
                                'lap_last_time': data.get('lap_last_time'),
                                'lap_completed': data.get('lap_completed'),
                                'session_time': data.get('session_time'),
                                'speed_kph': data.get('speed_kph'),
                                'rpm': data.get('rpm'),
                                'throttle': data.get('throttle'),
                                'brake': data.get('brake'),
                                'fuel_level': data.get('fuel_level'),
                            }
                            
                            print(f"[DEBUG] Recording lap: Lap={lap_current}, Completed={lap_completed}, Time={lap_time:.3f}s, DeviceID={self.device_id}")
                            
                            if not self.device_id:
                                print(f"[ERROR] Cannot record lap - device_id is None!")
                                return
                            
                            try:
                                result = laps.record_lap(
                                    lap_time=lap_time,
                                    driver_id=driver_id,
                                    device_id=self.device_id,
                                    track_id=data.get('track_name'),
                                    car_id=data.get('car_name'),
                                    telemetry=telemetry_snapshot,
                                    lap_number=lap_completed,
                                )
                                
                                if result and result.get('success'):
                                    if result.get('skipped'):
                                        print(f"[INFO] Lap {lap_completed} at {lap_time:.3f}s already exists - skipped duplicate")
                                        self.last_logged_lap = lap_completed
                                        self._last_recorded_lap_time = lap_time_raw
                                    else:
                                        print(f"[laps] Recorded lap {lap_completed} (completed) at {lap_time:.3f}s - stored to Supabase")
                                        self.laps_recorded_session += 1
                                        self.laps_total_recorded += 1
                                        self.last_lap_time = time.time()
                                        self.last_supabase_sync = time.time()
                                        self._last_recorded_lap_time = lap_time_raw
                                        if self.on_lap_recorded:
                                            try:
                                                self.on_lap_recorded(lap_completed, lap_time, result.get('data'))
                                            except Exception as e:
                                                print(f"[WARN] GUI callback error: {e}")
                                else:
                                    error_msg = result.get('error', 'Unknown error') if result else 'No result returned'
                                    print(f"[WARN] Failed to record lap {lap_completed}: {error_msg}")
                            except Exception as e:
                                print(f"[WARN] Failed to record lap: {e}")
                                import traceback
                                traceback.print_exc()
                    else:
                        # Still waiting for lap time to update
                        return
                elif time_since_pending > 3:
                    # Timeout - skip this lap
                    print(f"[WARN] Timeout waiting for valid lap time for lap {pending_lap_num} (got {lap_time_raw}), skipping")
                    self._pending_lap_completion = None
                else:
                    # Still waiting for valid time
                    return
        
        # NOW check if Lap has incremented (new lap started = previous lap completed)
        if lap_current > self._last_lap_current and self._last_lap_current > 0:
            # Lap has incremented! Mark the previous lap as pending completion
            # e.g., if Lap went from 12 to 13, lap 12 just completed
            lap_completed = self._last_lap_current
            is_on_track = data.get('is_on_track', False)
            print(f"[DEBUG] Lap incremented: {self._last_lap_current} → {lap_current} (is_on_track={is_on_track}, lap_last_time={data.get('lap_last_time')})")
            self._pending_lap_completion = (lap_completed, time.time())
            self._last_lap_current = lap_current
            
            # Don't record yet - wait for LapLastLapTime to update in next telemetry update
            return
        
        # No lap increment, update tracking
        if lap_current != self._last_lap_current:
            self._last_lap_current = lap_current
    
    def _telemetry_loop(self):
        """Background thread for telemetry collection"""
        while self.running:
            try:
                # Update heartbeat periodically to indicate service is online
                # This runs regardless of telemetry connection status
                if (time.time() - self._last_heartbeat) >= self.heartbeat_interval:
                    self._update_heartbeat()
                
                if not telemetry.is_connected():
                    # Only try to focus iRacing window if it actually exists
                    # This prevents spam when iRacing is not running
                    try:
                        if self.controls_manager:
                            if self.controls_manager.iracing_window_exists():
                                # Window exists, try to focus it before connecting
                                if self.controls_manager.focus_iracing_window():
                                    print("[INFO] Focused iRacing window before connection attempt")
                                else:
                                    print("[WARN] Could not focus iRacing window")
                                # Small delay to allow window focus to take effect
                                time.sleep(0.2)
                            # If window doesn't exist, skip focusing but still try to connect
                            # (in case iRacing starts while service is running)
                    except Exception as e:
                        print(f"[WARN] Error checking/focusing iRacing window: {e}")
                    
                    telemetry.connect()
                
                if telemetry.is_connected():
                    data = telemetry.get_current()
                    if data:
                        self._telemetry_callback(data)
                
                time.sleep(0.1)  # ~10Hz check rate
            except Exception as e:
                print(f"[WARN] Telemetry error: {e}")
                time.sleep(1)
    
    def start(self):
        """Start the service"""
        if self.running:
            return
        
        self.running = True
        
        # Test Supabase connection
        if supabase:
            try:
                supabase.table('irc_devices').select('device_id').limit(1).execute()
                self.supabase_connected = True
                self.last_supabase_sync = time.time()
                
                # Initialize last_logged_lap from database to prevent re-recording on restart
                if self.device_id:
                    self._initialize_lap_tracking()
                    self.refresh_supabase_metadata(force=True)
            except Exception as e:
                self.supabase_connected = False
                print(f"[WARN] Supabase connection test failed: {e}")
        else:
            self.supabase_connected = False
            print("[WARN] Supabase client not initialized - service may have limited functionality")

        # Load commander controls
        try:
            self.controls_manager.load_bindings(force=True)
        except Exception as exc:
            print(f"[WARN] Failed to load commander controls: {exc}")
        
        # Register telemetry callback
        telemetry.add_callback(self._telemetry_callback)
        
        # Start telemetry collection thread
        self.telemetry_thread = threading.Thread(target=self._telemetry_loop, daemon=True)
        self.telemetry_thread.start()
        
        # Start command queue polling if device is claimed
        if self.device_id and self.claimed:
            self._start_command_queue()
        
        # Load graphics config for UI interactions
        try:
            self.graphics_config.load_config(force=True)
        except Exception as exc:
            print(f"[WARN] Failed to load graphics config: {exc}")
        
        print("[OK] Rig service started")
        print(f"[*] Collecting laps for device: {self.device_id or 'Not registered'}")
        if self.device_portal_url:
            print(f"[*] Manage rig at: {self.device_portal_url}")
        self.refresh_supabase_metadata(force=True)
        # Force IP update on startup
        self._last_ip_update = 0
        # Send initial heartbeat to mark service as online (will include IP addresses)
        self._update_heartbeat()
        
        # Push initial state if iRacing is already connected
        # This ensures the database has current state immediately on startup
        def push_initial_state():
            time.sleep(3)  # Give telemetry a moment to connect and get accurate data
            if telemetry.is_connected():
                current_data = telemetry.get_current()
                if current_data:
                    print(f"[INFO] Pushing initial telemetry state on startup: is_on_track_car={current_data.get('is_on_track_car')}")
                    self._check_and_push_state_changes(current_data)
                else:
                    print("[WARN] No telemetry data available for initial state push")
            else:
                print("[WARN] iRacing not connected, cannot push initial state")
        
        # Push initial state in background thread (non-blocking)
        threading.Thread(target=push_initial_state, daemon=True).start()
    
    def get_status(self):
        """Get service status for GUI"""
        telemetry_data = telemetry.get_current()
        telemetry_mgr = telemetry.get_manager()

        self.refresh_supabase_metadata()
        local_info = device.get_info()
        metadata = self.device_metadata or {}

        supabase_info = {
            'connected': self.supabase_connected,
            'last_sync': self.last_supabase_sync,
            'laps_session': self.laps_recorded_session,
            'laps_total': self.laps_total_recorded,
            'device_id': self.device_id or 'Not registered',
            'device_name': metadata.get('device_name') or local_info.get('device_name'),
            'location': metadata.get('location') or local_info.get('location'),
            'status_text': metadata.get('status') or ('registered' if local_info.get('registered') else 'unregistered'),
            'registered_at': metadata.get('created_at') or local_info.get('registered_at'),
            'last_seen': metadata.get('last_seen'),
            'owner_user_id': metadata.get('owner_user_id') or local_info.get('owner_user_id'),
            'local_ip': metadata.get('local_ip') or local_info.get('local_ip'),
            'public_ip': metadata.get('public_ip') or local_info.get('public_ip'),
            'metadata_fetched_at': self._last_metadata_fetch,
            'portal_url': self.device_portal_url or local_info.get('portal_url'),
            'claim_code': self.claim_code or local_info.get('claim_code'),
            'claimed': self.claimed or local_info.get('claimed'),
            'fingerprint': self.hardware_fingerprint or local_info.get('fingerprint'),
        }

        return {
            'iracing': {
                'connected': telemetry_mgr.is_connected if telemetry_mgr else False,
                'last_update': telemetry_data.get('timestamp', 0) if telemetry_data else 0,
                'current_lap': telemetry_data.get('lap', 0) if telemetry_data else 0,
                'speed_kph': telemetry_data.get('speed_kph', 0) if telemetry_data else 0,
                'rpm': telemetry_data.get('rpm', 0) if telemetry_data else 0,
                'track_name': telemetry_data.get('track_name', 'N/A') if telemetry_data else 'N/A',
                'car_name': telemetry_data.get('car_name', 'N/A') if telemetry_data else 'N/A',
                'in_car': telemetry_data.get('is_on_track_car', False) if telemetry_data else False,
                'on_track': telemetry_data.get('is_on_track', False) if telemetry_data else False,
                'in_pit_stall': telemetry_data.get('player_in_pit_stall', False) if telemetry_data else False,
            },
            'supabase': supabase_info
        }

    def refresh_supabase_metadata(self, force: bool = False):
        """Refresh device metadata from Supabase"""
        if not self.device_id or not self.supabase_connected:
            return

        if not force and (time.time() - self._last_metadata_fetch) < self.metadata_refresh_interval:
            return

        try:
            result = supabase_service.table('irc_devices')\
                .select('*')\
                .eq('device_id', self.device_id)\
                .single()\
                .execute()

            if result.data:
                self.device_metadata = result.data
                self._last_metadata_fetch = time.time()
                # Update local cache from remote metadata
                device.get_manager().apply_remote_metadata(result.data)
                info = device.get_info()
                self.device_portal_url = info.get('portal_url')
                self.claim_code = info.get('claim_code')
                self.claimed = bool(info.get('claimed'))
                self.device_id = info.get('device_id')
        except Exception as e:
            print(f"[WARN] Failed to fetch Supabase device info: {e}")
    
    def _check_and_push_state_changes(self, telemetry_data, force_update=False):
        """Check for state changes and push updates to database immediately"""
        if not self.device_id or not self.supabase_connected:
            return
        
        # Throttle updates to max once per second
        now = time.time()
        if now - self._last_state_update < self._state_update_throttle:
            return
        
        try:
            # Extract current state values
            # Use is_on_track_car as primary indicator, but validate with other telemetry
            is_on_track_car_raw = telemetry_data.get('is_on_track_car', False)
            speed_kph_raw = telemetry_data.get('speed_kph', 0) or 0
            rpm_raw = telemetry_data.get('rpm', 0) or 0
            is_on_track = telemetry_data.get('is_on_track', False)
            
            # Determine in_car state
            # is_on_track_car is the primary indicator, but if it's True and we have no
            # meaningful telemetry (no speed, no RPM, not on track), we might be in garage/menu
            in_car = bool(is_on_track_car_raw)
            
            # Additional validation: if is_on_track_car is True but is_on_track is False,
            # we're probably in the garage/menu, not actually in the car
            # This is a common iRacing SDK quirk - is_on_track_car can be True in garage/menu
            if in_car and not is_on_track:
                in_car = False
                # Only log if this is a change from previous state
                last_in_car = self._last_telemetry_values.get('in_car') if self._last_telemetry_values else None
                if last_in_car is None or last_in_car != in_car:
                    print(f"[INFO] Correcting state: is_on_track_car=True but is_on_track=False → in_car=False (you're in garage/menu, not on track)")
            
            in_pit_stall = telemetry_data.get('player_in_pit_stall', False)
            track_name = telemetry_data.get('track_name')
            car_name = telemetry_data.get('car_name')
            lap_val = telemetry_data.get('lap')
            current_lap = int(lap_val) if lap_val is not None and lap_val > 0 else None
            
            # Get speed and RPM for display (but don't push on every change)
            speed_kph = telemetry_data.get('speed_kph')
            if speed_kph is not None:
                speed_kph = round(float(speed_kph), 1)
            else:
                speed_kph = None
            
            rpm_val = telemetry_data.get('rpm')
            rpm = int(rpm_val) if rpm_val is not None else None
            
            # Determine engine running state (RPM > 500 indicates engine is running)
            engine_running = rpm is not None and rpm > 500 if rpm is not None else False
            
            # Build current state (only track state changes, not fast-changing telemetry)
            current_state = {
                'in_car': in_car,
                'in_pit_stall': in_pit_stall,
                'track_name': track_name,
                'car_name': car_name,
                'current_lap': current_lap,
                'engine_running': engine_running,
                # Store speed/RPM for display but don't trigger state changes
                'speed_kph': speed_kph,
                'rpm': rpm,
            }
            
            # Check if state changed (focus on important state changes only)
            state_changed = False
            is_forced_update = False
            last_in_car = self._last_telemetry_values.get('in_car') if self._last_telemetry_values else None
            last_in_pit = self._last_telemetry_values.get('in_pit_stall') if self._last_telemetry_values else None
            last_engine_running = self._last_telemetry_values.get('engine_running') if self._last_telemetry_values else None
            
            # Always push if this is the first update (no previous state) or if forced
            if force_update:
                state_changed = True
                is_forced_update = True
                # Don't log forced updates - they're just sync checks
            elif not self._last_telemetry_values:
                state_changed = True
                print(f"[INFO] First telemetry update - pushing initial state: in_car={in_car}")
            else:
                # Check for important state changes only (not speed/RPM)
                if (current_state['in_car'] != last_in_car or
                    current_state['in_pit_stall'] != last_in_pit or
                    current_state['engine_running'] != last_engine_running or
                    current_state['track_name'] != self._last_telemetry_values.get('track_name') or
                    current_state['car_name'] != self._last_telemetry_values.get('car_name') or
                    current_state['current_lap'] != self._last_telemetry_values.get('current_lap')):
                    state_changed = True
                    # Only log actual state changes
                    if current_state['in_car'] != last_in_car:
                        print(f"[INFO] State change: in_car {last_in_car} → {in_car}")
                    if current_state['in_pit_stall'] != last_in_pit:
                        print(f"[INFO] State change: in_pit_stall {last_in_pit} → {in_pit_stall}")
                    if current_state['engine_running'] != last_engine_running:
                        print(f"[INFO] State change: engine_running {last_engine_running} → {engine_running}")
                else:
                    # Force an update every 30 seconds even if state hasn't changed (reduced frequency)
                    # This ensures the database stays in sync if telemetry reading was wrong initially
                    if time.time() - getattr(self, '_last_forced_update', 0) > 30:  # Every 30 seconds (was 10)
                        state_changed = True  # Force update to ensure database is correct
                        is_forced_update = True  # Mark as forced so we don't log it
                        self._last_forced_update = time.time()
                    # Log periodically to verify telemetry is being read correctly (less verbose)
                    if time.time() - getattr(self, '_last_debug_log', 0) > 60:  # Every 60 seconds
                        # Show the corrected state, not raw telemetry
                        print(f"[DEBUG] Current state: in_car={in_car}, in_pit={in_pit_stall}, engine_running={engine_running}, speed={speed_kph}kph, rpm={rpm}")
                        self._last_debug_log = time.time()
            
            if state_changed:
                from datetime import datetime
                now_iso = datetime.utcnow().isoformat() + 'Z'
                
                update_data = {
                    'last_seen': now_iso,
                    'iracing_connected': True,
                    'in_car': in_car,
                    'in_pit_stall': in_pit_stall,
                    'track_name': track_name,
                    'car_name': car_name,
                    'current_lap': current_lap,
                    'engine_running': engine_running,
                    # Include speed/RPM for display, but only update on state changes
                    'speed_kph': speed_kph,
                    'rpm': rpm,
                }
                
                try:
                    supabase_service.table('irc_devices')\
                        .update(update_data)\
                        .eq('device_id', self.device_id)\
                        .execute()
                    # Only log database updates when state actually changed (not forced updates)
                    if not is_forced_update:
                        print(f"[INFO] State update pushed: in_car={in_car}, in_pit={in_pit_stall}")
                    # For forced updates, don't log (they're just health checks to keep DB in sync)
                except Exception as e:
                    print(f"[ERROR] Failed to push state update to database: {e}")
                    import traceback
                    traceback.print_exc()
                
                # Log important state changes before updating last values
                if last_in_car is not None and in_car != last_in_car:
                    print(f"[INFO] State change: {'In car' if in_car else 'Out of car'}")
                if last_in_pit is not None and in_pit_stall != last_in_pit:
                    print(f"[INFO] State change: {'Entered pit' if in_pit_stall else 'Left pit'}")
                if last_engine_running is not None and engine_running != last_engine_running:
                    print(f"[INFO] State change: Engine {'started' if engine_running else 'stopped'}")
                
                # Update last values
                self._last_telemetry_values = current_state.copy()
                self._last_state_update = now
        except Exception as e:
            print(f"[ERROR] Error in _check_and_push_state_changes: {e}")
            import traceback
            traceback.print_exc()
    
    def _check_timed_session(self, telemetry_data):
        """Check timed session movement detection and timer expiration"""
        if not self.timed_session_state:
            return
        
        speed_kph = telemetry_data.get('speed_kph', 0) or 0
        
        # If waiting for movement, check if car is moving
        if self.timed_session_state.get('waitingForMovement') and not self.timed_session_state.get('active'):
            if speed_kph > 5:
                # Car is moving - start the timer
                print(f"[INFO] Timed session: Car is moving ({speed_kph:.1f} km/h), starting timer")
                self.timed_session_state['active'] = True
                self.timed_session_state['waitingForMovement'] = False
                self.timed_session_state['startTime'] = int(time.time() * 1000)  # milliseconds
                self._update_timed_session_state()
        
        # If active, check if timer expired
        if self.timed_session_state.get('active') and self.timed_session_state.get('startTime'):
            start_time_ms = self.timed_session_state['startTime']
            duration_seconds = self.timed_session_state['duration']
            elapsed_seconds = (time.time() * 1000 - start_time_ms) / 1000
            
            if elapsed_seconds >= duration_seconds:
                # Timer expired - reset car and complete session
                print(f"[INFO] Timed session expired ({elapsed_seconds:.1f}s / {duration_seconds}s), resetting car")
                self._complete_timed_session()
    
    def _update_timed_session_state(self):
        """Update timed session state in database"""
        if not self.device_id or not self.supabase_connected:
            return
        
        try:
            from datetime import datetime
            now_iso = datetime.utcnow().isoformat() + 'Z'
            
            update_data = {
                'timed_session_state': self.timed_session_state,
                'updated_at': now_iso,
            }
            
            supabase_service.table('irc_devices')\
                .update(update_data)\
                .eq('device_id', self.device_id)\
                .execute()
            
            print(f"[INFO] Updated timed session state in database: active={self.timed_session_state.get('active')}, waitingForMovement={self.timed_session_state.get('waitingForMovement')}")
        except Exception as e:
            print(f"[ERROR] Failed to update timed session state: {e}")
            import traceback
            traceback.print_exc()
    
    def _complete_timed_session(self):
        """Complete timed session: reset car, clear state, mark queue entry as completed"""
        if not self.device_id or not self.supabase_connected:
            return
        
        driver_user_id = self.timed_session_state.get('driver_user_id') if self.timed_session_state else None
        
        try:
            # Queue reset_car command via Supabase (same way website does it)
            print(f"[INFO] Queuing reset_car command to complete timed session")
            try:
                supabase_service.table('irc_device_commands')\
                    .insert({
                        'device_id': self.device_id,
                        'command_type': 'driver',
                        'command_action': 'reset_car',
                        'command_params': {'grace_period': 0},
                        'status': 'pending'
                    })\
                    .execute()
                print(f"[INFO] Queued reset_car command successfully")
            except Exception as e:
                print(f"[ERROR] Failed to queue reset_car command: {e}")
            
            # Clear timed session state
            from datetime import datetime
            now_iso = datetime.utcnow().isoformat() + 'Z'
            
            supabase_service.table('irc_devices')\
                .update({
                    'timed_session_state': None,
                    'updated_at': now_iso,
                })\
                .eq('device_id', self.device_id)\
                .execute()
            
            # Mark queue entry as completed
            if driver_user_id:
                try:
                    # Find active queue entry for this driver
                    queue_result = supabase_service.table('irc_device_queue')\
                        .select('id')\
                        .eq('device_id', self.device_id)\
                        .eq('user_id', driver_user_id)\
                        .eq('status', 'active')\
                        .maybe_single()\
                        .execute()
                    
                    if queue_result.data:
                        queue_id = queue_result.data['id']
                        supabase_service.table('irc_device_queue')\
                            .update({
                                'status': 'completed',
                                'completed_at': now_iso,
                                'updated_at': now_iso,
                            })\
                            .eq('id', queue_id)\
                            .execute()
                        print(f"[INFO] Marked queue entry {queue_id} as completed")
                except Exception as e:
                    print(f"[WARN] Failed to mark queue entry as completed: {e}")
            
            # Clear local state
            self.timed_session_state = None
            print(f"[INFO] Timed session completed and cleared")
            
        except Exception as e:
            print(f"[ERROR] Failed to complete timed session: {e}")
            import traceback
            traceback.print_exc()
    
    def _update_heartbeat(self):
        """Update last_seen timestamp and iRacing connection status in Supabase"""
        if not self.device_id or not self.supabase_connected:
            return
        
        try:
            from datetime import datetime
            now = datetime.utcnow().isoformat() + 'Z'
            
            # Get current iRacing connection status and telemetry data
            telemetry_mgr = telemetry.get_manager()
            iracing_connected = telemetry_mgr.is_connected if telemetry_mgr else False
            
            # Get current telemetry data
            in_car = None
            speed_kph = None
            rpm = None
            track_name = None
            car_name = None
            current_lap = None
            in_pit_stall = None
            
            if telemetry_mgr and telemetry_mgr.is_connected:
                current_telemetry = telemetry_mgr.get_current()
                if current_telemetry:
                    in_car = current_telemetry.get('is_on_track_car', False)
                    # Store speed even if 0 (car might be stopped)
                    speed_kph = current_telemetry.get('speed_kph')
                    if speed_kph is not None:
                        speed_kph = float(speed_kph)
                    else:
                        speed_kph = None
                    
                    # Store RPM even if 0 (engine might be off)
                    rpm_val = current_telemetry.get('rpm')
                    if rpm_val is not None:
                        rpm = int(rpm_val)
                    else:
                        rpm = None
                    
                    track_name = current_telemetry.get('track_name')
                    car_name = current_telemetry.get('car_name')
                    
                    # Only store lap if > 0 (0 means not started yet)
                    lap_val = current_telemetry.get('lap')
                    if lap_val is not None and lap_val > 0:
                        current_lap = int(lap_val)
                    else:
                        current_lap = None
                    
                    in_pit_stall = current_telemetry.get('player_in_pit_stall', False)
                else:
                    print(f"[DEBUG] Telemetry manager connected but get_current() returned None or empty")
            else:
                if not telemetry_mgr:
                    print(f"[DEBUG] Telemetry manager is None")
                elif not telemetry_mgr.is_connected:
                    print(f"[DEBUG] Telemetry manager is not connected")
            
            # Heartbeat only updates service health (last_seen and connection status)
            # Telemetry updates are handled by _check_and_push_state_changes() on state changes
            update_data = {
                'last_seen': now,
                'iracing_connected': iracing_connected,
            }
            
            # Update IP addresses periodically (every 5 minutes)
            current_time = time.time()
            if (current_time - self._last_ip_update) >= self.ip_update_interval:
                try:
                    from core import device
                    device_mgr = device.get_manager()
                    local_ip = device_mgr.get_local_ip()
                    public_ip = device_mgr.get_public_ip()
                    
                    if local_ip and local_ip != "127.0.0.1":
                        update_data['local_ip'] = local_ip
                    if public_ip and public_ip != "Unknown":
                        update_data['public_ip'] = public_ip
                    
                    self._last_ip_update = current_time
                    print(f"[INFO] IP addresses updated: local={local_ip}, public={public_ip}")
                except Exception as e:
                    print(f"[WARN] Failed to update IP addresses: {e}")
            
            # Update geolocation periodically (every hour) based on public IP
            if (current_time - self._last_geolocation_update) >= self.geolocation_update_interval:
                try:
                    geolocation = self._get_geolocation_from_ip()
                    if geolocation:
                        # Only update if we got valid data
                        # Note: These columns may not exist in the database yet - that's OK, we'll handle gracefully
                        if geolocation.get('latitude') and geolocation.get('longitude'):
                            update_data['latitude'] = geolocation.get('latitude')
                            update_data['longitude'] = geolocation.get('longitude')
                        if geolocation.get('city'):
                            update_data['city'] = geolocation.get('city')
                        if geolocation.get('region'):
                            update_data['region'] = geolocation.get('region')
                        if geolocation.get('country'):
                            update_data['country'] = geolocation.get('country')
                        if geolocation.get('postal_code'):
                            update_data['postal_code'] = geolocation.get('postal_code')
                        if geolocation.get('address'):
                            update_data['address'] = geolocation.get('address')
                        if geolocation.get('display_address'):
                            update_data['display_address'] = geolocation.get('display_address')
                        
                        self._last_geolocation_update = current_time
                        address_str = geolocation.get('address', 'N/A')
                        print(f"[INFO] Geolocation updated: {address_str} ({geolocation.get('city', 'N/A')}, {geolocation.get('region', 'N/A')}, {geolocation.get('country', 'N/A')})")
                except Exception as e:
                    print(f"[WARN] Failed to update geolocation: {e}")
            
            result = supabase_service.table('irc_devices')\
                .update(update_data)\
                .eq('device_id', self.device_id)\
                .execute()
            self._last_heartbeat = time.time()
            print(f"[INFO] Heartbeat updated: iracing_connected={iracing_connected}, last_seen={now}")
        except Exception as e:
            print(f"[WARN] Failed to update heartbeat: {e}")
            # If columns don't exist, try without them (graceful degradation)
            if 'column' in str(e).lower() or 'does not exist' in str(e).lower():
                print("[INFO] Some columns may not exist, falling back to basic update")
                try:
                    from datetime import datetime
                    now = datetime.utcnow().isoformat() + 'Z'
                    # Try with just last_seen and iracing_connected (most basic fields)
                    basic_update = {
                        'last_seen': now,
                        'iracing_connected': iracing_connected,
                    }
                    # Only add IPs if they're in update_data (to avoid errors if columns don't exist)
                    if 'local_ip' in update_data:
                        basic_update['local_ip'] = update_data.get('local_ip')
                    if 'public_ip' in update_data:
                        basic_update['public_ip'] = update_data.get('public_ip')
                    
                    supabase_service.table('irc_devices')\
                        .update(basic_update)\
                        .eq('device_id', self.device_id)\
                        .execute()
                    self._last_heartbeat = time.time()
                except Exception as e2:
                    print(f"[WARN] Failed to update heartbeat: {e2}")
            else:
                print(f"[WARN] Failed to update heartbeat: {e}")

    def _initialize_lap_tracking(self):
        """Initialize lap counts and last logged lap from Supabase"""
        try:
            last_lap = laps.get_last_lap_number(self.device_id)
            if last_lap is not None:
                self.last_logged_lap = last_lap
                print(f"[INFO] Initialized from database: last recorded lap was {last_lap}")
            else:
                print("[INFO] No previous laps found in database")
        except Exception as e:
            print(f"[WARN] Failed to initialize last lap from database: {e}")

        try:
            result = supabase_service.table('irc_laps')\
                .select('lap_id', count='exact')\
                .eq('device_id', self.device_id)\
                .execute()

            total = 0
            if hasattr(result, 'count') and result.count is not None:
                total = result.count
            elif isinstance(result, dict) and 'count' in result:
                total = result['count']
            elif result and result.data is not None:
                total = len(result.data)

            self.laps_total_recorded = total
            self.laps_recorded_session = 0
            print(f"[INFO] Total laps recorded for this rig: {total}")
        except Exception as e:
            print(f"[WARN] Failed to fetch lap count: {e}")

    # ------------------------------------------------------------------
    # Racing controls helpers
    # ------------------------------------------------------------------
    def get_controls_mapping(self, force: bool = False):
        try:
            return self.controls_manager.get_bindings(force=force)
        except Exception as exc:
            print(f"[WARN] Failed to retrieve controls mapping: {exc}")
            return {}

    def execute_control_action(self, action: str, params: Dict = None, source: str = "manual"):
        """Execute a control action (can be called from command queue or directly)"""
        try:
            # Focus iRacing window first to ensure commands are received
            if not self.controls_manager.focus_iracing_window():
                result = {'success': False, 'message': 'Unable to focus iRacing window'}
                self.controls_manager._log_action(action, None, source, result)
                return result
            time.sleep(0.1)  # Give window time to fully focus
            
            if params is None:
                params = {}
            
            # Get current telemetry for smart checks
            current_telemetry = telemetry.get_current()
            
            # Smart state checks before executing
            if action == "reset_car":
                # Reset car can be executed even when not in car
                allow_outside_car = True
            elif action == "enter_car":
                # Enter car can be executed anytime - it's safe to press even if already in car
                # iRacing will handle it correctly (won't do anything if already in car)
                # So we don't need to check - just allow it
                allow_outside_car = True
                # No need to check if already in car - the command is safe to execute
                # Just send the key press directly - don't go through reset sequence
                # Get the reset_car combo (enter_car uses the same key)
                self.controls_manager.load_bindings()
                reset_binding = self.controls_manager.get_bindings().get("reset_car")
                if reset_binding and reset_binding.get("combo"):
                    combo = reset_binding.get("combo")
                    # Send the key press directly using the controls manager's internal method
                    # This bypasses the full reset sequence and just sends the key
                    import os
                    if os.name == "nt":
                        # Get initial state before sending key
                        initial_telemetry = telemetry.get_current()
                        was_in_car_before = initial_telemetry.get('is_on_track_car', False) if initial_telemetry else False
                        
                        # Focus iRacing window before sending enter_car key
                        if not self.controls_manager.focus_iracing_window():
                            result = {'success': False, 'message': 'Unable to focus iRacing window'}
                            self.controls_manager._log_action(action, combo, source, result)
                            return result
                        time.sleep(0.15)
                        
                        # Send the key
                        key_sent = self.controls_manager._send_keystroke(combo)
                        key_msg = self.controls_manager._format_key_message(combo)
                        
                        if not key_sent:
                            result = {'success': False, 'message': f'Failed to {key_msg}'}
                            self.controls_manager._log_action(action, combo, source, result)
                            return result
                        
                        # Wait a moment for iRacing to process the key and update telemetry
                        time.sleep(0.5)
                        
                        # Check if we're now in the car
                        current_telemetry = telemetry.get_current()
                        is_in_car_now = current_telemetry.get('is_on_track_car', False) if current_telemetry else False
                        
                        if is_in_car_now and not was_in_car_before:
                            # Successfully entered the car
                            result = {'success': True, 'message': f'Enter car - {key_msg} (entered car successfully)'}
                        elif is_in_car_now and was_in_car_before:
                            # Already in car - key was sent but no state change (this is OK)
                            result = {'success': True, 'message': f'Enter car - {key_msg} (already in car)'}
                        else:
                            # Key was sent but car wasn't entered - might be in menu/garage or iRacing not ready
                            result = {'success': False, 'message': f'Enter car - {key_msg} (key sent but car not entered - may be in menu/garage or iRacing not ready)'}
                        
                        self.controls_manager._log_action(action, combo, source, result)
                        return result
                # If no combo found, fall through to normal execute_action (which will use the fallback)
            elif action in ["starter", "ignition"]:
                # Starter should check if already running (don't start an already-running engine)
                # Ignition is a toggle - it should work regardless of engine state
                if action == "starter" and current_telemetry:
                    rpm = current_telemetry.get('rpm', 0)
                    if rpm > 500:
                        result = {'success': False, 'message': 'Engine already running'}
                        self.controls_manager._log_action(action, None, source, result)
                        return result
                # Ignition is a toggle - allow it to work in any state
                allow_outside_car = False
            elif action == "pit_speed_limiter":
                # Pit limiter should check if already in pit
                if current_telemetry and current_telemetry.get('player_in_pit_stall', False):
                    result = {'success': False, 'message': 'Already in pit stall'}
                    self.controls_manager._log_action(action, None, source, result)
                    return result
                allow_outside_car = False
            elif action == "request_pit":
                # Request pit should check if already in pit
                if current_telemetry and current_telemetry.get('player_in_pit_stall', False):
                    result = {'success': False, 'message': 'Already in pit stall'}
                    self.controls_manager._log_action(action, None, source, result)
                    return result
                allow_outside_car = False
            else:
                allow_outside_car = False
            
            ok, context = self._ensure_control_context(allow_when_not_in_car=allow_outside_car)
            if not ok:
                # Log even failed attempts
                self.controls_manager._log_action(action, None, source, context)
                return context

            if action == "reset_car":
                grace_period = params.get('grace_period', 0.0)
                result = self._execute_reset_sequence(context, grace_period=grace_period)
                # Log reset sequence
                combo = self.controls_manager.get_binding_combo("reset_car")
                self.controls_manager._log_action(action, combo, source, result)
                return result

            return self.controls_manager.execute_action(action, source=source)
        except Exception as exc:
            result = {'success': False, 'message': str(exc)}
            self.controls_manager._log_action(action, None, source, result)
            return result

    def _ensure_control_context(self, allow_when_not_in_car: bool = False):
        telemetry_mgr = telemetry.get_manager()
        if not telemetry_mgr or not telemetry_mgr.is_connected:
            return False, {'success': False, 'message': 'iRacing not connected'}

        data = telemetry.get_current()
        if not data or not data.get('connected'):
            return False, {'success': False, 'message': 'No telemetry data available'}

        if not allow_when_not_in_car and not data.get('is_on_track_car', False):
            return False, {'success': False, 'message': 'Driver not in car'}

        return True, data

    def _execute_reset_sequence(self, telemetry_data, grace_period: float = 0.0):
        """
        Enhanced reset sequence: Turn off ignition → Stop car → Reset to pits → Reset out of car
        Optionally waits for grace period to let driver finish current lap
        Uses smart status monitoring to release keys as soon as transitions occur
        """
        # Focus iRacing window first to ensure commands are received
        if not self.controls_manager.focus_iracing_window():
            return {'success': False, 'message': 'Unable to focus iRacing window'}
        time.sleep(0.1)  # Give window time to fully focus
        
        bindings = self.controls_manager.get_bindings()
        reset_combo = bindings.get('reset_car', {}).get('combo')
        if not reset_combo:
            return {'success': False, 'message': 'Reset control is not configured'}

        ignition_combo = bindings.get('ignition', {}).get('combo')
        starter_combo = bindings.get('starter', {}).get('combo')
        
        # Get initial state
        current = telemetry.get_current()
        if not current:
            return {'success': False, 'message': 'No telemetry data available'}
        
        initial_speed = current.get('speed_kph', 0)
        initial_in_car = current.get('is_on_track_car', False)
        initial_in_pit = current.get('player_in_pit_stall', False)
        
        # Smart check: If already stopped and out of car, skip most steps
        if initial_speed <= 1.5 and not initial_in_car:
            print("[INFO] Car already stopped and out of car - skipping reset sequence")
            return {'success': True, 'message': 'Car already in reset state'}
        
        # Grace period: wait for driver to finish current lap if requested
        if grace_period > 0:
            print(f"[*] Reset grace period: waiting up to {grace_period:.1f}s for lap completion")
            start_time = time.time()
            initial_lap = telemetry_data.get('lap', 0)
            
            while (time.time() - start_time) < grace_period:
                current = telemetry.get_current()
                if not current:
                    break
                current_lap = current.get('lap', 0)
                # If lap number increased, they finished the lap
                if current_lap > initial_lap:
                    print("[OK] Lap completed during grace period")
                    break
                time.sleep(0.5)
        
        # Step 1: Turn off ignition immediately (to force car to slow down)
        if ignition_combo:
            print("[*] Turning off ignition immediately to force car to slow down...")
            # Focus iRacing window before sending ignition key
            if not self.controls_manager.focus_iracing_window():
                return {'success': False, 'message': 'Unable to focus iRacing window before ignition'}
            time.sleep(0.15)
            self.controls_manager.execute_combo(ignition_combo)
            time.sleep(0.3)  # Give ignition time to turn off

        # Step 2: Wait for car to stop (only if moving)
        if initial_speed > 1.5:
            print("[*] Waiting for car to stop...")
            for _ in range(30):  # Reduced from 50 (10 seconds max instead of 20)
                current = telemetry.get_current()
                if not current:
                    break
                speed = current.get('speed_kph', 0)
                if speed <= 1.5:
                    print("[OK] Car stopped")
                    break
                time.sleep(0.2)
            else:
                print("[WARN] Car did not stop within timeout, proceeding anyway")
        else:
            print("[INFO] Car already stopped, skipping wait")

        # Step 3: Reset to pits - hold reset key until we reach pit stall or leave car
        # Focus iRacing window again right before pressing reset key (in case focus was lost during wait/grace period)
        if not self.controls_manager.focus_iracing_window():
            return {'success': False, 'message': 'Unable to focus iRacing window before reset'}
        time.sleep(0.15)  # Give window time to fully focus before sending keys
        
        print("[*] Resetting to pits (holding reset key until status change)...")
        initial_status = telemetry.get_current()
        was_in_car = initial_status.get('is_on_track_car', False) if initial_status else False
        
        # Define status check: we want to stop when we're in pit stall OR no longer in car
        def check_pit_or_out(telemetry_data: dict) -> bool:
            in_pit = telemetry_data.get('player_in_pit_stall', False)
            in_car = telemetry_data.get('is_on_track_car', False)
            # Success if we're in pit stall, or if we were in car and now we're not
            return in_pit or (was_in_car and not in_car)
        
        # Hold reset key until status change (max 3 seconds)
        success, hold_time = self.controls_manager.execute_combo_hold_until_status(
            reset_combo, 
            check_pit_or_out, 
            max_hold=3.0, 
            source="queue_owner"
        )
        
        if success:
            current = telemetry.get_current()
            if current:
                in_pit = current.get('player_in_pit_stall', False)
                in_car = current.get('is_on_track_car', False)
                if in_pit:
                    print(f"[OK] Car reset to pits (held for {hold_time:.2f}s)")
                elif not in_car:
                    print(f"[OK] Car reset out of car (held for {hold_time:.2f}s)")
                else:
                    print(f"[OK] Reset completed (held for {hold_time:.2f}s)")
        else:
            print("[WARN] Reset to pits may not have completed")

        # Step 4: Reset out of car (if still in car)
        current = telemetry.get_current()
        if current and current.get('is_on_track_car', False):
            # Focus iRacing window again right before second reset (in case focus was lost)
            if not self.controls_manager.focus_iracing_window():
                return {'success': False, 'message': 'Unable to focus iRacing window before second reset'}
            time.sleep(0.15)
            
            print("[*] Resetting out of car (holding reset key until status change)...")
            
            # Define status check: we want to stop when we're no longer in car
            def check_out_of_car(telemetry_data: dict) -> bool:
                return not telemetry_data.get('is_on_track_car', False)
            
            # Hold reset key until out of car (max 3 seconds)
            success, hold_time = self.controls_manager.execute_combo_hold_until_status(
                reset_combo,
                check_out_of_car,
                max_hold=3.0,
                source="queue_owner"
            )
            
            if success:
                print(f"[OK] Car reset out of car (held for {hold_time:.2f}s)")
            else:
                print("[WARN] Reset out of car may not have completed")
        else:
            print("[OK] Already out of car, skipping out-of-car reset")

        # Step 5: Turn ignition back on (if we have it)
        if ignition_combo:
            print("[*] Turning ignition back on...")
            # Focus iRacing window before sending ignition key
            if not self.controls_manager.focus_iracing_window():
                return {'success': False, 'message': 'Unable to focus iRacing window before ignition'}
            time.sleep(0.15)
            self.controls_manager.execute_combo(ignition_combo)
            time.sleep(0.3)

        # Step 6: Start engine (if we have starter)
        if starter_combo:
            print("[*] Starting engine...")
            # Focus iRacing window before sending starter key
            if not self.controls_manager.focus_iracing_window():
                return {'success': False, 'message': 'Unable to focus iRacing window before starter'}
            time.sleep(0.15)
            self.controls_manager.execute_combo(starter_combo)

        print("[OK] Reset sequence completed")
        
        # Force a state update after reset to ensure database reflects new state
        # Wait a moment for telemetry to update after reset
        time.sleep(1.0)  # Give more time for telemetry to update
        
        # Get fresh telemetry and force update
        for attempt in range(3):  # Try up to 3 times
            current_telemetry = telemetry.get_current()
            if current_telemetry:
                is_on_track_car = current_telemetry.get('is_on_track_car', False)
                print(f"[INFO] Forcing state update after reset (attempt {attempt+1}): is_on_track_car={is_on_track_car}")
                
                # Force update without clearing last state (use force_update parameter)
                self._check_and_push_state_changes(current_telemetry, force_update=True)
                
                # Verify the update
                time.sleep(0.5)
                updated_telemetry = telemetry.get_current()
                if updated_telemetry:
                    final_state = updated_telemetry.get('is_on_track_car', False)
                    print(f"[INFO] State after reset update: is_on_track_car={final_state}")
                break
            else:
                print(f"[WARN] No telemetry available for state update (attempt {attempt+1})")
                time.sleep(0.5)
        
        return {'success': True, 'message': 'Reset sequence completed'}
    
    def _start_command_queue(self):
        """Start receiving commands via Supabase Realtime (or fallback to polling)"""
        if not self.device_id:
            print("[WARN] Cannot start command queue: device_id not set")
            return
        
        try:
            device_info = device.get_info()
            portal_url = device_info.get('portal_url', 'https://revshareracing.com/device/rig-unknown')
            # Extract base URL for fallback polling - remove /device/rig-xxx or /device suffix
            if '/device/' in portal_url:
                portal_base = portal_url.rsplit('/device/', 1)[0]
            elif portal_url.endswith('/device'):
                portal_base = portal_url.rsplit('/device', 1)[0]
            else:
                # If no /device in path, assume it's already a base URL
                portal_base = portal_url.rstrip('/')
            
            print(f"[*] Initializing command queue (device: {self.device_id}, portal: {portal_base})")
            
            # Use Supabase client for Realtime (push-based, scales to 1000s of rigs)
            # Falls back to polling if Realtime unavailable
            self.command_queue = command_queue.create_queue(
                self.device_id,
                supabase_client=supabase,  # Use the global Supabase client
                portal_base_url=portal_base
            )
            self.command_queue.set_execute_callback(self._handle_command)
            self.command_queue.start()
            print(f"[OK] Command queue started successfully for device: {self.device_id}")
        except Exception as e:
            print(f"[ERROR] Failed to start command queue: {e}")
            import traceback
            traceback.print_exc()
    
    def _handle_command(self, command: Dict) -> Dict:
        """Handle a command from the queue"""
        cmd_type = command.get('type')  # 'driver' or 'owner'
        cmd_action = command.get('action')
        cmd_params = command.get('params', {})
        
        # Determine source based on command type
        source = "queue"
        if cmd_type == 'driver':
            source = "queue_driver"
        elif cmd_type == 'owner':
            source = "queue_owner"
        
        # Handle different command types
        if cmd_action == 'reset_car':
            grace_period = cmd_params.get('grace_period', 0.0)
            telemetry_data = telemetry.get_current()
            result = self._execute_reset_sequence(telemetry_data, grace_period=grace_period)
            combo = self.controls_manager.get_binding_combo("reset_car")
            self.controls_manager._log_action(cmd_action, combo, source, result)
            
            # Force state update after reset to sync with website
            time.sleep(1.0)  # Wait for state to settle
            current_telemetry = telemetry.get_current()
            if current_telemetry:
                print("[INFO] Forcing state update after reset_car command")
                self._check_and_push_state_changes(current_telemetry, force_update=True)
            
            return result
        
        elif cmd_action == 'execute_action':
            action_name = cmd_params.get('action')
            if action_name:
                return self.execute_control_action(action_name, source=source)
            result = {'success': False, 'message': 'No action specified'}
            self.controls_manager._log_action("execute_action", None, source, result)
            return result
        
        # Handle enter_car specially - just press the key, don't go through full reset sequence
        elif cmd_action == 'enter_car':
            # Check if this is a timed session (from queue)
            timed_session = cmd_params.get('timed_session', False)
            session_duration_seconds = cmd_params.get('session_duration_seconds', 60)
            queue_driver_id = cmd_params.get('queue_driver_id')
            
            # Enter car should just press the reset key (same as reset_car binding)
            # But don't run the full reset sequence - just send the key press directly
            # Focus iRacing window first (like reset_car does) to ensure it works reliably
            if not self.controls_manager.focus_iracing_window():
                result = {'success': False, 'message': 'Unable to focus iRacing window'}
                self.controls_manager._log_action("enter_car", None, source, result)
                return result
            time.sleep(0.15)  # Give window time to fully focus before sending keys
            # Use execute_action which handles focusing and has fallback logic
            # This is simpler and more reliable than trying to manually send the key
            result = self.controls_manager.execute_action("enter_car", source=source)
            
            # If timed session, set up session state waiting for movement
            if timed_session and queue_driver_id:
                print(f"[INFO] Setting up timed session for driver {queue_driver_id}, duration: {session_duration_seconds}s")
                self.timed_session_state = {
                    'active': False,
                    'waitingForMovement': True,
                    'startTime': None,
                    'duration': session_duration_seconds,
                    'driver_user_id': queue_driver_id
                }
                # Update database with waiting state
                self._update_timed_session_state()
            
            # Force state update after enter_car to sync with website
            time.sleep(1.0)  # Wait for state to settle
            current_telemetry = telemetry.get_current()
            if current_telemetry:
                print("[INFO] Forcing state update after enter_car command")
                self._check_and_push_state_changes(current_telemetry, force_update=True)
            
            return result
        
        # Support direct control actions (starter, ignition, pit_speed_limiter, etc.)
        elif cmd_action in ['starter', 'ignition', 'pit_speed_limiter', 'request_pit', 'quick_repair', 'clear_flags']:
            return self.execute_control_action(cmd_action, source=source)
        
        elif cmd_action == 'enable_timed_reset':
            interval = cmd_params.get('interval', 0)
            grace_period = cmd_params.get('grace_period', 30)
            return self._enable_timed_reset(interval, grace_period)
        
        elif cmd_action == 'disable_timed_reset':
            return self._disable_timed_reset()
        
        else:
            return {'success': False, 'message': f'Unknown command action: {cmd_action}'}
    
    def _enable_timed_reset(self, interval: float, grace_period: float = 30.0):
        """Enable timed session resets"""
        if interval <= 0:
            return {'success': False, 'message': 'Invalid interval'}
        
        self.timed_reset_interval = interval
        self.timed_reset_grace_period = grace_period
        self.timed_reset_enabled = True
        self._last_reset_time = time.time()
        
        # Start timed reset thread if not already running
        if not self.timed_reset_thread or not self.timed_reset_thread.is_alive():
            self.timed_reset_thread = threading.Thread(target=self._timed_reset_loop, daemon=True)
            self.timed_reset_thread.start()
        
        print(f"[OK] Timed reset enabled: {interval}s interval, {grace_period}s grace period")
        return {'success': True, 'message': f'Timed reset enabled: {interval}s'}
    
    def _disable_timed_reset(self):
        """Disable timed session resets"""
        self.timed_reset_enabled = False
        print("[OK] Timed reset disabled")
        return {'success': True, 'message': 'Timed reset disabled'}
    
    def _timed_reset_loop(self):
        """Background thread for timed session resets"""
        while self.running and self.timed_reset_enabled:
            try:
                elapsed = time.time() - self._last_reset_time
                if elapsed >= self.timed_reset_interval:
                    # Calculate grace period based on current lap time if available
                    telemetry_data = telemetry.get_current()
                    grace = self.timed_reset_grace_period
                    
                    if telemetry_data:
                        lap_time = telemetry_data.get('lap_last_time', 0)
                        if lap_time and lap_time > 0:
                            # Add 50% of lap time as additional grace
                            grace = self.timed_reset_grace_period + (lap_time * 1.5)
                    
                    print(f"[*] Timed reset triggered (grace: {grace:.1f}s)")
                    self._execute_reset_sequence(telemetry_data or {}, grace_period=grace)
                    self._last_reset_time = time.time()
                
                time.sleep(1.0)  # Check every second
            except Exception as e:
                print(f"[WARN] Timed reset error: {e}")
                time.sleep(5.0)
    
    def _get_geolocation_from_ip(self) -> Optional[Dict]:
        """Get geolocation information from public IP address and reverse geocode to address"""
        try:
            from core import device
            device_mgr = device.get_manager()
            public_ip = device_mgr.get_public_ip()
            
            if not public_ip or public_ip == "Unknown":
                return None
            
            # Step 1: Get lat/lng from IP geolocation
            # Use ip-api.com (free, no API key required, 45 requests/minute limit)
            import requests
            response = requests.get(
                f'http://ip-api.com/json/{public_ip}?fields=status,message,country,regionName,city,zip,lat,lon',
                timeout=5
            )
            
            if response.status_code != 200:
                return None
                
            data = response.json()
            if data.get('status') != 'success':
                return None
            
            lat = data.get('lat')
            lon = data.get('lon')
            
            if not lat or not lon:
                return None
            
            result = {
                'latitude': lat,
                'longitude': lon,
                'city': data.get('city'),
                'region': data.get('regionName'),
                'country': data.get('country'),
                'postal_code': data.get('zip'),
            }
            
            # Step 2: Reverse geocode to get street address
            # Use OpenStreetMap Nominatim (free, no API key, but requires user-agent)
            # Rate limit: 1 request/second - we update hourly so we're well within limits
            try:
                import time
                time.sleep(1.1)  # Small delay to respect rate limits
                reverse_response = requests.get(
                    f'https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}&zoom=18&addressdetails=1',
                    headers={'User-Agent': 'RevShareRacing-PC-Service/1.0'},
                    timeout=5
                )
                
                if reverse_response.status_code == 200:
                    reverse_data = reverse_response.json()
                    address_data = reverse_data.get('address', {})
                    
                    # Build formatted address from components
                    address_parts = []
                    
                    # Street address (house number + road)
                    house_number = address_data.get('house_number')
                    road = address_data.get('road')
                    if house_number and road:
                        address_parts.append(f"{house_number} {road}")
                    elif road:
                        address_parts.append(road)
                    
                    # City/Town
                    city = address_data.get('city') or address_data.get('town') or address_data.get('village')
                    if city and city != result.get('city'):
                        address_parts.append(city)
                    
                    # State/Region
                    state = address_data.get('state')
                    if state and state != result.get('region'):
                        address_parts.append(state)
                    
                    # Postal code
                    postal = address_data.get('postcode')
                    if postal and postal != result.get('postal_code'):
                        result['postal_code'] = postal
                    
                    # Country
                    country = address_data.get('country')
                    if country:
                        result['country'] = country
                    
                    # Create formatted address string
                    if address_parts:
                        result['address'] = ', '.join(address_parts)
                    else:
                        # Fallback: use display_name from Nominatim
                        result['address'] = reverse_data.get('display_name', '').split(',')[0] if reverse_data.get('display_name') else None
                    
                    # Also store the full display name for reference
                    if reverse_data.get('display_name'):
                        result['display_address'] = reverse_data.get('display_name')
                    
                    print(f"[INFO] Reverse geocoded address: {result.get('address', 'N/A')}")
                else:
                    print(f"[WARN] Reverse geocoding failed: HTTP {reverse_response.status_code}")
            except Exception as e:
                print(f"[WARN] Reverse geocoding failed: {e}")
                # Continue without address - we still have lat/lng and city/region
            
            return result
        except Exception as e:
            print(f"[WARN] Geolocation lookup failed: {e}")
            return None
    
    def stop(self):
        """Stop the service"""
        self.running = False
        self.timed_reset_enabled = False
        
        if self.command_queue:
            self.command_queue.stop()
        
        if self.telemetry_thread:
            self.telemetry_thread.join(timeout=2)
        
        if self.timed_reset_thread:
            self.timed_reset_thread.join(timeout=2)
        
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
    print("Rev Share Racing - PC Service")
    print("=" * 80)
    print()
    print("This service handles:")
    print("  - Lap collection from iRacing")
    print("  - Rig registration to Supabase")
    print("  - Keystroke/control commands")
    print("  - Config retrieval")
    print()
    print(f"Manage this rig from the web portal at {device.DEVICE_PORTAL_BASE_URL}")
    print("This service handles local telemetry collection and queue execution.")
    print()
    print("=" * 80)
    print()
    
    service = get_service()
    service.start()
    
    try:
        # Keep running
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[*] Shutting down...")
        service.stop()
        print("[OK] Service stopped")

