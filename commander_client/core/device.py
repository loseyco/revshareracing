"""
Device fingerprinting and identification.
"""

import hashlib
import platform
import socket
import subprocess
import uuid
from typing import Optional


def get_fingerprint() -> str:
    """Generate deterministic hardware fingerprint."""
    components = [
        platform.node(),
        platform.system(),
        platform.release(),
        platform.machine(),
        str(uuid.getnode()),
    ]
    
    # Try to get system UUID on Windows
    try:
        output = subprocess.check_output(
            ["wmic", "csproduct", "get", "uuid"],
            stderr=subprocess.DEVNULL,
            text=True,
            timeout=2
        )
        lines = [l.strip() for l in output.splitlines() if l.strip()]
        if len(lines) >= 2:
            components.append(lines[1])
    except Exception:
        pass
    
    data = "|".join(str(c) for c in components if c)
    return hashlib.sha256(data.encode()).hexdigest()


def get_hostname() -> str:
    """Get machine hostname."""
    return socket.gethostname()


def get_local_ip() -> str:
    """Get local IP address."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

