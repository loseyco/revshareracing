# Build Status Monitor
$maxChecks = 40
$checkCount = 0

Write-Host "Monitoring build status (checking every 15 seconds)..." -ForegroundColor Cyan
Write-Host ""

while ($checkCount -lt $maxChecks) {
    $checkCount++
    $timestamp = Get-Date -Format "HH:mm:ss"
    
    if (Test-Path "dist\iRCommander.exe") {
        $size = [math]::Round((Get-Item "dist\iRCommander.exe").Length / 1MB, 2)
        $modified = (Get-Item "dist\iRCommander.exe").LastWriteTime
        Write-Host "[$timestamp] BUILD COMPLETE!" -ForegroundColor Green
        Write-Host "  Location: dist\iRCommander.exe"
        Write-Host "  Size: $size MB"
        Write-Host "  Created: $modified"
        break
    } else {
        $buildFiles = Get-ChildItem -Path "build" -Recurse -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($buildFiles) {
            $lastActivity = $buildFiles.LastWriteTime
            $timeSince = (Get-Date) - $lastActivity
            $minutes = [math]::Round($timeSince.TotalMinutes, 1)
            Write-Host "[$timestamp] Still building... (Last activity: $minutes min ago)" -ForegroundColor Yellow
        } else {
            Write-Host "[$timestamp] Still building..." -ForegroundColor Yellow
        }
        Start-Sleep -Seconds 15
    }
}

if ($checkCount -ge $maxChecks) {
    Write-Host ""
    Write-Host "Monitoring timeout reached. Build may still be in progress." -ForegroundColor Red
}
