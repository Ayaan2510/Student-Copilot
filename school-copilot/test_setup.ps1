# School Co-Pilot Setup Test Script

Write-Host "School Co-Pilot Setup Test" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan
Write-Host ""

# Check if Python is installed
Write-Host "Checking Python installation..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ $pythonVersion" -ForegroundColor Green
    } else {
        throw "Python not found"
    }
} catch {
    Write-Host "❌ Python not found" -ForegroundColor Red
    Write-Host "Please install Python 3.9+ from python.org or Microsoft Store" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "Running detailed setup check..." -ForegroundColor Yellow
python test_setup.py

Write-Host ""
Write-Host "Setup check complete!" -ForegroundColor Green
Read-Host "Press Enter to continue"