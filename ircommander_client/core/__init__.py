# Core modules
from . import device, telemetry, controls, joystick_config, joystick_monitor, network_discovery

# Remote desktop (optional)
try:
    from . import remote_desktop
except ImportError:
    remote_desktop = None

__all__ = ["device", "telemetry", "controls", "joystick_config", "joystick_monitor", "network_discovery", "remote_desktop"]
