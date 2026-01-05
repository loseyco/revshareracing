# iRCommander Client - PowerShell Deployment Script
# Deploys the client to a remote machine automatically

param(
    [Parameter(Mandatory=$true)]
    [string]$RemotePath,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet('git', 'network', 'robocopy')]
    [string]$Method = 'git',
    
    [Parameter(Mandatory=$false)]
    [string]$NetworkShare,
    
    [Parameter(Mandatory=$false)]
    [string]$Branch = 'main',
    
    [Parameter(Mandatory=$false)]
    [switch]$CreateSetup
)

$ErrorActionPreference = "Stop"

# Colors
function Write-Success { Write-Host "✓ $args" -ForegroundColor Green }
function Write-Warning { Write-Host "⚠ $args" -ForegroundColor Yellow }
function Write-Error { Write-Host "✗ $args" -ForegroundColor Red }
function Write-Info { Write-Host "ℹ $args" -ForegroundColor Cyan }

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BaseDir = $ScriptDir

# Files/directories to exclude
$ExcludePatterns = @(
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
    'build'
)

Write-Host "=" * 60
Write-Host "iRCommander Client - Deployment"
Write-Host "=" * 60
Write-Host ""

function Deploy-ViaGit {
    param([string]$RemotePath, [string]$Branch)
    
    Write-Info "Deploying via git to: $RemotePath"
    
    # Check if we're in a git repo
    if (-not (Test-Path (Join-Path $BaseDir '.git'))) {
        Write-Error "Not in a git repository. Cannot use git deployment."
        return $false
    }
    
    # Push current changes
    Write-Info "Pushing local changes to remote..."
    try {
        Push-Location $BaseDir
        $result = git push 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Failed to push changes. Continuing anyway..."
        } else {
            Write-Success "Local changes pushed"
        }
    } finally {
        Pop-Location
    }
    
    Write-Info "Pulling latest code on remote machine..."
    Write-Info "Run this on the remote machine:"
    Write-Host "  cd $RemotePath"
    Write-Host "  git pull origin $Branch"
    
    return $true
}

function Deploy-ViaNetwork {
    param([string]$RemotePath, [string]$NetworkShare)
    
    Write-Info "Deploying via network share: $NetworkShare"
    
    $RemoteDir = Join-Path $NetworkShare (Split-Path -Leaf $RemotePath)
    
    # Test network connection
    if (-not (Test-Path $NetworkShare)) {
        Write-Error "Cannot access network share: $NetworkShare"
        Write-Info "Make sure the network share is accessible and you have permissions"
        return $false
    }
    
    # Create remote directory
    try {
        if (-not (Test-Path $RemoteDir)) {
            New-Item -ItemType Directory -Path $RemoteDir -Force | Out-Null
        }
        Write-Success "Remote directory ready: $RemoteDir"
    } catch {
        Write-Error "Failed to create remote directory: $_"
        return $false
    }
    
    # Use robocopy for efficient file copying
    Write-Info "Copying files using robocopy..."
    
    $RobocopyArgs = @(
        $BaseDir,
        $RemoteDir,
        '/E',           # Copy subdirectories including empty ones
        '/XD',          # Exclude directories
        '__pycache__', '.git', 'data', 'venv', 'env', 'dist', 'build', '.pytest_cache'
    )
    
    # Add file exclusions
    $RobocopyArgs += '/XF'
    $RobocopyArgs += '*.pyc', '*.pyo', '*.log', '*.egg-info'
    
    $RobocopyArgs += '/NFL', '/NDL', '/NP'  # Less verbose output
    
    try {
        $result = & robocopy @RobocopyArgs
        $exitCode = $LASTEXITCODE
        
        # Robocopy returns 0-7 for success, 8+ for errors
        if ($exitCode -lt 8) {
            Write-Success "Files copied successfully"
            return $true
        } else {
            Write-Error "Robocopy failed with exit code: $exitCode"
            return $false
        }
    } catch {
        Write-Error "Failed to copy files: $_"
        return $false
    }
}

function New-SetupScript {
    param([string]$RemotePath, [string]$OutputPath)
    
    $ScriptContent = @"
@echo off
REM iRCommander Client - Remote Machine Setup Script
REM Run this on the remote machine after deployment

cd /d "%~dp0"
cd "$RemotePath"

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
call venv\Scripts\activate.bat

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
"@
    
    $OutputPath | Out-File -FilePath $OutputPath -Encoding ASCII
    Write-Success "Setup script created: $OutputPath"
}

# Main deployment logic
$Success = $false

try {
    switch ($Method) {
        'git' {
            $Success = Deploy-ViaGit -RemotePath $RemotePath -Branch $Branch
        }
        'network' {
            if (-not $NetworkShare) {
                Write-Error "--NetworkShare required for network method"
                exit 1
            }
            $Success = Deploy-ViaNetwork -RemotePath $RemotePath -NetworkShare $NetworkShare
        }
        'robocopy' {
            if (-not $NetworkShare) {
                Write-Error "--NetworkShare required for robocopy method"
                exit 1
            }
            $Success = Deploy-ViaNetwork -RemotePath $RemotePath -NetworkShare $NetworkShare
        }
    }
    
    if ($Success) {
        Write-Host ""
        Write-Success "Deployment initiated successfully!"
        
        if ($CreateSetup) {
            $SetupScriptPath = Join-Path $BaseDir 'remote_setup.bat'
            New-SetupScript -RemotePath $RemotePath -OutputPath $SetupScriptPath
            Write-Host ""
            Write-Info "Next steps:"
            Write-Host "1. Copy remote_setup.bat to the remote machine"
            Write-Host "2. Run remote_setup.bat on the remote machine"
            Write-Host "3. Configure .env file with Supabase credentials"
        }
    } else {
        Write-Host ""
        Write-Error "Deployment failed!"
        exit 1
    }
} catch {
    Write-Error "Deployment error: $_"
    exit 1
}
