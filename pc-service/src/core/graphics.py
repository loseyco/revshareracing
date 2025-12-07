"""
Graphics Config Module
Reads iRacing graphics configuration to determine UI element positions
"""

import os
import re
from pathlib import Path
from typing import Dict, Optional, Tuple


class GraphicsConfig:
    """Parses iRacing graphics configuration for UI element positions"""
    
    def __init__(self):
        self._iracing_dirs = self._discover_iracing_dirs()
        self._graphics_ini_path: Optional[Path] = None
        self._config_cache: Dict[str, str] = {}
        self._last_load_time: float = 0.0
    
    def _discover_iracing_dirs(self) -> list[Path]:
        """Discover iRacing installation directories"""
        profile = Path(os.environ.get("USERPROFILE", "")).expanduser()
        candidates = []
        
        env_override = os.environ.get("IRACING_DIR")
        if env_override:
            override_path = Path(env_override).expanduser()
            if override_path.exists():
                candidates.append(override_path)
        
        if profile.exists():
            # Check OneDrive paths first
            candidates.extend(sorted(profile.glob("OneDrive - */Documents/iRacing")))
            candidates.append(profile / "OneDrive" / "Documents" / "iRacing")
            # Fallback to standard Documents
            candidates.append(profile / "Documents" / "iRacing")
        
        seen = set()
        unique = []
        for path in candidates:
            if not path:
                continue
            key = str(path.resolve()).lower()
            if key in seen:
                continue
            seen.add(key)
            unique.append(path)
        
        return unique or [Path.home() / "Documents" / "iRacing"]
    
    def _find_graphics_ini(self) -> Optional[Path]:
        """Find the graphics.ini file"""
        for root in self._iracing_dirs:
            ini_path = root / "graphics.ini"
            if ini_path.exists():
                return ini_path
        return None
    
    def load_config(self, force: bool = False) -> Dict[str, str]:
        """Load graphics configuration"""
        import time
        
        if not force and (time.time() - self._last_load_time) < 60:
            return self._config_cache
        
        ini_path = self._find_graphics_ini()
        if not ini_path:
            return {}
        
        self._graphics_ini_path = ini_path
        config = {}
        
        try:
            content = ini_path.read_text(encoding='utf-8', errors='ignore')
            # Parse key=value pairs
            for line in content.splitlines():
                line = line.strip()
                if not line or line.startswith(';') or line.startswith('#'):
                    continue
                if '=' not in line:
                    continue
                key, value = line.split('=', 1)
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if key:
                    config[key.lower()] = value
        except Exception as e:
            print(f"[WARN] Failed to parse graphics.ini: {e}")
            return {}
        
        self._config_cache = config
        self._last_load_time = time.time()
        return config
    
    def get_resolution(self) -> Optional[Tuple[int, int]]:
        """Get screen resolution from config"""
        config = self.load_config()
        width = config.get('width') or config.get('resx')
        height = config.get('height') or config.get('resy')
        
        if width and height:
            try:
                return (int(width), int(height))
            except ValueError:
                pass
        
        return None
    
    def get_ui_scale(self) -> float:
        """Get UI scale factor"""
        config = self.load_config()
        scale = config.get('uiscale') or config.get('ui_scale') or '1.0'
        try:
            return float(scale)
        except ValueError:
            return 1.0


# Singleton instance
_graphics_config: Optional[GraphicsConfig] = None

def get_graphics_config() -> GraphicsConfig:
    """Get or create GraphicsConfig instance"""
    global _graphics_config
    if _graphics_config is None:
        _graphics_config = GraphicsConfig()
    return _graphics_config








