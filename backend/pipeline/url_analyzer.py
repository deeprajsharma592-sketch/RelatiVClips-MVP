"""
Stage 1: URL / file analysis.

Extracts metadata without downloading the full video. Uses:
  - yt-dlp --dump-json (no download) for YouTube URLs
  - ffprobe for local files

Falls back to a deterministic stub if either tool is unavailable, so the
pipeline can still run in tests / dev environments.
"""
import json
import subprocess
from pathlib import Path
from typing import Optional

from ..utils.config import YTDLP_PATH, FFPROBE_PATH


def _looks_like_youtube(source: str) -> bool:
    return "youtube.com" in source or "youtu.be" in source


def _extract_video_id(source: str) -> Optional[str]:
    """Best-effort video ID extraction (11-char YouTube ID)."""
    if "v=" in source:
        vid = source.split("v=")[-1].split("&")[0]
        return vid[:11] if len(vid) >= 11 else vid
    if "youtu.be/" in source:
        vid = source.split("youtu.be/")[-1].split("?")[0]
        return vid[:11] if len(vid) >= 11 else vid
    if "shorts/" in source:
        vid = source.split("shorts/")[-1].split("?")[0]
        return vid[:11] if len(vid) >= 11 else vid
    return None


def analyze_url(source: str, timeout: int = 30) -> dict:
    """Analyze a video source and return metadata.

    Args:
        source: YouTube URL or local file path.
        timeout: Subprocess timeout in seconds (default 30).

    Returns:
        {
          "source": str,        # original source
          "source_type": "youtube" | "local",
          "video_id": str|None, # YouTube video ID if applicable
          "title": str,         # video title (or filename for local)
          "duration_s": float,  # duration in seconds
          "channel": str|None,  # YouTube channel name if applicable
        }

    Never raises — returns a partial dict if any sub-step fails.
    """
    if _looks_like_youtube(source):
        return _analyze_youtube(source, timeout=timeout)
    return _analyze_local(source, timeout=timeout)


def _analyze_youtube(url: str, timeout: int) -> dict:
    """Use yt-dlp --dump-json to fetch metadata without downloading."""
    video_id = _extract_video_id(url)
    fallback = {
        "source": url,
        "source_type": "youtube",
        "video_id": video_id,
        "title": "Unknown",
        "duration_s": 0.0,
        "channel": None,
    }
    try:
        result = subprocess.run(
            [
                YTDLP_PATH,
                "--dump-json",
                "--no-download",
                "--no-warnings",
                "--no-check-certificates",
                url,
            ],
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        if result.returncode != 0 or not result.stdout.strip():
            return fallback
        data = json.loads(result.stdout.split("\n")[0])  # first line is the JSON
        return {
            "source": url,
            "source_type": "youtube",
            "video_id": data.get("id", video_id),
            "title": data.get("title", "Unknown"),
            "duration_s": float(data.get("duration", 0) or 0),
            "channel": data.get("uploader") or data.get("channel"),
        }
    except (subprocess.TimeoutExpired, json.JSONDecodeError, Exception):
        return fallback


def _analyze_local(path: str, timeout: int) -> dict:
    """Use ffprobe to read metadata from a local file."""
    p = Path(path)
    title = p.stem if p.exists() else "Unknown"
    fallback = {
        "source": path,
        "source_type": "local",
        "video_id": None,
        "title": title,
        "duration_s": 0.0,
        "channel": None,
    }
    if not p.exists():
        return fallback
    try:
        result = subprocess.run(
            [
                FFPROBE_PATH,
                "-v", "error",
                "-show_entries", "format=duration:format_tags=title",
                "-of", "json",
                str(p),
            ],
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        if result.returncode != 0 or not result.stdout.strip():
            return fallback
        data = json.loads(result.stdout)
        duration = float(data.get("format", {}).get("duration", 0) or 0)
        tags = data.get("format", {}).get("tags", {}) or {}
        return {
            "source": path,
            "source_type": "local",
            "video_id": None,
            "title": tags.get("title", title),
            "duration_s": duration,
            "channel": tags.get("artist"),
        }
    except (subprocess.TimeoutExpired, json.JSONDecodeError, Exception):
        return fallback
