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
from concurrent.futures import ThreadPoolExecutor, as_completed
import subprocess
import logging
from ..utils.config import get_proxy, COOKIES_PATH
import os
import time
import threading

from ..utils.config import (
    TEMP_DIR,
    YTDLP_PATH,
    FFMPEG_PATH,
    SURGICAL_BUFFER_SECONDS,
    MAX_SURGICAL_SEGMENTS,
    AUDIO_ONLY_BITRATE,
    PARALLEL_SURGICAL_WORKERS,
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
    cmd = [
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
    # Working copy of cookies (so yt-dlp's save_cookies can't corrupt source)
    if COOKIES_PATH and COOKIES_PATH.exists():
        import shutil
        _working = "/tmp/youtube_cookies_working.txt"
        try:
            shutil.copy2(str(COOKIES_PATH), _working)
            cmd.extend(["--cookies", _working])
        except Exception:
            cmd.extend(["--cookies", str(COOKIES_PATH)])
    _proxy = get_proxy()
    if _proxy:
        cmd.extend(["--proxy", _proxy])
    return cmd


def _download_one_segment(
    url: str,
    start: float,
    end: float,
    audio_path: Path,
    log_fn: Callable,
    seg_idx: int,
    total: int,
    log_lock: threading.Lock,
    on_segment_done: Optional[Callable[[int, int, bool], None]] = None,
) -> Dict:
    """Download a single audio segment. Thread-safe (uses log_lock for shared log_fn).

    `on_segment_done(idx, total, ok)` is invoked after each attempt outcome
    so callers can update a progress bar without parsing log messages.
    """
    if audio_path.exists():
        try:
            audio_path.unlink()
        except Exception:
            pass

    cmd = _ytdlp_section_url(url, start, end)

    def _log(msg: str) -> None:
        with log_lock:
            log_fn(msg)

    _log(f"  Downloading segment {seg_idx + 1}/{total} [{start:.1f}s - {end:.1f}s]...")

    result = None
    final_ok = False
    try:
        for seg_attempt in range(1, 5):
            try:
                with open(audio_path, "wb") as f:
                    result = subprocess.run(
                        cmd, stdout=f, stderr=subprocess.PIPE, timeout=120
                    )
                if result.returncode == 0 and audio_path.exists() and audio_path.stat().st_size > 0:
                    final_ok = True
                    break
                err_snippet = (result.stderr or b"")[:200].decode("utf-8", errors="replace").replace("\n", " ")
                _log(f"  [segment {seg_idx + 1}/{total}] attempt {seg_attempt}/4 failed (rc={result.returncode}): {err_snippet[:100]}")
            except subprocess.TimeoutExpired:
                _log(f"  [segment {seg_idx + 1}/{total}] attempt {seg_attempt}/4 timed out")
            except Exception as e:
                _log(f"  [segment {seg_idx + 1}/{total}] attempt {seg_attempt}/4 crashed: {e}")
            if seg_attempt < 4:
                time.sleep(3 * seg_attempt)
        if on_segment_done is not None:
            try:
                on_segment_done(seg_idx, total, final_ok)
            except Exception:
                pass
        if result is None or result.returncode != 0 or not audio_path.exists() or audio_path.stat().st_size == 0:
            _log(f"  Segment {seg_idx + 1} download failed (rc={getattr(result, 'returncode', 'n/a')})")
            return {"audio_path": None, "source_start": start, "source_end": end}
        _log(f"  Segment {seg_idx + 1} ready ({audio_path.stat().st_size / 1024:.0f} KB)")
        return {"audio_path": str(audio_path), "source_start": start, "source_end": end}
    except Exception as e:
        _log(f"  Segment {seg_idx + 1} error: {str(e)[:80]}")
        return {"audio_path": None, "source_start": start, "source_end": end}


def surgical_download_youtube(
    url: str,
    candidates: List[Dict],
    task_id: str,
    log_fn: Optional[Callable] = None,
    on_segment_done: Optional[Callable[[int, int, bool], None]] = None,
) -> List[Dict]:
    """Download audio segments around each candidate IN PARALLEL.

    Sequential version took ~60s for 3 segments (1 download at a time).
    Parallel version with N workers takes ~max(individual_download_time) =
    ~20-25s for the same 3 segments. ~2.5-3× speedup on the audio phase.

    Each segment download is independent and writes to its own file, so
    ThreadPoolExecutor is safe here. The proxy server handles concurrent
    connections from the same client.

    Args:
        url: YouTube URL.
        candidates: List of hook candidates (each with 'start', 'end').
        task_id: Used for temp file naming.
        log_fn: Optional callable(str) for status updates (thread-safe).

    Returns:
        List of dicts: {candidate, audio_path, source_start, source_end}.
        Order matches the input `candidates` list.
    """
    log_fn = log_fn or (lambda m: None)
    candidates = candidates[:MAX_SURGICAL_SEGMENTS]
    log_lock = threading.Lock()  # serialize log_fn calls (UI can't interleave)
    workers = max(1, min(PARALLEL_SURGICAL_WORKERS, len(candidates)))
    started_at = time.monotonic()

    log_fn(f"  Downloading {len(candidates)} segment(s) in parallel (workers={workers})...")

    # Submit all jobs
    futures = []
    indexed_results: List[Optional[Dict]] = [None] * len(candidates)
    with ThreadPoolExecutor(max_workers=workers, thread_name_prefix="surg") as pool:
        for i, cand in enumerate(candidates):
            start = float(cand["start"])
            end = float(cand["end"])
            audio_path = TEMP_DIR / f"{task_id}_seg{i}.m4a"
            fut = pool.submit(
                _download_one_segment,
                url, start, end, audio_path, log_fn, i, len(candidates), log_lock,
                on_segment_done,
            )
            futures.append((i, fut))

        # Collect in order, but they're running in parallel
        for i, fut in futures:
            try:
                seg_meta = fut.result(timeout=180)
            except Exception as e:
                log_fn(f"  Segment {i + 1} worker crashed: {str(e)[:120]}")
                start = float(candidates[i]["start"])
                end = float(candidates[i]["end"])
                seg_meta = {"audio_path": None, "source_start": start, "source_end": end}
            indexed_results[i] = seg_meta

    elapsed = time.monotonic() - started_at
    log_fn(f"  Parallel download complete in {elapsed:.1f}s")

    # Merge with original candidate metadata, preserving input order
    results = []
    for i, cand in enumerate(candidates):
        meta = indexed_results[i] or {
            "audio_path": None,
            "source_start": float(cand["start"]),
            "source_end": float(cand["end"]),
        }
        results.append({**cand, **meta})
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

def _run_with_retry(cmd, log_fn, label: str = "yt-dlp", max_attempts: int = 4, timeout: int = 120):
    """Run a yt-dlp command with retries on transient failures (rc=1, bot blocks).

    YouTube's anti-bot sometimes returns rc=1 for specific Webshare rotating-proxy
    IPs. A different IP on the next call often works. We retry with exponential backoff.
    """
    import time
    for attempt in range(1, max_attempts + 1):
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
            if result.returncode == 0:
                return result
            err_snippet = (result.stderr or "")[:150].replace("\n", " ")
            if log_fn:
                log_fn(f"  [{label}] attempt {attempt}/{max_attempts} failed (rc={result.returncode}): {err_snippet}")
        except subprocess.TimeoutExpired:
            if log_fn:
                log_fn(f"  [{label}] attempt {attempt}/{max_attempts} timed out after {timeout}s")
        except Exception as e:
            if log_fn:
                log_fn(f"  [{label}] attempt {attempt}/{max_attempts} crashed: {e}")
        if attempt < max_attempts:
            backoff = 3 * attempt
            time.sleep(backoff)
    return None
