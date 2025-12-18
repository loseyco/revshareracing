"""
GridPass Commander Service
Main service orchestrating telemetry, API, and controls.
"""

import time
import threading
from typing import Dict, Optional, Callable

from config import HEARTBEAT_INTERVAL, COMMAND_POLL_INTERVAL
from api_client import GridPassAPI, get_api, APIError
from core import device, telemetry, controls


class CommanderService:
    """Main service coordinating all components."""
    
    def __init__(self):
        self.running = False
        self.api: GridPassAPI = get_api()
        self.controls = controls.get_manager()
        
        # State
        self.device_id: Optional[str] = None
        self.hardware_fingerprint: str = device.get_fingerprint()
        self.api_connected = False
        
        # Lap tracking
        self.laps_recorded = 0
        self._last_lap = 0
        self._last_session_id = None
        self._pending_lap = None
        
        # Threads
        self._telemetry_thread: Optional[threading.Thread] = None
        self._command_thread: Optional[threading.Thread] = None
        self._last_heartbeat = 0
        
        # Callbacks
        self.on_lap_recorded: Optional[Callable] = None
        self.on_status_change: Optional[Callable] = None
        
        self._setup_device()
    
    def _setup_device(self):
        """Check if device is registered."""
        if self.api.is_registered:
            self.device_id = self.api.device_id
            self.api_connected = True
            print(f"[OK] Device registered: {self.device_id}")
        elif self.api.is_logged_in and self.api.user.tenant_id:
            # Auto-register if logged in with tenant
            self.register_device()
        else:
            print("[INFO] Not registered - please login to register device")
    
    def register_device(self):
        """Register device with API using logged-in user's tenant."""
        if not self.api.is_logged_in:
            print("[WARN] Must be logged in to register device")
            return False
        
        try:
            result = self.api.register(
                hardware_id=self.hardware_fingerprint,
                name=device.get_hostname()
            )
            self.device_id = result.device_id
            self.api_connected = True
            print(f"[OK] Registered device: {self.device_id}")
            
            # Start command polling if not already running
            if self.running and not self._command_thread:
                import threading
                self._command_thread = threading.Thread(target=self._command_loop, daemon=True)
                self._command_thread.start()
            
            return True
        except APIError as e:
            print(f"[WARN] Registration failed: {e}")
            return False
    
    def start(self):
        """Start the service."""
        if self.running:
            return
        
        self.running = True
        
        # Load controls
        self.controls.load_bindings(force=True)
        
        # Send initial heartbeat
        self._send_heartbeat()
        
        # Start telemetry
        telemetry.add_callback(self._on_telemetry)
        self._telemetry_thread = threading.Thread(target=self._telemetry_loop, daemon=True)
        self._telemetry_thread.start()
        
        # Start command polling
        if self.api_connected:
            self._command_thread = threading.Thread(target=self._command_loop, daemon=True)
            self._command_thread.start()
        
        print("[OK] Commander service started")
    
    def stop(self):
        """Stop the service."""
        self.running = False
        if self._telemetry_thread:
            self._telemetry_thread.join(timeout=2)
        if self._command_thread:
            self._command_thread.join(timeout=2)
        self.api.close()
        print("[OK] Commander service stopped")
    
    def get_status(self) -> Dict:
        """Get current service status."""
        telem = telemetry.get_current()
        return {
            "iracing": {
                "connected": telemetry.is_connected(),
                "lap": telem.get("lap", 0),
                "speed_kph": telem.get("speed_kph", 0),
                "track": telem.get("track_name", "N/A"),
                "car": telem.get("car_name", "N/A"),
                "in_car": telem.get("is_on_track_car", False),
            },
            "api": {
                "connected": self.api_connected,
                "device_id": self.device_id or "Not registered",
                "laps_recorded": self.laps_recorded,
            }
        }
    
    def execute_action(self, action: str) -> Dict:
        """Execute a control action."""
        return self.controls.execute_action(action)
    
    def reset_car(self) -> Dict:
        """Execute reset car sequence."""
        # Turn off ignition first
        ignition = self.controls.bindings.get("ignition", {}).get("combo")
        if ignition:
            self.controls.execute_combo(ignition)
            time.sleep(0.3)
        
        # Wait for car to stop
        for _ in range(30):
            telem = telemetry.get_current()
            if telem.get("speed_kph", 0) <= 1.5:
                break
            time.sleep(0.2)
        
        # Reset
        result = self.controls.execute_action("reset_car")
        time.sleep(1.0)
        
        # Turn ignition back on
        if ignition:
            self.controls.execute_combo(ignition)
        
        return result
    
    # === Private Methods ===
    
    def _telemetry_loop(self):
        """Background telemetry loop."""
        while self.running:
            try:
                # Heartbeat
                if time.time() - self._last_heartbeat >= HEARTBEAT_INTERVAL:
                    self._send_heartbeat()
                
                # Connect to iRacing if needed
                if not telemetry.is_connected():
                    if self.controls.iracing_window_exists():
                        self.controls.focus_iracing()
                        time.sleep(0.2)
                    telemetry.connect()
                
                # Process telemetry
                if telemetry.is_connected():
                    data = telemetry.get_current()
                    if data:
                        self._process_telemetry(data)
                
                time.sleep(0.1)
            except Exception as e:
                print(f"[WARN] Telemetry loop error: {e}")
                time.sleep(1)
    
    def _command_loop(self):
        """Background command polling loop."""
        while self.running and self.api_connected:
            try:
                commands = self.api.get_commands()
                for cmd in commands:
                    result = self._handle_command(cmd)
                    self.api.complete_command(
                        cmd["id"],
                        status="completed" if result.get("success") else "failed",
                        result=result
                    )
            except APIError as e:
                print(f"[WARN] Command poll error: {e}")
            except Exception as e:
                print(f"[WARN] Command error: {e}")
            
            time.sleep(COMMAND_POLL_INTERVAL)
    
    def _handle_command(self, cmd: Dict) -> Dict:
        """Handle a command from the API."""
        action = cmd.get("command_action")
        params = cmd.get("command_params", {})
        
        if action == "reset_car":
            return self.reset_car()
        elif action in ["ignition", "starter", "enter_car", "pit_speed_limiter"]:
            return self.execute_action(action)
        
        return {"success": False, "message": f"Unknown action: {action}"}
    
    def _send_heartbeat(self):
        """Send heartbeat to API."""
        if not self.api_connected:
            return
        try:
            self.api.heartbeat()
            self._last_heartbeat = time.time()
        except APIError as e:
            print(f"[WARN] Heartbeat failed: {e}")
    
    def _on_telemetry(self, data: Dict):
        """Telemetry callback from iRacing."""
        self._process_telemetry(data)
    
    def _process_telemetry(self, data: Dict):
        """Process telemetry data for lap recording."""
        # Session change detection
        session_id = data.get("session_unique_id")
        if session_id and session_id != self._last_session_id:
            self._last_session_id = session_id
            self._last_lap = 0
            self._pending_lap = None
        
        lap = data.get("lap", 0)
        if lap <= 1:
            self._last_lap = lap
            return
        
        # Detect lap completion
        if lap > self._last_lap and self._last_lap > 0:
            self._pending_lap = (self._last_lap, time.time())
        self._last_lap = lap
        
        # Process pending lap
        if self._pending_lap:
            lap_num, timestamp = self._pending_lap
            lap_time = data.get("lap_last_time", 0)
            
            if lap_time and lap_time > 0:
                self._pending_lap = None
                self._record_lap(lap_num, lap_time, data)
    
    def _record_lap(self, lap_num: int, lap_time: float, data: Dict):
        """Record a lap to the API."""
        if not self.api_connected:
            return
        
        try:
            self.api.upload_lap(
                lap_time=lap_time,
                track=data.get("track_name", "Unknown"),
                car=data.get("car_name", "Unknown"),
                lap_number=lap_num,
                driver_name=data.get("driver_name"),
            )
            self.laps_recorded += 1
            print(f"[OK] Lap {lap_num}: {lap_time:.3f}s")
            
            if self.on_lap_recorded:
                self.on_lap_recorded(lap_num, lap_time)
        except APIError as e:
            print(f"[WARN] Lap upload failed: {e}")
    
    def _update_api_status(self, data: Dict):
        """Update status on API."""
        if not self.api_connected:
            return
        
        try:
            in_car = data.get("is_on_track_car", False)
            self.api.update_status(
                status="online" if in_car else "idle",
                car=data.get("car_name"),
                track=data.get("track_name"),
            )
        except APIError:
            pass


# Singleton
_service: Optional[CommanderService] = None

def get_service() -> CommanderService:
    global _service
    if _service is None:
        _service = CommanderService()
    return _service

