#!/usr/bin/env python3
"""RelatiV user-machine YouTube source proxy.

Run this on the computer that owns the logged-in browser session. The main
backend calls this small service instead of contacting YouTube from a blocked
cloud/server IP.

Required environment variables:
    USER_PROXY_TOKEN       Long random shared secret used by both services.

Optional environment variables:
    USER_PROXY_BROWSER     yt-dlp browser selector (default: brave).
    USER_PROXY_COOKIES_FILE  Local Netscape cookies file; preferred when set.
    USER_PROXY_HOST        Bind address (default: 127.0.0.1).
    USER_PROXY_PORT        Bind port (default: 8765).
    USER_PROXY_YTDLP       yt-dlp executable (default: yt-dlp on PATH).
    USER_PROXY_FFMPEG      FFmpeg binary or containing directory (optional).

Example:
    USER_PROXY_TOKEN="$(python -c 'import secrets; print(secrets.token_urlsafe(32))')" \
      python User_as_Proxy.py

Expose port 8765 with a Cloudflare tunnel, then configure the main backend:
    RESIDENTIAL_DOWNLOAD_URL=https://your-tunnel.trycloudflare.com
    RESIDENTIAL_DOWNLOAD_TOKEN=<same token>
"""

from __future__ import annotations

import hmac
import os
import shutil
import subprocess
import tempfile
import threading
import uuid
from pathlib import Path
from urllib.parse import urlparse

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.background import BackgroundTasks
from fastapi.responses import FileResponse


TOKEN = os.getenv("USER_PROXY_TOKEN", "").strip()
BROWSER = os.getenv("USER_PROXY_BROWSER", "brave").strip()
COOKIES_FILE = os.getenv("USER_PROXY_COOKIES_FILE", "").strip()
HOST = os.getenv("USER_PROXY_HOST", "127.0.0.1").strip()
PORT = int(os.getenv("USER_PROXY_PORT", "8765"))
YTDLP = os.getenv("USER_PROXY_YTDLP", "yt-dlp").strip()
FFMPEG = os.getenv("USER_PROXY_FFMPEG", "").strip()
WORK_DIR = Path(tempfile.gettempdir()) / "relativ-user-proxy"
WORK_DIR.mkdir(parents=True, exist_ok=True)
_download_lock = threading.Lock()

app = FastAPI(title="RelatiV User as Proxy", docs_url=None, redoc_url=None)


def _authorize(
    authorization: str | None = Header(default=None),
    x_relativ_proxy_token: str | None = Header(default=None),
) -> None:
    if not TOKEN:
        raise HTTPException(503, "USER_PROXY_TOKEN is not configured")
    candidate = x_relativ_proxy_token or ""
    if authorization and authorization.lower().startswith("bearer "):
        candidate = authorization[7:].strip()
    if not candidate or not hmac.compare_digest(candidate, TOKEN):
        raise HTTPException(401, "Invalid proxy token")


def _validate_youtube_url(url: str) -> str:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if parsed.scheme not in {"http", "https"} or not (
        host == "youtu.be" or host == "youtube.com" or host.endswith(".youtube.com")
    ):
        raise HTTPException(400, "Only YouTube URLs are accepted")
    return url


def _base_command() -> list[str]:
    command = [YTDLP, "--no-playlist", "--no-warnings", "--no-check-certificates"]
    if FFMPEG:
        command.extend(["--ffmpeg-location", FFMPEG])
    if COOKIES_FILE:
        cookie_path = Path(COOKIES_FILE).expanduser()
        if not cookie_path.is_file():
            raise HTTPException(503, "USER_PROXY_COOKIES_FILE does not exist")
        command.extend(["--cookies", str(cookie_path)])
    elif BROWSER:
        command.extend(["--cookies-from-browser", BROWSER])
    return command


def _run(command: list[str], timeout: int = 900) -> subprocess.CompletedProcess[str]:
    with _download_lock:
        result = subprocess.run(command, capture_output=True, text=True, timeout=timeout)
    if result.returncode != 0:
        error = (result.stderr or result.stdout or "yt-dlp failed")[-800:]
        raise HTTPException(502, error)
    return result


def _locate_output(stem: str) -> Path:
    candidates = sorted(
        (path for path in WORK_DIR.glob(f"{stem}.*") if path.is_file()),
        key=lambda path: path.stat().st_size,
        reverse=True,
    )
    if not candidates or candidates[0].stat().st_size <= 1024:
        raise HTTPException(502, "yt-dlp completed without a playable output file")
    return candidates[0]


@app.get("/health", dependencies=[Depends(_authorize)])
def health() -> dict:
    return {
        "status": "ok",
        "browser": BROWSER,
        "cookie_source": "file" if COOKIES_FILE else "browser",
        "yt_dlp": shutil.which(YTDLP) or YTDLP,
        "token_configured": bool(TOKEN),
    }


def _download_file(url: str, start: float | None, end: float | None) -> Path:
    _validate_youtube_url(url)
    stem = f"relativ_{uuid.uuid4().hex}"
    output = str(WORK_DIR / f"{stem}.%(ext)s")
    command = _base_command() + [
        "-f",
        "bv*[height<=1080]+ba/b[height<=1080]/best",
        "--merge-output-format", "mp4",
        "-o", output,
    ]
    if start is not None or end is not None:
        begin = max(0.0, float(start or 0.0))
        finish = "" if end is None else f"{max(begin, float(end)):.3f}"
        command.extend(["--download-sections", f"*{begin:.3f}-{finish}", "--force-keyframes-at-cuts"])
    command.extend(["--", url])
    _run(command)
    return _locate_output(stem)


@app.get("/download", dependencies=[Depends(_authorize)])
def download(
    background_tasks: BackgroundTasks,
    url: str = Query(...),
    start: float | None = Query(default=None),
    end: float | None = Query(default=None),
    format_spec: str | None = Query(default=None),  # compatibility; intentionally ignored
) -> FileResponse:
    del format_spec
    path = _download_file(url, start, end)
    background_tasks.add_task(path.unlink, missing_ok=True)
    return FileResponse(path, media_type="video/mp4", filename="source.mp4")


@app.post("/segment", dependencies=[Depends(_authorize)])
def segment(
    background_tasks: BackgroundTasks,
    url: str = Query(...),
    start: float | None = Query(default=None),
    end: float | None = Query(default=None),
    format_spec: str | None = Query(default=None),
) -> FileResponse:
    return download(background_tasks, url, start, end, format_spec)


@app.get("/subtitles", dependencies=[Depends(_authorize)])
def subtitles(url: str = Query(...), lang: str = Query(default="en")) -> dict:
    _validate_youtube_url(url)
    stem = f"subs_{uuid.uuid4().hex}"
    output = str(WORK_DIR / f"{stem}.%(ext)s")
    command = _base_command() + [
        "--write-subs", "--write-auto-subs",
        "--sub-langs", f"{lang}.*,{lang}",
        "--sub-format", "vtt",
        "--skip-download",
        "-o", output,
        "--", url,
    ]
    try:
        _run(command, timeout=180)
        files = sorted(WORK_DIR.glob(f"{stem}*.vtt"), key=lambda p: p.stat().st_size, reverse=True)
        if not files:
            raise HTTPException(404, "No subtitles available")
        content = files[0].read_text(encoding="utf-8", errors="replace")
        if len(content) < 50:
            raise HTTPException(404, "Subtitle file was empty")
        return {"vtt": content}
    finally:
        for path in WORK_DIR.glob(f"{stem}*"):
            path.unlink(missing_ok=True)


if __name__ == "__main__":
    if not TOKEN:
        raise SystemExit("Set USER_PROXY_TOKEN before starting User_as_Proxy.py")
    import uvicorn

    print(f"RelatiV User as Proxy listening on http://{HOST}:{PORT} (browser={BROWSER})")
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")
