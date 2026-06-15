"""
Audio signal analysis: peaks, valleys, AND steep events (transitions).

Why valleys:
  - A "valley" is a sudden DECREASE in energy (RMS drops below mean × factor).
  - Valleys are awkward silences, dramatic pauses, the moment right BEFORE a
    punchline lands. The contrast between valley and the following peak is
    what makes a joke / reveal / callback land.
  - Detecting both gives the LLM candidates from the WHOLE story arc, not
    just the loudest moments.

Why steep events (NEW):
  - A "steep valley" is a TRANSITION — energy drops suddenly over <1s.
    Catches "I lost everything..." [DROP] "...then made 10 Cr" beats.
  - A "steep peak" is a sudden LOUD — emphasis, applause burst, laugh.
  - These are different from sustained peaks/valleys: they are the EDGES,
    not the regions. The combination of steep-valley → steep-peak is the
    most viral structural pattern in short-form content.

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
    STEEP_MIN_RELATIVE_DROP,
    STEEP_MIN_RELATIVE_RISE,
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
    """Detect sustained ENERGY VALLEYS — see module docstring for details."""
    if progress_callback:
        progress_callback("Loading audio for valley analysis...")

    y, sr = librosa.load(audio_path, sr=TARGET_SAMPLE_RATE, mono=True)
    hop_length = 512

    rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]
    mean_energy = float(np.mean(rms))
    threshold = mean_energy * VALLEY_THRESHOLD_MULTIPLIER

    frame_dur = hop_length / sr
    min_frames = max(1, int(min_duration_s / frame_dur))

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
                in_valley = False
                valley_min_energy = 1e9

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


def _detect_steep_events(
    rms: np.ndarray,
    mean_energy: float,
    frame_dur: float,
) -> Tuple[List[dict], List[dict]]:
    """Detect sudden energy TRANSITIONS — steep valleys and steep peaks.

    A "steep valley" is a moment where the smoothed RMS energy DROPS rapidly
    (over < 1 second) by at least STEEP_MIN_RELATIVE_DROP × mean_energy. This
    catches "I lost everything..." [drop] "...then made 10 Cr" beats.

    A "steep peak" is the opposite — a rapid RISE. Catches emphasis, applause
    bursts, music swells, "BOOM" moments.

    Args:
        rms: 1-D array of per-frame RMS values (already computed once).
        mean_energy: Mean RMS across the whole clip (for normalization).
        frame_dur: Seconds per frame.

    Returns:
        (steep_valleys, steep_peaks) — each is a list of dicts with start,
        end, transition timestamp, magnitude, and score.
    """
    STEEP_WINDOW = 8  # ~0.25s smoothing window at 16kHz / hop=512
    drop_threshold = mean_energy * STEEP_MIN_RELATIVE_DROP
    rise_threshold = mean_energy * STEEP_MIN_RELATIVE_RISE

    # Smooth the RMS to remove per-frame noise
    kernel = np.ones(STEEP_WINDOW) / STEEP_WINDOW
    rms_smooth = np.convolve(rms, kernel, mode="same")
    # First-order delta (rate of change per frame)
    delta = np.diff(rms_smooth, prepend=rms_smooth[0])

    steep_valleys: List[dict] = []
    steep_peaks: List[dict] = []

    i = STEEP_WINDOW
    n = len(delta)
    while i < n - STEEP_WINDOW:
        d = delta[i]
        if d < -drop_threshold:
            # Walk through the drop region to find the trough
            region_end = i
            while region_end < n and delta[region_end] < 0:
                region_end += 1
            trough_idx = i + int(np.argmin(delta[i:region_end]))
            trough_s = float(trough_idx * frame_dur)
            drop_magnitude = float(max(0.0, rms_smooth[i - 1] - rms_smooth[trough_idx]))
            relative_drop = drop_magnitude / max(mean_energy, 1e-6)
            steep_valleys.append({
                "start": round(max(0.0, trough_s - 2.0), 2),
                "end": round(trough_s + 2.0, 2),
                "trough_s": round(trough_s, 2),
                "drop_magnitude": round(drop_magnitude, 4),
                "relative_drop": round(relative_drop, 3),
                "score": round(min(1.0, relative_drop / 0.5), 3),
            })
            i = region_end
        elif d > rise_threshold:
            region_end = i
            while region_end < n and delta[region_end] > 0:
                region_end += 1
            peak_idx = i + int(np.argmax(delta[i:region_end]))
            peak_s = float(peak_idx * frame_dur)
            rise_magnitude = float(max(0.0, rms_smooth[peak_idx] - rms_smooth[i - 1]))
            relative_rise = rise_magnitude / max(mean_energy, 1e-6)
            steep_peaks.append({
                "start": round(max(0.0, peak_s - 2.0), 2),
                "end": round(peak_s + 2.0, 2),
                "peak_s": round(peak_s, 2),
                "rise_magnitude": round(rise_magnitude, 4),
                "relative_rise": round(relative_rise, 3),
                "score": round(min(1.0, relative_rise / 0.5), 3),
            })
            i = region_end
        else:
            i += 1

    # Dedupe overlapping events (keep highest score)
    def _dedupe(events: List[dict]) -> List[dict]:
        if not events:
            return []
        events = sorted(events, key=lambda e: e["score"], reverse=True)
        kept: List[dict] = []
        for e in events:
            if any(not (e["end"] < k["start"] or e["start"] > k["end"]) for k in kept):
                continue
            kept.append(e)
        return kept

    return _dedupe(steep_valleys), _dedupe(steep_peaks)


def analyze_audio_peaks_and_valleys(
    audio_path: str, progress_callback=None
) -> dict:
    """One-shot: load the audio once, return peaks + valleys + steep events.

    This is the entry point the moment_detector uses. Avoids loading the
    same audio file twice (which would be 2x the I/O + decode time).

    The four signal types returned:
      - peaks:        sustained high-energy regions
      - valleys:      sustained low-energy regions
      - steep_peaks:  sudden LOUD transitions (emphasis, applause, BOOM)
      - steep_valleys: sudden QUIET transitions (dramatic drops, "wait for it")
    """
    if progress_callback:
        progress_callback("Loading audio for combined peak + valley + steep analysis...")

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

    # ── STEEP EVENTS (NEW) ─────────────────────────────────────────────
    steep_valleys, steep_peaks = _detect_steep_events(rms, mean_energy, frame_dur)
    steep_valleys.sort(key=lambda v: v["score"], reverse=True)
    steep_peaks.sort(key=lambda v: v["score"], reverse=True)

    duration = float(len(y)) / sr

    if progress_callback:
        progress_callback(
            f"Found {len(peaks)} peaks + {len(valleys)} valleys + "
            f"{len(steep_peaks)} steep peaks + {len(steep_valleys)} steep valleys over {duration:.1f}s"
        )

    return {
        "peaks": peaks,
        "valleys": valleys,
        "steep_peaks": steep_peaks,
        "steep_valleys": steep_valleys,
        "mean_energy": round(mean_energy, 4),
        "peak_threshold": round(peak_threshold, 4),
        "valley_threshold": round(valley_threshold, 4),
        "duration_s": round(duration, 2),
    }
