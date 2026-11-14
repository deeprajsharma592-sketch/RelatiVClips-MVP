@echo off
setlocal
title RelatiV Public Tunnel - Cloudflare
color 0a

echo =====================================================================
echo       RelatiV Public Cloudflare Tunnel for Lenovo LOQ RTX
echo =====================================================================
echo.

where cloudflared >nul 2>&1
if errorlevel 1 (
    if not exist "%~dp0cloudflared.exe" (
        echo [INFO] Downloading cloudflared.exe for Windows...
        curl -L -o "%~dp0cloudflared.exe" https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
    )
    set "CLOUDFLARED=%~dp0cloudflared.exe"
) else (
    set "CLOUDFLARED=cloudflared"
)

echo.
echo [OK] Starting tunnel for http://localhost:9000 ...
echo [OK] Look for the https://*.trycloudflare.com URL below.
echo [OK] Set that URL as BACKEND_BASE_URL in Vercel to route traffic to this LOQ!
echo.

"%CLOUDFLARED%" tunnel --url http://localhost:9000
pause
