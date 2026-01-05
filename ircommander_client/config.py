"""
iRCommander Client - Configuration
Lightweight, API-first configuration.
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Version
VERSION = "1.0.0"

# Determine base path
if getattr(sys, 'frozen', False):
    BASE_PATH = Path(sys.executable).parent
else:
    BASE_PATH = Path(__file__).parent

# Try to load embedded credentials first (for production builds)
try:
    from credentials import SUPABASE_URL as EMBEDDED_URL, \
                           SUPABASE_ANON_KEY as EMBEDDED_ANON_KEY, \
                           SUPABASE_SERVICE_ROLE_KEY as EMBEDDED_SERVICE_KEY
    # Use embedded credentials if they're set
    _default_url = EMBEDDED_URL if EMBEDDED_URL else ''
    _default_anon = EMBEDDED_ANON_KEY if EMBEDDED_ANON_KEY else ''
    _default_service = EMBEDDED_SERVICE_KEY if EMBEDDED_SERVICE_KEY else ''
except ImportError:
    # No embedded credentials, will use .env or environment variables
    _default_url = ''
    _default_anon = ''
    _default_service = ''

# Load .env if exists (for development - overrides embedded credentials)
env_path = BASE_PATH / '.env'
if env_path.exists():
    load_dotenv(env_path)

# Supabase Configuration
# Priority: .env file > environment variables > embedded credentials
SUPABASE_URL = os.getenv('SUPABASE_URL', _default_url)
SUPABASE_ANON_KEY = os.getenv('SUPABASE_ANON_KEY', _default_anon)
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY', _default_service)

# Legacy API URL support (for backward compatibility, but not used)
IRCOMMANDER_API_URL = os.getenv('IRCOMMANDER_API_URL', '')
GRIDPASS_API_URL = os.getenv('GRIDPASS_API_URL', '')

# Data directory
DATA_DIR = BASE_PATH / 'data'
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Intervals (seconds)
HEARTBEAT_INTERVAL = 30
COMMAND_POLL_INTERVAL = 2
TELEMETRY_UPDATE_RATE = 0.016  # ~60Hz

