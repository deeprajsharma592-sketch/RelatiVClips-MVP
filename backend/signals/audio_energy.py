"""
Audio energy signal provider (always available).
Extracts Librosa RMS energy, spectral flux (rate of acoustic change),
and laughter/applause energy bursts.
"""
from typing import Optional, List, Tuple
from pathlib import Path
import numpy as np
from .base import TimeSeries, run_with_silent_fail, log
from ..utils.config import TARGET_SAMPLE_RATE


def _extract_audio_energy_raw(audio_path: str, bucket_s: float = 5.0) -> Optional[TimeSeries]:
    """Inner extractor for Librosa RMS + Spectral Flux."""
    if not audio_path or not Path(audio_path).exists():
        return None

    import soundfile as sf
    import librosa

    try:
        y, sr = sf.read(audio_path)
        if y.ndim > 1:
            y = np.mean(y, axis=1)
        if sr != TARGET_SAMPLE_RATE:
            import scipy.signal
            num_samples = int(len(y) * TARGET_SAMPLE_RATE / sr)
            y = scipy.signal.resample(y, num_samples)
            sr = TARGET_SAMPLE_RATE
        y = y.astype(np.float32)
    except Exception as e:
        log.warning(f"[audio_energy] Failed to load audio file {audio_path}: {e}")
        return None

    duration_s = len(y) / sr
    if duration_s <= 0:
        return None

    hop_length = int(sr * 0.1)  # 100ms frames
    # 1. RMS Energy
    rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]

    # 2. Spectral Flux (onset strength / rate of change)
    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop_length)
    if len(onset_env) < len(rms):
        onset_env = np.pad(onset_env, (0, len(rms) - len(onset_env)))
    else:
        onset_env = onset_env[:len(rms)]

    # 3. High-frequency cheer/laughter indicator (spectral centroid)
    cent = librosa.feature.spectral_centroid(y=y, sr=sr, hop_length=hop_length)[0]
    if len(cent) < len(rms):
        cent = np.pad(cent, (0, len(rms) - len(cent)))
    else:
        cent = cent[:len(rms)]

    # Normalize components to [0, 1]
    def _norm(arr):
        mx = np.max(arr) if len(arr) > 0 else 0
        mn = np.min(arr) if len(arr) > 0 else 0
        return (arr - mn) / (mx - mn + 1e-8)

    norm_rms = _norm(rms)
    norm_flux = _norm(onset_env)
    norm_cent = _norm(cent)

    # Composite audio energy: 50% RMS, 30% flux, 20% high-frequency excitement
    composite_frames = 0.50 * norm_rms + 0.30 * norm_flux + 0.20 * norm_cent

    # Aggregate into buckets (default 5.0s)
    total_buckets = int(np.ceil(duration_s / bucket_s))
    series: TimeSeries = []
    frames_per_second = sr / hop_length

    for b in range(total_buckets):
        t_start = b * bucket_s
        t_end = min(duration_s, t_start + bucket_s)
        f_start = int(t_start * frames_per_second)
        f_end = int(t_end * frames_per_second)
        if f_start < len(composite_frames):
            window_vals = composite_frames[f_start:max(f_start + 1, f_end)]
            val = float(np.mean(window_vals))
        else:
            val = 0.0
        series.append((t_start, t_end, val))

    # Normalize so peak is 1.0
    max_val = max(v for _, _, v in series) if series else 0.0
    if max_val > 0:
        series = [(s, e, round(v / max_val, 4)) for s, e, v in series]

    return series


def extract_audio_energy_signal(audio_path: str, bucket_s: float = 5.0) -> Optional[TimeSeries]:
    """
    Public entry point for audio energy signal (always available if audio exists).
    Returns [(t_start, t_end, value)] or None.
    """
    return run_with_silent_fail(
        _extract_audio_energy_raw,
        provider_name="audio_energy",
        audio_path=audio_path,
        bucket_s=bucket_s,
        timeout_s=8.0,
    )
