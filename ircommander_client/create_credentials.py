"""Helper script to create credentials.py file."""
import sys

url = sys.argv[1] if len(sys.argv) > 1 else ''
anon = sys.argv[2] if len(sys.argv) > 2 else ''
service = sys.argv[3] if len(sys.argv) > 3 else ''

content = f"""# Embedded Credentials for iRCommander Client
# This file is generated during the build process.
# DO NOT commit this file to version control.

SUPABASE_URL = r"{url}"
SUPABASE_ANON_KEY = r"{anon}"
SUPABASE_SERVICE_ROLE_KEY = r"{service}"
"""

with open('credentials.py', 'w') as f:
    f.write(content)
