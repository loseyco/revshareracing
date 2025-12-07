"""
iRacing Commander V4 - Configuration
Loads configuration from environment variables
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load .env file if it exists
# Handle both development and PyInstaller executable paths
if getattr(sys, 'frozen', False):
    # Running as compiled executable
    base_path = Path(sys.executable).parent
else:
    # Running as script
    base_path = Path(__file__).parent.parent

env_path = base_path / '.env'
if env_path.exists():
    load_dotenv(env_path)

# Supabase Configuration
SUPABASE_URL = os.getenv('SUPABASE_URL', '')
SUPABASE_ANON_KEY = os.getenv('SUPABASE_ANON_KEY', '')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')

# Server Configuration (for optional API server)
SERVER_HOST = os.getenv('SERVER_HOST', '127.0.0.1')
SERVER_PORT = int(os.getenv('SERVER_PORT', '5000'))

# Validate required config
if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    print("[WARN] Supabase configuration missing!")
    print("[WARN] Please set SUPABASE_URL and SUPABASE_ANON_KEY in .env file")

