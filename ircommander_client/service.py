"""
iRCommander Service
Main service orchestrating telemetry, Supabase, and controls.
"""

import time
import threading
import subprocess
import sys
import importlib
import os
from datetime import datetime, timedelta
from typing import Dict, Optional, Callable, List

from config import HEARTBEAT_INTERVAL, COMMAND_POLL_INTERVAL, VERSION, SUPABASE_URL
from supabase_client import IRCommanderSupabaseClient, get_client, SupabaseError
from api_client import IRCommanderAPI, get_api
from core import device, telemetry, controls, joystick_config, joystick_monitor, network_discovery


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


# Updater (optional)
UPDATER_AVAILABLE = False
updater = None

try:
    from core import updater
    UPDATER_AVAILABLE = True
except ImportError as e:
    print(f"[INFO] Updater module not available: {e}")
    UPDATER_AVAILABLE = False
    updater = None
except Exception as e:
    print(f"[WARN] Failed to load updater module: {e}")
    UPDATER_AVAILABLE = False
    updater = None


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
        self.device_name: Optional[str] = None
        self.hardware_fingerprint: str = device.get_fingerprint()
        self.connected = False
        self._auth_failure_count = 0
        self._max_auth_failures = 3
        
        # Lap tracking
        self.laps_recorded = 0
        self._last_lap = 0
        self._last_session_id = None
        self._pending_lap = None
        self._recorded_lap_numbers = set()  # Track lap numbers to prevent duplicates (lap_time can change)
        
        # Timed session state tracking
        self._timed_session_lap_at_complete = None  # Lap number when timer expired (to wait for next lap completion)
        self._timed_session_start_lap = None  # Lap number when racing started (to detect lap completion)
        self._timed_session_last_lap = None  # Last lap number seen (to detect lap changes)
        
        # Threads
        self._telemetry_thread: Optional[threading.Thread] = None
        self._command_thread: Optional[threading.Thread] = None
        self._last_heartbeat = 0
        
        # Updater
        self.updater = None
        self._pending_update = None
        self._last_update_check = 0
        self._update_check_interval = 3600  # Check for updates every hour
        if UPDATER_AVAILABLE and updater:
            try:
                self.updater = updater.get_updater(VERSION, supabase_url=SUPABASE_URL)
            except Exception as e:
                print(f"[WARN] Failed to initialize updater: {e}")
        
        # Remote desktop
        self.remote_desktop_server = None
        if REMOTE_DESKTOP_AVAILABLE:
            try:
                self.remote_desktop_server = remote_desktop.initialize_remote_desktop(
                    on_connection_state_change=self._on_remote_desktop_state_change
                )
            except Exception as e:
                print(f"[WARN] Remote desktop initialization failed: {e}")
        
        # Network discovery
        self.network_discovery = None
        try:
            self.network_discovery = network_discovery.get_discovery(
                device_id=None,  # Will be set after device registration
                device_name=None,  # Will be set after device registration
                version=VERSION,
                on_peer_discovered=self._on_peer_discovered,
                on_peer_lost=self._on_peer_lost
            )
        except Exception as e:
            print(f"[WARN] Network discovery initialization failed: {e}")
        
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
            
            # Update network discovery with device info
            if self.network_discovery:
                self.network_discovery.device_id = self.device_id
                self.network_discovery.device_name = self.device_name
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
            
            # Update network discovery with device info
            if self.network_discovery:
                self.network_discovery.device_id = self.device_id
                self.network_discovery.device_name = self.device_name
            
            # Clear any pending commands from before registration (ignore old commands)
            try:
                cleared_count = self.client.clear_pending_commands()
                if cleared_count > 0:
                    print(f"[INFO] Cleared {cleared_count} pending command(s) from before registration")
            except Exception as e:
                print(f"[WARN] Failed to clear pending commands: {e}")
            
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
        
        # Clear any pending commands from before startup (ignore old commands)
        if self.connected:
            try:
                cleared_count = self.client.clear_pending_commands()
                if cleared_count > 0:
                    print(f"[INFO] Cleared {cleared_count} pending command(s) from before startup")
            except Exception as e:
                print(f"[WARN] Failed to clear pending commands: {e}")
        
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
        
        # Start network discovery
        if self.network_discovery:
            try:
                self.network_discovery.start()
            except Exception as e:
                print(f"[WARN] Failed to start network discovery: {e}")
        
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
        if self.network_discovery:
            try:
                self.network_discovery.stop()
            except Exception as e:
                print(f"[WARN] Error stopping network discovery: {e}")
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
        """Get current service status with full state information."""
        telem = telemetry.get_current()
        on_pit_road = telem.get("on_pit_road", False)
        in_garage = telem.get("in_garage", False)
        in_pits = on_pit_road or in_garage
        on_track = telem.get("is_on_track", False)
        speed_kph = telem.get("speed_kph", 0)
        is_moving = speed_kph > 1.5  # Consider moving if speed > 1.5 km/h
        
        # Determine if actually in car
        # IsOnTrackCar can be True even when driver is out of car
        # We need to check multiple indicators:
        # - InGarage: If True, definitely out of car
        # - IsOnTrack: If False, likely in menu/garage (out of car)
        # - IsOnTrackCar: Only trust if IsOnTrack is also True
        is_on_track_car = telem.get("is_on_track_car", False)
        is_on_track = telem.get("is_on_track", False)
        
        # If in garage, definitely out of car
        if in_garage:
            in_car = False
        # If not on track at all, likely in menu/garage (out of car)
        elif not is_on_track:
            in_car = False
        # If IsOnTrackCar is False, definitely out of car
        elif not is_on_track_car:
            in_car = False
        # Only consider in car if BOTH IsOnTrack and IsOnTrackCar are True
        else:
            in_car = is_on_track and is_on_track_car
        
        return {
            "iracing": {
                "connected": telemetry.is_connected(),
                "lap": telem.get("lap", 0),
                "speed_kph": speed_kph,
                "track": telem.get("track_name", "N/A"),
                "car": telem.get("car_name", "N/A"),
                "in_car": in_car,
                "in_pits": in_pits,
                "on_pit_road": on_pit_road,
                "in_garage": in_garage,
                "on_track": on_track,
                "is_moving": is_moving,
                # Note: Ignition and pit limiter states are not directly available from iRacing SDK
                # They would need to be tracked separately if needed
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
        """Execute reset car sequence based on current car state.
        
        Checks state after each action and proceeds accordingly.
        """
        def get_state():
            """Get current car state."""
            telem = telemetry.get_current()
            return {
                'in_car': telem.get("is_on_track_car", False),
                'in_pits': telem.get("on_pit_road", False) or telem.get("in_garage", False),
                'speed': telem.get("speed_kph", 0)
            }
        
        # Get initial state
        state = get_state()
        
        # If OUT of car: Already reset - just ensure we're in pits and stay out
        if not state['in_car']:
            if not state['in_pits']:
                # Out of car but not in pits - reset to pits (but stay out of car)
                print("[INFO] Out of car but not in pits - resetting to pits...")
                result = self.controls.execute_action("reset_car", hold_until_state_change=True)
                time.sleep(0.5)
                state = get_state()
                if state['in_pits']:
                    result["message"] = "Reset to pits (staying out of car)"
                    result["success"] = True
                else:
                    result["message"] = "Reset to pits may still be in progress"
            else:
                # Already out of car and in pits - perfect, nothing to do
                result = {"success": True, "message": "Already out of car in pits"}
            return result
        
        # If IN car and already IN pits: Just exit car
        if state['in_car'] and state['in_pits']:
            print("[INFO] In car and in pits - exiting car...")
            result = self.controls.execute_action("reset_car", hold_until_state_change=True)
            time.sleep(0.5)
            
            # Check state after exit
            state = get_state()
            if not state['in_car']:
                result["message"] = "Exited car"
                result["success"] = True
            else:
                result["message"] = "Exit car may still be in progress"
            return result
        
        # If IN car but NOT in pits: Reset to pits first
        print("[INFO] In car but not in pits - resetting to pits...")
        
        # Turn off ignition and wait for stop
        ignition = self.controls.bindings.get("ignition", {}).get("combo")
        if ignition:
            self.controls.execute_combo(ignition)
            time.sleep(0.3)
        
        # Wait for car to stop
        for _ in range(30):
            state = get_state()
            if state['speed'] <= 1.5:
                break
            time.sleep(0.2)
        
        # Reset to pits
        result = self.controls.execute_action("reset_car", hold_until_state_change=True)
        time.sleep(0.5)
        
        # Check state after reset
        state = get_state()
        
        # Turn off ignition after reset (in case it turned on)
        if ignition:
            self.controls.execute_combo(ignition)
            time.sleep(0.2)
        
        # If we're now in pits and still in car, exit car
        if state['in_pits'] and state['in_car']:
            print("[INFO] Now in pits - exiting car...")
            result2 = self.controls.execute_action("reset_car", hold_until_state_change=True)
            time.sleep(0.5)
            
            # Check final state
            state = get_state()
            if not state['in_car']:
                result["message"] = "Car reset to pits and exited car"
                result["success"] = True
            else:
                result["message"] = "Car reset to pits, exit may still be in progress"
        elif state['in_pits']:
            result["message"] = "Car reset to pits (already out of car)"
        else:
            result["message"] = f"Reset to pits: {result.get('message', 'OK')} (current: in_pits={state['in_pits']}, in_car={state['in_car']})"
        
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
                
                # Telemetry processing is handled via callback (_on_telemetry)
                # No need to process here - callback handles it
                if telemetry.is_connected():
                    # Update network discovery with iRacing status
                    if self.network_discovery:
                        self.network_discovery.set_iracing_status(True)
                    
                    # Check and update timed session state
                    if self.connected:
                        self._check_timed_session()
                else:
                    # Update network discovery - iRacing not connected
                    if self.network_discovery:
                        self.network_discovery.set_iracing_status(False)
                
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
                    action = cmd.get("command_action", "unknown")
                    print(f"[COMMAND] Received: {action} (ID: {cmd.get('id', 'unknown')})")
                    result = self._handle_command(cmd)
                    if result.get("success"):
                        print(f"[COMMAND] Success: {action}")
                    else:
                        print(f"[COMMAND] Failed: {action} - {result.get('message', 'Unknown error')}")
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
        
        # Check if iRacing window exists for actions that require it
        if action in ["reset_car", "ignition", "starter", "enter_car", "pit_speed_limiter"]:
            if not self.controls.iracing_window_exists():
                return {
                    "success": False,
                    "message": "iRacing is not running. Please start iRacing before sending commands."
                }
        
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
            import traceback
            print(f"[ERROR] WebRTC offer handling failed: {e}")
            traceback.print_exc()
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
            import traceback
            print(f"[ERROR] Remote desktop input handling failed: {e}")
            traceback.print_exc()
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
            import traceback
            print(f"[ERROR] Input simulation failed: {e}")
            traceback.print_exc()
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
            self._recorded_lap_numbers = set()  # Reset recorded laps for new session
        
        lap = data.get("lap", 0)
        lap_time = data.get("lap_last_time", 0)
        
        # Skip if no valid lap data
        if lap <= 0:
            return
        
        # When lap_last_time becomes available, record the previous lap
        # lap_last_time contains the time for the last completed lap
        # So when we're on lap N, lap_last_time is the time for lap N-1
        if lap_time and lap_time > 0:
            # Validate lap time - iRacing uses very large values (like 999999.0) for invalid laps
            # Also check for reasonable lap times (not negative, not zero, not extremely large)
            # Typical valid lap times are between 5 seconds and 10 minutes (600 seconds)
            # Values >= 1000 are almost certainly invalid (iRacing uses 999999.0 for invalid)
            MAX_VALID_LAP_TIME = 600.0  # 10 minutes max (reasonable for any track)
            MIN_VALID_LAP_TIME = 5.0    # 5 seconds min (very fast but possible on short tracks like Bristol)
            
            if lap_time < MIN_VALID_LAP_TIME or lap_time >= 1000.0:
                # Invalid lap time - skip recording (iRacing uses 999999.0 for invalid laps)
                if lap_time >= 1000.0:
                    print(f"[INFO] Skipping invalid lap {lap - 1}: lap_time={lap_time:.3f}s (invalid marker)")
                return
            
            # Calculate which lap this time belongs to
            # If we're on lap 2, lap_last_time is for lap 1
            # If we're on lap 3, lap_last_time is for lap 2, etc.
            completed_lap_num = lap - 1
            
            # Only record if:
            # 1. It's a valid lap number (>= 1, skip out lap)
            # 2. We haven't already recorded this lap number (lap_time can change, so track by lap_num only)
            # 3. We've actually progressed past this lap (lap > completed_lap_num is always true, but check we're not on first lap)
            if completed_lap_num >= 1:
                # Track by lap number only - lap_time can update/change, so we don't want to record the same lap twice
                if completed_lap_num not in self._recorded_lap_numbers:
                    # Check if we've moved past this lap (current lap should be > completed_lap_num)
                    if lap > completed_lap_num:
                        self._record_lap(completed_lap_num, lap_time, data)
                        self._recorded_lap_numbers.add(completed_lap_num)
        
        # Update last lap tracking
        self._last_lap = lap
    
    def _record_lap(self, lap_num: int, lap_time: float, data: Dict):
        """Record a lap directly to Supabase."""
        if not self.connected:
            print(f"[WARN] Cannot upload lap {lap_num}: device not connected/registered")
            return
        
        track = data.get("track_name", "Unknown")
        car = data.get("car_name", "Unknown")
        driver = data.get("driver_name")
        
        try:
            print(f"[INFO] Uploading lap {lap_num}: {lap_time:.3f}s @ {track} in {car}")
            result = self.client.upload_lap(
                lap_time=lap_time,
                track=track,
                car=car,
                lap_number=lap_num,
                driver_name=driver,
            )
            
            # Only increment counter if it's not a duplicate
            if not result.get("duplicate", False):
                self.laps_recorded += 1
                print(f"[OK] Lap {lap_num}: {lap_time:.3f}s uploaded successfully")
            else:
                print(f"[OK] Lap {lap_num}: {lap_time:.3f}s already exists (duplicate skipped)")
            
            if self.on_lap_recorded:
                self.on_lap_recorded(lap_num, lap_time)
        except SupabaseError as e:
            print(f"[ERROR] Lap upload failed for lap {lap_num}: {e}")
            print(f"[ERROR]   Track: {track}, Car: {car}, Time: {lap_time:.3f}s")
            import traceback
            traceback.print_exc()
        except Exception as e:
            print(f"[ERROR] Unexpected error uploading lap {lap_num}: {e}")
            import traceback
            traceback.print_exc()
    
    def _check_timed_session(self):
        """Check and update timed session state based on telemetry. Client manages the full state machine."""
        if not self.connected or not self.device_id:
            return
        
        try:
            # Get current timed session state from database
            device_info = self.client._get_device_by_api_key()
            if not device_info:
                return
            
            session_state = device_info.get("timed_session_state")
            if not session_state or not session_state.get("active"):
                # Reset local state if session is no longer active
                self._timed_session_lap_at_complete = None
                self._timed_session_start_lap = None
                self._timed_session_last_lap = None
                return
            
            # Get current telemetry
            telem = telemetry.get_current()
            speed_kph = telem.get("speed_kph", 0)
            is_moving = speed_kph > 1.5  # Consider moving if speed > 1.5 km/h
            in_car = telem.get("is_on_track_car", False) and telem.get("is_on_track", False)
            on_pit_road = telem.get("on_pit_road", False)
            in_garage = telem.get("in_garage", False)
            current_lap = telem.get("lap", 0)
            current_state = session_state.get("state", "")
            timer_started = session_state.get("timer_started_at") is not None
            timer_expires_at = session_state.get("timer_expires_at")
            duration_seconds = session_state.get("duration_seconds", 60)
            
            now = datetime.utcnow()
            now_iso = now.isoformat() + "Z"
            updates = {}
            
            # State machine for timed session
            if current_state == "entering_car":
                # Wait until in car
                if in_car:
                    updates["state"] = "waiting_for_movement"
                    print("[TIMED_SESSION] Entered car, waiting for movement...")
            
            elif current_state == "waiting_for_movement":
                # Detect movement and start timer
                if is_moving and not timer_started:
                    # Try to calculate smarter duration based on average lap time
                    calculated_duration = duration_seconds
                    avg_lap_time = None
                    laps_target = None
                    if track_name and car_name:
                        avg_lap_time = self.client.get_average_lap_time(track_name, car_name)
                        if avg_lap_time:
                            # Calculate duration to allow roughly 2-3 laps based on average
                            # Use the requested duration as a minimum, but extend if average lap time suggests more time needed
                            laps_target = max(2, int(duration_seconds / max(avg_lap_time, 30)))  # At least 2 laps
                            calculated_duration = max(duration_seconds, laps_target * avg_lap_time * 1.2)  # 20% buffer
                            print(f"[TIMED_SESSION] Average lap time for {car_name} at {track_name}: {avg_lap_time:.2f}s")
                            print(f"[TIMED_SESSION] Adjusted duration: {calculated_duration:.0f}s (target: ~{laps_target} laps)")
                    
                    expires_dt = now.replace(microsecond=0) + timedelta(seconds=calculated_duration)
                    expires_iso = expires_dt.isoformat() + "Z"
                    updates["state"] = "racing"
                    updates["timer_started_at"] = now_iso
                    updates["timer_expires_at"] = expires_iso
                    # Store average lap time info if available
                    if track_name and car_name and avg_lap_time:
                        updates["average_lap_time"] = avg_lap_time
                        updates["track_name"] = track_name
                        updates["car_name"] = car_name
                        updates["calculated_duration"] = calculated_duration
                        updates["laps_target"] = laps_target
                    self._timed_session_start_lap = current_lap
                    self._timed_session_last_lap = current_lap
                    print(f"[TIMED_SESSION] Movement detected! Timer started. Duration: {calculated_duration:.0f}s")
            
            elif current_state == "racing":
                # Track lap changes
                if self._timed_session_last_lap is not None and current_lap > self._timed_session_last_lap:
                    # Lap completed!
                    print(f"[TIMED_SESSION] Lap {self._timed_session_last_lap} completed! Current lap: {current_lap}")
                    self._timed_session_last_lap = current_lap
                
                # Check if timer expired
                timer_expired = False
                if timer_expires_at:
                    try:
                        # Parse ISO timestamp
                        expires_str = timer_expires_at.replace("Z", "")
                        if "." in expires_str:
                            expires_dt = datetime.fromisoformat(expires_str)
                        else:
                            expires_dt = datetime.fromisoformat(expires_str + ".000")
                        if now >= expires_dt:
                            timer_expired = True
                            # Timer expired - wait for current lap to complete
                            updates["state"] = "completing_lap"
                            self._timed_session_lap_at_complete = current_lap  # Track which lap we're on
                            print(f"[TIMED_SESSION] Timer expired! Waiting for lap {current_lap} to complete...")
                    except Exception as e:
                        print(f"[WARN] Error parsing timer_expires_at: {e}")
                
                # Update last lap seen
                if self._timed_session_last_lap is None:
                    self._timed_session_last_lap = current_lap
            
            elif current_state == "completing_lap":
                # Wait for lap to complete OR car to stop (after timer expired, both are valid end conditions)
                if self._timed_session_lap_at_complete is not None:
                    # Check if lap completed
                    if current_lap > self._timed_session_lap_at_complete:
                        # Lap completed, move to stopping
                        updates["state"] = "stopping"
                        self._timed_session_lap_at_complete = None
                        print("[TIMED_SESSION] Lap completed. Stopping car...")
                        # Turn off ignition
                        self.execute_action("ignition")
                    # OR check if car stopped (valid end condition after timer expired)
                    elif not is_moving and speed_kph < 1.0:
                        # Car stopped after timer expired - end session
                        updates["state"] = "stopping"
                        self._timed_session_lap_at_complete = None
                        print("[TIMED_SESSION] Car stopped after timer expired. Stopping car...")
                        # Turn off ignition
                        self.execute_action("ignition")
            
            elif current_state == "stopping":
                # Wait for car to stop (speed < threshold)
                if not is_moving and speed_kph < 1.0:
                    updates["state"] = "exiting_car"
                    print("[TIMED_SESSION] Car stopped. Exiting car...")
                    # Exit car - ensure ignition is off, then reset to pits and exit
                    # Don't use reset_car() as it has its own ignition logic that might turn it back on
                    # Instead, manually handle the sequence to keep ignition off
                    def get_car_state():
                        """Get current car state."""
                        telem = telemetry.get_current()
                        return {
                            'in_car': telem.get("is_on_track_car", False) and telem.get("is_on_track", False),
                            'in_pits': telem.get("on_pit_road", False) or telem.get("in_garage", False),
                            'speed': telem.get("speed_kph", 0)
                        }
                    
                    car_state = get_car_state()
                    if car_state['in_car'] and car_state['in_pits']:
                        # Already in pits, just exit
                        self.controls.execute_action("reset_car", hold_until_state_change=True)
                    elif car_state['in_car'] and not car_state['in_pits']:
                        # Not in pits, reset to pits first (ignition should already be off)
                        self.controls.execute_action("reset_car", hold_until_state_change=True)
                        time.sleep(0.5)
                        # Ensure ignition stays off after reset (iRacing may turn it on during reset)
                        ignition = self.controls.bindings.get("ignition", {}).get("combo")
                        if ignition:
                            self.controls.execute_combo(ignition)
                            time.sleep(0.2)
                        # Now exit if still in car
                        car_state = get_car_state()
                        if car_state['in_car'] and car_state['in_pits']:
                            self.controls.execute_action("reset_car", hold_until_state_change=True)
            
            elif current_state == "exiting_car":
                # Wait until out of car
                if not in_car:
                    updates["clear_state"] = True  # Mark to clear the entire state
                    self._timed_session_lap_at_complete = None
                    self._timed_session_start_lap = None
                    self._timed_session_last_lap = None
                    print("[TIMED_SESSION] Session completed!")
            
            # Update database if there are changes
            if updates:
                try:
                    client = self.client.service_client or self.client.supabase
                    if updates.get("clear_state"):
                        # Clear the entire timed_session_state when session is complete
                        client.table("irc_devices").update({
                            "timed_session_state": None,
                            "updated_at": now_iso
                        }).eq("device_id", self.device_id).execute()
                        
                        # Also mark the queue entry as completed (if it exists and isn't a temp entry)
                        queue_entry_id = session_state.get("queue_entry_id")
                        if queue_entry_id and not queue_entry_id.startswith("temp-"):
                            try:
                                client.table("irc_device_queue").update({
                                    "status": "completed",
                                    "completed_at": now_iso
                                }).eq("id", queue_entry_id).execute()
                                print(f"[TIMED_SESSION] Queue entry {queue_entry_id} marked as completed")
                            except Exception as e:
                                print(f"[WARN] Failed to mark queue entry as completed: {e}")
                    else:
                        # Update the session state
                        client.table("irc_devices").update({
                            "timed_session_state": {
                                **session_state,
                                **updates,
                                "updated_at": now_iso
                            }
                        }).eq("device_id", self.device_id).execute()
                except Exception as e:
                    print(f"[WARN] Failed to update timed session state: {e}")
        
        except Exception as e:
            # Don't spam errors - only log if it's unexpected
            if "timed_session_state" not in str(e).lower():
                print(f"[WARN] Error checking timed session: {e}")
    
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
    
    def get_discovered_peers(self, online_only: bool = True) -> List[Dict]:
        """
        Get list of discovered peers on the local network.
        
        Args:
            online_only: If True, only return peers that are currently online
        
        Returns:
            List of peer dictionaries
        """
        if not self.network_discovery:
            return []
        
        peers = self.network_discovery.get_peers(online_only=online_only)
        return [peer.to_dict() for peer in peers]
    
    def _on_peer_discovered(self, peer):
        """Callback when a new peer is discovered."""
        print(f"[INFO] Discovered peer: {peer.device_name} ({peer.device_id}) at {peer.local_ip}")
    
    def _on_peer_lost(self, peer):
        """Callback when a peer goes offline."""
        print(f"[INFO] Peer lost: {peer.device_name} ({peer.device_id})")


# Singleton
_service: Optional[IRCommanderService] = None

def get_service() -> IRCommanderService:
    global _service
    if _service is None:
        _service = IRCommanderService()
    return _service

