"""
GridPass PC Service - Configuration
Runs on rig computers to manage device status, telemetry, and queue operations.

This service communicates with the GridPass platform via secure API calls.
Each device has its own unique API key for authentication.

Configuration can be loaded from:
1. Environment variables
2. .env file
3. Hardcoded production defaults (for distributed executables)
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# ============================================
# PLATFORM CONFIGURATION
# ============================================
# GridPass platform settings
GRIDPASS_PLATFORM_NAME = "GridPass"
GRIDPASS_VERSION = "2.0.0"

# Portal URLs for different tenants (user-facing websites)
DEFAULT_PORTAL_URL = os.getenv("GRIDPASS_PORTAL_URL", "https://gridpass.app")
REVSHARERACING_PORTAL_URL = os.getenv("REVSHARERACING_PORTAL_URL", "https://revshareracing.com")

# ============================================
# API CONFIGURATION
# ============================================
# GridPass API URL (production default)
DEFAULT_GRIDPASS_API_URL = "https://gridpass.app"

# Load .env file if it exists (for development/override)
# Handle both development and PyInstaller executable paths
if getattr(sys, 'frozen', False):
    # Running as compiled executable
    base_path = Path(sys.executable).parent
else:
    # Running as script
    base_path = Path(__file__).parent.parent

env_path = base_path / '.env'
if env_path.exists():
    try:
        load_dotenv(env_path)
    except Exception as e:
        # Don't crash if .env loading fails
        print(f"[INFO] Could not load .env file: {e}")

# GridPass API Configuration
GRIDPASS_API_URL = os.getenv('GRIDPASS_API_URL', DEFAULT_GRIDPASS_API_URL)

# Data directory for storing device config
DATA_DIR = base_path / 'data'

# Device API key is stored in gridpass_config.json, not in environment
# This prevents accidental key leakage and allows per-device keys

# Server Configuration (for optional local API server)
SERVER_HOST = os.getenv('SERVER_HOST', '127.0.0.1')
SERVER_PORT = int(os.getenv('SERVER_PORT', '5000'))

# ============================================
# TENANT CONFIGURATION
# ============================================
# Default tenant ID (RevShareRacing is the primary tenant)
# This can be overridden per-device in the device_config.json
DEFAULT_TENANT_ID = os.getenv('GRIDPASS_DEFAULT_TENANT_ID', 'a0000000-0000-0000-0000-000000000001')

# ============================================
# LEGACY SUPABASE CONFIGURATION (DEPRECATED)
# ============================================
# These are kept for backward compatibility during migration
# New code should use the GridPass API client instead
SUPABASE_URL = os.getenv('SUPABASE_URL', '')
SUPABASE_ANON_KEY = os.getenv('SUPABASE_ANON_KEY', '')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')

# Flag to check if legacy mode is enabled (for gradual migration)
USE_LEGACY_SUPABASE = bool(SUPABASE_URL and SUPABASE_ANON_KEY)

# ============================================
# HELPER FUNCTIONS
# ============================================
def get_portal_url(tenant_slug: str = None) -> str:
    """Get the portal URL for a tenant."""
    if tenant_slug == "revshareracing":
        return REVSHARERACING_PORTAL_URL
    return DEFAULT_PORTAL_URL

def get_device_claim_url(device_id: str, tenant_slug: str = None) -> str:
    """Get the claim URL for a device on a specific tenant portal."""
    base_url = get_portal_url(tenant_slug)
    return f"{base_url}/device/{device_id}"

def get_data_dir() -> Path:
    """Get the data directory, creating it if needed."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    return DATA_DIR
