"""
Transcript cache by video_id.

Saves the YouTube auto-captions / faster-whisper output keyed by the
YouTube video_id so re-processing the same video skips the network /
GPU transcription entirely.

Storage:
  - One JSON file per video_id under `temp/transcript_cache/<video_id>.json`
  - Schema: the same dict `fetch_transcript()` returns:
        {"segments": [...], "language": "...", "source": "...",
         "cached_at": ISO-8601, "video_id": "..."}
  - Files older than TRANSCRIPT_CACHE_TTL_DAYS are evicted on read
    (cheap mtime check, no background job needed)

Why disk-based (not Redis):
  - Single-process deployment, low cache hit rate expected
  - Zero infrastructure: no Redis to provision
  - Survives restarts (the whole point of caching)
"""
import json
import logging
import os
import time
from pathlib import Path
from typing import Optional

from ..utils.config import BASE_DIR

log = logging.getLogger(__name__)

CACHE_DIR = BASE_DIR / "temp" / "transcript_cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

TRANSCRIPT_CACHE_TTL_DAYS = 14  # auto-expire stale entries


def _cache_path(video_id: str) -> Path:
    safe = "".join(c for c in video_id if c.isalnum() or c in "-_")
    return CACHE_DIR / f"{safe}.json"


def get(video_id: str) -> Optional[dict]:
    """Return cached transcript for video_id, or None if miss/expired."""
    if not video_id:
        return None
    path = _cache_path(video_id)
    if not path.exists():
        return None
    try:
        age_s = time.time() - path.stat().st_mtime
        if age_s > TRANSCRIPT_CACHE_TTL_DAYS * 86400:
            log.info(f"Transcript cache expired for {video_id} ({age_s/86400:.1f}d old)")
            try:
                path.unlink()
            except Exception:
                pass
            return None
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict) or not data.get("segments"):
            return None
        return data
    except Exception as e:
        log.warning(f"Transcript cache read failed for {video_id}: {e}")
        return None


def put(video_id: str, transcript: dict) -> bool:
    """Persist transcript for video_id. Idempotent.

    `transcript` is the dict returned by `fetch_transcript()` —
    we add a cached_at timestamp so we can age-out the entry later.
    """
    if not video_id or not transcript:
        return False
    if not transcript.get("segments"):
        return False  # never cache empty results
    path = _cache_path(video_id)
    try:
        enriched = dict(transcript)
        enriched["cached_at"] = time.time()
        enriched["video_id"] = video_id
        with open(path, "w", encoding="utf-8") as f:
            json.dump(enriched, f, ensure_ascii=False)
        log.info(f"Cached transcript for {video_id} ({len(enriched['segments'])} segments)")
        return True
    except Exception as e:
        log.warning(f"Transcript cache write failed for {video_id}: {e}")
        return False


def invalidate(video_id: str) -> bool:
    """Remove a cached entry. Used when a user reports bad captions."""
    path = _cache_path(video_id)
    if not path.exists():
        return False
    try:
        path.unlink()
        return True
    except Exception:
        return False


def stats() -> dict:
    """Cache health snapshot (for /healthz-style diagnostics)."""
    if not CACHE_DIR.exists():
        return {"exists": False, "entries": 0, "size_mb": 0.0}
    entries = list(CACHE_DIR.glob("*.json"))
    total_bytes = sum(p.stat().st_size for p in entries)
    return {
        "exists": True,
        "entries": len(entries),
        "size_mb": round(total_bytes / (1024 * 1024), 2),
        "ttl_days": TRANSCRIPT_CACHE_TTL_DAYS,
    }
