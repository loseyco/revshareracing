# iRCommander API Test Script
# Tests all major API endpoints

$baseUrl = "https://ircommander-dqtp5bc6q-pj-loseys-projects.vercel.app"
# Or use local: $baseUrl = "http://localhost:3001"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "iRCommander API Tests" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Health Check
Write-Host "[1/6] Testing Health Endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/v1/health" -Method Get
    if ($response.status -eq "healthy" -and $response.api -eq "iRCommander API") {
        Write-Host "  ✅ Health check passed" -ForegroundColor Green
        Write-Host "     API: $($response.api)" -ForegroundColor Gray
        Write-Host "     Version: $($response.version)" -ForegroundColor Gray
    } else {
        Write-Host "  ❌ Health check failed - unexpected response" -ForegroundColor Red
    }
} catch {
    Write-Host "  ❌ Health check failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 2: Auth Register (if you have test credentials)
Write-Host "[2/6] Testing Auth Register..." -ForegroundColor Yellow
Write-Host "  ⚠️  Skipping - requires test credentials" -ForegroundColor Gray
Write-Host ""

# Test 3: Auth Login (if you have test credentials)
Write-Host "[3/6] Testing Auth Login..." -ForegroundColor Yellow
Write-Host "  ⚠️  Skipping - requires test credentials" -ForegroundColor Gray
Write-Host ""

# Test 4: Device Register (requires auth or will fail)
Write-Host "[4/6] Testing Device Register..." -ForegroundColor Yellow
$registerBody = @{
    hardware_id = "test-hardware-12345"
    name = "Test Device"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/v1/device/register" -Method Post -Body $registerBody -ContentType "application/json"
    Write-Host "  ✅ Device registration successful" -ForegroundColor Green
    Write-Host "     Device ID: $($response.data.device_id)" -ForegroundColor Gray
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 401) {
        Write-Host "  ⚠️  Registration requires authentication (expected)" -ForegroundColor Yellow
    } else {
        Write-Host "  ❌ Registration failed: $_" -ForegroundColor Red
    }
}
Write-Host ""

# Test 5: CORS Headers
Write-Host "[5/6] Testing CORS Headers..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/v1/health" -Method Options -UseBasicParsing
    $corsHeaders = $response.Headers["Access-Control-Allow-Origin"]
    if ($corsHeaders) {
        Write-Host "  ✅ CORS headers present" -ForegroundColor Green
        Write-Host "     Allow-Origin: $corsHeaders" -ForegroundColor Gray
    } else {
        Write-Host "  ⚠️  CORS headers not found" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ⚠️  CORS test skipped: $_" -ForegroundColor Yellow
}
Write-Host ""

# Test 6: API Response Format
Write-Host "[6/6] Testing API Response Format..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/v1/health" -Method Get
    if ($response.PSObject.Properties.Name -contains "status" -and 
        $response.PSObject.Properties.Name -contains "api" -and
        $response.PSObject.Properties.Name -contains "endpoints") {
        Write-Host "  ✅ Response format correct" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Response format incorrect" -ForegroundColor Red
    }
} catch {
    Write-Host "  ❌ Format test failed: $_" -ForegroundColor Red
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Tests Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
