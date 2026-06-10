import numpy as np
import librosa
from typing import List, Dict
from ..utils.config import TARGET_SAMPLE_RATE, PEAK_THRESHOLD_MULTIPLIER


def analyze_audio_peaks(audio_path: str, progress_callback=None) -> dict:
    """
    Analyze audio for RMS energy and high-intensity peaks.

    WHY RMS ENERGY SPECIFICALLY:
    - RMS (Root Mean Square) = "average loudness over time"
    - More stable than peak detection (less sensitive to sudden spikes)
    - Better represents "how loud was this over a time window"
    - Podcasts/lectures have moderate dynamic range - RMS captures this well

    WHY 1.5x MEAN THRESHOLD:
    - 1.0x = every frame (noise)
    - 2.0x = only explosions/cheers (too strict for speaking)
    - 1.5x = captures emphasis, laughter, applause, applause without noise

    WHY NOT JUST USE WHISPER TIMESTAMPS:
    - Whisper tells you WHAT was said and WHEN
    - Librosa tells you HOW HARD it was said
    - Combining both = the AI knows which moments have ENERGY + MEANING

    Args:
        audio_path: Path to 16kHz WAV file
        progress_callback: Optional callback for progress updates

    Returns:
        dict: {peaks: [{timestamp, energy_score}], mean_energy, duration}
    """
    if progress_callback:
        progress_callback("Loading audio for energy analysis...")

    y, sr = librosa.load(audio_path, sr=TARGET_SAMPLE_RATE, mono=True)

    hop_length = 512
    frame_rate = sr / hop_length

    rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]

    mean_energy = float(np.mean(rms))
    threshold = mean_energy * PEAK_THRESHOLD_MULTIPLIER

    peaks = []
    for i, energy in enumerate(rms):
        if energy > threshold:
            timestamp = float(i * hop_length / sr)
            peaks.append({
                "timestamp": round(timestamp, 2),
                "energy_score": round(float(energy), 4),
                "relative_to_mean": round(float(energy / mean_energy), 2)
            })

    peaks.sort(key=lambda x: x["energy_score"], reverse=True)

    duration = float(len(y)) / sr

    if progress_callback:
        progress_callback(f"Found {len(peaks)} high-energy peaks (threshold: {threshold:.4f})")

    return {
        "peaks": peaks,
        "mean_energy": round(mean_energy, 4),
        "threshold": round(threshold, 4),
        "duration_s": round(duration, 2),
        "frame_rate_hz": round(frame_rate, 2),
        "total_frames": len(rms)
    }


def get_audio_moments(audio_path: str, n_moments: int = 10, progress_callback=None) -> List[Dict]:
    """
    Extract top N high-energy audio moments.

    WHY THIS IS NEEDED:
    - Clip selector needs candidate moments to consider
    - Not all high-energy moments are interesting (e.g., background noise)
    - Providing top 10-15 gives Gemma enough context to choose from

    Args:
        audio_path: Path to 16kHz WAV file
        n_moments: Number of top moments to return
        progress_callback: Optional callback

    Returns:
        List of top energy moments with timestamps
    """
    analysis = analyze_audio_peaks(audio_path, progress_callback)

    top_moments = analysis["peaks"][:n_moments]

    return [
        {
            "timestamp_s": m["timestamp"],
            "energy_score": m["energy_score"],
            "description": f"High energy moment ({m['relative_to_mean']:.1f}x average)"
        }
        for m in top_moments
    ]


def estimate_speech_segments(audio_path: str, silence_threshold_db: int = -40) -> List[dict]:
    """
    Estimate speech segments by detecting non-silent portions.

    WHY THIS IS NEEDED:
    - Clips should start and end during speech, not silence
    - Knowing speech boundaries helps Gemma pick better clip boundaries
    - Prevents clips starting with 2 seconds of dead air

    Args:
        audio_path: Path to 16kHz WAV file
        silence_threshold_db: Silence threshold in decibels

    Returns:
        List of speech segments [{start, end, duration}]
    """
    y, sr = librosa.load(audio_path, sr=TARGET_SAMPLE_RATE, mono=True)

    intervals = librosa.effects.split(y, top_db=-silence_threshold_db)

    segments = []
    for start_frame, end_frame in intervals:
        start_s = start_frame / sr
        end_s = end_frame / sr
        segments.append({
            "start": round(start_s, 2),
            "end": round(end_s, 2),
            "duration": round(end_s - start_s, 2)
        })

    return segments