# RelatiV GPU Backend Starter for Windows PowerShell
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

# 3. Check FFmpeg
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    Write-Host "[WARNING] FFmpeg was not found in your system PATH!" -ForegroundColor Yellow
    Write-Host "To install FFmpeg on Windows, run: winget install Gyan.FFmpeg" -ForegroundColor Yellow
}

# 4. Check dependencies
Write-Host "[*] Verifying dependencies..." -ForegroundColor Green
try {
    python -c "import fastapi, faster_whisper, uvicorn" 2>$null
    if ($LASTEXITCODE -ne 0) { throw "Missing deps" }
} catch {
    Write-Host "[*] Installing backend requirements..." -ForegroundColor Yellow
    pip install -r backend/requirements.txt
    Write-Host "[*] Installing PyTorch with CUDA acceleration..." -ForegroundColor Yellow
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
}

# 5. Create directories
if (-not (Test-Path "temp")) { New-Item -ItemType Directory -Path "temp" | Out-Null }
if (-not (Test-Path "outputs")) { New-Item -ItemType Directory -Path "outputs" | Out-Null }

# 6. Verify GPU
Write-Host "[*] Testing NVIDIA CUDA GPU..." -ForegroundColor Green
python -c "import torch; print(f'[CUDA] Available: {torch.cuda.is_available()}, Device: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else ''None''}')"

# 7. Start Uvicorn
Write-Host ""
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "Starting RelatiV GPU Server on http://localhost:9000" -ForegroundColor Cyan
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host ""

python -m uvicorn backend.main:app --host 0.0.0.0 --port 9000 --reload
