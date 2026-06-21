#!/usr/bin/env python3
"""
RelatiV Residential Download Server — runs on Deepraj's laptop.
Receives YouTube download requests from Hetzner server and streams video back.

Usage:
    python3 ytdlp-residential-server.py [--port 8765]

Security: Intended for local/DMZ use only. No auth — network isolation is the guard.
"""

import argparse
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Optional

import uvicorn
from fastapi import FastAPI, HTTPException, Header, Query
from fastapi.responses import FileResponse, StreamingResponse

app = FastAPI(title="RelatiV Residential Downloader")

# Where to stash temp files (set via env or default to system temp)
TEMP_DIR = Path(os.environ.get("YTDLP_TEMP_DIR", tempfile.gettempdir()))

# yt-dlp path — use system yt-dlp
YT_DLP_CMD = os.environ.get("YTDLP_CMD", "yt-dlp")

# Optional: list of allowed caller IPs (empty = allow all, for local use)
ALLOWED_IPS: list[str] = []


def run_yt_dlp(url: str, format_spec: str, cookies_path: Optional[str] = None) -> tuple[list[str], list[str]]:
    """Run yt-dlp -g to get stream URLs, return (urls, stderr)."""
    cmd = [YT_DLP_CMD, "-f", format_spec, "-g", url]
    if cookies_path:
        cmd.extend(["--cookies", cookies_path])
    result = subprocess.run(cmd, capture_output=True, text=True)
    urls = [u.strip() for u in result.stdout.strip().split("\n") if u.strip()]
    return urls, result.stderr.strip().split("\n")


def download_segment(url: str, output_path: Path, cookies_path: Optional[str] = None,
                     start: Optional[float] = None, end: Optional[float] = None) -> Path:
    """Download a YouTube segment using yt-dlp with range."""
    cmd = [YT_DLP_CMD, "-f", "worst[height>=360]/worst", "--no-playlist",
           "-o", str(output_path)]
    if cookies_path:
        cmd.extend(["--cookies", cookies_path])
    if start is not None or end is not None:
        cmd.extend(["--download-sections", f"*{start or 0}_{end or ''}"])
    cmd.append(url)
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"yt-dlp failed: {result.stderr}")
    if not output_path.exists():
        raise RuntimeError(f"yt-dlp produced no file: {result.stdout}")
    return output_path


@app.get("/health")
async def health():
    return {"status": "ok", "cmd": YT_DLP_CMD}


@app.get("/formats")
async def get_formats(
    url: str = Query(...),
    cookies: Optional[str] = Query(None, description="Path to cookies.txt on THIS machine"),
):
    """Return available formats for a URL without downloading."""
    urls, err = run_yt_dlp(url, "best", cookies)
    return {"urls": urls, "debug": err}


@app.get("/download")
async def download_video(
    url: str = Query(...),
    format_spec: str = Query("worst[height>=360]/worst", description="yt-dlp format spec"),
    cookies: Optional[str] = Query(None, description="Path to cookies.txt on THIS machine"),
    filename: Optional[str] = Query(None, description="Preferred filename"),
    x_real_ip: Optional[str] = Header(None, alias="X-Real-IP"),
):
    """
    Stream-download a YouTube video back to the caller.
    yt-dlp runs on THIS machine (residential IP), streams back to Hetzner server.
    """
    # IP check (optional)
    if ALLOWED_IPS and x_real_ip not in ALLOWED_IPS:
        raise HTTPException(403, "IP not allowed")

    if not url.startswith(("http://", "https://")):
        raise HTTPException(400, "Invalid URL")

    try:
        # Get stream URL (yt-dlp resolves on THIS machine's residential IP)
        stream_urls, err = run_yt_dlp(url, format_spec, cookies)
        if not stream_urls:
            raise HTTPException(502, f"No stream URLs found. yt-dlp said: {err}")

        # For now, download the full video to a temp file, then stream it back
        # (yt-dlp can't stream directly without downloading to disk first for segmented content)
        ext = "mp4"
        if filename:
            ext = filename.split(".")[-1] if "." in filename else "mp4"

        out_path = TEMP_DIR / f"relativ_{os.getpid()}_{hash(url) & 0xFFFFFFFF}.{ext}"

        try:
            download_segment(url, out_path, cookies)
            file_size = out_path.stat().st_size

            media_type = "video/mp4"
            return FileResponse(
                path=out_path,
                filename=filename or f"video.{ext}",
                media_type=media_type,
                headers={
                    "Content-Length": str(file_size),
                    "X-Stream-URL": stream_urls[0][:200] if stream_urls else "",
                },
            )
        finally:
            # Clean up temp file after response is sent
            if out_path.exists():
                out_path.unlink(missing_ok=True)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/segment")
async def download_segment_api(
    url: str,
    start: Optional[float] = None,
    end: Optional[float] = None,
    format_spec: str = "worst[height>=360]/worst",
    cookies: Optional[str] = None,
):
    """
    Download a specific time range of a YouTube video.
    FastAPI can't easily stream a subprocess output, so we download to a temp file first.
    """
    ext = "mp4"
    out_path = TEMP_DIR / f"relativ_seg_{hash(url) & 0xFFFFFFFF}_{start or 0}_{end or 'end'}.{ext}"

    try:
        download_segment(url, out_path, cookies, start, end)

        def file_iterator():
            with open(out_path, "rb") as f:
                while chunk := f.read(1024 * 1024):  # 1MB chunks
                    yield chunk

        return StreamingResponse(
            file_iterator(),
            media_type="video/mp4",
            headers={
                "Content-Disposition": f'attachment; filename="{out_path.name}"',
                "X-Start": str(start or 0),
                "X-End": str(end or ""),
            },
        )
    finally:
        if out_path.exists():
            out_path.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description="RelatiV Residential Download Server")
    parser.add_argument("--host", default="0.0.0.0", help="Host to bind to (0.0.0.0 = LAN accessible)")
    parser.add_argument("--port", type=int, default=8765, help="Port to listen on")
    parser.add_argument("--temp-dir", default=None, help="Temp directory for downloads")
    parser.add_argument("--allowed-ips", default="", help="Comma-separated allowed IPs (empty = all)")
    args = parser.parse_args()

    if args.temp_dir:
        TEMP_DIR.mkdir(parents=True, exist_ok=True)
    if args.allowed_ips:
        global ALLOWED_IPS
        ALLOWED_IPS = [ip.strip() for ip in args.allowed_ips.split(",")]

    print(f"Starting RelatiV Download Server on {args.host}:{args.port}")
    print(f"  Temp dir : {TEMP_DIR}")
    print(f"  yt-dlp   : {YT_DLP_CMD}")
    print(f"  Allowed  : {ALLOWED_IPS or 'ALL IPs'}")

    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
