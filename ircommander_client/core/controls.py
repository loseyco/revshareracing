"""
iRacing Controls - Key sending and window management
"""

import ctypes
import os
import re
import struct
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

if os.name == "nt":
    from ctypes import wintypes
    USER32 = ctypes.windll.user32
else:
    USER32 = None

# Key codes
VK_MAP = {
    "SHIFT": 0x10, "CTRL": 0x11, "ALT": 0x12,
    "ENTER": 0x0D, "TAB": 0x09, "SPACE": 0x20,
    "UP": 0x26, "DOWN": 0x28, "LEFT": 0x25, "RIGHT": 0x27,
    **{f"F{i}": 0x6F + i for i in range(1, 13)}
}

VK_NAMES = {
    **{code: chr(code) for code in range(ord("A"), ord("Z") + 1)},
    **{code: chr(code) for code in range(ord("0"), ord("9") + 1)},
    0x0D: "ENTER", 0x10: "SHIFT", 0x11: "CTRL", 0x12: "ALT",
    0x20: "SPACE", **{0x70 + i: f"F{i + 1}" for i in range(12)},
}

KEYEVENTF_KEYUP = 0x0002
SW_RESTORE = 9

# Action definitions
ACTIONS = {
    "reset_car": {"label": "Reset Car", "cfg_names": ("RunActiveReset", "Reset")},
    "ignition": {"label": "Ignition", "cfg_names": ("Ignition",)},
    "starter": {"label": "Starter", "cfg_names": ("Starter",)},
    "enter_car": {"label": "Enter Car", "cfg_names": ("EnterCar", "Enter")},
    "pit_speed_limiter": {"label": "Pit Limiter", "cfg_names": ("PitSpeedLimiter",)},
}


class ControlsManager:
    """Manages iRacing key bindings and execution."""
    
    def __init__(self):
        self.bindings: Dict[str, Dict] = {}
        self._iracing_dirs = self._find_iracing_dirs()
        self._cached_hwnd = None
    
    def load_bindings(self, force: bool = False):
        """Load key bindings from iRacing config."""
        cfg_path = self._find_controls_cfg()
        if not cfg_path:
            self.bindings = {k: {"label": v["label"], "combo": None} for k, v in ACTIONS.items()}
            return
        
        try:
            data = cfg_path.read_bytes()
            for action, defn in ACTIONS.items():
                combo = self._extract_binding(data, defn["cfg_names"])
                self.bindings[action] = {"label": defn["label"], "combo": combo}
        except Exception as e:
            print(f"[WARN] Failed to load bindings: {e}")
    
    def get_bindings(self) -> Dict:
        if not self.bindings:
            self.load_bindings()
        return self.bindings
    
    def execute_action(self, action: str, hold_until_state_change: bool = False) -> Dict:
        """Execute an action by sending keys.
        
        Args:
            action: Action to execute
            hold_until_state_change: If True, hold key until telemetry state changes (for reset_car)
        """
        if not self.bindings:
            self.load_bindings()
        
        binding = self.bindings.get(action)
        if not binding:
            return {"success": False, "message": f"Unknown action: {action}"}
        
        combo = binding.get("combo")
        if not combo:
            # Fallback: enter_car can use reset_car binding
            if action == "enter_car":
                reset = self.bindings.get("reset_car", {})
                combo = reset.get("combo")
            if not combo:
                return {"success": False, "message": f"No binding for {action}"}
        
        if not self.focus_iracing():
            return {"success": False, "message": "Cannot focus iRacing window"}
        
        time.sleep(0.1)
        
        # For reset_car, hold until state changes if requested
        if action == "reset_car" and hold_until_state_change:
            success = self._send_keys_until_state_change(combo)
        else:
            # Hold reset_car and enter_car keys for 1 second (default behavior)
            hold_time = 1.0 if action in ("reset_car", "enter_car") else 0.0
            success = self._send_keys(combo, hold=hold_time)
        
        return {"success": success, "message": f"Sent {combo}" if success else "Key send failed"}
    
    def execute_combo(self, combo: str) -> bool:
        """Execute a key combo directly."""
        if not combo or USER32 is None:
            return False
        if not self.focus_iracing():
            return False
        time.sleep(0.1)
        return self._send_keys(combo)
    
    def focus_iracing(self) -> bool:
        """Focus the iRacing window."""
        if USER32 is None:
            return False
        
        hwnd = self._find_iracing_hwnd()
        if not hwnd:
            return False
        
        try:
            if USER32.IsIconic(hwnd):
                USER32.ShowWindow(hwnd, SW_RESTORE)
                time.sleep(0.1)
            
            USER32.SetForegroundWindow(hwnd)
            USER32.BringWindowToTop(hwnd)
            time.sleep(0.1)
            
            return USER32.GetForegroundWindow() == hwnd
        except Exception:
            return False
    
    def iracing_window_exists(self) -> bool:
        """Check if iRacing window exists."""
        return self._find_iracing_hwnd() is not None
    
    def _send_keys(self, combo: str, hold: float = 0.0) -> bool:
        """Send a key combo."""
        parts = [p.strip() for p in combo.replace("+", " ").split() if p.strip()]
        if not parts:
            return False
        
        vk_codes = []
        for part in parts:
            vk = self._key_to_vk(part)
            if vk is None:
                return False
            vk_codes.append(vk)
        
        modifiers = vk_codes[:-1]
        main_key = vk_codes[-1]
        
        try:
            # Press modifiers
            for vk in modifiers:
                USER32.keybd_event(vk, 0, 0, 0)
                time.sleep(0.01)
            
            # Press main key
            USER32.keybd_event(main_key, 0, 0, 0)
            
            if hold > 0:
                time.sleep(hold)
            
            # Release
            USER32.keybd_event(main_key, 0, KEYEVENTF_KEYUP, 0)
            for vk in reversed(modifiers):
                USER32.keybd_event(vk, 0, KEYEVENTF_KEYUP, 0)
            
            return True
        except Exception:
            return False
    
    def _send_keys_until_state_change(self, combo: str, timeout: float = 10.0) -> bool:
        """Send keys and hold until telemetry state changes (for reset_car).
        
        Monitors telemetry for state changes that indicate reset completed.
        """
        try:
            # Try relative import first (since we're in the core package)
            try:
                from . import telemetry
            except ImportError:
                # Fallback to absolute import
                from core import telemetry
        except ImportError:
            # Fallback to fixed hold time if telemetry not available
            return self._send_keys(combo, hold=2.0)
        
        parts = [p.strip() for p in combo.replace("+", " ").split() if p.strip()]
        if not parts:
            return False
        
        vk_codes = []
        for part in parts:
            vk = self._key_to_vk(part)
            if vk is None:
                return False
            vk_codes.append(vk)
        
        modifiers = vk_codes[:-1]
        main_key = vk_codes[-1]
        
        try:
            # Get initial state - track car position state
            initial_telem = telemetry.get_current()
            initial_in_car = initial_telem.get('is_on_track_car', False)
            initial_on_pit_road = initial_telem.get('on_pit_road', False)
            initial_in_garage = initial_telem.get('in_garage', False)
            
            # Press modifiers
            for vk in modifiers:
                USER32.keybd_event(vk, 0, 0, 0)
                time.sleep(0.01)
            
            # Press main key and hold
            USER32.keybd_event(main_key, 0, 0, 0)
            
            # Monitor for state change
            start_time = time.time()
            check_interval = 0.1  # Check every 100ms
            last_check = start_time
            min_hold_time = 0.3  # Minimum hold time to ensure key is registered
            
            while (time.time() - start_time) < timeout:
                current_time = time.time()
                
                # Wait for minimum hold time before checking state
                if current_time - start_time < min_hold_time:
                    time.sleep(0.05)
                    continue
                
                # Check state periodically
                if current_time - last_check >= check_interval:
                    telem = telemetry.get_current()
                    current_in_car = telem.get('is_on_track_car', False)
                    current_on_pit_road = telem.get('on_pit_road', False)
                    current_in_garage = telem.get('in_garage', False)
                    
                    # State change indicators - reset changes car position state:
                    # 1. In/out of car state changed (most reliable)
                    # 2. Pit road state changed
                    # 3. Garage state changed
                    state_changed = (
                        current_in_car != initial_in_car or
                        current_on_pit_road != initial_on_pit_road or
                        current_in_garage != initial_in_garage
                    )
                    
                    if state_changed:
                        break
                    
                    last_check = current_time
                
                time.sleep(0.05)  # Small sleep to avoid busy-waiting
            
            # Release keys
            USER32.keybd_event(main_key, 0, KEYEVENTF_KEYUP, 0)
            for vk in reversed(modifiers):
                USER32.keybd_event(vk, 0, KEYEVENTF_KEYUP, 0)
            
            return True
        except Exception as e:
            # If anything fails, try to release keys and fall back
            try:
                USER32.keybd_event(main_key, 0, KEYEVENTF_KEYUP, 0)
                for vk in reversed(modifiers):
                    USER32.keybd_event(vk, 0, KEYEVENTF_KEYUP, 0)
            except:
                pass
            return False
    
    def _key_to_vk(self, key: str) -> Optional[int]:
        key = key.upper()
        if key in VK_MAP:
            return VK_MAP[key]
        if len(key) == 1 and key.isalnum():
            return ord(key)
        return None
    
    def _find_iracing_hwnd(self) -> Optional[int]:
        if USER32 is None:
            return None
        
        if self._cached_hwnd and USER32.IsWindow(self._cached_hwnd):
            return self._cached_hwnd
        
        # Clear cache if window is invalid
        self._cached_hwnd = None
        
        client_matches = []
        ui_matches = []
        
        def enum_proc(hwnd, _):
            if not USER32.IsWindowVisible(hwnd):
                return True
            
            # Get window class name to identify browser windows
            class_buf = ctypes.create_unicode_buffer(256)
            USER32.GetClassNameW(hwnd, class_buf, 256)
            class_name = class_buf.value.lower()
            
            # Skip browser windows (UI is typically in a browser)
            if any(browser in class_name for browser in ["chrome", "mozilla", "iexplore", "edge", "msedge"]):
                return True
            
            length = USER32.GetWindowTextLengthW(hwnd)
            if length <= 0:
                return True
            buf = ctypes.create_unicode_buffer(length + 1)
            USER32.GetWindowTextW(hwnd, buf, length + 1)
            title = buf.value.lower()
            
            # Prefer exact match "iracing" (client) over UI windows
            # The UI typically has "iracing" in a browser window, which we've already filtered
            if title == "iracing":
                client_matches.insert(0, hwnd)
            elif "iracing" in title:
                # Additional check: UI windows often have specific patterns
                # Client window is typically just "iRacing" or has track/car info
                if "ui" not in title and "browser" not in title:
                    client_matches.append(hwnd)
                else:
                    ui_matches.append(hwnd)
            return True
        
        ENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
        USER32.EnumWindows(ENUMPROC(enum_proc), 0)
        
        # Prefer client matches over UI matches
        if client_matches:
            self._cached_hwnd = client_matches[0]
            return client_matches[0]
        
        # Fallback to UI only if no client found (shouldn't happen normally)
        if ui_matches:
            self._cached_hwnd = ui_matches[0]
            return ui_matches[0]
        
        return None
    
    def _find_iracing_dirs(self) -> List[Path]:
        profile = Path(os.environ.get("USERPROFILE", "")).expanduser()
        candidates = [
            profile / "Documents" / "iRacing",
            profile / "OneDrive" / "Documents" / "iRacing",
        ]
        return [p for p in candidates if p.exists()]
    
    def _find_controls_cfg(self) -> Optional[Path]:
        for d in self._iracing_dirs:
            cfg = d / "controls.cfg"
            if cfg.exists():
                return cfg
        return None
    
    def _extract_binding(self, data: bytes, names: Tuple[str, ...]) -> Optional[str]:
        """Extract binding from controls.cfg binary."""
        for name in names:
            pattern = name.encode("ascii") + b"\x00"
            for match in re.finditer(pattern, data):
                start = match.end()
                if start + 16 > len(data):
                    continue
                _, _, b_type, value = struct.unpack_from("<4I", data, start)
                if b_type == 4 and value:  # Keyboard binding
                    return self._decode_binding(value)
        return None
    
    def _decode_binding(self, value: int) -> Optional[str]:
        if value == 0:
            return None
        
        mods = []
        if value & 0x00010000:
            mods.append("SHIFT")
        if value & 0x00020000:
            mods.append("CTRL")
        if value & 0x00040000:
            mods.append("ALT")
        
        vk = value & 0xFF
        key = VK_NAMES.get(vk, f"VK_{vk:02X}")
        
        return "+".join(mods + [key]) if mods else key


# Singleton
_manager: Optional[ControlsManager] = None

def get_manager() -> ControlsManager:
    global _manager
    if _manager is None:
        _manager = ControlsManager()
    return _manager

