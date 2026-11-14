#!/usr/bin/env python3
"""
RelatiVClips - Automatic YouTube Cookie Bundler
Extracts your logged-in YouTube session cookies from Chrome, Edge, Brave, or Firefox
and saves them directly to `backend/cookies.txt` and `Documents/youtube_cookies.txt`.
"""
import os
import sys
import shutil
import subprocess
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = BASE_DIR / "backend"
TARGETS = [
    BACKEND_DIR / "cookies.txt",
    Path.home() / "Documents" / "youtube_cookies.txt",
]

# Find yt-dlp executable
ytdlp = shutil.which("yt-dlp")
if not ytdlp:
    venv_ytdlp_win = BASE_DIR / ".venv" / "Scripts" / "yt-dlp.exe"
    venv_ytdlp_unix = BASE_DIR / ".venv" / "bin" / "yt-dlp"
    if venv_ytdlp_win.exists():
        ytdlp = str(venv_ytdlp_win)
    elif venv_ytdlp_unix.exists():
        ytdlp = str(venv_ytdlp_unix)
    else:
        ytdlp = "yt-dlp"

print("=" * 60)
print("RelatiVClips: Bundling YouTube Cookies")
print(f"Using yt-dlp: {ytdlp}")
print("=" * 60)

browsers = ["chrome", "edge", "brave", "firefox"]
success = False

for b in browsers:
    print(f"\n[*] Trying extraction from {b.upper()}...")
    temp_cookie = BACKEND_DIR / f"temp_{b}_cookies.txt"
    cmd = [
        ytdlp,
        "--cookies-from-browser", b,
        "--cookies", str(temp_cookie),
        "--skip-download",
        "https://www.youtube.com",
    ]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=25)
        if temp_cookie.exists() and temp_cookie.stat().st_size > 200:
            print(f"[✓] Successfully extracted {temp_cookie.stat().st_size} bytes of cookies from {b}!")
            for t in TARGETS:
                t.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(str(temp_cookie), str(t))
                print(f"[✓] Saved to: {t}")
            temp_cookie.unlink(missing_ok=True)
            success = True
            break
        else:
            err = (res.stderr or "").strip().split("\n")[-1]
            print(f"[-] Could not extract from {b}: {err[:120]}")
    except Exception as e:
        print(f"[-] Error trying {b}: {e}")

if success:
    print("\n" + "=" * 60)
    print("SUCCESS: YouTube cookies are bundled and active!")
    print("The pipeline will now download crystal-clear 1080p60 streams.")
    print("=" * 60)
else:
    print("\n" + "!" * 60)
    print("Could not auto-extract from browser.")
    print("Please ensure your browser (Chrome or Edge) is closed or export cookies manually to:")
    print(f"  {TARGETS[0]}")
    print("!" * 60)
