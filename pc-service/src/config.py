"""
Rev Share Racing - Configuration
Loads configuration from environment variables or uses hardcoded production defaults
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Production Supabase configuration (hardcoded for client distribution)
# These are the default values - can be overridden by .env file for development
DEFAULT_SUPABASE_URL = "https://wonlunpmgsnxctvgozva.supabase.co"
DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indvbmx1bnBtZ3NueGN0dmdvenZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2MzQ2MTMsImV4cCI6MjA3NzIxMDYxM30.mjwYrlIZn1Dgk8mPQkwYVxFMi34s8v7qojcqxNqFPQ4"
DEFAULT_SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indvbmx1bnBtZ3NueGN0dmdvenZhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTYzNDYxMywiZXhwIjoyMDc3MjEwNjEzfQ.lxRA0UV-yyxdEz8OdD2MveOmevwgl3pCT0V9HT2aaek"

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

# Supabase Configuration
# Use environment variables if set, otherwise use production defaults
# This allows .env to override for development, but works without it for end users
SUPABASE_URL = os.getenv('SUPABASE_URL', DEFAULT_SUPABASE_URL)
SUPABASE_ANON_KEY = os.getenv('SUPABASE_ANON_KEY', DEFAULT_SUPABASE_ANON_KEY)
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY', DEFAULT_SUPABASE_SERVICE_ROLE_KEY)

# Server Configuration (for optional API server)
SERVER_HOST = os.getenv('SERVER_HOST', '127.0.0.1')
SERVER_PORT = int(os.getenv('SERVER_PORT', '5000'))

# Configuration is ready - no validation needed since we have defaults

