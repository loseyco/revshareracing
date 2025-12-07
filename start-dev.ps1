param(
    [switch]$Headless
)

$ErrorActionPreference = "Stop"

function Start-WindowProcess {
    param (
        [Parameter(Mandatory = $true)]
        [string]$WorkingDirectory,
        [Parameter(Mandatory = $true)]
        [string]$Command
    )

    $powershellExe = "${env:WINDIR}\System32\WindowsPowerShell\v1.0\powershell.exe"
    if (-not (Test-Path $powershellExe)) {
        throw "Unable to locate powershell.exe at $powershellExe"
    }

    Start-Process -FilePath $powershellExe -ArgumentList "-NoExit", "-Command", $Command -WorkingDirectory $WorkingDirectory
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

function Set-DevEnvironmentVariables {
    param (
        [string]$EnvFile
    )

    if (-not (Test-Path $EnvFile)) {
        Write-Host "-> No .env file found at $EnvFile. Continuing without extra environment variables." -ForegroundColor Yellow
        return
    }

    Write-Host "-> Loading environment variables from $EnvFile" -ForegroundColor Gray
    Get-Content $EnvFile | Where-Object { $_ -and -not $_.StartsWith("#") } | ForEach-Object {
        if ($_ -match "^\s*([^=]+)=(.*)$") {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [System.Environment]::SetEnvironmentVariable($key, $value)
        }
    }

    if ($env:SUPABASE_URL -and -not $env:NEXT_PUBLIC_SUPABASE_URL) {
        [System.Environment]::SetEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL", $env:SUPABASE_URL)
    }
    if ($env:SUPABASE_ANON_KEY -and -not $env:NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        [System.Environment]::SetEnvironmentVariable("NEXT_PUBLIC_SUPABASE_ANON_KEY", $env:SUPABASE_ANON_KEY)
    }
}

Set-DevEnvironmentVariables -EnvFile (Join-Path $root ".env")

# Fallback Supabase defaults if not provided in env files
if (-not $env:SUPABASE_URL) {
    [System.Environment]::SetEnvironmentVariable("SUPABASE_URL", "https://wonlunpmgsnxctvgozva.supabase.co")
}
if (-not $env:SUPABASE_ANON_KEY) {
    [System.Environment]::SetEnvironmentVariable("SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indvbmx1bnBtZ3NueGN0dmdvenZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2MzQ2MTMsImV4cCI6MjA3NzIxMDYxM30.mjwYrlIZn1Dgk8mPQkwYVxFMi34s8v7qojcqxNqFPQ4")
}
if (-not $env:SUPABASE_SERVICE_ROLE_KEY) {
    [System.Environment]::SetEnvironmentVariable("SUPABASE_SERVICE_ROLE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indvbmx1bnBtZ3NueGN0dmdvenZhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTYzNDYxMywiZXhwIjoyMDc3MjEwNjEzfQ.lxRA0UV-yyxdEz8OdD2MveOmevwgl3pCT0V9HT2aaek")
}
if (-not $env:NEXT_PUBLIC_SUPABASE_URL) {
    [System.Environment]::SetEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL", [System.Environment]::GetEnvironmentVariable("SUPABASE_URL"))
}
if (-not $env:NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    [System.Environment]::SetEnvironmentVariable("NEXT_PUBLIC_SUPABASE_ANON_KEY", [System.Environment]::GetEnvironmentVariable("SUPABASE_ANON_KEY"))
}

Write-Host "Starting Rev Share Racing development environment..." -ForegroundColor Cyan

$frontendCommand = "Set-Location `"$root\web-app`"; npm run dev"
Start-WindowProcess -WorkingDirectory "$root\web-app" -Command $frontendCommand
Write-Host "-> Frontend dev server launching at http://localhost:3000" -ForegroundColor Green

if (-not $Headless) {
    # Set environment variable and run Python in the new PowerShell window
    $pcCommand = "`$env:GRIDPASS_ENV = 'development'; Set-Location `"$root\pc-service`"; python start.py"
    Start-WindowProcess -WorkingDirectory "$root\pc-service" -Command $pcCommand
    Write-Host "-> PC service starting in a new window." -ForegroundColor Green
    Write-Host "  Use CTRL+C in that window to stop the service."
} else {
    Write-Host "Skipping PC service launch (Headless switch supplied)." -ForegroundColor Yellow
}

Write-Host "`nAll processes started. Close the spawned PowerShell windows to stop them."

