"""
Joystick Button Configuration
Stores which joystick buttons should trigger which actions
"""

import json
from pathlib import Path
from typing import Dict, Optional
from config import DATA_DIR


class JoystickConfig:
    """Manages joystick button to action mappings."""
    
    def __init__(self):
        self.config_path = DATA_DIR / "joystick_config.json"
        self.config: Dict[str, Optional[int]] = {
            "enter_reset_button": None,  # Single button for both enter_car and reset_car
        }
        self.load()
    
    def load(self):
        """Load configuration from file."""
        if self.config_path.exists():
            try:
                data = json.loads(self.config_path.read_text())
                self.config.update(data)
            except Exception as e:
                print(f"[WARN] Failed to load joystick config: {e}")
    
    def save(self):
        """Save configuration to file."""
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        self.config_path.write_text(json.dumps(self.config, indent=2))
    
    def set_button(self, action: str, button_num: Optional[int]):
        """Set joystick button for an action."""
        # Both enter_car and reset_car use the same button
        if action in ("enter_car", "reset_car"):
            self.config["enter_reset_button"] = button_num
            self.save()
            return True
        key = f"{action}_button"
        if key in self.config:
            self.config[key] = button_num
            self.save()
            return True
        return False
    
    def get_button(self, action: str) -> Optional[int]:
        """Get joystick button number for an action."""
        # Both enter_car and reset_car use the same button
        if action in ("enter_car", "reset_car"):
            return self.config.get("enter_reset_button")
        key = f"{action}_button"
        return self.config.get(key)
    
    def get_all(self) -> Dict[str, Optional[int]]:
        """Get all button mappings."""
        return self.config.copy()


# Singleton
_config: Optional[JoystickConfig] = None

def get_config() -> JoystickConfig:
    global _config
    if _config is None:
        _config = JoystickConfig()
    return _config

