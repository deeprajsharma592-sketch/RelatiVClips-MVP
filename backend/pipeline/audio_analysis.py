"""
Audio signal analysis: BOTH peaks AND valleys.

Why valleys:
  - A "valley" is a sudden DECREASE in energy (RMS drops below mean × factor).
  - Valleys are awkward silences, dramatic pauses, the moment right BEFORE a
    punchline lands. The contrast between valley and the following peak is
    what makes a joke / reveal / callback land.
  - Detecting both gives the LLM candidates from the WHOLE story arc, not
    just the loudest moments.

The "valley" is the hook the energy-based peak detector misses:
  - "I lost everything..." (3s valley, low energy)
  - "...and then I made 10 Cr in 6 months." (peak, energy spike)
The valley→peak PAIR is the viral moment, not the peak alone.
"""
import numpy as np
import librosa
from typing import List, Dict, Tuple
from ..utils.config import (
    TARGET_SAMPLE_RATE,
    PEAK_THRESHOLD_MULTIPLIER,
    VALLEY_THRESHOLD_MULTIPLIER,
    VALLEY_MIN_DURATION_S,
    VALLEY_CONTEXT_PADDING_S,
)


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


def analyze_audio_valleys(
    audio_path: str,
    progress_callback=None,
    min_duration_s: float = VALLEY_MIN_DURATION_S,
    context_padding_s: float = VALLEY_CONTEXT_PADDING_S,
) -> dict:
    """
    Detect ENERGY VALLEYS — moments where the audio suddenly drops to a
    low-energy state for >= min_duration_s. These are awkward silences,
    dramatic pauses, the moment right before a punchline. The CONTRAST
    with the surrounding energy is what makes them hook.

    Algorithm:
      1. Load audio + compute RMS energy per frame (same as peak detector)
      2. Compute mean RMS
      3. Mark frames where RMS < mean × VALLEY_THRESHOLD_MULTIPLIER
      4. Group consecutive low frames into regions >= min_duration_s
      5. For each region: extend by ±context_padding_s to form a clip
         window (the valley + the peaks on either side = the hook)

    Returns:
        dict: {
            valleys: [{
                start, end,         # the clip window (with padding)
                valley_start, valley_end,  # the actual low-energy region
                depth,              # how far below mean the valley went (relative)
                score,              # overall score (depth × duration)
            }, ...],
            mean_energy, threshold, duration_s
        }
    """
    if progress_callback:
        progress_callback("Loading audio for valley analysis...")

    y, sr = librosa.load(audio_path, sr=TARGET_SAMPLE_RATE, mono=True)
    hop_length = 512

    rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]
    mean_energy = float(np.mean(rms))
    threshold = mean_energy * VALLEY_THRESHOLD_MULTIPLIER

    frame_dur = hop_length / sr  # seconds per frame
    min_frames = max(1, int(min_duration_s / frame_dur))

    # Find low-energy regions
    low_mask = rms < threshold
    valleys: List[dict] = []

    in_valley = False
    valley_start_frame = 0
    valley_min_energy = 1e9

    for i, is_low in enumerate(low_mask):
        if is_low:
            if not in_valley:
                in_valley = True
                valley_start_frame = i
                valley_min_energy = rms[i]
            else:
                valley_min_energy = min(valley_min_energy, rms[i])
        else:
            if in_valley:
                valley_end_frame = i
                valley_dur = (valley_end_frame - valley_start_frame) * frame_dur
                if valley_dur >= min_duration_s:
                    depth = (mean_energy - valley_min_energy) / mean_energy  # 0-1
                    score = depth * (valley_dur / 10.0)  # weight duration
                    valley_start_s = valley_start_frame * frame_dur
                    valley_end_s = valley_end_frame * frame_dur
                    # Pad both sides to capture the surrounding peaks
                    clip_start = max(0, valley_start_s - context_padding_s)
                    clip_end = valley_end_s + context_padding_s
                    valleys.append({
                        "start": round(clip_start, 2),
                        "end": round(clip_end, 2),
                        "valley_start": round(valley_start_s, 2),
                        "valley_end": round(valley_end_s, 2),
                        "depth": round(depth, 3),
                        "score": round(score, 3),
                        "duration_s": round(valley_dur, 2),
                    })
                in_valley = False
                valley_min_energy = 1e9

    # Handle valley that extends to end of audio
    if in_valley:
        valley_end_frame = len(low_mask)
        valley_dur = (valley_end_frame - valley_start_frame) * frame_dur
        if valley_dur >= min_duration_s:
            depth = (mean_energy - valley_min_energy) / mean_energy
            score = depth * (valley_dur / 10.0)
            valley_start_s = valley_start_frame * frame_dur
            valley_end_s = valley_end_frame * frame_dur
            clip_start = max(0, valley_start_s - context_padding_s)
            clip_end = valley_end_s + context_padding_s
            valleys.append({
                "start": round(clip_start, 2),
                "end": round(clip_end, 2),
                "valley_start": round(valley_start_s, 2),
                "valley_end": round(valley_end_s, 2),
                "depth": round(depth, 3),
                "score": round(score, 3),
                "duration_s": round(valley_dur, 2),
            })

    valleys.sort(key=lambda v: v["score"], reverse=True)

    if progress_callback:
        callback_msg = (
            f"Found {len(valleys)} energy valleys (depth>=1-{VALLEY_THRESHOLD_MULTIPLIER:.2f}×mean, "
            f"dur>={min_duration_s:.1f}s)"
        )
        progress_callback(callback_msg)

    return {
        "valleys": valleys,
        "mean_energy": round(mean_energy, 4),
        "threshold": round(threshold, 4),
        "duration_s": round(float(len(y)) / sr, 2),
    }


def analyze_audio_peaks_and_valleys(
    audio_path: str, progress_callback=None
) -> dict:
    """
    One-shot: load the audio once, return both peaks and valleys.

    This is the entry point the moment_detector uses. Avoids loading the
    same audio file twice (which would be 2x the I/O + decode time).
    """
    if progress_callback:
        progress_callback("Loading audio for combined peak + valley analysis...")

    y, sr = librosa.load(audio_path, sr=TARGET_SAMPLE_RATE, mono=True)
    hop_length = 512
    frame_dur = hop_length / sr

    rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]
    mean_energy = float(np.mean(rms))
    peak_threshold = mean_energy * PEAK_THRESHOLD_MULTIPLIER
    valley_threshold = mean_energy * VALLEY_THRESHOLD_MULTIPLIER

    # Peaks: frames above threshold
    peaks: List[dict] = []
    for i, energy in enumerate(rms):
        if energy > peak_threshold:
            timestamp = float(i * frame_dur)
            peaks.append({
                "timestamp": round(timestamp, 2),
                "energy_score": round(float(energy), 4),
                "relative_to_mean": round(float(energy / mean_energy), 2),
            })
    peaks.sort(key=lambda x: x["energy_score"], reverse=True)

    # Valleys: low-energy regions >= min_duration_s
    low_mask = rms < valley_threshold
    min_frames = max(1, int(VALLEY_MIN_DURATION_S / frame_dur))
    valleys: List[dict] = []
    in_valley = False
    valley_start_frame = 0
    valley_min_energy = 1e9

    for i, is_low in enumerate(low_mask):
        if is_low:
            if not in_valley:
                in_valley = True
                valley_start_frame = i
                valley_min_energy = rms[i]
            else:
                valley_min_energy = min(valley_min_energy, rms[i])
        else:
            if in_valley:
                valley_end_frame = i
                valley_dur = (valley_end_frame - valley_start_frame) * frame_dur
                if valley_dur >= min_frames * frame_dur:
                    depth = (mean_energy - valley_min_energy) / mean_energy
                    score = depth * (valley_dur / 10.0)
                    valley_start_s = valley_start_frame * frame_dur
                    valley_end_s = valley_end_frame * frame_dur
                    clip_start = max(0, valley_start_s - VALLEY_CONTEXT_PADDING_S)
                    clip_end = valley_end_s + VALLEY_CONTEXT_PADDING_S
                    valleys.append({
                        "start": round(clip_start, 2),
                        "end": round(clip_end, 2),
                        "valley_start": round(valley_start_s, 2),
                        "valley_end": round(valley_end_s, 2),
                        "depth": round(depth, 3),
                        "score": round(score, 3),
                        "duration_s": round(valley_dur, 2),
                    })
                in_valley = False
                valley_min_energy = 1e9

    if in_valley:
        valley_end_frame = len(low_mask)
        valley_dur = (valley_end_frame - valley_start_frame) * frame_dur
        if valley_dur >= min_frames * frame_dur:
            depth = (mean_energy - valley_min_energy) / mean_energy
            score = depth * (valley_dur / 10.0)
            valley_start_s = valley_start_frame * frame_dur
            valley_end_s = valley_end_frame * frame_dur
            clip_start = max(0, valley_start_s - VALLEY_CONTEXT_PADDING_S)
            clip_end = valley_end_s + VALLEY_CONTEXT_PADDING_S
            valleys.append({
                "start": round(clip_start, 2),
                "end": round(clip_end, 2),
                "valley_start": round(valley_start_s, 2),
                "valley_end": round(valley_end_s, 2),
                "depth": round(depth, 3),
                "score": round(score, 3),
                "duration_s": round(valley_dur, 2),
            })

    valleys.sort(key=lambda v: v["score"], reverse=True)

    duration = float(len(y)) / sr

    if progress_callback:
        progress_callback(
            f"Found {len(peaks)} peaks + {len(valleys)} valleys over {duration:.1f}s"
        )

    return {
        "peaks": peaks,
        "valleys": valleys,
        "mean_energy": round(mean_energy, 4),
        "peak_threshold": round(peak_threshold, 4),
        "valley_threshold": round(valley_threshold, 4),
        "duration_s": round(duration, 2),
    }