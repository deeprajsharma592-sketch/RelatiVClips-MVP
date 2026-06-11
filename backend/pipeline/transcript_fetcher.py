import json
import os
import re
import subprocess
from pathlib import Path
from typing import Optional, Callable

from ..utils.config import TEMP_DIR, YTDLP_PATH, COOKIES_PATH


def _extract_video_id(url: str) -> str:
    if "watch?v=" in url:
        return url.split("watch?v=")[-1].split("&")[0]
    elif "youtu.be/" in url:
        return url.split("youtu.be/")[-1].split("?")[0]
    elif "shorts/" in url:
        return url.split("shorts/")[-1].split("?")[0]
    return ""


def _parse_vtt(vtt_path: str) -> list:
    segments = []
    try:
        with open(vtt_path, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception:
        return []

    blocks = re.split(r"\n\s*\n", content)
    for block in blocks:
        lines = block.strip().split("\n")
        if not lines:
            continue
        time_match = None
        text_start = 0
        for i, line in enumerate(lines):
            m = re.match(
                r"(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})",
                line,
            )
            if m:
                time_match = m
                text_start = i + 1
                break
        if not time_match:
            continue
        parts = [int(x) for x in time_match.groups()]
        start = parts[0] * 3600 + parts[1] * 60 + parts[2] + parts[3] / 1000
        end = parts[4] * 3600 + parts[5] * 60 + parts[6] + parts[7] / 1000
        text = " ".join(lines[text_start:]).strip()
        text = re.sub(r"<[^>]+>", "", text).strip()
        if text:
            segments.append({"start": round(start, 3), "end": round(end, 3), "text": text})
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
        text = " ".join(lines[2:]).strip()
        text = re.sub(r"<[^>]+>", "", text).strip()
        if text:
            segments.append({"start": round(start, 3), "end": round(end, 3), "text": text})
    return segments


def _try_ytdlp_transcript(url: str, task_id: str, log: Callable) -> Optional[dict]:
    """Try to fetch transcript via yt-dlp's subtitle download."""
    log("  Downloading auto-generated subtitles via yt-dlp...")

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
        # EJS challenge solver + node runtime — required for 2025+ YouTube
        "--js-runtimes", "node",
        "--remote-components", "ejs:github",
    ]

    if COOKIES_PATH and COOKIES_PATH.exists():
        cmd.extend(["--cookies", str(COOKIES_PATH)])

    cmd.append(url)

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)

        if result.returncode != 0:
            log(f"  yt-dlp subtitle download returned {result.returncode}")
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
    except subprocess.TimeoutExpired:
        log("  yt-dlp subtitle download timed out")
    except Exception as e:
        log(f"  yt-dlp subtitle error: {str(e)[:100]}")

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

    if COOKIES_PATH and COOKIES_PATH.exists():
        cmd.extend(["--cookies", str(COOKIES_PATH)])

    try:
        log("  Downloading audio...")
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)

        if result.returncode != 0:
            log(f"  Audio download failed: {result.stderr[:100]}")
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
    1. yt-dlp auto-generated subtitles (fast, no GPU needed)
    2. faster-whisper on downloaded audio (GPU, fallback)

    Args:
        url: Video URL (YouTube or direct)
        task_id: Unique task identifier
        log: Optional progress callback

    Returns:
        dict with keys: segments, language, source
        segments is list of {start, end, text}
        source is "ytdlp_vtt", "ytdlp_srt", "whisper", or None
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

    # Clean up audio file
    try:
        if audio_path and os.path.exists(audio_path):
            os.remove(audio_path)
    except Exception:
        pass

    if transcript:
        return transcript

    return {"segments": [], "language": "en", "source": None}
