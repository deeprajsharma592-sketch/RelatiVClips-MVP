@echo off
setlocal
cd /d "%~dp0"
title RelatiV GPU Backend - Lenovo LOQ RTX
color 0b

echo =====================================================================
echo       RelatiV Video AI Pipeline - GPU Worker Initialization
echo                 Target: Lenovo LOQ (NVIDIA RTX)
echo =====================================================================
echo.

:: 1. Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python was not found in your PATH!
    echo Please install Python 3.11 or 3.12 and ensure "Add Python to PATH" is checked.
    pause
    exit /b 1
)

:: 2. Create and activate virtual environment
if not exist .venv (
    echo [*] Creating virtual environment...
    python -m venv .venv
)
call .venv\Scripts\activate.bat

:: 3. Ensure required packages are installed
python -c "import fastapi" >nul 2>&1
if errorlevel 1 (
    echo [*] Installing requirements from backend/requirements.txt...
    python -m pip install --upgrade pip
    python -m pip install -r backend/requirements.txt
    python -m pip install -U yt-dlp
    echo [*] Installing PyTorch with CUDA acceleration...
    python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
)

:: 4. Ensure runtime folders exist
if not exist temp mkdir temp
if not exist outputs mkdir outputs

:: 5. Launch FastAPI Backend
echo.
echo =====================================================================
echo RelatiV GPU Backend is running on http://localhost:9000
echo =====================================================================
echo.

python -m uvicorn backend.main:app --host 0.0.0.0 --port 9000 --reload
if errorlevel 1 pause
