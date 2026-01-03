"""
iRCommander Service
Main service orchestrating telemetry, Supabase, and controls.
"""

import time
import threading
import subprocess
import sys
import importlib
from typing import Dict, Optional, Callable

from config import HEARTBEAT_INTERVAL, COMMAND_POLL_INTERVAL
from supabase_client import IRCommanderSupabaseClient, get_client, SupabaseError
from core import device, telemetry, controls, joystick_config, joystick_monitor


def _check_webrtc_dependencies():
    """Check if WebRTC dependencies are installed."""
    try:
        import aiortc
        import cv2
        import mss
        import numpy
        import aiohttp
        import pyautogui  # For input simulation
        return True
    except ImportError:
        return False


def _install_webrtc_dependencies():
    """Attempt to install WebRTC dependencies if missing."""
    dependencies = [
        "aiortc>=1.6.0",
        "opencv-python>=4.8.0",
        "mss>=9.0.0",
        "numpy>=1.24.0",
        "aiohttp>=3.9.0",
        "pyautogui>=0.9.54",
    ]
    
    print("[INFO] WebRTC dependencies not found. Installing...")
    try:
        # Install all dependencies at once for better error handling
        print(f"[INFO] Installing: {' '.join(dependencies)}")
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install"] + dependencies,
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
        )
        
        if result.returncode == 0:
            print("[OK] WebRTC dependencies installed successfully")
            return True
        else:
            print(f"[WARN] Installation had issues. Output: {result.stderr}")
            # Still try to continue - maybe some were installed
            return _check_webrtc_dependencies()
            
    except subprocess.TimeoutExpired:
        print("[WARN] Installation timed out")
        return False
    except Exception as e:
        print(f"[WARN] Error installing WebRTC dependencies: {e}")
        print("[INFO] Remote desktop will be unavailable. Install manually with:")
        print(f"  pip install {' '.join(dependencies)}")
        return False


# Remote desktop (optional)
# Check dependencies first, install if needed, then import
REMOTE_DESKTOP_AVAILABLE = False
remote_desktop = None

# Check if dependencies are installed
if not _check_webrtc_dependencies():
    # Try to install them
    if _install_webrtc_dependencies():
        # Verify installation worked
        if not _check_webrtc_dependencies():
            print("[WARN] Dependencies installed but still not importable. Remote desktop disabled.")
        else:
            print("[OK] WebRTC dependencies verified")
    else:
        print("[WARN] Could not install WebRTC dependencies. Remote desktop disabled.")

# Now try to import the module
if _check_webrtc_dependencies():
    try:
        # Import or reload the module (reload if it was already imported without deps)
        module_name = 'core.remote_desktop'
        if module_name in sys.modules:
            # Module was already imported, reload it to pick up newly installed deps
            importlib.reload(sys.modules[module_name])
        
        from core import remote_desktop
        REMOTE_DESKTOP_AVAILABLE = True
        print("[OK] Remote desktop module loaded")
    except Exception as e:
        print(f"[WARN] Failed to load remote desktop module: {e}")
        REMOTE_DESKTOP_AVAILABLE = False
        remote_desktop = None
else:
    print("[INFO] Remote desktop unavailable (dependencies not installed)")


class IRCommanderService:
    """Main service coordinating all components."""
    
    def __init__(self):
        self.running = False
        self.client: IRCommanderSupabaseClient = get_client()
        self.controls = controls.get_manager()
        self.joystick_config = joystick_config.get_config()
        self.joystick_monitor = None
        
        # State
        self.device_id: Optional[str] = None
        self.hardware_fingerprint: str = device.get_fingerprint()
        self.connected = False
        self._auth_failure_count = 0
        self._max_auth_failures = 3
        
        # Lap tracking
        self.laps_recorded = 0
        self._last_lap = 0
        self._last_session_id = None
        self._pending_lap = None
        
        # Threads
        self._telemetry_thread: Optional[threading.Thread] = None
        self._command_thread: Optional[threading.Thread] = None
        self._last_heartbeat = 0
        
        # Remote desktop
        self.remote_desktop_server = None
        if REMOTE_DESKTOP_AVAILABLE:
            try:
                self.remote_desktop_server = remote_desktop.initialize_remote_desktop(
                    on_connection_state_change=self._on_remote_desktop_state_change
                )
            except Exception as e:
                print(f"[WARN] Remote desktop initialization failed: {e}")
        
        # Callbacks
        self.on_lap_recorded: Optional[Callable] = None
        self.on_status_change: Optional[Callable] = None
        
        self._setup_device()
    
    def _setup_device(self):
        """Check if device is registered."""
        if self.client.is_registered:
            self.device_id = self.client.device_id
            self.connected = True
            # Try to get device name from database
            try:
                device_info = self.client.get_status()
                self.device_name = device_info.get("name") or device.get_hostname()
            except Exception:
                self.device_name = device.get_hostname()
            print(f"[OK] Device registered: {self.device_id} ({self.device_name})")
        elif self.client.is_logged_in:
            # Auto-register if logged in (with or without tenant)
            # Force new registration if no existing config (fresh start)
            print("[INFO] User logged in, attempting device registration...")
            self.register_device(force_new=True)
        else:
            print("[INFO] Not registered - please login to register device")
    
    def register_device(self, force_new: bool = False):
        """Register device directly with Supabase.
        
        Args:
            force_new: If True, forces registration as a new device (new device_id)
        """
        if not self.client.is_logged_in:
            print("[WARN] Must be logged in to register device")
            return False
        
        try:
            tenant_id = self.client.user.tenant_id if self.client.user else None
            result = self.client.register_device(
                hardware_id=self.hardware_fingerprint,
                name=device.get_hostname(),
                tenant_id=tenant_id,
                force_new=force_new
            )
            self.device_id = result.device_id
            self.device_name = result.name or device.get_hostname()
            self.connected = True
            print(f"[OK] Registered device: {self.device_id} ({self.device_name})")
            
            # Start command polling if not already running
            if self.running and not self._command_thread:
                import threading
                self._command_thread = threading.Thread(target=self._command_loop, daemon=True)
                self._command_thread.start()
            
            return True
        except SupabaseError as e:
            print(f"[WARN] Registration failed: {e}")
            return False
    
    def start(self):
        """Start the service."""
        if self.running:
            return
        
        self.running = True
        
        # Load controls
        self.controls.load_bindings(force=True)
        
        # Setup joystick monitor
        self._setup_joystick_monitor()
        
        # Send initial heartbeat
        self._send_heartbeat()
        
        # Start telemetry
        telemetry.add_callback(self._on_telemetry)
        self._telemetry_thread = threading.Thread(target=self._telemetry_loop, daemon=True)
        self._telemetry_thread.start()
        
        # Start command polling
        if self.connected:
            self._command_thread = threading.Thread(target=self._command_loop, daemon=True)
            self._command_thread.start()
        
        # Start remote desktop server
        if self.remote_desktop_server:
            try:
                self.remote_desktop_server.start()
                print("[OK] Remote desktop server started")
            except Exception as e:
                print(f"[WARN] Failed to start remote desktop: {e}")
        
        print("[OK] iRCommander service started")
    
    def stop(self):
        """Stop the service."""
        self.running = False
        if self.joystick_monitor:
            self.joystick_monitor.stop()
        if self._telemetry_thread:
            self._telemetry_thread.join(timeout=2)
        if self._command_thread:
            self._command_thread.join(timeout=2)
        if self.remote_desktop_server:
            try:
                self.remote_desktop_server.stop()
            except Exception as e:
                print(f"[WARN] Error stopping remote desktop: {e}")
        self.client.close()
        print("[OK] iRCommander service stopped")
    
    def _setup_joystick_monitor(self):
        """Setup joystick monitoring."""
        try:
            self.joystick_monitor = joystick_monitor.get_monitor(
                controls_manager=self.controls,
                joystick_config=self.joystick_config,
                action_check_callback=self._check_action_allowed
            )
            if self.joystick_monitor:
                self.joystick_monitor.set_enabled(True)
        except Exception as e:
            print(f"[WARN] Failed to setup joystick monitor: {e}")
            self.joystick_monitor = None
    
    def _check_action_allowed(self, action: str) -> bool:
        """Check if an action is allowed (can be extended for payment/credits checks)."""
        # For now, always allow
        # TODO: Add timed session, credit, payment checks here
        return True
    
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
            "supabase": {
                "connected": self.connected,
                "device_id": self.device_id or "Not registered",
                "device_name": self.device_name or "N/A",
                "name": self.device_name or "N/A",  # Also include as 'name' for compatibility
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
                    # Don't focus here - focus only happens before sending key commands
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
        while self.running and self.connected:
            try:
                commands = self.client.get_commands()
                for cmd in commands:
                    result = self._handle_command(cmd)
                    self.client.complete_command(
                        cmd["id"],
                        status="completed" if result.get("success") else "failed",
                        result=result
                    )
            except SupabaseError as e:
                # Check if it's an auth error
                if "not found" in str(e).lower() or "invalid" in str(e).lower():
                    self._auth_failure_count += 1
                    if self._auth_failure_count >= self._max_auth_failures:
                        print(f"[ERROR] Command poll authentication failed. API key may be invalid.")
                else:
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
        elif action == "webrtc_offer":
            return self._handle_webrtc_offer(params)
        elif action == "remote_desktop_input":
            return self._handle_remote_desktop_input(params)
        
        return {"success": False, "message": f"Unknown action: {action}"}
    
    def _handle_webrtc_offer(self, params: Dict) -> Dict:
        """Handle WebRTC offer from web client."""
        if not self.remote_desktop_server:
            return {
                "success": False,
                "message": "Remote desktop not available. WebRTC dependencies may be missing."
            }
        
        offer_sdp = params.get("offer")
        if not offer_sdp:
            return {"success": False, "message": "Missing offer SDP"}
        
        try:
            # Run async function in the event loop
            import asyncio
            loop = self.remote_desktop_server._loop
            if loop and loop.is_running():
                # Schedule coroutine in the running loop
                future = asyncio.run_coroutine_threadsafe(
                    self.remote_desktop_server.handle_offer(offer_sdp),
                    loop
                )
                answer_sdp = future.result(timeout=10)
            else:
                # Fallback: run in new event loop
                answer_sdp = asyncio.run(self.remote_desktop_server.handle_offer(offer_sdp))
            
            return {
                "success": True,
                "answer": answer_sdp,
                "session_id": params.get("session_id")
            }
        except Exception as e:
            print(f"[ERROR] WebRTC offer handling failed: {e}", exc_info=True)
            return {
                "success": False,
                "message": f"WebRTC error: {str(e)}"
            }
    
    def _handle_remote_desktop_input(self, params: Dict) -> Dict:
        """Handle remote desktop input events (mouse/keyboard)."""
        if not self.remote_desktop_server:
            return {"success": False, "message": "Remote desktop not available"}
        
        try:
            input_type = params.get("input_type")
            if not input_type:
                return {"success": False, "message": "Missing input_type"}
            
            # Forward to remote desktop server
            if hasattr(self.remote_desktop_server, 'handle_input'):
                result = self.remote_desktop_server.handle_input(params)
                return result
            else:
                # Fallback: handle directly
                return self._simulate_input(params)
        except Exception as e:
            print(f"[ERROR] Remote desktop input handling failed: {e}", exc_info=True)
            return {
                "success": False,
                "message": f"Input error: {str(e)}"
            }
    
    def _simulate_input(self, params: Dict) -> Dict:
        """Simulate input events using pyautogui."""
        try:
            import pyautogui
            input_type = params.get("input_type")
            
            if input_type == "mousedown" or input_type == "mouseup":
                x = int(params.get("x", 0))
                y = int(params.get("y", 0))
                button = params.get("button", 0)  # 0=left, 1=middle, 2=right
                
                if input_type == "mousedown":
                    if button == 0:
                        pyautogui.mouseDown(x, y, button='left')
                    elif button == 1:
                        pyautogui.mouseDown(x, y, button='middle')
                    elif button == 2:
                        pyautogui.mouseDown(x, y, button='right')
                else:  # mouseup
                    if button == 0:
                        pyautogui.mouseUp(x, y, button='left')
                    elif button == 1:
                        pyautogui.mouseUp(x, y, button='middle')
                    elif button == 2:
                        pyautogui.mouseUp(x, y, button='right')
            
            elif input_type == "mousemove":
                x = int(params.get("x", 0))
                y = int(params.get("y", 0))
                buttons = params.get("buttons", 0)
                if buttons > 0:
                    pyautogui.dragTo(x, y, duration=0.01)
                else:
                    pyautogui.moveTo(x, y, duration=0.01)
            
            elif input_type == "wheel":
                x = int(params.get("x", 0))
                y = int(params.get("y", 0))
                deltaY = params.get("deltaY", 0)
                # Scroll amount (positive = scroll up, negative = scroll down)
                scroll_amount = int(deltaY / 100)  # Normalize scroll delta
                pyautogui.scroll(scroll_amount, x=x, y=y)
            
            elif input_type == "keydown":
                key = params.get("key")
                if key:
                    # Handle special keys
                    key_map = {
                        "Enter": "enter",
                        "Backspace": "backspace",
                        "Tab": "tab",
                        "Escape": "esc",
                        "ArrowUp": "up",
                        "ArrowDown": "down",
                        "ArrowLeft": "left",
                        "ArrowRight": "right",
                        "Delete": "delete",
                        "Home": "home",
                        "End": "end",
                        "PageUp": "pageup",
                        "PageDown": "pagedown",
                    }
                    pyautogui_key = key_map.get(key, key.lower())
                    pyautogui.keyDown(pyautogui_key)
            
            elif input_type == "keyup":
                key = params.get("key")
                if key:
                    key_map = {
                        "Enter": "enter",
                        "Backspace": "backspace",
                        "Tab": "tab",
                        "Escape": "esc",
                        "ArrowUp": "up",
                        "ArrowDown": "down",
                        "ArrowLeft": "left",
                        "ArrowRight": "right",
                        "Delete": "delete",
                        "Home": "home",
                        "End": "end",
                        "PageUp": "pageup",
                        "PageDown": "pagedown",
                    }
                    pyautogui_key = key_map.get(key, key.lower())
                    pyautogui.keyUp(pyautogui_key)
            
            return {"success": True}
        except ImportError:
            return {"success": False, "message": "pyautogui not installed"}
        except Exception as e:
            print(f"[ERROR] Input simulation failed: {e}", exc_info=True)
            return {"success": False, "message": str(e)}
    
    def _send_heartbeat(self):
        """Send heartbeat to Supabase."""
        if not self.connected:
            return
        try:
            self.client.heartbeat()
            self._last_heartbeat = time.time()
            self._auth_failure_count = 0  # Reset on success
        except SupabaseError as e:
            self._auth_failure_count += 1
            if self._auth_failure_count >= self._max_auth_failures:
                print(f"[ERROR] Multiple authentication failures. API key may be invalid.")
                print(f"[INFO] Attempting to re-register device...")
                # Clear the invalid API key
                self.client.api_key = None
                self.client.device_id = None
                self.connected = False
                self._auth_failure_count = 0
                
                # Try to re-register if logged in
                if self.client.is_logged_in:
                    if self.register_device():
                        print(f"[OK] Device re-registered successfully")
                    else:
                        print(f"[ERROR] Re-registration failed. Please delete device_config.json and restart.")
                else:
                    print(f"[ERROR] Not logged in. Please login to re-register device.")
            else:
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
        """Record a lap directly to Supabase."""
        if not self.connected:
            return
        
        try:
            self.client.upload_lap(
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
        except SupabaseError as e:
            print(f"[WARN] Lap upload failed: {e}")
    
    def _update_api_status(self, data: Dict):
        """Update status on Supabase."""
        if not self.connected:
            return
        
        try:
            in_car = data.get("is_on_track_car", False)
            self.client.update_status(
                status="online" if in_car else "idle",
                car=data.get("car_name"),
                track=data.get("track_name"),
            )
        except SupabaseError:
            pass
    
    def _on_remote_desktop_state_change(self, state: str):
        """Handle remote desktop connection state change."""
        print(f"[INFO] Remote desktop connection state: {state}")
    
    def get_remote_desktop_stats(self) -> Dict:
        """Get remote desktop statistics."""
        if self.remote_desktop_server:
            return self.remote_desktop_server.get_stats()
        return {"available": False}


# Singleton
_service: Optional[IRCommanderService] = None

def get_service() -> IRCommanderService:
    global _service
    if _service is None:
        _service = IRCommanderService()
    return _service

