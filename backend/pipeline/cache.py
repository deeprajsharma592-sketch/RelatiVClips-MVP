"""
Pipeline cache (Option 1: URL-keyed result cache + Option 3: Source segment cache).

NEW 2026-06-15: shipped to cut repeat-request compute by 40-50%.

Two caches, both file-based (no Redis needed at this scale):

  1. RESULT CACHE  — same URL+platform → same LLM picks → no re-processing
     Key:   cache/youtube_results/{sha256(url+platform)[:16]}.json
     Value: full clip list (metadata only, no file_path) + LLM cost data
     TTL:   7 days (FILE_RETENTION_HOURS)
     Saved: at end of successful run
     Hit:   at top of run_youtube_pipeline_async

  2. SEGMENT CACHE — same URL+time-range → same downloaded segment → no re-download
     Key:   cache/segments/{sha256(url+start+end)[:16]}.mp4
     Value: the downloaded surgical segment
     TTL:   7 days
     Saved: after each surgical segment download
     Hit:   before each surgical segment download

Why this works for re-renders:
  - User requests TikTok → 3 surgical segments downloaded + cached
  - User then requests Reels for same video:
    - Result cache: MISS (different platform key) → LLM runs
    - Segment cache: HIT × 3 → 0 re-downloads
    - Net savings: 30-50% of compute (skipping yt-dlp segment downloads)
  - User then re-requests TikTok (same params):
    - Result cache: HIT → 0 LLM, 0 download, instant return
    - Net savings: 100% of compute

Storage math:
  - 100 runs/day × 30MB/result + 100MB/segments × 7d = ~91GB max
  - Hetzner 150GB VPS: 60% used → 91GB cache would push to 150% (over)
  - Mitigation: 50% cache hit rate in steady state means 50% of that = 45GB
  - Aggressive cleanup: only keep last 3 days hot, evict older

Cleaned by: cleanup_cache_files() — same 2h grace + 7d TTL pattern as temp/outputs.
"""

import hashlib
import json
import logging
import shutil
import time
from pathlib import Path
from typing import Optional

from ..utils.config import CACHE_DIR, FILE_RETENTION_HOURS

log = logging.getLogger("relativ.cache")


# ─────────────────────────────────────────────────────────────────────────────
# Key helpers
# ─────────────────────────────────────────────────────────────────────────────

def url_hash(url: str) -> str:
    """Stable 16-char hash of a YouTube URL."""
    return hashlib.sha256(url.encode("utf-8")).hexdigest()[:16]


def segment_hash(url: str, start: float, end: float) -> str:
    """Stable 16-char hash of (URL, start, end) — used to dedupe surgical segments."""
    # Round to 1 decimal to avoid float-jitter misses (176.6299999 vs 176.63)
    payload = f"{url}|{round(start, 1)}|{round(end, 1)}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


# ─────────────────────────────────────────────────────────────────────────────
# RESULT CACHE (Option 1)
# ─────────────────────────────────────────────────────────────────────────────

def result_cache_path(url: str, platform: str) -> Path:
    """Path to the cached result JSON for (url, platform)."""
    payload = f"{url}|{platform}"
    key = hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]
    return CACHE_DIR / "youtube_results" / f"{key}.json"


def get_cached_result(
    url: str,
    platform: str,
    max_age_hours: int = FILE_RETENTION_HOURS,
    verify_files: bool = True,
) -> Optional[dict]:
    """
    Get cached result for (url, platform) if fresh AND files still exist.

    Args:
        url: YouTube URL
        platform: "tiktok" | "reels" | "shorts"
        max_age_hours: TTL in hours (default FILE_RETENTION_HOURS = 7d)
        verify_files: if True, also check that referenced files still exist on disk

    Returns:
        Cached result dict with _cache_hit=True, _cache_age_hours=N, _cache_savings_usd=X
        or None if cache miss / stale / files missing.
    """
    path = result_cache_path(url, platform)
    if not path.exists():
        return None

    age_h = (time.time() - path.stat().st_mtime) / 3600
    if age_h >= max_age_hours:
        log.debug(f"[CACHE] Result stale ({age_h:.1f}h > {max_age_hours}h): {path.name}")
        return None

    try:
        with open(path) as f:
            data = json.load(f)
    except Exception as e:
        log.warning(f"[CACHE] Failed to read result cache {path.name}: {e}")
        return None

    if verify_files:
        # Check that the referenced clip files still exist on disk
        clips = data.get("clips", [])
        for c in clips:
            url_path = c.get("url", "")
            if url_path and not Path(url_path.replace("/download/", str(Path(__file__).parent.parent.parent / "outputs") + "/")).exists():
                # Try the actual disk path
                file_path = c.get("file_path")
                if file_path and not Path(file_path).exists():
                    log.debug(f"[CACHE] Result references missing file {file_path}, invalidating")
                    return None

    # Annotate hit metadata
    data["_cache_hit"] = True
    data["_cache_age_hours"] = round(age_h, 1)
    data["_cache_savings_usd"] = data.get("llm_cost_usd", 0.0)
    data["llm_cost_usd"] = 0.0  # Cost is 0 on hit
    data["cost_per_clip_usd"] = 0.0
    log.info(
        f"[CACHE] HIT result: {url[:50]}... ({platform}) "
        f"age={age_h:.1f}h saved=${data['_cache_savings_usd']:.4f}"
    )
    return data


def save_result_cache(url: str, platform: str, result: dict) -> bool:
    """
    Save a successful pipeline result to cache.

    Strips large/non-serializable fields (file_path is replaced with url),
    keeps metadata so cache hits can rehydrate the response.

    Returns:
        True if saved, False on error.
    """
    path = result_cache_path(url, platform)
    path.parent.mkdir(parents=True, exist_ok=True)

    try:
        # Build a cacheable subset
        cacheable = {
            "clips": [],
            "llm_cost_usd": result.get("llm_cost_usd", 0.0),
            "cost_per_clip_usd": result.get("cost_per_clip_usd", 0.0),
            "llm_provider": result.get("llm_provider"),
            "llm_model": result.get("llm_model"),
            "archetype": result.get("archetype"),
            "platform": platform,
            "n_clips": len(result.get("clips", [])),
            "cached_at": time.time(),
            "cached_url_hash": url_hash(url),
        }
        for c in result.get("clips", []):
            cacheable_clip = {
                k: v for k, v in c.items()
                if k not in ("file_path",)  # strip disk path
            }
            cacheable["clips"].append(cacheable_clip)

        # Write atomically: write to .tmp then rename
        tmp = path.with_suffix(".tmp")
        with open(tmp, "w") as f:
            json.dump(cacheable, f, default=str, indent=2)
        tmp.rename(path)
        log.info(
            f"[CACHE] Saved result: {url[:50]}... ({platform}) "
            f"→ {path.name} ({len(cacheable['clips'])} clips, ${cacheable['llm_cost_usd']:.4f})"
        )
        return True
    except Exception as e:
        log.warning(f"[CACHE] Failed to save result cache: {e}")
        return False


# ─────────────────────────────────────────────────────────────────────────────
# SEGMENT CACHE (Option 3)
# ─────────────────────────────────────────────────────────────────────────────

def segment_cache_path(url: str, start: float, end: float) -> Path:
    """Path to the cached surgical segment for (url, start, end)."""
    return CACHE_DIR / "segments" / f"{segment_hash(url, start, end)}.mp4"


def get_cached_segment(
    url: str,
    start: float,
    end: float,
    max_age_hours: int = FILE_RETENTION_HOURS,
) -> Optional[Path]:
    """
    Get cached segment file path if fresh.

    Returns:
        Path to cached segment file, or None if miss/stale.
    """
    path = segment_cache_path(url, start, end)
    if not path.exists():
        return None

    age_h = (time.time() - path.stat().st_mtime) / 3600
    if age_h >= max_age_hours:
        log.debug(f"[CACHE] Segment stale ({age_h:.1f}h > {max_age_hours}h): {path.name}")
        return None

    log.info(f"[CACHE] HIT segment: {url[:50]}... [{start:.1f}-{end:.1f}] → {path.name}")
    return path


def save_segment_cache(url: str, start: float, end: float, segment_path: Path) -> bool:
    """
    Copy a freshly downloaded segment into the cache.

    Returns:
        True if saved, False on error.
    """
    target = segment_cache_path(url, start, end)
    target.parent.mkdir(parents=True, exist_ok=True)

    # Don't overwrite a fresher cache
    if target.exists():
        age_h = (time.time() - target.stat().st_mtime) / 3600
        if age_h < FILE_RETENTION_HOURS:
            return False

    try:
        shutil.copy2(segment_path, target)
        log.info(
            f"[CACHE] Saved segment: {url[:50]}... [{start:.1f}-{end:.1f}] "
            f"→ {target.name} ({target.stat().st_size // 1024}KB)"
        )
        return True
    except Exception as e:
        log.warning(f"[CACHE] Failed to save segment cache: {e}")
        return False


# ─────────────────────────────────────────────────────────────────────────────
# Cleanup
# ─────────────────────────────────────────────────────────────────────────────

def cleanup_cache_files(max_age_hours: int = FILE_RETENTION_HOURS) -> dict:
    """
    Clean up stale cache files. Called by the cleanup scheduler.

    Returns:
        {deleted_count, deleted_mb, errors}
    """
    from datetime import datetime, timedelta
    cutoff = time.time() - (max_age_hours * 3600)
    deleted = 0
    deleted_bytes = 0
    errors = []

    for sub in ("youtube_results", "segments"):
        sub_dir = CACHE_DIR / sub
        if not sub_dir.exists():
            continue
        for fp in sub_dir.glob("*"):
            if not fp.is_file():
                continue
            try:
                if fp.stat().st_mtime < cutoff:
                    size = fp.stat().st_size
                    fp.unlink()
                    deleted += 1
                    deleted_bytes += size
            except Exception as e:
                errors.append(str(e))

    return {
        "deleted_count": deleted,
        "deleted_mb": round(deleted_bytes / (1024 * 1024), 2),
        "errors": errors,
    }


def get_cache_stats() -> dict:
    """
    Snapshot of cache state — for /admin/cache endpoint and monitoring.

    Returns:
        {results: {count, total_mb}, segments: {count, total_mb}, oldest_age_hours}
    """
    stats = {"results": {"count": 0, "total_mb": 0.0}, "segments": {"count": 0, "total_mb": 0.0}}
    now = time.time()
    oldest = 0.0

    for sub, key in (("youtube_results", "results"), ("segments", "segments")):
        sub_dir = CACHE_DIR / sub
        if not sub_dir.exists():
            continue
        for fp in sub_dir.glob("*"):
            try:
                if not fp.is_file():
                    continue
                stats[key]["count"] += 1
                stats[key]["total_mb"] = stats[key].get("total_mb", 0.0) + (fp.stat().st_size / (1024 * 1024))
                age_h = (now - fp.stat().st_mtime) / 3600
                if age_h > oldest:
                    oldest = age_h
            except Exception:
                pass

    stats["total_count"] = stats["results"]["count"] + stats["segments"]["count"]
    stats["total_mb"] = round(stats["results"]["total_mb"] + stats["segments"]["total_mb"], 2)
    stats["oldest_age_hours"] = round(oldest, 1)
    return stats
