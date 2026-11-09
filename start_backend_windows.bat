@echo off
TITLE RelatiV GPU Backend - Lenovo LOQ RTX 5050
color 0b

echo =====================================================================
echo       RelatiV Video AI Pipeline - GPU Worker Initialization
echo                 Target: Lenovo LOQ (NVIDIA RTX)
echo =====================================================================
echo.

:: 1. Check Python
python --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python is not installed or not in your PATH.
    echo Please install Python 3.11 or 3.12 from python.org (check "Add Python to PATH").
    pause
    exit /b 1
)

:: 2. Check or create virtual environment
if not exist ".venv" (
    echo [*] Creating Python virtual environment in .venv...
    python -m venv .venv
)

echo [*] Activating virtual environment...
call .venv\Scripts\activate.bat

:: 3. Check FFmpeg
ffmpeg -version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] FFmpeg was not found in your system PATH!
    echo To install FFmpeg on Windows quickly, run in PowerShell:
    echo   winget install Gyan.FFmpeg
    echo or download from https://www.gyan.dev/ffmpeg/builds/
    echo.
)

:: 4. Install dependencies if needed
echo [*] Checking required dependencies...
python -c "import fastapi, faster_whisper, uvicorn, yt_dlp" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [*] Installing dependencies from backend/requirements.txt...
    pip install -r backend/requirements.txt
    echo [*] Ensuring latest yt-dlp version for YouTube pipeline...
    pip install -U yt-dlp
    echo [*] Installing PyTorch with CUDA acceleration...
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
)

:: 5. Create temp & outputs directories
if not exist "temp" mkdir temp
if not exist "outputs" mkdir outputs

:: 6. Verify NVIDIA CUDA GPU
echo [*] Checking NVIDIA GPU status...
python -c "import torch; print(f'[CUDA] Available: {torch.cuda.is_available()}, Device: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \"None\"}')"

:: 7. Start the FastAPI Uvicorn Server on port 9000
echo.
echo =====================================================================
echo RelatiV GPU Backend is starting on http://localhost:9000
echo Connect to Cloudflare Tunnel / ngrok to link with relativclips.com
echo =====================================================================
echo.

python -m uvicorn backend.main:app --host 0.0.0.0 --port 9000 --reload
pause
