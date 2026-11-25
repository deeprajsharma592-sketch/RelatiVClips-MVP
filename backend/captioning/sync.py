"""Audio-locked caption synchronization for trimmed render clips.

Eliminates timing drift between talking-head audio/video and burned-in ASS
captions by deriving word timestamps directly from the trimmed clip's own
audio track (starting at t = 0.000), rather than relying on coarse YouTube
segment captions or guessed surgical download keyframe offsets.
"""
from __future__ import annotations

import array
import logging
import math
import re
import subprocess
import threading
import wave
from pathlib import Path
from typing import Any, Optional

from .ass_builder import normalize_words
from .hinglish import convert_words_to_hinglish, has_devanagari

log = logging.getLogger(__name__)

_WHISPER_LOCK = threading.Lock()
_WHISPER_CACHE: dict[tuple[str, str, str], Any] = {}


def _get_whisper_model() -> Any:
    """Load and cache faster-whisper WhisperModel across clips in a worker."""
    from faster_whisper import WhisperModel
    from ..utils.config import WHISPER_COMPUTE_TYPE, WHISPER_MODEL
    from ..utils.vram_manager import get_vram_usage

    vram = get_vram_usage()
    device = "cuda" if vram.get("cuda_available") else "cpu"
    compute_type = WHISPER_COMPUTE_TYPE if device == "cuda" else "int8"
    key = (WHISPER_MODEL, device, compute_type)

    with _WHISPER_LOCK:
        if key in _WHISPER_CACHE:
            return _WHISPER_CACHE[key]
        try:
            model = WhisperModel(WHISPER_MODEL, device=device, compute_type=compute_type)
        except Exception:
            key = (WHISPER_MODEL, "cpu", "int8")
            if key in _WHISPER_CACHE:
                return _WHISPER_CACHE[key]
            model = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8")
        _WHISPER_CACHE[key] = model
        return model


def _extract_sync_wav(
    media_path: Path,
    wav_path: Path,
    start_s: float = 0.0,
    duration_s: Optional[float] = None,
    subtitle_offset_s: float = 0.0,
) -> Optional[Path]:
    """Extract a 16kHz mono PCM WAV aligned to t=0 of the rendered clip."""
    from ..utils.config import FFMPEG_PATH

    cmd = [FFMPEG_PATH, "-y", "-hide_banner", "-loglevel", "error"]
    if start_s > 0.01:
        cmd.extend(["-ss", f"{start_s:.3f}"])
    cmd.extend(["-i", str(media_path)])
    if duration_s is not None and duration_s > 0.1:
        cmd.extend(["-t", f"{duration_s:.3f}"])
    cmd.extend([
        "-vn",
        "-af", "aresample=async=1:first_pts=0",
        "-ac", "1",
        "-ar", "16000",
        "-c:a", "pcm_s16le",
        str(wav_path),
    ])
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    if res.returncode == 0 and wav_path.exists() and wav_path.stat().st_size > 1024:
        return wav_path
    return None


def _word_emphasis(text: str) -> int:
    if re.search(r"(?:[$₹]\d|\d+%?)", text):
        return 2
    if text.isupper() and len(text) > 2:
        return 1
    return 0


def _explicit_caption_language(clip: dict[str, Any]) -> Optional[str]:
    """Extract user-selected caption language ('en', 'hi', 'hinglish', 'ur') if set."""
    for container_key in ("style", "caption_style"):
        container = clip.get(container_key)
        if isinstance(container, dict):
            overrides = container.get("overrides")
            if isinstance(overrides, dict) and overrides.get("language"):
                return str(overrides["language"]).strip().lower()
            if container.get("language"):
                return str(container["language"]).strip().lower()
    if clip.get("caption_language"):
        return str(clip["caption_language"]).strip().lower()
    return None


def _infer_clip_language(clip: dict[str, Any]) -> Optional[str]:
    """Infer consistent Whisper language ('hi', 'en', 'ur', etc.) from explicit selection or clip metadata."""
    explicit = _explicit_caption_language(clip)
    if explicit:
        if explicit in ("hinglish", "hi", "hindi"):
            return "hi"
        if explicit in ("en", "english"):
            return "en"
        if explicit in ("ur", "urdu"):
            return "ur"

    # Check text/words/transcript for Devanagari first so Hindi/Hinglish clips never mis-detect as English.
    for key in ("caption", "text", "viral_title"):
        val = clip.get(key)
        if isinstance(val, str) and has_devanagari(val):
            return "hi"
    for w in clip.get("words") or []:
        if isinstance(w, dict) and has_devanagari(str(w.get("w") or w.get("word") or "")):
            return "hi"
    transcript = clip.get("transcript") or {}
    if isinstance(transcript, dict):
        for seg in transcript.get("segments") or []:
            if isinstance(seg, dict) and has_devanagari(str(seg.get("text") or "")):
                return "hi"

    raw_lang = str(
        clip.get("language")
        or (transcript.get("language") if isinstance(transcript, dict) else "")
        or ""
    ).strip().lower()
    if not raw_lang:
        return None
    if raw_lang.startswith("hi") or "hindi" in raw_lang:
        return "hi"
    if raw_lang.startswith("en") or "english" in raw_lang:
        return "en"
    code = raw_lang.split("-")[0].split("_")[0]
    return code if len(code) == 2 and code.isalpha() else None


def _transcribe_wav_words(
    wav_path: Path,
    clip_duration: float,
    language: Optional[str] = None,
    convert_hinglish: bool = True,
) -> Optional[list[dict[str, Any]]]:
    """Transcribe trimmed 16kHz WAV with faster-whisper word_timestamps=True."""
    try:
        model = _get_whisper_model()
        transcribe_kwargs: dict[str, Any] = {
            "beam_size": 5,
            "word_timestamps": True,
        }
        if language:
            transcribe_kwargs["language"] = language
            transcribe_kwargs["task"] = "transcribe"

        with _WHISPER_LOCK:
            try:
                segments, transcribe_info = model.transcribe(
                    str(wav_path),
                    vad_filter=True,
                    vad_parameters=dict(min_silence_duration_ms=300),
                    **transcribe_kwargs,
                )
            except Exception:
                segments, transcribe_info = model.transcribe(
                    str(wav_path),
                    vad_filter=False,
                    **transcribe_kwargs,
                )
            seg_list = list(segments)

        words: list[dict[str, Any]] = []
        for seg in seg_list:
            for w in getattr(seg, "words", None) or []:
                text = (w.word or "").strip()
                if not text:
                    continue
                ws = max(0.0, round(float(w.start), 3))
                we = min(clip_duration, max(ws + 0.05, round(float(w.end), 3)))
                if ws >= clip_duration:
                    continue
                words.append({
                    "w": text,
                    "start": ws,
                    "end": we,
                    "emph": _word_emphasis(text),
                })
        if not words:
            return None
        return convert_words_to_hinglish(words) if convert_hinglish else words
    except ImportError:
        return None
    except Exception as exc:
        log.debug("Whisper clip-sync skipped (%s)", exc)
        return None


def _detect_speech_intervals(wav_path: Path, frame_ms: int = 20) -> tuple[list[tuple[float, float]], float]:
    """Detect active speech intervals (seconds) from a 16kHz mono PCM WAV."""
    with wave.open(str(wav_path), "rb") as wf:
        sr = wf.getframerate()
        n_frames = wf.getnframes()
        raw = wf.readframes(n_frames)
    if not raw or sr <= 0:
        return [], 0.0

    samples = array.array("h")
    samples.frombytes(raw)
    total_dur = len(samples) / sr
    hop = max(1, int(sr * frame_ms / 1000))
    n_bins = len(samples) // hop
    if n_bins == 0:
        return [], total_dur

    rms: list[float] = []
    scale = 1.0 / 32768.0
    for b in range(n_bins):
        base = b * hop
        sq = sum((samples[base + j] * scale) ** 2 for j in range(hop))
        rms.append(math.sqrt(sq / hop))

    sorted_rms = sorted(rms)
    noise_floor = sorted_rms[min(len(sorted_rms) - 1, int(len(sorted_rms) * 0.20))]
    peak = sorted_rms[min(len(sorted_rms) - 1, int(len(sorted_rms) * 0.95))]
    thresh = max(0.008, noise_floor + 0.18 * max(0.0, peak - noise_floor))
    active = [val > thresh for val in rms]

    # Bridge short gaps (< 220ms) so natural consonant pauses stay in one burst
    bridge_bins = max(1, int(220 / frame_ms))
    closed = list(active)
    gap = 0
    for i in range(len(closed)):
        if closed[i]:
            if 0 < gap <= bridge_bins:
                closed[i - gap : i] = True
            gap = 0
        else:
            gap += 1

    intervals: list[tuple[float, float]] = []
    in_seg = False
    seg_start = 0
    for i, flag in enumerate(closed):
        if flag and not in_seg:
            in_seg = True
            seg_start = i
        elif not flag and in_seg:
            in_seg = False
            s_t = (seg_start * hop) / sr
            e_t = (i * hop) / sr
            if e_t - s_t >= 0.08:
                intervals.append((round(s_t, 3), round(e_t, 3)))
    if in_seg:
        s_t = (seg_start * hop) / sr
        if total_dur - s_t >= 0.08:
            intervals.append((round(s_t, 3), round(total_dur, 3)))

    return intervals, total_dur


def _energy_align_words(
    words: list[dict[str, Any]],
    wav_path: Path,
    clip_duration: float,
) -> list[dict[str, Any]]:
    """Anchor existing word timestamps to actual speech onset in the trimmed WAV."""
    if not words:
        return words
    intervals, wav_dur = _detect_speech_intervals(wav_path)
    if not intervals:
        return words

    dur = min(clip_duration, wav_dur) if wav_dur > 0.5 else clip_duration
    first_speech = intervals[0][0]
    first_word = words[0]["start"]
    offset = first_speech - first_word

    # Correct keyframe-snap / caption-lead offset when consistent and bounded
    if 0.25 <= abs(offset) <= 10.0:
        shifted = []
        for w in words:
            ns = w["start"] + offset
            ne = w["end"] + offset
            if ne <= 0.0 or ns >= dur:
                continue
            shifted.append({
                **w,
                "start": round(max(0.0, ns), 3),
                "end": round(min(dur, max(ns + 0.05, ne)), 3),
            })
        if shifted:
            return shifted
    return words


def sync_clip_captions_to_audio(
    clip: dict[str, Any],
    media_path: str | Path,
    task_id: str,
    clip_index: int,
    start_s: float = 0.0,
    duration_s: Optional[float] = None,
    subtitle_offset_s: float = 0.0,
) -> str:
    """Lock clip caption words to the actual rendered audio track.

    Mutates ``clip["words"]`` with clip-relative (0..duration) timestamps and
    sets ``clip["caption_words_relative"] = True``.
    Returns the sync method used: ``"whisper_audio"``, ``"energy_aligned"``, or ``"original"``.
    """
    media = Path(media_path)
    if not media.exists():
        return "original"

    from ..utils.config import TEMP_DIR
    clip_duration = float(duration_s or max(0.5, float(clip.get("end", 30)) - float(clip.get("start", 0))))
    wav_path = TEMP_DIR / f"sync_{task_id}_{clip_index}.wav"
    try:
        extracted = _extract_sync_wav(media, wav_path, start_s=start_s, duration_s=clip_duration)
        if not extracted:
            return "original"

        # 1. Best: transcribe the exact trimmed clip audio with word-level timestamps
        clip_lang = _infer_clip_language(clip)
        explicit_lang = _explicit_caption_language(clip)
        use_hinglish = explicit_lang in (None, "", "hinglish")
        whisper_words = _transcribe_wav_words(
            extracted,
            clip_duration,
            language=clip_lang,
            convert_hinglish=use_hinglish,
        )
        if whisper_words:
            # Whisper reports times against the extracted WAV. The final
            # subtitle file can target either a pretrimmed clip (offset 0) or
            # the original segment, so translate to that media timeline here.
            clip["words"] = [
                {**word,
                 "start": round(float(word.get("start", 0.0)) + subtitle_offset_s, 3),
                 "end": round(float(word.get("end", word.get("start", 0.0))) + subtitle_offset_s, 3)}
                for word in whisper_words
            ]
            clip["caption_words_relative"] = True
            clip["caption_sync_source"] = "whisper_audio"
            return "whisper_audio"

        # 2. Fallback: align existing transcript words to detected speech onset in the WAV
        existing_words = normalize_words(clip)
        if existing_words:
            aligned = _energy_align_words(existing_words, extracted, clip_duration)
            if subtitle_offset_s:
                aligned = [
                    {**w,
                     "start": round(float(w.get("start", 0.0)) + subtitle_offset_s, 3),
                     "end": round(float(w.get("end", w.get("start", 0.0))) + subtitle_offset_s, 3)}
                    for w in aligned
                ]
            clip["words"] = aligned
            clip["caption_words_relative"] = True
            clip["caption_sync_source"] = "energy_aligned"
            return "energy_aligned"

        return "original"
    except Exception as exc:
        log.warning("Caption audio sync failed for clip %s: %s", clip_index, exc)
        return "original"
    finally:
        wav_path.unlink(missing_ok=True)
