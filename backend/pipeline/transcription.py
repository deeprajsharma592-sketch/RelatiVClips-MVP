import json
from pathlib import Path
from typing import Dict, List, Optional
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

    WHY faster-whisper:
    - CTranslate2 int8 quantization runs efficiently on CPU
    - Word-level timestamps enable precise clip boundaries
    - VAD filter silences improve segmentation accuracy

    Args:
        audio_path: Path to 16kHz WAV file
        task_id: Task identifier for saving transcript JSON
        progress_callback: Optional callback

    Returns:
        dict: {segments: [{start, end, text, words: [...]}], language, duration}
    """
    if progress_callback:
        progress_callback("Loading faster-whisper model...")

    from faster_whisper import WhisperModel

    vram = get_vram_usage()
    model = None

    if vram["cuda_available"]:
        try:
            model = WhisperModel(WHISPER_MODEL, device="cuda", compute_type=WHISPER_COMPUTE_TYPE)
            if progress_callback:
                progress_callback(f"Using GPU for Whisper (VRAM: {vram['allocated_mb']}MB)")
        except Exception as e:
            if progress_callback:
                progress_callback(f"GPU load failed ({e}), falling back to CPU")

    if model is None:
        if progress_callback:
            progress_callback("Loading Whisper on CPU (int8)...")
        model = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8")

    if progress_callback:
        progress_callback("Model loaded. Starting transcription...")

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

    if vram["cuda_available"]:
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