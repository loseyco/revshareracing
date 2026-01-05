"""
Joystick Monitor
Monitors joystick button presses and sends keyboard keystrokes
"""

import ctypes
import os
import time
import threading
from typing import Optional, Callable
from ctypes import wintypes

if os.name == "nt":
    WINMM = ctypes.windll.winmm
else:
    WINMM = None

# Joystick constants
JOYSTICKID1 = 0
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

JOY_RETURNBUTTONS = 0x00000080

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

if WINMM:
    WINMM.joyGetPosEx.argtypes = [wintypes.UINT, ctypes.POINTER(JOYINFOEX)]
    WINMM.joyGetPosEx.restype = wintypes.DWORD  # MMRESULT is actually a DWORD


class JoystickMonitor:
    """Monitors joystick buttons and triggers keyboard actions."""
    
    def __init__(self, controls_manager, joystick_config, action_check_callback: Optional[Callable[[str], bool]] = None):
        self.controls = controls_manager
        self.config = joystick_config
        self.action_check_callback = action_check_callback
        self.running = False
        self.monitor_thread: Optional[threading.Thread] = None
        self.poll_interval = 0.05  # 50ms
        self.last_button_states = {}  # Track previous states to detect presses
        self.enabled = False
    
    def start(self):
        """Start monitoring."""
        if not WINMM or os.name != "nt":
            print("[JOYSTICK] Monitoring not supported on this platform")
            return False
        
        if self.running:
            return True
        
        # Check if any buttons are configured
        button_num = self.config.get_button("enter_car")  # Same for both enter_car and reset_car
        
        if not button_num:
            print("[JOYSTICK] No joystick buttons configured - monitoring disabled")
            return False
        
        self.running = True
        self.monitor_thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self.monitor_thread.start()
        print(f"[JOYSTICK] Started monitoring (Enter/Reset: Button{button_num})")
        return True
    
    def stop(self):
        """Stop monitoring."""
        self.running = False
        if self.monitor_thread:
            self.monitor_thread.join(timeout=1.0)
        print("[JOYSTICK] Stopped monitoring")
    
    def set_enabled(self, enabled: bool):
        """Enable or disable monitoring."""
        self.enabled = enabled
        if enabled and not self.running:
            self.start()
        elif not enabled and self.running:
            self.stop()
    
    def _monitor_loop(self):
        """Main monitoring loop."""
        while self.running:
            try:
                if self.enabled:
                    self._check_buttons()
                time.sleep(self.poll_interval)
            except Exception as e:
                print(f"[JOYSTICK] Monitor error: {e}")
                time.sleep(1.0)
    
    def _check_buttons(self):
        """Check joystick button states."""
        if not WINMM:
            return
        
        joy_info = JOYINFOEX()
        joy_info.dwSize = ctypes.sizeof(JOYINFOEX)
        joy_info.dwFlags = JOY_RETURNBUTTONS
        
        result = WINMM.joyGetPosEx(JOYSTICKID1, ctypes.byref(joy_info))
        
        if result != 0:  # MMSYSERR_NOERROR = 0
            return
        
        current_buttons = joy_info.dwButtons
        
        # Check enter_car/reset_car button (they share the same button)
        button_num = self.config.get_button("enter_car")  # Same for both
        if button_num:
            # Check which action to execute based on context
            # For now, we'll execute enter_car (can be enhanced later)
            self._check_button(button_num, current_buttons, "enter_car")
    
    def _check_button(self, button_num: int, current_buttons: int, action: str):
        """Check if a specific button was pressed."""
        button_mask = 1 << (button_num - 1)  # Button 1 = bit 0, Button 2 = bit 1, etc.
        is_pressed = (current_buttons & button_mask) != 0
        was_pressed = self.last_button_states.get(button_num, False)
        
        # Detect press (transition from not pressed to pressed)
        if is_pressed and not was_pressed:
            self._handle_button_press(button_num, action)
        
        self.last_button_states[button_num] = is_pressed
    
    def _handle_button_press(self, button_num: int, action: str):
        """Handle a button press."""
        print(f"[JOYSTICK] Button{button_num} pressed -> {action}")
        
        # If this is enter_car/reset_car, determine which action to execute based on context
        if action == "enter_car":
            # Check if we're in the car to decide between enter_car and reset_car
            try:
                from core import telemetry
                current = telemetry.get_current()
                in_car = current and current.get("is_on_track_car", False)
                
                # If in car, use reset_car; if not, use enter_car
                actual_action = "reset_car" if in_car else "enter_car"
                print(f"[JOYSTICK] Context: {'in car' if in_car else 'not in car'} -> executing {actual_action}")
            except Exception as e:
                print(f"[JOYSTICK] Error checking telemetry: {e}, defaulting to {action}")
                actual_action = action
        else:
            actual_action = action
        
        # Check if action is allowed
        if self.action_check_callback:
            if not self.action_check_callback(actual_action):
                print(f"[JOYSTICK] Action {actual_action} blocked by callback")
                return
        
        # Execute keyboard equivalent
        print(f"[JOYSTICK] Executing keyboard equivalent for {actual_action}")
        result = self.controls.execute_action(actual_action)
        
        if result.get("success"):
            print(f"[JOYSTICK] Successfully executed {actual_action}")
        else:
            print(f"[JOYSTICK] Failed to execute {actual_action}: {result.get('message')}")


# Singleton
_monitor: Optional[JoystickMonitor] = None

def get_monitor(controls_manager=None, joystick_config=None, action_check_callback=None) -> Optional[JoystickMonitor]:
    global _monitor
    if _monitor is None:
        if controls_manager and joystick_config:
            _monitor = JoystickMonitor(controls_manager, joystick_config, action_check_callback)
    return _monitor

