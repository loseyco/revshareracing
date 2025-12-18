"""
GridPass Commander Client - Configuration
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

# Load .env if exists
env_path = BASE_PATH / '.env'
if env_path.exists():
    load_dotenv(env_path)

# API Configuration
GRIDPASS_API_URL = os.getenv('GRIDPASS_API_URL', 'https://commander.gridpass.app')

# Data directory
DATA_DIR = BASE_PATH / 'data'
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Intervals (seconds)
HEARTBEAT_INTERVAL = 30
COMMAND_POLL_INTERVAL = 2
TELEMETRY_UPDATE_RATE = 0.016  # ~60Hz

