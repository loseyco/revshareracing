# iRCommander Client - Automated Deployment Guide

This guide explains how to automatically deploy the `ircommander_client` to another machine for development testing.

## Quick Start

### Option 1: Git Deployment (Recommended)

If both machines have access to the same git repository:

```powershell
# On your development machine
cd ircommander_client
python deploy.py --method git --remote-path "C:\ircommander_client" --create-setup
```

Then on the remote machine:
```bash
cd C:\ircommander_client
git pull origin main
remote_setup.bat
```

### Option 2: Network Share Deployment (Windows)

If both machines are on the same network:

```powershell
# On your development machine
cd ircommander_client
.\deploy.ps1 -Method network -NetworkShare "\\REMOTE_MACHINE\C$\ircommander_client" -RemotePath "C:\ircommander_client" -CreateSetup
```

Or using Python:
```bash
python deploy.py --method network --network-share "\\REMOTE_MACHINE\C$\ircommander_client" --remote-path "C:\ircommander_client" --create-setup
```

### Option 3: SSH/SCP Deployment (Cross-platform)

For Linux/Mac or Windows with SSH:

```bash
# Using rsync (most efficient)
python deploy.py --method rsync --remote-host "user@remote-machine" --remote-path "/home/user/ircommander_client"

# Using scp (simpler, creates archive)
python deploy.py --method scp --remote-host "user@remote-machine" --remote-path "/home/user/ircommander_client"
```

## Deployment Methods

### 1. Git Deployment

**Best for:** Machines with git access to the same repository

**Requirements:**
- Both machines have git installed
- Both machines have access to the git repository
- Changes are committed and pushed

**Usage:**
```bash
python deploy.py --method git --remote-path "C:\ircommander_client" --branch main
```

**Process:**
1. Pushes local changes to git remote
2. Provides commands to run on remote machine
3. Remote machine pulls latest code

### 2. Network Share Deployment

**Best for:** Windows machines on the same network

**Requirements:**
- Both machines on same network
- Network share accessible (UNC path)
- Appropriate permissions

**Usage:**
```powershell
.\deploy.ps1 -Method network -NetworkShare "\\MACHINE\Share" -RemotePath "C:\ircommander_client"
```

**Process:**
1. Connects to network share
2. Copies all files (excluding .env, __pycache__, etc.)
3. Uses robocopy for efficient copying

### 3. Rsync Deployment

**Best for:** Linux/Mac or Windows with rsync installed

**Requirements:**
- rsync installed on both machines
- SSH access to remote machine

**Usage:**
```bash
python deploy.py --method rsync --remote-host "user@remote" --remote-path "/path/to/client" --ssh-user "user"
```

**Process:**
1. Uses rsync to sync files efficiently
2. Only transfers changed files
3. Handles deletions automatically

### 4. SCP Deployment

**Best for:** Simple file copy over SSH

**Requirements:**
- SSH access to remote machine
- tar/gzip on remote machine

**Usage:**
```bash
python deploy.py --method scp --remote-host "user@remote" --remote-path "/path/to/client"
```

**Process:**
1. Creates compressed archive
2. Copies archive to remote
3. Provides extraction commands

## Remote Machine Setup

After deploying files, you need to set up the environment on the remote machine:

### Automatic Setup

If you used `--create-setup`, a `remote_setup.bat` script was created. Copy it to the remote machine and run it:

```bash
remote_setup.bat
```

### Manual Setup

1. **Install Python 3.10+** (if not already installed)

2. **Create virtual environment:**
   ```bash
   cd C:\ircommander_client
   python -m venv venv
   venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

4. **Configure environment:**
   ```bash
   copy config.example.env .env
   # Edit .env and add your Supabase credentials
   ```

5. **Test the client:**
   ```bash
   # Development mode with auto-reload
   dev_start.bat
   
   # Or headless
   dev_start_headless.bat
   ```

## Continuous Deployment

### Using Git with Auto-Pull Script

Create a script on the remote machine that automatically pulls and restarts:

**auto_update.bat:**
```batch
@echo off
cd C:\ircommander_client
git pull origin main
if errorlevel 1 (
    echo Git pull failed
    pause
    exit /b 1
)
echo Update complete. Restart the client to apply changes.
pause
```

### Using Task Scheduler (Windows)

1. Create a scheduled task that runs `auto_update.bat` periodically
2. Or use a file watcher to detect changes and auto-restart

### Using Development Mode Auto-Reload

The client has built-in auto-reload in development mode. Just run:

```bash
dev_start.bat
```

This watches for code changes and automatically restarts the application. Combined with git pull, you can have near-instant updates.

## Troubleshooting

### Network Share Not Accessible

- Check network connectivity
- Verify share permissions
- Try mapping the network drive first:
  ```powershell
  net use Z: \\MACHINE\Share
  ```

### Git Pull Fails

- Check git credentials
- Verify remote repository access
- Check for uncommitted changes on remote

### Python Not Found

- Install Python 3.10+ from python.org
- Add Python to PATH during installation
- Restart terminal after installation

### Dependencies Installation Fails

- Update pip: `python -m pip install --upgrade pip`
- Check internet connection
- Try installing packages individually to identify issues

### .env File Missing

- Copy `config.example.env` to `.env`
- Fill in Supabase credentials from your Supabase dashboard
- Make sure `.env` is in the `ircommander_client` directory

## Best Practices

1. **Always test locally first** before deploying to remote
2. **Use git for version control** - commit changes before deploying
3. **Keep .env files separate** - never commit `.env` to git
4. **Use virtual environments** - isolate dependencies per machine
5. **Document remote machine setup** - note any machine-specific configurations
6. **Use development mode** - enables auto-reload for faster iteration

## Example Workflow

1. **Make changes on development machine:**
   ```bash
   # Edit code
   # Test locally
   git add .
   git commit -m "New feature"
   ```

2. **Deploy to remote:**
   ```powershell
   python deploy.py --method git --remote-path "C:\ircommander_client" --create-setup
   ```

3. **On remote machine:**
   ```bash
   git pull origin main
   remote_setup.bat  # Only needed first time or after dependency changes
   dev_start.bat     # Starts with auto-reload
   ```

4. **Future updates:**
   - Just run `git pull` on remote
   - Auto-reload will detect changes and restart automatically

## Advanced: Automated Sync Script

Create a script that continuously syncs changes:

**sync_to_remote.ps1:**
```powershell
$RemotePath = "C:\ircommander_client"
$NetworkShare = "\\REMOTE_MACHINE\C$\ircommander_client"

while ($true) {
    Write-Host "Syncing to remote..." -ForegroundColor Cyan
    .\deploy.ps1 -Method network -NetworkShare $NetworkShare -RemotePath $RemotePath
    Write-Host "Waiting 30 seconds..." -ForegroundColor Yellow
    Start-Sleep -Seconds 30
}
```

Run this in a separate terminal while developing, and changes will automatically sync every 30 seconds.
