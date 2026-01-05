# PowerShell script to upload executable to GitHub release
# Usage: .\upload-release.ps1 -Version "1.0.2"

param(
    [Parameter(Mandatory=$true)]
    [string]$Version
)

$exePath = "dist\RevShareRacing.exe"
$tagName = "v$Version"

# Check if executable exists
if (-not (Test-Path $exePath)) {
    Write-Host "ERROR: Executable not found at $exePath" -ForegroundColor Red
    Write-Host "Please build the executable first using: python build_exe.py" -ForegroundColor Yellow
    exit 1
}

# Check if GitHub CLI is installed
$ghInstalled = Get-Command gh -ErrorAction SilentlyContinue
if (-not $ghInstalled) {
    Write-Host "GitHub CLI (gh) not found. Installing..." -ForegroundColor Yellow
    Write-Host "Please install GitHub CLI from: https://cli.github.com/" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Or manually upload:" -ForegroundColor Yellow
    Write-Host "1. Go to: https://github.com/loseyco/revshareracing/releases/new" -ForegroundColor Cyan
    Write-Host "2. Tag: $tagName" -ForegroundColor Cyan
    Write-Host "3. Title: Rev Share Racing $tagName" -ForegroundColor Cyan
    Write-Host "4. Upload: $exePath" -ForegroundColor Cyan
    exit 1
}

# Check if authenticated
Write-Host "Checking GitHub authentication..." -ForegroundColor Cyan
$authStatus = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Not authenticated. Please run: gh auth login" -ForegroundColor Yellow
    exit 1
}

# Get file size
$fileSize = (Get-Item $exePath).Length / 1MB
Write-Host "Executable size: $([math]::Round($fileSize, 2)) MB" -ForegroundColor Green

# Create release
Write-Host ""
Write-Host "Creating release $tagName..." -ForegroundColor Cyan
Write-Host "This will:" -ForegroundColor Yellow
Write-Host "  - Create a new release with tag $tagName" -ForegroundColor Yellow
Write-Host "  - Upload $exePath" -ForegroundColor Yellow
Write-Host "  - Set as latest release" -ForegroundColor Yellow
Write-Host ""

$releaseNotes = @"
Rev Share Racing PC Service $tagName

## What's New

- ✅ Auto-update system - automatically checks for and installs updates
- ✅ Active rigs list on home page
- ✅ Queue system with 60-second timeout for position 1 drivers
- ✅ Improved logout handling across browsers

## Quick Start

1. **Download** `RevShareRacing.exe` from this release
2. **Run** the executable (double-click)
3. **Claim your rig** using the claim code shown in the console
4. **Start iRacing** and the service will automatically connect

## Features

- ✅ Automatic lap tracking from iRacing
- ✅ Remote control via web portal
- ✅ Real-time status updates
- ✅ Standalone executable (no installation required)
- ✅ Auto-update support

## Requirements

- Windows 10/11 (64-bit)
- iRacing installed
- Internet connection
"@

# Create release with notes
$notesFile = "release-notes-$Version.md"
$releaseNotes | Out-File -FilePath $notesFile -Encoding UTF8

try {
    gh release create $tagName `
        $exePath `
        --title "Rev Share Racing $tagName" `
        --notes-file $notesFile `
        --latest

    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Release created successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "View release at:" -ForegroundColor Cyan
        Write-Host "https://github.com/loseyco/revshareracing/releases/tag/$tagName" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "The website will automatically show this as the latest release!" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to create release" -ForegroundColor Red
        exit 1
    }
} finally {
    # Clean up notes file
    if (Test-Path $notesFile) {
        Remove-Item $notesFile
    }
}


