# Quick build status checker
$buildLog = "C:\Users\pjlos\.cursor\projects\c-Users-pjlos-OneDrive-Projects-RevShareRacing\terminals\817606.txt"
$exePath = "C:\Users\pjlos\OneDrive\Projects\RevShareRacing\ircommander_client\dist\iRCommander.exe"

Write-Host "=== Build Status ===" -ForegroundColor Cyan
Write-Host ""

# Check if executable exists
if (Test-Path $exePath) {
    $exe = Get-Item $exePath
    $sizeMB = [math]::Round($exe.Length / 1MB, 2)
    Write-Host "[OK] Build Complete!" -ForegroundColor Green
    Write-Host "  Executable: $($exe.Name)" -ForegroundColor White
    Write-Host "  Size: $sizeMB MB" -ForegroundColor White
    Write-Host "  Created: $($exe.CreationTime)" -ForegroundColor White
} else {
    Write-Host "[IN PROGRESS] Build still running..." -ForegroundColor Yellow
    
    # Check if Python is running
    $pythonProcs = Get-Process python -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*Python*" }
    if ($pythonProcs) {
        Write-Host "  Python processes: $($pythonProcs.Count) running" -ForegroundColor White
        $totalCPU = ($pythonProcs | Measure-Object -Property CPU -Sum).Sum
        Write-Host "  Total CPU time: $([math]::Round($totalCPU, 2))s" -ForegroundColor White
    }
    
    # Check build folder
    $buildFiles = Get-ChildItem "C:\Users\pjlos\OneDrive\Projects\RevShareRacing\ircommander_client\build" -Recurse -ErrorAction SilentlyContinue | Measure-Object
    if ($buildFiles.Count -gt 0) {
        Write-Host "  Build files: $($buildFiles.Count) files" -ForegroundColor White
    }
}

Write-Host ""
Write-Host "=== Recent Log Output ===" -ForegroundColor Cyan
if (Test-Path $buildLog) {
    Get-Content $buildLog -Tail 10 | ForEach-Object {
        if ($_ -match "\[OK\]|\[ERROR\]|\[WARN\]|\[INFO\]") {
            $color = switch -Regex ($_) {
                "\[OK\]" { "Green" }
                "\[ERROR\]" { "Red" }
                "\[WARN\]" { "Yellow" }
                default { "White" }
            }
            Write-Host $_ -ForegroundColor $color
        } else {
            Write-Host $_ -ForegroundColor Gray
        }
    }
} else {
    Write-Host "Log file not found" -ForegroundColor Red
}
