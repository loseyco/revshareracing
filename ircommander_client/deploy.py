"""
iRCommander Client - Automated Deployment Script
Deploys the client to a remote machine automatically.
"""

import os
import sys
import subprocess
import argparse
import shutil
from pathlib import Path
from typing import Optional

# Colors for output
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    RESET = '\033[0m'

def print_success(msg):
    print(f"{Colors.GREEN}✓ {msg}{Colors.RESET}")

def print_warning(msg):
    print(f"{Colors.YELLOW}⚠ {msg}{Colors.RESET}")

def print_error(msg):
    print(f"{Colors.RED}✗ {msg}{Colors.RESET}")

def print_info(msg):
    print(f"{Colors.BLUE}ℹ {msg}{Colors.RESET}")

# Get the base directory
BASE_DIR = Path(__file__).parent

# Files/directories to exclude from deployment
EXCLUDE_PATTERNS = [
    '__pycache__',
    '*.pyc',
    '*.pyo',
    '.env',
    '.git',
    'data',
    '*.log',
    '.pytest_cache',
    'venv',
    'env',
    '*.egg-info',
    'dist',
    'build',
]

def deploy_via_git(remote_path: str, branch: str = 'main'):
    """Deploy via git pull on remote machine."""
    print_info(f"Deploying via git to: {remote_path}")
    
    # Check if we're in a git repo
    if not (BASE_DIR / '.git').exists():
        print_error("Not in a git repository. Cannot use git deployment.")
        return False
    
    # Push current changes first
    print_info("Pushing local changes to remote...")
    try:
        subprocess.run(['git', 'push'], cwd=BASE_DIR, check=True)
        print_success("Local changes pushed")
    except subprocess.CalledProcessError:
        print_warning("Failed to push changes. Continuing anyway...")
    
    # Execute git pull on remote
    print_info(f"Pulling latest code on remote machine...")
    print_info(f"Run this on the remote machine:")
    print(f"  cd {remote_path}")
    print(f"  git pull origin {branch}")
    
    return True

def deploy_via_network_share(remote_path: str, network_share: str):
    """Deploy via network share (Windows UNC path)."""
    print_info(f"Deploying via network share: {network_share}")
    
    remote_dir = Path(network_share) / Path(remote_path).name
    
    # Create remote directory if it doesn't exist
    try:
        remote_dir.mkdir(parents=True, exist_ok=True)
        print_success(f"Remote directory ready: {remote_dir}")
    except Exception as e:
        print_error(f"Failed to create remote directory: {e}")
        return False
    
    # Copy files
    print_info("Copying files...")
    copied = 0
    skipped = 0
    
    for item in BASE_DIR.rglob('*'):
        # Skip excluded patterns
        if any(pattern in str(item.relative_to(BASE_DIR)) for pattern in EXCLUDE_PATTERNS):
            continue
        
        if item.is_file():
            rel_path = item.relative_to(BASE_DIR)
            dest_path = remote_dir / rel_path
            
            # Create parent directories
            dest_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Copy file
            try:
                shutil.copy2(item, dest_path)
                copied += 1
            except Exception as e:
                print_warning(f"Failed to copy {rel_path}: {e}")
                skipped += 1
    
    print_success(f"Copied {copied} files")
    if skipped > 0:
        print_warning(f"Skipped {skipped} files")
    
    return True

def deploy_via_rsync(remote_path: str, remote_host: str, ssh_user: Optional[str] = None):
    """Deploy via rsync (requires rsync on both machines)."""
    print_info(f"Deploying via rsync to {remote_host}:{remote_path}")
    
    # Build rsync command
    exclude_args = []
    for pattern in EXCLUDE_PATTERNS:
        exclude_args.extend(['--exclude', pattern])
    
    remote = f"{remote_host}:{remote_path}" if not ssh_user else f"{ssh_user}@{remote_host}:{remote_path}"
    
    cmd = [
        'rsync',
        '-avz',
        '--delete',
        *exclude_args,
        f"{BASE_DIR}/",
        remote
    ]
    
    print_info(f"Running: {' '.join(cmd)}")
    try:
        subprocess.run(cmd, check=True)
        print_success("Deployment complete via rsync")
        return True
    except subprocess.CalledProcessError as e:
        print_error(f"rsync failed: {e}")
        return False
    except FileNotFoundError:
        print_error("rsync not found. Install rsync to use this method.")
        return False

def deploy_via_scp(remote_path: str, remote_host: str, ssh_user: Optional[str] = None):
    """Deploy via scp (simple file copy over SSH)."""
    print_info(f"Deploying via scp to {remote_host}:{remote_path}")
    
    # Create a temporary archive
    import tempfile
    import tarfile
    
    with tempfile.NamedTemporaryFile(suffix='.tar.gz', delete=False) as tmp:
        archive_path = tmp.name
    
    print_info("Creating archive...")
    try:
        with tarfile.open(archive_path, 'w:gz') as tar:
            for item in BASE_DIR.rglob('*'):
                # Skip excluded patterns
                if any(pattern in str(item.relative_to(BASE_DIR)) for pattern in EXCLUDE_PATTERNS):
                    continue
                
                if item.is_file():
                    tar.add(item, arcname=item.relative_to(BASE_DIR))
        
        print_success("Archive created")
        
        # Copy to remote
        remote = f"{remote_host}:{remote_path}" if not ssh_user else f"{ssh_user}@{remote_host}:{remote_path}"
        remote_archive = f"{remote}/ircommander_client.tar.gz"
        
        print_info("Copying archive to remote...")
        subprocess.run(['scp', archive_path, remote_archive], check=True)
        
        print_info("Extracting on remote...")
        print_info(f"Run this on the remote machine:")
        print(f"  cd {remote_path}")
        print(f"  tar -xzf ircommander_client.tar.gz")
        print(f"  rm ircommander_client.tar.gz")
        
        return True
    except Exception as e:
        print_error(f"Deployment failed: {e}")
        return False
    finally:
        # Cleanup
        if os.path.exists(archive_path):
            os.unlink(archive_path)

def create_setup_script(remote_path: str, output_path: Optional[Path] = None):
    """Create a setup script for the remote machine."""
    if output_path is None:
        output_path = BASE_DIR / 'remote_setup.bat'
    
    script_content = f"""@echo off
REM iRCommander Client - Remote Machine Setup Script
REM Run this on the remote machine after deployment

cd /d "%~dp0"
cd "{remote_path}"

echo ========================================
echo iRCommander Client - Setup
echo ========================================

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found! Please install Python 3.10+
    pause
    exit /b 1
)

echo [OK] Python found

REM Create virtual environment if it doesn't exist
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
call venv\\Scripts\\activate.bat

REM Install/update dependencies
echo Installing dependencies...
pip install --upgrade pip
pip install -r requirements.txt

REM Check for .env file
if not exist ".env" (
    echo.
    echo ========================================
    echo WARNING: .env file not found!
    echo ========================================
    echo Please create a .env file with your Supabase credentials.
    echo Copy config.example.env to .env and fill in the values.
    echo.
    copy config.example.env .env
    echo.
    echo Please edit .env and add your Supabase credentials.
    pause
)

echo.
echo ========================================
echo Setup complete!
echo ========================================
echo.
echo To run the client:
echo   dev_start.bat          - Development mode with GUI
echo   dev_start_headless.bat - Development mode headless
echo   python main.py         - Production mode with GUI
echo   python main.py --headless - Production mode headless
echo.
pause
"""
    
    output_path.write_text(script_content)
    print_success(f"Setup script created: {output_path}")
    return output_path

def main():
    parser = argparse.ArgumentParser(description="Deploy iRCommander Client to remote machine")
    parser.add_argument('--method', '-m', 
                       choices=['git', 'network', 'rsync', 'scp'],
                       default='git',
                       help='Deployment method')
    parser.add_argument('--remote-path', '-p', required=True,
                       help='Path on remote machine (e.g., C:\\ircommander_client or /home/user/ircommander_client)')
    parser.add_argument('--network-share', '-n',
                       help='Network share path (e.g., \\\\machine\\share) - for network method')
    parser.add_argument('--remote-host', '-h',
                       help='Remote hostname/IP - for rsync/scp methods')
    parser.add_argument('--ssh-user', '-u',
                       help='SSH username - for rsync/scp methods')
    parser.add_argument('--branch', '-b', default='main',
                       help='Git branch to deploy (for git method)')
    parser.add_argument('--create-setup', action='store_true',
                       help='Create setup script for remote machine')
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("iRCommander Client - Deployment")
    print("=" * 60)
    print()
    
    success = False
    
    if args.method == 'git':
        success = deploy_via_git(args.remote_path, args.branch)
    elif args.method == 'network':
        if not args.network_share:
            print_error("--network-share required for network method")
            sys.exit(1)
        success = deploy_via_network_share(args.remote_path, args.network_share)
    elif args.method == 'rsync':
        if not args.remote_host:
            print_error("--remote-host required for rsync method")
            sys.exit(1)
        success = deploy_via_rsync(args.remote_path, args.remote_host, args.ssh_user)
    elif args.method == 'scp':
        if not args.remote_host:
            print_error("--remote-host required for scp method")
            sys.exit(1)
        success = deploy_via_scp(args.remote_path, args.remote_host, args.ssh_user)
    
    if success:
        print()
        print_success("Deployment initiated successfully!")
        
        if args.create_setup:
            create_setup_script(args.remote_path)
            print()
            print_info("Next steps:")
            print("1. Copy remote_setup.bat to the remote machine")
            print("2. Run remote_setup.bat on the remote machine")
            print("3. Configure .env file with Supabase credentials")
    else:
        print()
        print_error("Deployment failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()
