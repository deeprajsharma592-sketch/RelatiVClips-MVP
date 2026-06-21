import json
import os
import re
import subprocess
import time
from pathlib import Path
from typing import Optional, Callable

from ..utils.config import TEMP_DIR, YTDLP_PATH, COOKIES_PATH, get_proxy


def _extract_video_id(url: str) -> str:
    if "watch?v=" in url:
        return url.split("watch?v=")[-1].split("&")[0]
    elif "youtu.be/" in url:
        return url.split("youtu.be/")[-1].split("?")[0]
    elif "shorts/" in url:
        return url.split("shorts/")[-1].split("?")[0]
    return ""


def _parse_vtt(vtt_path: str) -> list:
    """Parse VTT file from path."""
    try:
        with open(vtt_path, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception:
        return []
    return _parse_vtt_content(content)


def _parse_vtt_content(content: str) -> list:
    """Parse VTT string (used for in-memory subtitle data from laptop proxy)."""
    blocks = re.split(r"\n\s*\n", content)
    segments = []
    for block in blocks:
        lines = block.strip().split("\n")
        if len(lines) < 2:
            continue
        if lines[0].startswith("WEBVTT"):
            lines = lines[1:]
        timing_line = None
        text_lines = []
        for i, line in enumerate(lines):
            if "-->" in line:
                timing_line = line
                text_lines = lines[i + 1:]
                break
        if not timing_line:
            continue
        try:
            start_str = timing_line.split("-->")[0].strip().replace(",", ".")
            end_str = timing_line.split("-->")[1].split()[0].strip().replace(",", ".")
            start = sum(float(x) * mult for x, mult in zip(start_str.split(":"), [3600, 60, 1]))
            end = sum(float(x) * mult for x, mult in zip(end_str.split(":"), [3600, 60, 1]))
            text = re.sub(r"<[^>]+>", "", " ".join(text_lines)).strip()
            if text and start < end:
                segments.append({"start": round(start, 3), "end": round(end, 3), "text": text})
        except Exception:
            continue
    return segments


def _parse_srt(srt_path: str) -> list:
    segments = []
    try:
        with open(srt_path, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception:
        return []
    blocks = re.split(r"\n\s*\n", content.strip())
    for block in blocks:
        lines = block.strip().split("\n")
        if len(lines) < 2:
            continue
        time_match = re.match(
            r"(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})",
            lines[1],
        )
        if not time_match:
            continue
        parts = [int(x) for x in time_match.groups()]
        start = parts[0] * 3600 + parts[1] * 60 + parts[2] + parts[3] / 1000
        end = parts[4] * 3600 + parts[5] * 60 + parts[6] + parts[7] / 1000
        text = re.sub(r"<[^>]+>", "", " ".join(lines[2:]).strip())
        if text:
            segments.append({"start": round(start, 3), "end": round(end, 3), "text": text})
    return segments


def _try_ytdlp_transcript(url: str, task_id: str, log: Callable) -> Optional[dict]:
    """
    Try to get transcript via yt-dlp auto-generated subtitles.
    Routes through Deepraj's laptop (residential IP) first, then falls back
    to direct server download.

    Returns segments dict or None if unavailable.
    """
    import requests as _requests
    from ..utils.config import RESIDENTIAL_DOWNLOAD_URL, RESIDENTIAL_DOWNLOAD_TIMEOUT

    # --- Step 1: Try laptop (residential IP) ---
    try:
        laptop_url = f"{RESIDENTIAL_DOWNLOAD_URL.rstrip('/')}/subtitles"
        log(f"  Fetching subtitles via laptop proxy: {laptop_url}")
        resp = _requests.get(
            laptop_url,
            params={"url": url, "lang": "en"},
            timeout=RESIDENTIAL_DOWNLOAD_TIMEOUT,
        )
        if resp.status_code == 200:
            data = resp.json()
            vtt = data.get("vtt", "")
            if vtt and len(vtt) > 50:
                segments = _parse_vtt_content(vtt)
                if segments:
                    log(f"  Laptop proxy subtitles: {len(segments)} segments")
                    return {"segments": segments, "language": "en", "source": "ytdlp_vtt"}
        elif resp.status_code == 404:
            log("  Laptop proxy: no subtitles for this video")
        else:
            log(f"  Laptop proxy error {resp.status_code}: {resp.text[:100]}")
    except _requests.exceptions.ConnectionError:
        log("  Laptop proxy unreachable — trying direct download")
    except Exception as e:
        log(f"  Laptop proxy error: {e}")

    # --- Step 2: Fall back to direct server download ---
    subs_base = TEMP_DIR / f"{task_id}_subs"
    subs_vtt = subs_base.with_suffix(".en.vtt")
    subs_srt = subs_base.with_suffix(".en.srt")

    for p in [subs_vtt, subs_srt]:
        if p.exists():
            try:
                p.unlink()
            except Exception:
                pass

    cmd = [
        YTDLP_PATH,
        "--write-auto-subs",
        "--sub-lang", "en",
        "--sub-format", "vtt/srt/best",
        "--skip-download",
        "-o", str(subs_base),
        "--no-warnings",
        "--no-check-certificates",
        "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "--js-runtimes", "node",
        "--remote-components", "ejs:github",
    ]

    _cookies_arg = None
    if COOKIES_PATH and COOKIES_PATH.exists():
        import shutil
        _working = "/tmp/youtube_cookies_working.txt"
        try:
            shutil.copy2(str(COOKIES_PATH), _working)
            _cookies_arg = _working
        except Exception:
            _cookies_arg = str(COOKIES_PATH)
        cmd.extend(["--cookies", _cookies_arg])
    _proxy = get_proxy()
    if _proxy:
        cmd.extend(["--proxy", _proxy])

    cmd.append(url)

    last_stderr = ""
    success = False
    max_attempts = 4
    timeout = 180
    for attempt in range(1, max_attempts + 1):
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
            last_stderr = result.stderr or ""
            if result.returncode == 0:
                success = True
                break
            err_snippet = last_stderr[:150].replace("\n", " ")
            log(f"  [subtitle direct] attempt {attempt}/{max_attempts} failed (rc={result.returncode}): {err_snippet}")
        except subprocess.TimeoutExpired:
            log(f"  [subtitle direct] attempt {attempt}/{max_attempts} timed out after {timeout}s")
        except Exception as e:
            log(f"  [subtitle direct] attempt {attempt}/{max_attempts} crashed: {e}")
        if attempt < max_attempts:
            time.sleep(3 * attempt)

    if not success:
        combined = last_stderr.lower()
        if "sign in" in combined or "cookies" in combined or "not a bot" in combined:
            log("  Auth/cookie error — returning auth_error flag")
            return {"segments": [], "auth_error": True}
        log("  yt-dlp subtitle download failed after retries")
        return None

    segments = []
    source = None

    if subs_vtt.exists() and subs_vtt.stat().st_size > 0:
        log(f"  VTT subtitles found ({subs_vtt.stat().st_size} bytes)")
        segments = _parse_vtt(str(subs_vtt))
        source = "ytdlp_vtt"
    elif subs_srt.exists() and subs_srt.stat().st_size > 0:
        log(f"  SRT subtitles found ({subs_srt.stat().st_size} bytes)")
        segments = _parse_srt(str(subs_srt))
        source = "ytdlp_srt"

    if segments:
        log(f"  Parsed {len(segments)} subtitle segments")
        return {"segments": segments, "language": "en", "source": source}

    log("  Subtitles file empty or unparseable")
    return None


def _try_whisper_transcript(audio_path: str, task_id: str, log: Callable) -> Optional[dict]:
    """Fall back to faster-whisper local transcription."""
    log("  Running faster-whisper on audio...")
    try:
        from faster_whisper import WhisperModel
        from ..utils.config import WHISPER_MODEL, WHISPER_COMPUTE_TYPE
        from ..utils.vram_manager import get_vram_usage, clear_gpu

        vram = get_vram_usage()
        if not vram.get("cuda_available"):
            log("  No CUDA GPU available, cannot run Whisper")
            return None

        model = WhisperModel(WHISPER_MODEL, device="cuda", compute_type=WHISPER_COMPUTE_TYPE)
        segments, info = model.transcribe(
            audio_path,
            beam_size=5,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500),
        )

        segment_list = []
        for seg in segments:
            segment_list.append({
                "start": round(seg.start, 3),
                "end": round(seg.end, 3),
                "text": seg.text.strip(),
            })

        clear_gpu()
        log(f"  Whisper transcribed: {len(segment_list)} segments in {info.language}")
        return {"segments": segment_list, "language": info.language or "en", "source": "whisper"}
    except ImportError:
        log("  faster-whisper not installed, skipping")
    except Exception as e:
        log(f"  Whisper failed: {str(e)[:100]}")

    return None


def _download_audio(url: str, task_id: str, log: Callable) -> Optional[str]:
    """Download audio from a URL using yt-dlp."""
    audio_path = TEMP_DIR / f"{task_id}_audio.m4a"

    if audio_path.exists():
        try:
            audio_path.unlink()
        except Exception:
            pass

    cmd = [
        YTDLP_PATH,
        "-f", "bestaudio/best",
        "--extract-audio",
        "--audio-format", "m4a",
        "--audio-quality", "0",
        "-o", str(audio_path),
        "--no-warnings",
        "--no-check-certificates",
        "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        url,
    ]

    _cookies_arg = None
    if COOKIES_PATH and COOKIES_PATH.exists():
        import shutil
        _working = "/tmp/youtube_cookies_working.txt"
        try:
            shutil.copy2(str(COOKIES_PATH), _working)
            _cookies_arg = _working
        except Exception:
            _cookies_arg = str(COOKIES_PATH)
        cmd.extend(["--cookies", _cookies_arg])
    _proxy = get_proxy()
    if _proxy:
        cmd.extend(["--proxy", _proxy])

    try:
        log("  Downloading audio...")
        result = _run_with_retry(cmd, log, label="audio download", max_attempts=4, timeout=600)
        if result is None or result.returncode != 0:
            log("  Audio download failed after retries")
            return None

        if audio_path.exists() and audio_path.stat().st_size > 0:
            log(f"  Audio downloaded ({audio_path.stat().st_size / 1024 / 1024:.1f}MB)")
            return str(audio_path)

        log("  Audio file not created")
    except subprocess.TimeoutExpired:
        log("  Audio download timed out")
    except Exception as e:
        log(f"  Audio download error: {str(e)[:100]}")

    return None


def fetch_transcript(
    url: str,
    task_id: str,
    log: Optional[Callable] = None
) -> dict:
    """
    Fetch transcript for a video URL with automatic fallback.

    Priority:
    1. yt-dlp auto-generated subtitles via laptop residential IP (fast)
    2. yt-dlp direct server download (fallback)
    3. faster-whisper on downloaded audio (GPU, fallback)

    Returns dict with keys: segments, language, source
    """
    if log is None:
        log = lambda m: None

    transcript = _try_ytdlp_transcript(url, task_id, log)

    if transcript:
        return transcript

    log("  yt-dlp captions unavailable, falling back to audio transcription...")
    audio_path = _download_audio(url, task_id, log)

    if not audio_path:
        return {"segments": [], "language": "en", "source": None}

    transcript = _try_whisper_transcript(audio_path, task_id, log)

    try:
        if audio_path and os.path.exists(audio_path):
            os.remove(audio_path)
    except Exception:
        pass

    if transcript:
        return transcript

    return {"segments": [], "language": "en", "source": None}


def _run_with_retry(cmd, log_fn, label: str = "yt-dlp", max_attempts: int = 4, timeout: int = 120):
    """Run a yt-dlp command with retries on transient failures."""
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
            time.sleep(3 * attempt)
    return None
