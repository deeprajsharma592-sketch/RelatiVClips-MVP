#!/usr/bin/env python3
"""
RelatiV Residential Download Server — runs on Deepraj's Windows laptop.
Receives YouTube download requests from Hetzner server and streams video back.

SETUP:
    1. pip install fastapi uvicorn yt-dlp
    2. Export YouTube cookies to a .txt file (EditThisCookie extension)
    3. Set COOKIES_PATH below to the path of your cookies file
    4. Run: python ytdlp-server.py

SECURITY: No auth — network isolation is the guard. Only run on a trusted LAN.
"""

import argparse
import os
import subprocess
import tempfile
from pathlib import Path
from typing import Optional

import uvicorn
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse, StreamingResponse

app = FastAPI(title="RelatiV Residential Downloader")

# === CONFIGURATION ===
# CHANGE THIS to your cookies file path
COOKIES_PATH: Optional[str] = r"C:\Users\DEEPRAJ\Documents\youtube_cookies.txt"
# ====================

TEMP_DIR = Path(os.environ.get("TEMP", tempfile.gettempdir()))
YT_DLP_CMD = "yt-dlp"


def run_yt_dlp(url: str, format_spec: str) -> tuple[list[str], str]:
    cmd = [YT_DLP_CMD, "-f", format_spec, "-g", url]
    if COOKIES_PATH and os.path.exists(COOKIES_PATH):
        cmd.extend(["--cookies", COOKIES_PATH])
    result = subprocess.run(cmd, capture_output=True, text=True)
    urls = [u.strip() for u in result.stdout.strip().split("\n") if u.strip()]
    return urls, result.stderr.strip()


def download_video(url: str, output_path: Path, start: Optional[float] = None,
                   end: Optional[float] = None) -> Path:
    cmd = [YT_DLP_CMD, "-f", "worst[height>=360]/worst", "--no-playlist",
           "-o", str(output_path)]
    if COOKIES_PATH and os.path.exists(COOKIES_PATH):
        cmd.extend(["--cookies", COOKIES_PATH])
    if start is not None or end is not None:
        cmd.extend(["--download-sections", f"*{start or 0}_{end or ''}"])
    cmd.append(url)
    print(f"[yt-dlp] Downloading: {url}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"yt-dlp failed:\n{result.stderr}")
    if not output_path.exists():
        raise RuntimeError(f"No file produced")
    print(f"[yt-dlp] Done: {output_path.stat().st_size // 1024} KB")
    return output_path


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "cookies": COOKIES_PATH if (COOKIES_PATH and os.path.exists(COOKIES_PATH)) else "NOT FOUND",
        "temp": str(TEMP_DIR),
    }


@app.get("/download")
async def download_video_endpoint(
    url: str = Query(...),
    format_spec: str = Query("worst[height>=360]/worst"),
):
    if not url.startswith("http"):
        raise HTTPException(400, "Invalid URL")

    stream_urls, err = run_yt_dlp(url, format_spec)
    if not stream_urls:
        raise HTTPException(502, f"No streams found. yt-dlp: {err[:300]}")

    out_path = TEMP_DIR / f"relativ_{os.getpid()}_{abs(hash(url))}.mp4"
    try:
        download_video(url, out_path)
        return FileResponse(
            path=out_path,
            filename="video.mp4",
            media_type="video/mp4",
            headers={"Content-Length": str(out_path.stat().st_size)},
        )
    finally:
        if out_path.exists():
            out_path.unlink(missing_ok=True)


@app.post("/segment")
async def download_segment_endpoint(
    url: str,
    start: Optional[float] = None,
    end: Optional[float] = None,
    format_spec: str = "worst[height>=360]/worst",
):
    out_path = TEMP_DIR / f"relativ_seg_{abs(hash(url))}_{start or 0}_{end or 'end'}.mp4"
    try:
        download_video(url, out_path, start, end)

        def iter_file():
            with open(out_path, "rb") as f:
                while chunk := f.read(1024 * 1024):
                    yield chunk

        return StreamingResponse(iter_file(), media_type="video/mp4")
    finally:
        if out_path.exists():
            out_path.unlink(missing_ok=True)


def main():
    print("=" * 50)
    print("RelatiV Residential Download Server")
    print("=" * 50)
    print(f"  Temp dir   : {TEMP_DIR}")
    print(f"  Cookies    : {COOKIES_PATH}")
    if COOKIES_PATH and not os.path.exists(COOKIES_PATH):
        print("  WARNING: Cookies file NOT FOUND at that path!")
        print("  Edit the COOKIES_PATH variable in this script.")
    print("  yt-dlp     :", YT_DLP_CMD)
    print()
    print("Starting server on http://0.0.0.0:8765")
    print("Keep this window open while using RelatiV")
    print("=" * 50)
    uvicorn.run(app, host="0.0.0.0", port=8765, log_level="warning")


if __name__ == "__main__":
    main()
