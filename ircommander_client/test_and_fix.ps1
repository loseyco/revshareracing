# Test and Fix Script for iRCommander
# This script will test the full flow and show results

Write-Host "========================================"
Write-Host "iRCommander Full Test & Fix Script"
Write-Host "========================================"
Write-Host ""

# Check if Next.js server is running
Write-Host "[1] Checking if Next.js server is running..."
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/v1/auth/login" -Method POST -Body (@{email="test";password="test"} | ConvertTo-Json) -ContentType "application/json" -TimeoutSec 3 -ErrorAction Stop
    Write-Host "    [OK] Server is running on port 3001"
} catch {
    Write-Host "    [ERROR] Server is NOT running on port 3001"
    Write-Host "    Please start it with: cd ircommander && npm run dev"
    Write-Host ""
    Write-Host "    Waiting 10 seconds for you to start it..."
    Start-Sleep -Seconds 10
    
    # Try again
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3001/api/v1/auth/login" -Method POST -Body (@{email="test";password="test"} | ConvertTo-Json) -ContentType "application/json" -TimeoutSec 3 -ErrorAction Stop
        Write-Host "    [OK] Server is now running"
    } catch {
        Write-Host "    [ERROR] Server still not responding. Please start it manually."
        exit 1
    }
}

Write-Host ""
Write-Host "[2] Running full flow test..."
Write-Host ""

# Run the Python test
$testScript = Join-Path $PSScriptRoot "test_full_flow.py"
if (-not (Test-Path $testScript)) {
    Write-Host "[ERROR] test_full_flow.py not found"
    exit 1
}

python $testScript pjlosey@outlook.com "!Google1!"

Write-Host ""
Write-Host "========================================"
Write-Host "Test Complete"
Write-Host "========================================"
