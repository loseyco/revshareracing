# Fix Git Authentication for GitHub
Write-Host "=== Git Authentication Setup ===" -ForegroundColor Cyan
Write-Host ""

cd "c:\Users\pjlos\OneDrive\Projects\RevShareRacing"

# Check current remote
Write-Host "Current remote URL:" -ForegroundColor Yellow
$remote = git remote get-url origin
Write-Host $remote -ForegroundColor White
Write-Host ""

# Check if using HTTPS
if ($remote -like "https://*") {
    Write-Host "Using HTTPS authentication" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Cyan
    Write-Host "1. Use Personal Access Token (Recommended)"
    Write-Host "2. Use GitHub CLI (gh auth login)"
    Write-Host "3. Use SSH instead"
    Write-Host ""
    
    # Check if GitHub CLI is installed
    $ghInstalled = Get-Command gh -ErrorAction SilentlyContinue
    if ($ghInstalled) {
        Write-Host "GitHub CLI (gh) is installed!" -ForegroundColor Green
        Write-Host "You can run: gh auth login" -ForegroundColor Yellow
        Write-Host ""
    }
    
    Write-Host "To use Personal Access Token:" -ForegroundColor Cyan
    Write-Host "1. Go to: https://github.com/settings/tokens"
    Write-Host "2. Generate new token (classic) with 'repo' scope"
    Write-Host "3. When you push, use the token as your password"
    Write-Host ""
    
} else {
    Write-Host "Using SSH authentication" -ForegroundColor Yellow
    Write-Host "Checking SSH keys..."
    ssh-add -l 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "No SSH keys loaded. Check your SSH setup." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "=== Quick Fix: Try pushing now ===" -ForegroundColor Cyan
Write-Host "This will prompt for credentials if needed..." -ForegroundColor Yellow
Write-Host ""




