"""Safe ytagent adapter for verified, high-quality YouTube source downloads.

ytagent contains public relay and free-proxy fallbacks. RelatiV deliberately
registers only its direct yt-dlp + BGutil methods. Existing residential and
cookie-backed downloaders remain the fallback in ``pipeline.surgical``.
"""

from __future__ import annotations

import json
import os
import subprocess
import threading
from pathlib import Path
from typing import Callable, Optional

from .config import CACHE_DIR, FFMPEG_PATH, FFPROBE_PATH, YT_PROXY


YTAGENT_BGUTIL_HOME = Path(
    os.getenv("YTAGENT_BGUTIL_HOME", str(CACHE_DIR / "bgutil-ytdlp-pot-provider"))
).expanduser()
os.environ.setdefault("YTAGENT_BGUTIL_HOME", str(YTAGENT_BGUTIL_HOME))
YTAGENT_ENABLED = os.getenv("YTAGENT_ENABLED", "1").strip().lower() in {"1", "true", "yes", "on"}
YTAGENT_TIMEOUT_SECONDS = int(os.getenv("YTAGENT_TIMEOUT_SECONDS", "240"))
YTAGENT_MAX_HEIGHT = int(os.getenv("YTAGENT_MAX_HEIGHT", "1080"))
YTAGENT_MIN_HEIGHT = int(os.getenv("YTAGENT_MIN_HEIGHT", "720"))
_DEFAULT_FORMAT = (
        f"bestvideo[height<={YTAGENT_MAX_HEIGHT}][vcodec^=avc1][ext=mp4]+"
        "bestaudio[acodec^=mp4a]/"
        f"bestvideo[height<={YTAGENT_MAX_HEIGHT}][ext=mp4]+bestaudio[ext=m4a]/"
        f"bestvideo[height<={YTAGENT_MAX_HEIGHT}]+bestaudio/"
        f"best[height<={YTAGENT_MAX_HEIGHT}]"
)
YTAGENT_FORMAT = os.getenv("YTAGENT_FORMAT", "").strip() or _DEFAULT_FORMAT

# No community Cobalt, Piped, Invidious, free SOCKS5, GitHub Actions, audio-only,
# or low-resolution single-file salvage in the production video path.
SAFE_METHOD_NAMES = ("transcript_probe", "ytdlp_default", "ytdlp_jsless", "ytdlp_ios")

_SOURCE_DIR = CACHE_DIR / "ytagent_sources"
_STATE_DIR = CACHE_DIR / "ytagent_state"
_locks_guard = threading.Lock()
_source_locks: dict[str, threading.Lock] = {}


class YtAgentError(RuntimeError):
    pass


def _source_lock(video_id: str) -> threading.Lock:
    with _locks_guard:
        return _source_locks.setdefault(video_id, threading.Lock())


def _probe_video(path: Path) -> dict:
    result = subprocess.run(
        [
            FFPROBE_PATH,
            "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream=codec_type,width,height,codec_name",
            "-of", "json",
            str(path),
        ],
        capture_output=True,
        text=True,
        timeout=30,
    )
    if result.returncode != 0:
        raise YtAgentError(f"ffprobe rejected ytagent output: {result.stderr[:180]}")
    try:
        streams = json.loads(result.stdout).get("streams", [])
    except (ValueError, TypeError) as exc:
        raise YtAgentError("ffprobe returned invalid JSON") from exc
    video = next((stream for stream in streams if stream.get("codec_type") == "video"), None)
    # The selected-stream probe above is intentionally video-only. Probe audio
    # separately so a failed merge cannot pass verification as a silent clip.
    audio_result = subprocess.run(
        [FFPROBE_PATH, "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=codec_name", "-of", "json", str(path)],
        capture_output=True,
        text=True,
        timeout=30,
    )
    try:
        audio_streams = json.loads(audio_result.stdout).get("streams", []) if audio_result.returncode == 0 else []
    except (ValueError, TypeError):
        audio_streams = []
    width = int((video or {}).get("width", 0) or 0)
    height = int((video or {}).get("height", 0) or 0)
    if width <= 0 or height <= 0:
        raise YtAgentError("ytagent output has no playable video stream")
    if not audio_streams:
        raise YtAgentError("ytagent output has no audio stream; the video/audio merge did not complete")
    if height < YTAGENT_MIN_HEIGHT:
        raise YtAgentError(f"ytagent output is only {height}p; minimum accepted quality is {YTAGENT_MIN_HEIGHT}p")
    return {
        "width": width,
        "height": height,
        "codec": (video or {}).get("codec_name", "unknown"),
        "audio_codec": audio_streams[0].get("codec_name", "unknown"),
    }


def _cached_source(video_id: str) -> Optional[Path]:
    for candidate in sorted(_SOURCE_DIR.glob(f"{video_id}.*")):
        if candidate.is_file() and candidate.stat().st_size >= 1_000_000:
            try:
                _probe_video(candidate)
                return candidate
            except Exception:
                candidate.unlink(missing_ok=True)
    return None


def download_high_quality_source(url: str, log: Optional[Callable[[str], None]] = None) -> dict:
    """Download one verified source file, cached by canonical YouTube ID."""
    if not YTAGENT_ENABLED:
        raise YtAgentError("ytagent is disabled")

    try:
        from ytagent.agents.truth import TruthAgent
        from ytagent.agents.verifier import Verifier
        from ytagent.bootstrap import ensure_bgutil_ready
        from ytagent.methods import METHOD_REGISTRY
        from ytagent.methods.base import default_opts
        from ytagent.orchestrator import Orchestrator
        from ytagent.utils.ids import to_video_id
    except ImportError as exc:
        raise YtAgentError("ytagent-cli is not installed; run pip install -r backend/requirements.txt") from exc

    video_id = to_video_id(url)
    _SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    _STATE_DIR.mkdir(parents=True, exist_ok=True)

    with _source_lock(video_id):
        cached = _cached_source(video_id)
        if cached:
            meta = _probe_video(cached)
            return {"path": str(cached), "video_id": video_id, "method": "cache", **meta}

        safe_methods = {
            name: METHOD_REGISTRY[name]
            for name in SAFE_METHOD_NAMES
            if name in METHOD_REGISTRY
        }
        if not safe_methods:
            raise YtAgentError("ytagent has no approved direct download methods")

        bgutil_ready = ensure_bgutil_ready(auto_install=False, auto_start=True)
        if log and not bgutil_ready:
            log("ytagent: BGutil is not ready; direct methods may fall back to RelatiV's residential downloader")
        if log:
            log(f"ytagent: downloading verified source up to {YTAGENT_MAX_HEIGHT}p")
        orchestrator = Orchestrator(
            truth=TruthAgent(state_dir=_STATE_DIR),
            verifier=Verifier(),
            methods=safe_methods,
        )
        result = orchestrator.download(
            url,
            _SOURCE_DIR,
            opts=default_opts(
                timeout=YTAGENT_TIMEOUT_SECONDS,
                format=YTAGENT_FORMAT,
                proxy=YT_PROXY or None,
            ),
        )
        if not result.ok or not result.final_path:
            reasons = "; ".join(
                f"{attempt.method}: {attempt.reason or attempt.verify_reason or 'failed'}"
                for attempt in result.attempts
                if not attempt.ok
            )
            raise YtAgentError(f"ytagent could not produce a verified video: {reasons[-500:]}")

        source = Path(result.final_path)
        meta = _probe_video(source)
        if log:
            log(
                f"ytagent: verified {meta['width']}x{meta['height']} source "
                f"via {result.method_used}"
            )
        return {
            "path": str(source),
            "video_id": video_id,
            "method": result.method_used,
            **meta,
        }


def download_segment(
    url: str,
    destination: Path,
    start: float,
    end: float,
    log: Optional[Callable[[str], None]] = None,
) -> dict:
    """Slice an accurate padded segment from the cached verified source."""
    if end <= start:
        raise YtAgentError("segment end must be after start")
    source = download_high_quality_source(url, log=log)
    destination.parent.mkdir(parents=True, exist_ok=True)
    duration = end - start
    command = [
        FFMPEG_PATH,
        "-y",
        "-ss", f"{start:.3f}",
        "-i", source["path"],
        "-t", f"{duration:.3f}",
        "-map", "0:v:0",
        "-map", "0:a:0?",
        "-c", "copy",
        "-avoid_negative_ts", "make_zero",
        "-movflags", "+faststart",
        str(destination),
    ]
    result = subprocess.run(command, capture_output=True, timeout=max(60, int(duration * 3)))
    if result.returncode != 0 or not destination.exists() or destination.stat().st_size <= 1024:
        destination.unlink(missing_ok=True)
        raise YtAgentError(
            "FFmpeg could not slice ytagent source: "
            + result.stderr.decode("utf-8", errors="replace")[-240:]
        )
    segment_meta = _probe_video(destination)
    return {**source, **segment_meta, "path": str(destination)}


def status() -> dict:
    try:
        import ytagent
        from ytagent.bootstrap import bgutil_status

        version = getattr(ytagent, "__version__", "unknown")
        installed = True
        bgutil = bgutil_status()
    except ImportError:
        version = None
        installed = False
        bgutil = {"ready": False}
    return {
        "enabled": YTAGENT_ENABLED,
        "installed": installed,
        "version": version,
        "max_height": YTAGENT_MAX_HEIGHT,
        "min_height": YTAGENT_MIN_HEIGHT,
        "safe_methods": list(SAFE_METHOD_NAMES),
        "source_dir": str(_SOURCE_DIR),
        "bgutil_home": str(YTAGENT_BGUTIL_HOME),
        "bgutil": bgutil,
    }
