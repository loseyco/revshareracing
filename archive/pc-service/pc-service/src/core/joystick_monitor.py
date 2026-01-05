"""
Joystick Input Monitor
Monitors joystick/steering wheel button presses and conditionally allows/blocks actions
"""

from __future__ import annotations

import ctypes
import os
import time
import threading
from typing import Dict, Optional, Callable, Set
from ctypes import wintypes

# Windows API constants
USER32 = ctypes.windll.user32 if os.name == "nt" else None
WINMM = ctypes.windll.winmm if os.name == "nt" else None

# DirectInput constants (simplified - we'll use joyGetPosEx for basic joystick reading)
JOY_BUTTON1 = 0x0001
JOY_BUTTON2 = 0x0002
JOY_BUTTON3 = 0x0004
JOY_BUTTON4 = 0x0008
JOY_BUTTON5 = 0x0010
JOY_BUTTON6 = 0x0020
JOY_BUTTON7 = 0x0040
JOY_BUTTON8 = 0x0080
JOY_BUTTON9 = 0x0100
JOY_BUTTON10 = 0x0200
JOY_BUTTON11 = 0x0400
JOY_BUTTON12 = 0x0800
JOY_BUTTON13 = 0x1000
JOY_BUTTON14 = 0x2000
JOY_BUTTON15 = 0x4000
JOY_BUTTON16 = 0x8000

JOYSTICKID1 = 0
JOYSTICKID2 = 1

# joyGetPosEx structure
class JOYINFOEX(ctypes.Structure):
    _fields_ = [
        ("dwSize", wintypes.DWORD),
        ("dwFlags", wintypes.DWORD),
        ("dwXpos", wintypes.DWORD),
        ("dwYpos", wintypes.DWORD),
        ("dwZpos", wintypes.DWORD),
        ("dwRpos", wintypes.DWORD),
        ("dwUpos", wintypes.DWORD),
        ("dwVpos", wintypes.DWORD),
        ("dwButtons", wintypes.DWORD),
        ("dwButtonNumber", wintypes.DWORD),
        ("dwPOV", wintypes.DWORD),
        ("dwReserved1", wintypes.DWORD),
        ("dwReserved2", wintypes.DWORD),
    ]

JOY_RETURNBUTTONS = 0x00000080
JOY_RETURNPOV = 0x00000040

if WINMM:
    WINMM.joyGetPosEx.argtypes = [wintypes.UINT, ctypes.POINTER(JOYINFOEX)]
    WINMM.joyGetPosEx.restype = wintypes.MMRESULT


class JoystickMonitor:
    """
    Monitors joystick button presses and conditionally allows/blocks actions
    """
    
    def __init__(self, controls_manager, service_instance=None):
        self.controls_manager = controls_manager
        self.service = service_instance
        self.running = False
        self.monitor_thread = None
        self.poll_interval = 0.05  # Check every 50ms
        self.last_button_states = {}  # Track previous button states to detect presses
        self.button_to_action_map: Dict[int, str] = {}  # Map button number to action name
        self.action_check_callbacks: Dict[str, Callable[[], bool]] = {}  # Check if action is allowed
        self.enabled = False
        
    def start(self):
        """Start monitoring joystick input"""
        if not WINMM or os.name != "nt":
            print("[JOYSTICK] Joystick monitoring not supported on this platform")
            return False
        
        if self.running:
            return True
        
        # Build button-to-action mapping from controls bindings
        self._build_button_mapping()
        
        if not self.button_to_action_map:
            print("[JOYSTICK] No joystick button bindings found - monitoring disabled")
            return False
        
        self.running = True
        self.monitor_thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self.monitor_thread.start()
        print(f"[JOYSTICK] Started monitoring {len(self.button_to_action_map)} joystick button bindings")
        return True
    
    def stop(self):
        """Stop monitoring joystick input"""
        self.running = False
        if self.monitor_thread:
            self.monitor_thread.join(timeout=1.0)
        print("[JOYSTICK] Stopped monitoring")
    
    def set_enabled(self, enabled: bool):
        """Enable or disable joystick monitoring"""
        self.enabled = enabled
        if enabled and not self.running:
            self.start()
        print(f"[JOYSTICK] Monitoring {'enabled' if enabled else 'disabled'}")
    
    def register_action_check(self, action: str, check_callback: Callable[[], bool]):
        """Register a callback to check if an action is allowed"""
        self.action_check_callbacks[action] = check_callback
        print(f"[JOYSTICK] Registered check callback for action: {action}")
    
    def _build_button_mapping(self):
        """Build mapping from joystick button numbers to actions"""
        self.button_to_action_map = {}
        
        # Reload bindings to get latest config
        self.controls_manager.load_bindings(force=True)
        bindings = self.controls_manager.get_bindings()
        
        for action, binding_info in bindings.items():
            combo = binding_info.get("combo")
            source = binding_info.get("source", "")
            
            # Only map joystick bindings
            if combo and (combo.startswith("Button") or combo.startswith("button")):
                try:
                    # Extract button number from "Button1", "Button2", etc.
                    button_num = int(combo.replace("Button", "").replace("button", ""))
                    self.button_to_action_map[button_num] = action
                    print(f"[JOYSTICK] Mapped Button{button_num} -> {action}")
                except ValueError:
                    print(f"[JOYSTICK] Failed to parse button number from: {combo}")
    
    def _monitor_loop(self):
        """Main monitoring loop - runs in separate thread"""
        while self.running:
            try:
                if self.enabled:
                    self._check_joystick_buttons()
                time.sleep(self.poll_interval)
            except Exception as e:
                print(f"[JOYSTICK] Error in monitor loop: {e}")
                time.sleep(1.0)  # Wait longer on error
    
    def _check_joystick_buttons(self):
        """Check current joystick button states and detect presses"""
        if not WINMM:
            return
        
        # Check primary joystick (JOYSTICKID1)
        joy_info = JOYINFOEX()
        joy_info.dwSize = ctypes.sizeof(JOYINFOEX)
        joy_info.dwFlags = JOY_RETURNBUTTONS
        
        result = WINMM.joyGetPosEx(JOYSTICKID1, ctypes.byref(joy_info))
        
        if result != 0:  # MMSYSERR_NOERROR = 0
            # No joystick found or error
            return
        
        current_buttons = joy_info.dwButtons
        
        # Check each button we're monitoring
        for button_num, action in self.button_to_action_map.items():
            button_mask = 1 << (button_num - 1)  # Button 1 = bit 0, Button 2 = bit 1, etc.
            is_pressed = (current_buttons & button_mask) != 0
            was_pressed = self.last_button_states.get(button_num, False)
            
            # Detect button press (transition from not pressed to pressed)
            if is_pressed and not was_pressed:
                self._handle_button_press(button_num, action)
            
            # Update state
            self.last_button_states[button_num] = is_pressed
    
    def _handle_button_press(self, button_num: int, action: str):
        """Handle a joystick button press"""
        print(f"[JOYSTICK] Button{button_num} pressed -> {action}")
        
        # Check if action is allowed
        if not self._is_action_allowed(action):
            print(f"[JOYSTICK] Action {action} NOT ALLOWED - blocking")
            self._block_action(action)
            return
        
        print(f"[JOYSTICK] Action {action} ALLOWED - executing keyboard equivalent")
        # Action is allowed - execute keyboard equivalent
        self._execute_keyboard_equivalent(action)
    
    def _is_action_allowed(self, action: str) -> bool:
        """Check if an action is allowed based on registered callbacks"""
        # Check registered callback first
        if action in self.action_check_callbacks:
            try:
                return self.action_check_callbacks[action]()
            except Exception as e:
                print(f"[JOYSTICK] Error in action check callback for {action}: {e}")
                return False
        
        # Default: allow if no check registered
        return True
    
    def _block_action(self, action: str):
        """Block an action by taking corrective measures"""
        # For enter_car, we can immediately exit the car if it was entered
        if action == "enter_car":
            print(f"[JOYSTICK] Blocking {action} - will exit car if entered")
            # Check telemetry after a short delay to see if car was entered
            # If so, immediately exit by sending enter_car again (if it's a toggle)
            threading.Timer(0.3, self._exit_car_if_entered).start()
        
        # For reset_car, we can't easily undo it once it happens
        # But we can try to re-enter the car if we detect a reset
        elif action == "reset_car":
            print(f"[JOYSTICK] Blocking {action} - cannot undo reset, but will attempt to re-enter car")
            # Check if car was reset and try to re-enter
            threading.Timer(1.0, self._re_enter_car_if_reset).start()
    
    def _exit_car_if_entered(self):
        """Check if car was entered and exit if so"""
        try:
            from core import telemetry
            current = telemetry.get_current()
            if current and current.get('in_car', False):
                print("[JOYSTICK] Car was entered despite blocking - attempting to exit")
                # Try to exit by sending enter_car again (if it's a toggle)
                # This might not work if enter_car is not a toggle, but it's worth trying
                result = self.controls_manager.execute_action("enter_car", source="joystick_block")
                if result.get('success'):
                    print("[JOYSTICK] Successfully exited car")
                else:
                    print(f"[JOYSTICK] Failed to exit car: {result.get('message')}")
        except Exception as e:
            print(f"[JOYSTICK] Error checking if car entered: {e}")
    
    def _re_enter_car_if_reset(self):
        """Check if car was reset and try to re-enter if so"""
        try:
            from core import telemetry
            current = telemetry.get_current()
            # If we're not in car after a reset, try to re-enter
            if current and not current.get('in_car', False):
                print("[JOYSTICK] Car was reset despite blocking - attempting to re-enter")
                # Try to enter car again
                result = self.controls_manager.execute_action("enter_car", source="joystick_block")
                if result.get('success'):
                    print("[JOYSTICK] Successfully re-entered car")
                else:
                    print(f"[JOYSTICK] Failed to re-enter car: {result.get('message')}")
        except Exception as e:
            print(f"[JOYSTICK] Error checking if car reset: {e}")
    
    def _execute_keyboard_equivalent(self, action: str):
        """Execute the keyboard equivalent of an action"""
        # If action is allowed, we don't need to do anything - let the joystick button work naturally
        # The joystick button press will already reach iRacing, so we just log it
        print(f"[JOYSTICK] Action {action} allowed - joystick button will work naturally")
        
        # Optional: We could also send the keyboard equivalent to ensure it works,
        # but that might cause double-triggering. For now, we just allow the natural joystick input.


# Singleton instance
_monitor: Optional[JoystickMonitor] = None


def get_monitor(controls_manager=None, service_instance=None) -> JoystickMonitor:
    """Get or create joystick monitor singleton"""
    global _monitor
    if _monitor is None:
        if controls_manager is None:
            from core import controls
            controls_manager = controls.get_manager()
        _monitor = JoystickMonitor(controls_manager, service_instance)
    return _monitor

