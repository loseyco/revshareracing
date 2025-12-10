"""
Controls Module
Reads iRacing key bindings and exposes racing controls
"""

from __future__ import annotations

import ctypes
import json
import os
import re
import struct
import time
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple, Callable

from ctypes import wintypes


ACTION_DEFINITIONS = {
    "pit_speed_limiter": {
        "label": "Pit Speed Limiter",
        "keywords": ["pit speed limiter", "pit limiter", "pitspeedlimiter", "pit_speed_limiter"],
        "cfg_names": ("PitSpeedLimiter",),
    },
    "starter": {
        "label": "Starter",
        "keywords": ["starter", "start engine"],
        "cfg_names": ("Starter",),
    },
    "ignition": {
        "label": "Ignition",
        "keywords": ["ignition", "toggle ignition"],
        "cfg_names": ("Ignition",),
    },
    "request_pit": {
        "label": "Request Pit Service",
        "keywords": ["request pit service", "pit service request", "pit service"],
        "cfg_names": ("FuelToEndToggle", "InLapToggle"),
    },
    "quick_repair": {
        "label": "Quick Repair",
        "keywords": ["fast repair", "quick repair"],
        "cfg_names": ("SaveActiveReset", "RunActiveReset"),
    },
    "clear_flags": {
        "label": "Clear Penalties",
        "keywords": ["clear penalties", "clear black flags", "clear penalties request"],
        "cfg_names": ("TellTaleReset", "RunActiveReset"),
    },
    "reset_car": {
        "label": "Reset Car",
        "keywords": ["reset car", "tow car", "reset"],
        "cfg_names": ("RunActiveReset", "SaveActiveReset", "Reset"),
    },
    "enter_car": {
        "label": "Enter Car",
        "keywords": ["enter car", "get in car", "enter vehicle"],
        "cfg_names": ("EnterCar", "Enter",),
    },
}

VK_MAP = {
    "SHIFT": 0x10,
    "CTRL": 0x11,
    "CONTROL": 0x11,
    "ALT": 0x12,
    "ENTER": 0x0D,
    "RETURN": 0x0D,
    "TAB": 0x09,
    "SPACE": 0x20,
    "UP": 0x26,
    "DOWN": 0x28,
    "LEFT": 0x25,
    "RIGHT": 0x27,
    "HOME": 0x24,
    "END": 0x23,
    "PAGEUP": 0x21,
    "PAGEDOWN": 0x22,
    "INSERT": 0x2D,
    "DELETE": 0x2E,
}

for i in range(1, 13):
    VK_MAP[f"F{i}"] = 0x6F + i


KEYEVENTF_KEYUP = 0x0002
USER32 = ctypes.windll.user32 if os.name == "nt" else None
SW_RESTORE = 9
SW_SHOW = 5

# Windows message constants for PostMessage
WM_KEYDOWN = 0x0100
WM_KEYUP = 0x0101
WM_CHAR = 0x0102

MODIFIER_FLAGS = (
    (0x00010000, "SHIFT"),
    (0x00020000, "CTRL"),
    (0x00040000, "ALT"),
    (0x00080000, "WIN"),
)

VK_NAMES = {
    **{code: chr(code) for code in range(ord("A"), ord("Z") + 1)},
    **{code: chr(code) for code in range(ord("0"), ord("9") + 1)},
    0x08: "BACKSPACE",
    0x09: "TAB",
    0x0D: "ENTER",
    0x10: "SHIFT",
    0x11: "CTRL",
    0x12: "ALT",
    0x14: "CAPSLOCK",
    0x1B: "ESC",
    0x20: "SPACE",
    0x21: "PGUP",
    0x22: "PGDN",
    0x23: "END",
    0x24: "HOME",
    0x25: "LEFT",
    0x26: "UP",
    0x27: "RIGHT",
    0x28: "DOWN",
    0x2D: "INS",
    0x2E: "DEL",
    **{0x70 + i: f"F{i + 1}" for i in range(12)},
    0x5B: "LWIN",
    0x5C: "RWIN",
    0x60: "NUM0",
    0x61: "NUM1",
    0x62: "NUM2",
    0x63: "NUM3",
    0x64: "NUM4",
    0x65: "NUM5",
    0x66: "NUM6",
    0x67: "NUM7",
    0x68: "NUM8",
    0x69: "NUM9",
    0x6A: "NUM*",
    0x6B: "NUM+",
    0x6C: "NUMSEP",
    0x6D: "NUM-",
    0x6E: "NUM.",
    0x6F: "NUM/",
}


class ControlsManager:
    """Manages racing controls loaded from iRacing configuration"""

    def __init__(self):
        self.ir = None
        self.bindings: Dict[str, Dict[str, Optional[str]]] = {}
        self._bindings_loaded_at = 0.0
        self._binding_file_mtime = 0.0
        self._override_file = Path(__file__).parent.parent.parent / "data" / "commander_controls.json"
        self._iracing_dirs = self._discover_iracing_dirs()
        self._iracing_dir = self._iracing_dirs[0] if self._iracing_dirs else Path.home() / "Documents" / "iRacing"
        self._last_error: Optional[str] = None
        self._controls_cfg_path: Optional[Path] = None
        self._controls_cfg_mtime: float = 0.0
        self._cached_hwnd: Optional[int] = None
        self._action_log: List[Dict] = []  # Log of executed actions
        self._max_log_entries = 100  # Keep last 100 entries

    # --------------------------------------------------------------------- #
    # Loading bindings
    # --------------------------------------------------------------------- #
    def load_bindings(self, force: bool = False) -> None:
        """Load key bindings from override file or iRacing configuration"""
        if not force and (time.time() - self._bindings_loaded_at) < 5:
            return

        bindings = self._load_override_bindings()
        if not bindings:
            bindings = self._load_iracing_bindings()

        if not bindings:
            bindings = self._default_bindings()

        self.bindings = bindings
        self._bindings_loaded_at = time.time()

    def _load_override_bindings(self) -> Dict[str, Dict[str, Optional[str]]]:
        if not self._override_file.exists():
            return {}
        try:
            data = json.loads(self._override_file.read_text(encoding="utf-8"))
            bindings = {}
            for action, combo in data.items():
                if action in ACTION_DEFINITIONS:
                    bindings[action] = {
                        "label": ACTION_DEFINITIONS[action]["label"],
                        "combo": combo,
                        "source": "override",
                    }
            return bindings
        except Exception as exc:  # pragma: no cover - defensive
            self._last_error = f"Failed to load override controls: {exc}"
            return {}

    def _load_iracing_bindings(self) -> Dict[str, Dict[str, Optional[str]]]:
        cfg_bindings = self._load_controls_cfg_bindings()
        ini_bindings = self._load_ini_bindings()

        if cfg_bindings:
            ini_bindings.update(cfg_bindings)
        return ini_bindings

    def _load_ini_bindings(self) -> Dict[str, Dict[str, Optional[str]]]:
        self._last_error = None

        config_file: Optional[Path] = None
        for root in self._iter_iracing_dirs():
            candidate = root / "app.ini"
            if candidate.exists():
                config_file = candidate
                break

        if not config_file:
            return {}

        try:
            mtime = config_file.stat().st_mtime
            if mtime == self._binding_file_mtime and self.bindings:
                return self.bindings
            self._binding_file_mtime = mtime

            kv_pairs = self._read_key_values(config_file)
            bindings: Dict[str, Dict[str, Optional[str]]] = {}

            for action, definition in ACTION_DEFINITIONS.items():
                combo = self._detect_binding(definition["keywords"], kv_pairs)
                bindings[action] = {
                    "label": definition["label"],
                    "combo": combo,
                    "source": config_file.name,
                }

            return bindings
        except Exception as exc:  # pragma: no cover - defensive
            self._last_error = f"Failed to parse {config_file.name}: {exc}"
            return {}

    def _load_controls_cfg_bindings(self) -> Dict[str, Dict[str, Optional[str]]]:
        cfg_path, cfg_bytes, mtime = self._load_controls_cfg_bytes()
        if cfg_path is None or cfg_bytes is None:
            return {}

        combos: Dict[str, Dict[str, Optional[str]]] = {}
        for action, definition in ACTION_DEFINITIONS.items():
            cfg_names = definition.get("cfg_names")
            if not cfg_names:
                continue

            combo, combo_type = _extract_cfg_combo(cfg_bytes, cfg_names)
            if combo:
                source = "controls.cfg"
                if combo_type == "joystick":
                    source = "controls.cfg (joystick)"
                combos[action] = {
                    "label": definition["label"],
                    "combo": combo,
                    "source": source,
                }

        if combos:
            self._controls_cfg_path = cfg_path
            if mtime is not None:
                self._controls_cfg_mtime = mtime
            self._last_error = None

        return combos

    def _read_key_values(self, path: Path) -> Dict[str, str]:
        kv_pairs: Dict[str, str] = {}
        for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
            line = raw.strip()
            if not line or line.startswith(";") or line.startswith("#") or line.startswith("["):
                continue
            if "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip().lower()
            value = value.strip().strip('"').strip("'")
            if key:
                kv_pairs[key] = value
        return kv_pairs

    def _detect_binding(self, keywords: List[str], kv_pairs: Dict[str, str]) -> Optional[str]:
        for keyword in keywords:
            key = keyword.lower()
            if key in kv_pairs:
                return kv_pairs[key]
        # Try partial match for keys that include spaces or underscores
        for key, value in kv_pairs.items():
            for keyword in keywords:
                if keyword.replace(" ", "") in key.replace(" ", ""):
                    return value
        return None

    def _default_bindings(self) -> Dict[str, Dict[str, Optional[str]]]:
        bindings: Dict[str, Dict[str, Optional[str]]] = {}
        for action, definition in ACTION_DEFINITIONS.items():
            bindings[action] = {
                "label": definition["label"],
                "combo": None,
                "source": "default",
            }
        return bindings

    # --------------------------------------------------------------------- #
    # iRacing directory discovery helpers
    # --------------------------------------------------------------------- #
    def _discover_iracing_dirs(self) -> List[Path]:
        profile = Path(os.environ.get("USERPROFILE", "")).expanduser()
        candidates: List[Path] = []

        env_override = os.environ.get("IRACING_DIR")
        if env_override:
            override_path = Path(env_override).expanduser()
            if override_path.exists():
                candidates.append(override_path)

        if profile.exists():
            candidates.extend(sorted(profile.glob("OneDrive - */Documents/iRacing")))
            candidates.append(profile / "OneDrive" / "Documents" / "iRacing")
            candidates.append(profile / "Documents" / "iRacing")

        seen = set()
        unique: List[Path] = []
        for path in candidates:
            if not path:
                continue
            key = str(path.resolve()).lower()
            if key in seen:
                continue
            seen.add(key)
            unique.append(path)

        return unique or [Path.home() / "Documents" / "iRacing"]

    def _iter_iracing_dirs(self) -> Iterable[Path]:
        for directory in self._iracing_dirs:
            yield directory

    def _load_controls_cfg_bytes(self) -> Tuple[Optional[Path], Optional[bytes], Optional[float]]:
        best_path: Optional[Path] = None
        best_bytes: Optional[bytes] = None
        best_mtime: Optional[float] = None

        for root in self._iter_iracing_dirs():
            cfg_path = root / "controls.cfg"
            if not cfg_path.exists():
                continue
            try:
                data = cfg_path.read_bytes()
                mtime = cfg_path.stat().st_mtime
            except OSError:
                continue
            if best_mtime is None or mtime >= best_mtime:
                best_path = cfg_path
                best_bytes = data
                best_mtime = mtime

        return best_path, best_bytes, best_mtime

    # --------------------------------------------------------------------- #
    # Public API
    # --------------------------------------------------------------------- #
    def set_iracing(self, ir_instance) -> None:
        """Set iRacing SDK instance (reserved for future expansion)"""
        self.ir = ir_instance

    def get_bindings(self, force: bool = False) -> Dict[str, Dict[str, Optional[str]]]:
        """Return racing controls with combos"""
        self.load_bindings(force=force)
        return self.bindings
    
    def get_all_controller_keys(self, force: bool = False) -> Dict[str, str]:
        """Return ALL controller keys from controls.cfg (not just predefined actions)"""
        cfg_path, cfg_bytes, _ = self._load_controls_cfg_bytes()
        if not cfg_bytes:
            return {}
        
        all_bindings = {}
        
        # Extract all bindings from the binary config
        # This is a simplified parser - you may need to enhance based on actual format
        try:
            # Look for control names in the binary data
            # iRacing stores controls as null-terminated strings followed by binding data
            text_section = cfg_bytes[:min(len(cfg_bytes), 10000)]  # First 10KB usually has names
            
            # Find potential control names (alphanumeric strings)
            for match in re.finditer(rb'([A-Za-z][A-Za-z0-9_]{2,})\x00', text_section):
                control_name = match.group(1).decode('ascii', errors='ignore')
                if control_name and len(control_name) > 2:
                    # Try to find the binding for this control
                    combo, combo_type = _extract_cfg_combo(cfg_bytes, (control_name,))
                    if combo:
                        all_bindings[control_name] = combo
        
        except Exception as e:
            print(f"[WARN] Failed to extract all controller keys: {e}")
        
        return all_bindings

    def get_binding_combo(self, action: str) -> Optional[str]:
        binding = self.bindings.get(action)
        if not binding:
            return None
        return binding.get("combo")

    def execute_combo(self, combo: Optional[str], source: str = "manual") -> bool:
        if not combo:
            self._log_action("combo", combo, source, {'success': False, 'message': 'No combo provided'})
            return False
        if os.name != "nt" or USER32 is None:
            self._log_action("combo", combo, source, {'success': False, 'message': 'Windows only'})
            return False
        success = self._send_keystroke(combo)
        key_msg = self._format_key_message(combo)
        self._log_action("combo", combo, source, {'success': success, 'message': key_msg if success else f'Failed to {key_msg}'})
        return success

    def execute_action(self, action: str, source: str = "manual") -> Dict[str, str]:
        """Execute configured action by sending key presses"""
        self.load_bindings()
        binding = self.bindings.get(action)
        
        # Fallback: if enter_car has no binding OR no combo, use reset_car binding (they're often the same key)
        if action == "enter_car":
            if not binding or not binding.get("combo"):
                reset_binding = self.bindings.get("reset_car")
                if reset_binding and reset_binding.get("combo"):
                    binding = reset_binding
                    print(f"[INFO] Using reset_car binding for enter_car (same key)")
        
        if not binding:
            result = {'success': False, 'message': f'Unknown action: {action}'}
            self._log_action(action, None, source, result)
            return result

        combo = binding.get("combo")
        if not combo:
            # Provide helpful error message with instructions
            action_label = binding.get("label", action)
            result = {'success': False, 'message': f'No key binding configured for {action_label}. Please configure this key in iRacing settings (Controls > Ignition)'}
            self._log_action(action, combo, source, result)
            return result

        if os.name != "nt" or USER32 is None:
            result = {'success': False, 'message': 'Sending keys supported on Windows only'}
            self._log_action(action, combo, source, result)
            return result

        # Debug: log the combo being used
        print(f"[DEBUG] Executing {action} with combo: '{combo}' (type: {type(combo).__name__})")

        # For enter_car, hold the key briefly (0.15s) to ensure iRacing registers it
        # This is similar to reset_car but shorter since we're just entering, not resetting
        hold_duration = 0.15 if action == "enter_car" else 0.0
        success = self._send_keystroke(combo, hold_duration=hold_duration)
        key_msg = self._format_key_message(combo)
        if success:
            result = {'success': True, 'message': f'Executed {binding["label"]} - {key_msg}'}
        elif self._last_error:
            result = {'success': False, 'message': f'{self._last_error} - {key_msg}'}
        else:
            result = {'success': False, 'message': f'Failed to {key_msg}'}
        
        self._log_action(action, combo, source, result)
        return result

    def get_last_error(self) -> Optional[str]:
        return self._last_error
    
    def iracing_window_exists(self) -> bool:
        """Check if iRacing window exists without attempting to focus it."""
        return self._find_iracing_hwnd() is not None
    
    def focus_iracing_window(self) -> bool:
        """Focus the iRacing window. Returns True if successful."""
        return self._focus_iracing_window()
    
    def _format_key_message(self, combo: Optional[str]) -> str:
        """Format a key combo into a readable message like 'pressed the R key'"""
        if not combo:
            return "no key"
        
        parts = [part.strip() for part in combo.replace("+", " ").split() if part.strip()]
        if not parts:
            return "no key"
        
        # Get the main key (last part)
        main_key = parts[-1].upper()
        
        # Format modifiers
        modifiers = parts[:-1]
        if modifiers:
            mod_str = "+".join([m.upper() for m in modifiers])
            return f"pressed {mod_str}+{main_key}"
        else:
            return f"pressed the {main_key} key"
    
    def _log_action(self, action: str, combo: Optional[str], source: str, result: Dict[str, str]):
        """Log an executed action"""
        # Format the key message
        key_message = self._format_key_message(combo)
        
        # Update message to include key info if not already present
        message = result.get('message', '')
        if message and 'pressed' not in message.lower():
            if result.get('success', False):
                message = f"{key_message} - {message}" if message else key_message
            else:
                message = f"Failed to {key_message} - {message}" if message else f"Failed to {key_message}"
        elif not message:
            message = key_message if result.get('success', False) else f"Failed to {key_message}"
        
        log_entry = {
            'timestamp': time.time(),
            'action': action,
            'combo': combo,
            'key_message': key_message,  # Add formatted key message
            'source': source,  # "manual", "queue", "automated", etc.
            'success': result.get('success', False),
            'message': message,
        }
        self._action_log.append(log_entry)
        # Keep only last N entries
        if len(self._action_log) > self._max_log_entries:
            self._action_log.pop(0)
    
    def get_action_log(self, limit: int = 50) -> List[Dict]:
        """Get recent action log entries"""
        return self._action_log[-limit:] if limit else self._action_log.copy()

    # --------------------------------------------------------------------- #
    # Key sending helpers
    # --------------------------------------------------------------------- #
    def _send_keystroke(self, combo: str, hold_duration: float = 0.0) -> bool:
        """
        Send a keystroke combo, optionally holding it for a duration
        
        Args:
            combo: Key combination string (e.g., "R" or "CTRL+R")
            hold_duration: If > 0, hold the key for this many seconds before releasing
        """
        self._last_error = None
        parts = [part.strip() for part in combo.replace("+", " ").split() if part.strip()]
        if not parts:
            return False

        vk_codes: List[int] = []
        for part in parts:
            vk = self._key_to_vk(part)
            if vk is None:
                self._last_error = f"Unable to convert key '{part}' to virtual key code"
                print(f"[WARN] Failed to convert key '{part}' to VK code for combo '{combo}'")
                return False
            vk_codes.append(vk)

        modifiers = vk_codes[:-1]
        main_key = vk_codes[-1]

        try:
            # Simple approach: Focus iRacing, then send keys
            print(f"[KEY] Preparing to send combo: {combo}")
            focus_result = self._focus_iracing_window()
            if not focus_result:
                self._last_error = "Unable to focus iRacing window"
                print(f"[KEY] FAILED to focus iRacing window - aborting key send")
                return False
            print(f"[KEY] Successfully focused iRacing window")
            time.sleep(0.15)  # Give window time to focus
            
            # Press modifiers
            for vk in modifiers:
                print(f"[KEY] Pressing modifier: {vk} (0x{vk:02X})")
                USER32.keybd_event(vk, 0, 0, 0)
                time.sleep(0.01)
            
            # Press main key
            print(f"[KEY] Pressing main key: {main_key} (0x{main_key:02X}) - '{combo}'")
            USER32.keybd_event(main_key, 0, 0, 0)
            
            # If hold_duration > 0, hold the key for that duration
            if hold_duration > 0:
                print(f"[KEY] Holding key for {hold_duration:.3f}s")
                time.sleep(hold_duration)
            
            # Release main key
            print(f"[KEY] Releasing main key: {main_key} (0x{main_key:02X})")
            USER32.keybd_event(main_key, 0, KEYEVENTF_KEYUP, 0)
            
            # Release modifiers
            for vk in reversed(modifiers):
                print(f"[KEY] Releasing modifier: {vk} (0x{vk:02X})")
                USER32.keybd_event(vk, 0, KEYEVENTF_KEYUP, 0)
            
            print(f"[KEY] Successfully sent combo: {combo}")
            return True
        except Exception:
            return False
    
    def execute_combo_hold(self, combo: Optional[str], hold_duration: float, source: str = "manual") -> bool:
        """Execute a combo and hold it for a specified duration"""
        if not combo:
            self._log_action("combo", combo, source, {'success': False, 'message': 'No combo provided'})
            return False
        if os.name != "nt" or USER32 is None:
            self._log_action("combo", combo, source, {'success': False, 'message': 'Windows only'})
            return False
        success = self._send_keystroke(combo, hold_duration=hold_duration)
        key_msg = self._format_key_message(combo)
        hold_msg = f"{key_msg} (held for {hold_duration:.1f}s)"
        self._log_action("combo", combo, source, {'success': success, 'message': hold_msg if success else f'Failed to {hold_msg}'})
        return success
    
    def execute_combo_hold_until_status(self, combo: Optional[str], status_check: Callable[[Dict], bool], 
                                         max_hold: float = 3.0, source: str = "manual") -> Tuple[bool, float]:
        """
        Hold a key combo while monitoring telemetry status, releasing as soon as target status is reached
        
        Args:
            combo: Key combination to hold
            status_check: Function that takes telemetry dict and returns True when target status is reached
            max_hold: Maximum time to hold the key (safety limit, default 3 seconds)
            source: Source of the command for logging
        
        Returns:
            Tuple of (success: bool, actual_hold_time: float)
        """
        if not combo:
            self._log_action("combo", combo, source, {'success': False, 'message': 'No combo provided'})
            return False, 0.0
        if os.name != "nt" or USER32 is None:
            self._log_action("combo", combo, source, {'success': False, 'message': 'Windows only'})
            return False, 0.0
        
        # Import telemetry here to avoid circular imports
        try:
            from core import telemetry
        except ImportError:
            # Fallback to fixed duration if telemetry not available
            success = self._send_keystroke(combo, hold_duration=min(max_hold, 2.0))
            key_msg = self._format_key_message(combo)
            self._log_action("combo", combo, source, {'success': success, 'message': f'{key_msg} (held, no telemetry)'})
            return success, min(max_hold, 2.0)
        
        parts = [part.strip() for part in combo.replace("+", " ").split() if part.strip()]
        if not parts:
            return False, 0.0

        vk_codes: List[int] = []
        for part in parts:
            vk = self._key_to_vk(part)
            if vk is None:
                return False, 0.0
            vk_codes.append(vk)

        modifiers = vk_codes[:-1]
        main_key = vk_codes[-1]
        key_msg = self._format_key_message(combo)

        try:
            # Simple approach: Focus iRacing, then send keys
            print(f"[KEY-HOLD] Preparing to hold combo: {combo}")
            if not self._focus_iracing_window():
                self._last_error = "Unable to focus iRacing window"
                print(f"[KEY-HOLD] FAILED to focus iRacing window - aborting")
                self._log_action("combo", combo, source, {'success': False, 'message': f'Failed to {key_msg} - {self._last_error}'})
                return False, 0.0
            print(f"[KEY-HOLD] Successfully focused iRacing window")
            time.sleep(0.15)
            
            # Press modifiers
            for vk in modifiers:
                print(f"[KEY-HOLD] Pressing modifier: {vk} (0x{vk:02X})")
                USER32.keybd_event(vk, 0, 0, 0)
                time.sleep(0.01)
            
            # Press main key
            print(f"[KEY-HOLD] Pressing and HOLDING main key: {main_key} (0x{main_key:02X}) - '{combo}'")
            USER32.keybd_event(main_key, 0, 0, 0)
            
            # Hold and monitor status
            start_time = time.time()
            status_reached = False
            check_interval = 0.1  # Check every 100ms
            
            while (time.time() - start_time) < max_hold:
                # Check if target status reached
                current_telemetry = telemetry.get_current()
                if current_telemetry and status_check(current_telemetry):
                    status_reached = True
                    break
                
                time.sleep(check_interval)
            
            actual_hold_time = time.time() - start_time
            
            # Release main key
            print(f"[KEY-HOLD] Releasing main key after {actual_hold_time:.3f}s: {main_key} (0x{main_key:02X})")
            USER32.keybd_event(main_key, 0, KEYEVENTF_KEYUP, 0)
            
            # Release modifiers
            for vk in reversed(modifiers):
                print(f"[KEY-HOLD] Releasing modifier: {vk} (0x{vk:02X})")
                USER32.keybd_event(vk, 0, KEYEVENTF_KEYUP, 0)
            
            print(f"[KEY-HOLD] Successfully completed hold for combo: {combo} (held for {actual_hold_time:.3f}s)")
            
            if status_reached:
                hold_msg = f"{key_msg} (held for {actual_hold_time:.2f}s until status change)"
            else:
                hold_msg = f"{key_msg} (held for {actual_hold_time:.2f}s, max time reached)"
            
            self._log_action("combo", combo, source, {'success': True, 'message': hold_msg})
            return True, actual_hold_time
            
        except Exception as e:
            # Make sure to release keys even on error
            try:
                USER32.keybd_event(main_key, 0, KEYEVENTF_KEYUP, 0)
                for vk in reversed(modifiers):
                    USER32.keybd_event(vk, 0, KEYEVENTF_KEYUP, 0)
            except:
                pass
            self._log_action("combo", combo, source, {'success': False, 'message': f'Failed to {key_msg} - {str(e)}'})
            return False, 0.0

    def _key_to_vk(self, key: str) -> Optional[int]:
        key_upper = key.upper()
        if key_upper in VK_MAP:
            return VK_MAP[key_upper]
        if len(key_upper) == 1 and key_upper.isalnum():
            return ord(key_upper)
        return None

    def _focus_iracing_window(self) -> bool:
        """Focus the iRacing window. Returns True if successful."""
        if USER32 is None:
            return False
        hwnd = self._find_iracing_hwnd()
        if not hwnd:
            self._last_error = "iRacing window not found"
            return False
        
        try:
            # Get window title for logging
            length = USER32.GetWindowTextLengthW(hwnd)
            title = ""
            if length > 0:
                buffer = ctypes.create_unicode_buffer(length + 1)
                USER32.GetWindowTextW(hwnd, buffer, length + 1)
                title = buffer.value
            
            print(f"[FOCUS] Found iRacing window: HWND={hwnd}, Title='{title}'")
            
            # Restore if minimized
            if USER32.IsIconic(hwnd):
                print("[FOCUS] Window is minimized - restoring")
                USER32.ShowWindow(hwnd, SW_RESTORE)
                time.sleep(0.1)
            
            # Use AttachThreadInput to allow focus even when another window is active
            iracing_thread_id = USER32.GetWindowThreadProcessId(hwnd, None)
            current_thread_id = ctypes.windll.kernel32.GetCurrentThreadId()
            
            thread_attached = False
            if iracing_thread_id != current_thread_id:
                try:
                    thread_attached = USER32.AttachThreadInput(current_thread_id, iracing_thread_id, True)
                    if thread_attached:
                        print("[FOCUS] Thread input attached")
                        time.sleep(0.05)
                except Exception as e:
                    print(f"[FOCUS] Failed to attach thread input: {e}")
            
            # Unlock foreground window restrictions (matches working test)
            if hasattr(USER32, "LockSetForegroundWindow"):
                LSFW_UNLOCK = 2
                result = USER32.LockSetForegroundWindow(LSFW_UNLOCK)
                print(f"[FOCUS] LockSetForegroundWindow(UNLOCK) returned: {result}")
            
            # Allow iRacing to set foreground (matches working test)
            iracing_process_id = ctypes.c_ulong()
            USER32.GetWindowThreadProcessId(hwnd, ctypes.byref(iracing_process_id))
            if hasattr(USER32, "AllowSetForegroundWindow"):
                result = USER32.AllowSetForegroundWindow(iracing_process_id.value)
                print(f"[FOCUS] AllowSetForegroundWindow returned: {result}")
            
            # Try SwitchToThisWindow first (this is what works in the test)
            try:
                switch_func = ctypes.windll.user32.SwitchToThisWindow
                switch_func.argtypes = [ctypes.c_void_p, ctypes.c_bool]
                switch_func.restype = None
                switch_func(hwnd, True)
                time.sleep(0.3)  # Give it more time like the test
            except Exception as e:
                print(f"[FOCUS] SwitchToThisWindow failed: {e}")
            
            # Then try standard methods (this also works in the test)
            USER32.BringWindowToTop(hwnd)
            time.sleep(0.1)
            result_fg = USER32.SetForegroundWindow(hwnd)
            print(f"[FOCUS] SetForegroundWindow returned: {result_fg}")
            time.sleep(0.1)
            USER32.SetActiveWindow(hwnd)
            time.sleep(0.05)
            USER32.SetFocus(hwnd)
            time.sleep(0.1)  # Match test timing
            
            # Detach thread input
            if thread_attached:
                try:
                    USER32.AttachThreadInput(current_thread_id, iracing_thread_id, False)
                except Exception:
                    pass
            
            # Verify it worked (match test timing - wait a bit longer)
            time.sleep(0.2)  # Match test timing
            foreground_hwnd_after = USER32.GetForegroundWindow()
            if foreground_hwnd_after == hwnd:
                print(f"[FOCUS] SUCCESS - iRacing window is now in foreground")
                return True
            else:
                print(f"[FOCUS] FAILED - foreground is {foreground_hwnd_after}")
                self._last_error = "Failed to focus iRacing window"
                return False
        except Exception as e:
            self._last_error = f"Failed to focus iRacing window: {e}"
            print(f"[FOCUS] EXCEPTION: {e}")
            return False

    def _find_iracing_hwnd(self) -> Optional[int]:
        if USER32 is None:
            return None
        if self._cached_hwnd and USER32.IsWindow(self._cached_hwnd):
            # Verify the cached window is still valid and is actually iRacing
            try:
                length = USER32.GetWindowTextLengthW(self._cached_hwnd)
                if length > 0:
                    buffer = ctypes.create_unicode_buffer(length + 1)
                    USER32.GetWindowTextW(self._cached_hwnd, buffer, length + 1)
                    title = buffer.value.lower()
                    # Check if it's actually iRacing (not a browser)
                    if title == "iracing" or (title.startswith("iracing") and "chrome" not in title and "firefox" not in title and "edge" not in title and "browser" not in title):
                        return self._cached_hwnd
            except Exception:
                pass
            # Cache is invalid, clear it
            self._cached_hwnd = None

        matches: List[int] = []

        def enum_proc(hwnd, _lparam):
            # Skip invisible windows
            if not USER32.IsWindowVisible(hwnd):
                return True
            
            # Get window class name to identify browser windows
            class_buffer = ctypes.create_unicode_buffer(256)
            USER32.GetClassNameW(hwnd, class_buffer, 256)
            class_name = class_buffer.value.lower()
            
            # Skip browser windows by class name
            browser_classes = ["chrome", "firefox", "mozilla", "opera", "msedge", "iexplore", "brave"]
            if any(browser in class_name for browser in browser_classes):
                return True
            
            length = USER32.GetWindowTextLengthW(hwnd)
            if length <= 0:
                return True
            buffer = ctypes.create_unicode_buffer(length + 1)
            USER32.GetWindowTextW(hwnd, buffer, length + 1)
            title = buffer.value.lower()
            
            # Check if title contains browser indicators (additional check)
            is_browser = any(browser in title for browser in ["chrome", "firefox", "edge", "browser", "mozilla", "opera", "www.", "http", "://"])
            
            # Prioritize exact "iracing" match
            if title == "iracing":
                matches.insert(0, hwnd)  # Highest priority
                return False
            elif "iracing" in title and not is_browser:
                # Only add if it's not a browser window
                matches.append(hwnd)
            return True

        ENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
        enum_callback = ENUMPROC(enum_proc)
        USER32.EnumWindows(enum_callback, 0)

        # Use the first match (prioritized exact match if found)
        if matches:
            self._cached_hwnd = matches[0]
            return matches[0]
        
        # If no game window found, don't fall back to browser windows
        # Return None to indicate iRacing window not found
        return None


# Singleton access ----------------------------------------------------------
_manager: Optional[ControlsManager] = None


def get_manager() -> ControlsManager:
    global _manager
    if _manager is None:
        _manager = ControlsManager()
    return _manager


def _extract_cfg_combo(blob: bytes, names: Tuple[str, ...]) -> Tuple[Optional[str], Optional[str]]:
    keyboard = _find_binding(blob, names, binding_type=4, decoder=_decode_keyboard_binding)
    if keyboard:
        return keyboard, "keyboard"
    joystick = _find_binding(blob, names, binding_type=2, decoder=_decode_joystick_binding)
    if joystick:
        return joystick, "joystick"
    return None, None


def _find_binding(blob: bytes, control_names: Tuple[str, ...], binding_type: int, decoder) -> Optional[str]:
    for name in control_names:
        pattern = name.encode("ascii") + b"\x00"
        for match in re.finditer(pattern, blob):
            start = match.end()
            if start + 16 > len(blob):
                continue
            _, _, b_type, value = struct.unpack_from("<4I", blob, start)
            if b_type == binding_type:
                combo = decoder(value)
                if combo:
                    return combo
    return None


def _decode_keyboard_binding(value: int) -> Optional[str]:
    if value == 0:
        return None
    modifiers = []
    for flag, name in MODIFIER_FLAGS:
        if value & flag:
            modifiers.append(name)
    vk_code = value & 0xFF
    base = VK_NAMES.get(vk_code)
    if base is None:
        vk_code = value & 0xFFFF
        base = VK_NAMES.get(vk_code)
    if base is None:
        base = f"VK_{value & 0xFFFF:02X}"
    if modifiers:
        return "+".join(modifiers + [base])
    return base


def _decode_joystick_binding(value: int) -> Optional[str]:
    if value == 0:
        return None
    return f"Button{value}"

