import json
from pathlib import Path
from typing import Dict, List
from faster_whisper import WhisperModel
from ..utils.config import (
    WHISPER_MODEL,
    WHISPER_COMPUTE_TYPE,
    TEMP_DIR
)
from ..utils.vram_manager import clear_gpu, get_vram_usage


def transcribe_audio(
    audio_path: str,
    task_id: str,
    progress_callback=None
) -> dict:
    """
    Transcribe audio to JSON with word-level timestamps.

    WHY faster-whisper INSTEAD OF openai-whisper:
    - openai-whisper uses PyTorch default FP32 = ~5.5GB VRAM
    - faster-whisper uses CTranslate2 with int8_float16 = ~3GB VRAM
    - 40% memory reduction with similar accuracy
    - 2-3x faster inference speed

    WHY word-level timestamps:
    - Gemma needs precise clip boundaries (<100ms accuracy)
    - Word-level enables "karaoke" highlighting in .ass subtitles
    - Allows sharp cuts without "frozen frame" artifacts

    WHY int8_float16:
    - INT8 weights = 1 byte per parameter
    - FP16 activations = 2 bytes when needed for precision
    - Hybrid approach = best accuracy/memory tradeoff

    Args:
        audio_path: Path to 16kHz WAV file
        task_id: Task identifier for saving transcript JSON
        progress_callback: Optional callback

    Returns:
        dict: {segments: [{start, end, text, words: [...]}], language, duration}
    """
    if progress_callback:
        progress_callback("Loading faster-whisper model...")

    # Try GPU first; CPU is too slow so fail fast if GPU unavailable
    vram = get_vram_usage()
    if vram["cuda_available"]:
        try:
            model = WhisperModel(WHISPER_MODEL, device="cuda", compute_type=WHISPER_COMPUTE_TYPE)
            if progress_callback:
                progress_callback(f"Using GPU for Whisper (VRAM: {vram['allocated_mb']}MB)")
        except Exception as e:
            if progress_callback:
                progress_callback(f"GPU load failed ({e}), not falling back to CPU (too slow)")
            raise RuntimeError(f"GPU unavailable for Whisper: {e}")
    else:
        if progress_callback:
            progress_callback("No CUDA GPU available, skipping Whisper (CPU too slow)")
        raise RuntimeError("No GPU for Whisper and CPU is too slow")

    if progress_callback:
        progress_callback("Model loaded. Starting transcription...")
        vram = get_vram_usage()
        progress_callback(f"VRAM after load: {vram['allocated_mb']}MB")

    if progress_callback:
        progress_callback("Transcribing audio (this may take several minutes)...")

    segments, info = model.transcribe(
        audio_path,
        word_timestamps=True,
        beam_size=5,
        vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=500)
    )

    transcript_segments = []
    for seg in segments:
        words = []
        if seg.words:
            for word in seg.words:
                words.append({
                    "word": word.word,
                    "start": round(word.start, 3),
                    "end": round(word.end, 3),
                    "probability": round(word.probability, 3)
                })

        transcript_segments.append({
            "start": round(seg.start, 3),
            "end": round(seg.end, 3),
            "text": seg.text.strip(),
            "words": words
        })

    if progress_callback:
        progress_callback(f"Transcription complete. Language: {info.language}, Duration: {info.duration}s")

    result = {
        "language": info.language,
        "duration_s": round(info.duration, 2),
        "segments": transcript_segments,
        "task_id": task_id
    }

    transcript_path = TEMP_DIR / f"{task_id}_transcript.json"
    with open(transcript_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    del model

    clear_result = clear_gpu()
    if progress_callback:
        progress_callback(f"VRAM cleared. Released: {clear_result.get('released_mb', 0):.1f}MB")

    return result


def load_transcript(task_id: str) -> dict:
    """
    Load existing transcript from disk.

    WHY THIS IS NEEDED:
    - If a task was interrupted, we can resume from transcript
    - Allows debugging without re-transcribing
    - Clip selector can reload transcript without re-running Whisper
    """
    transcript_path = TEMP_DIR / f"{task_id}_transcript.json"
    if transcript_path.exists():
        with open(transcript_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return None


def get_text_for_timestamp_range(segments: List[dict], start: float, end: float) -> str:
    """
    Extract text content for a specific time range.

    WHY THIS IS NEEDED:
    - Gemma needs the actual transcript text for each clip
    - This function extracts just the relevant portion
    - Used when building the prompt for clip selection

    Args:
        segments: Transcript segments from faster-whisper
        start: Start time in seconds
        end: End time in seconds

    Returns:
        Text content within the time range
    """
    relevant_text = []

    for seg in segments:
        if seg["start"] >= start and seg["end"] <= end:
            relevant_text.append(seg["text"])
        elif seg["start"] < end and seg["end"] > start:
            relevant_text.append(seg["text"])

    return " ".join(relevant_text).strip()