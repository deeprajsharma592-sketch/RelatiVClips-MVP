# RelatiV GPU Backend Starter for Windows PowerShell
Set-Location $PSScriptRoot

Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "      RelatiV Video AI Pipeline - GPU Worker Initialization" -ForegroundColor Cyan
Write-Host "                Target: Lenovo LOQ (NVIDIA RTX)" -ForegroundColor Cyan
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check Python
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Python is not installed or not in your PATH." -ForegroundColor Red
    Write-Host "Please install Python 3.11 or 3.12 from python.org (check 'Add Python to PATH')." -ForegroundColor Yellow
    exit 1
}

# 2. Virtual environment
if (-not (Test-Path ".venv")) {
    Write-Host "[*] Creating Python virtual environment in .venv..." -ForegroundColor Yellow
    python -m venv .venv
}

Write-Host "[*] Activating virtual environment..." -ForegroundColor Green
& .\.venv\Scripts\Activate.ps1

# 3. Check dependencies
Write-Host "[*] Verifying dependencies..." -ForegroundColor Green
try {
    python -c "import fastapi" 2>$null
    if ($LASTEXITCODE -ne 0) { throw "Missing deps" }
} catch {
    Write-Host "[*] Installing backend requirements..." -ForegroundColor Yellow
    python -m pip install --upgrade pip
    python -m pip install -r backend/requirements.txt
    python -m pip install "transformers<4.49.0"
    python -m pip install -U yt-dlp
    Write-Host "[*] Installing PyTorch with CUDA acceleration..." -ForegroundColor Yellow
    python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124
}

# 4. Create directories
if (-not (Test-Path "temp")) { New-Item -ItemType Directory -Path "temp" | Out-Null }
if (-not (Test-Path "outputs")) { New-Item -ItemType Directory -Path "outputs" | Out-Null }

# 5. Start Uvicorn
Write-Host ""
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "Starting RelatiV GPU Server on http://localhost:9000" -ForegroundColor Cyan
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host ""

python -m uvicorn backend.main:app --host 0.0.0.0 --port 9000 --reload
