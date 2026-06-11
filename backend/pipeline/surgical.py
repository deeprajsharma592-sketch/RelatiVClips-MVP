"""
Surgical download — Stage 4 of the new pipeline.

Responsibility: given a list of hook candidates and a video URL,
fetch ONLY the segments around each candidate. We do not download the
full video first; that wastes 90%+ of bandwidth and disk for long videos.

Two source paths:
  - YouTube: yt-dlp with `--download-sections` to clip the time range
  - Local: ffmpeg `-ss` + `-t` to extract the segment from the source file

Returns a list of (candidate, segment_path) pairs. Downstream stages
(transcription, face detection) operate on these segments, not the
full video.

Why this matters:
  - 30s segment for a 30min video = 60× less data
  - Parallelizable: each candidate is independent
  - Idempotent: same (url, start, end) always produces the same path
  - Cacheable: TEMP_DIR survives across tasks; cleanup owns eviction
"""
from typing import List, Dict, Optional, Callable
from pathlib import Path
import subprocess
import logging
import os

from ..utils.config import (
    TEMP_DIR,
    YTDLP_PATH,
    FFMPEG_PATH,
    SURGICAL_BUFFER_SECONDS,
    MAX_SURGICAL_SEGMENTS,
    AUDIO_ONLY_BITRATE,
)

log = logging.getLogger(__name__)


def _ytdlp_section_url(url: str, start: float, end: float) -> List[str]:
    """Build a yt-dlp command that downloads only [start, end] of the video.

    yt-dlp's `--download-sections` accepts a time-range string like
    '*00:01:30-00:02:00'. We pad by SURGICAL_BUFFER_SECONDS so the
    renderer has safe head/tail for accurate seek.
    """
    pad = SURGICAL_BUFFER_SECONDS
    s = max(0.0, start - pad)
    e = end + pad
    fmt = "%H:%M:%S"
    from datetime import datetime, timedelta
    s_str = str(timedelta(seconds=int(s)))
    e_str = str(timedelta(seconds=int(e)))
    return [
        YTDLP_PATH,
        "-f", "bestaudio/best",
        "--extract-audio",
        "--audio-format", "m4a",
        "--audio-quality", "0",
        "--download-sections", f"*{s_str}-{e_str}",
        "-o", "-",  # stdout
        "--no-warnings",
        "--no-check-certificates",
        url,
    ]


def surgical_download_youtube(
    url: str,
    candidates: List[Dict],
    task_id: str,
    log_fn: Optional[Callable] = None,
) -> List[Dict]:
    """Download audio segments around each candidate.

    Args:
        url: YouTube URL.
        candidates: List of hook candidates (each with 'start', 'end').
        task_id: Used for temp file naming.
        log_fn: Optional callable(str) for status updates.

    Returns:
        List of dicts: {candidate, audio_path, source_start, source_end}.
        Candidates that failed to download are still returned, with audio_path=None.
    """
    log_fn = log_fn or (lambda m: None)
    candidates = candidates[:MAX_SURGICAL_SEGMENTS]
    results = []

    for i, cand in enumerate(candidates):
        start = float(cand["start"])
        end = float(cand["end"])
        audio_path = TEMP_DIR / f"{task_id}_seg{i}.m4a"

        if audio_path.exists():
            try:
                audio_path.unlink()
            except Exception:
                pass

        cmd = _ytdlp_section_url(url, start, end)
        log_fn(f"  Downloading segment {i+1}/{len(candidates)} [{start:.1f}s - {end:.1f}s]...")
        try:
            with open(audio_path, "wb") as f:
                result = subprocess.run(cmd, stdout=f, stderr=subprocess.PIPE, timeout=120)
            if result.returncode != 0 or not audio_path.exists() or audio_path.stat().st_size == 0:
                log_fn(f"  Segment {i+1} download failed (rc={result.returncode})")
                results.append({**cand, "audio_path": None, "source_start": start, "source_end": end})
                continue
            log_fn(f"  Segment {i+1} ready ({audio_path.stat().st_size / 1024:.0f} KB)")
            results.append({**cand, "audio_path": str(audio_path), "source_start": start, "source_end": end})
        except subprocess.TimeoutExpired:
            log_fn(f"  Segment {i+1} timed out")
            results.append({**cand, "audio_path": None, "source_start": start, "source_end": end})
        except Exception as e:
            log_fn(f"  Segment {i+1} error: {str(e)[:80]}")
            results.append({**cand, "audio_path": None, "source_start": start, "source_end": end})

    return results


def surgical_extract_local(
    source_video: str,
    candidates: List[Dict],
    task_id: str,
    log_fn: Optional[Callable] = None,
) -> List[Dict]:
    """Extract audio segments from a local file using ffmpeg."""
    log_fn = log_fn or (lambda m: None)
    candidates = candidates[:MAX_SURGICAL_SEGMENTS]
    results = []

    for i, cand in enumerate(candidates):
        start = float(cand["start"])
        end = float(cand["end"])
        audio_path = TEMP_DIR / f"{task_id}_seg{i}.m4a"

        cmd = [
            FFMPEG_PATH, "-y", "-hide_banner", "-loglevel", "error",
            "-ss", str(start), "-i", source_video,
            "-t", str(end - start),
            "-vn", "-acodec", "aac", "-b:a", AUDIO_ONLY_BITRATE,
            str(audio_path),
        ]
        log_fn(f"  Extracting segment {i+1}/{len(candidates)} [{start:.1f}s - {end:.1f}s]...")
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            if result.returncode != 0 or not audio_path.exists():
                log_fn(f"  Segment {i+1} extract failed")
                results.append({**cand, "audio_path": None, "source_start": start, "source_end": end})
                continue
            log_fn(f"  Segment {i+1} ready ({audio_path.stat().st_size / 1024:.0f} KB)")
            results.append({**cand, "audio_path": str(audio_path), "source_start": start, "source_end": end})
        except subprocess.TimeoutExpired:
            log_fn(f"  Segment {i+1} timed out")
            results.append({**cand, "audio_path": None, "source_start": start, "source_end": end})
        except Exception as e:
            log_fn(f"  Segment {i+1} error: {str(e)[:80]}")
            results.append({**cand, "audio_path": None, "source_start": start, "source_end": end})

    return results


def cleanup_segments(task_id: str):
    """Remove all temp files for a task. Idempotent."""
    for path in TEMP_DIR.glob(f"{task_id}_seg*.m4a"):
        try:
            path.unlink()
        except Exception:
            pass
