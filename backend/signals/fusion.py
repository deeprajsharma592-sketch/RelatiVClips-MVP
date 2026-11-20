"""
Signal Fusion Module.
Resamples available signals to a common 5s grid, applies 5-min rolling median subtraction,
percentile ranking, 3% boundary masking, weight re-normalization, peak detection (min distance 60s),
and extracts top-K hot regions (<=35% video coverage) with ±90s margins.
"""
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass
import numpy as np
import scipy.signal
from scipy.stats import rankdata

from .base import TimeSeries, log
from ..utils.config import (
    SIGNAL_WEIGHT_EXTERNAL,
    SIGNAL_WEIGHT_AUDIO,
    SIGNAL_WEIGHT_TRANSCRIPT,
    HEATMAP_GRID_STEP_S,
    HEATMAP_WINDOW_S,
    HEATMAP_MASK_PCT,
    HEATMAP_PEAK_MIN_DISTANCE_S,
    HEATMAP_MAX_COVERAGE_PCT,
)


@dataclass
class HeatmapPeak:
    timestamp_s: float
    heat_score: float
    region_start_s: float
    region_end_s: float


@dataclass
class FusionResult:
    grid_s: np.ndarray
    heat_scores: np.ndarray
    peaks: List[HeatmapPeak]
    hot_regions: List[Tuple[float, float, float]]  # (start_s, end_s, avg_heat)
    signals_used: List[str]
    coverage_pct: float


def _resample_to_grid(series: TimeSeries, grid: np.ndarray, step_s: float) -> np.ndarray:
    """Resample arbitrary (t_start, t_end, val) intervals onto uniform time grid."""
    resampled = np.zeros(len(grid), dtype=np.float32)
    if not series:
        return resampled

    for t_start, t_end, val in series:
        if t_end <= t_start:
            t_end = t_start + step_s
        idx_start = max(0, int(np.floor(t_start / step_s)))
        idx_end = min(len(grid), int(np.ceil(t_end / step_s)))
        for i in range(idx_start, idx_end):
            # Keep the max intensity overlapping this 5s step
            if val > resampled[i]:
                resampled[i] = val

    return resampled


def _rolling_median_lift(signal: np.ndarray, window_size: int) -> np.ndarray:
    """Subtract rolling median (window ~5 min) to compute lift over baseline."""
    n = len(signal)
    if n == 0:
        return signal
    if window_size < 3:
        return signal - np.median(signal)

    # Use scipy.ndimage.median_filter or sliding window
    from scipy.ndimage import median_filter
    baseline = median_filter(signal, size=min(window_size, n), mode="nearest")
    lift = signal - baseline
    # Only positive lift represents heightened engagement over baseline
    return np.maximum(0.0, lift)


def _percentile_rank(arr: np.ndarray) -> np.ndarray:
    """Convert array to 0.0 - 1.0 percentile rank, robust to extreme outliers."""
    if len(arr) == 0:
        return arr
    if np.all(arr == arr[0]):
        return np.zeros_like(arr, dtype=np.float32)
    # rankdata assigns 1 to lowest, N to highest
    ranks = rankdata(arr, method="average")
    return (ranks - 1.0) / (len(arr) - 1.0)


def fuse_signals(
    signals: Dict[str, Optional[TimeSeries]],
    duration_s: float,
    weights: Optional[Dict[str, float]] = None,
    grid_step_s: float = HEATMAP_GRID_STEP_S,
) -> FusionResult:
    """
    Fuse multiple engagement signals onto a 5s common grid.
    Handles missing signals gracefully by re-normalizing weights across available signals.
    Applies 3% intro/outro masking and finds peaks with min distance 60s.
    """
    if duration_s <= 0:
        duration_s = 60.0

    grid = np.arange(0, duration_s, grid_step_s)
    if len(grid) == 0:
        grid = np.array([0.0])

    # Default weights map
    default_w = {
        "youtube_replay": SIGNAL_WEIGHT_EXTERNAL,
        "twitch_clips": SIGNAL_WEIGHT_EXTERNAL,
        "twitch_chat": SIGNAL_WEIGHT_EXTERNAL,
        "audio_energy": SIGNAL_WEIGHT_AUDIO,
        "transcript_density": SIGNAL_WEIGHT_TRANSCRIPT,
    }
    w_map = weights or default_w

    # 1. Process each available signal
    normalized_signals: Dict[str, np.ndarray] = {}
    active_weights: Dict[str, float] = {}

    window_steps = max(3, int(HEATMAP_WINDOW_S / grid_step_s))  # ~60 steps for 5 min

    for name, series in signals.items():
        if series is None or len(series) == 0:
            continue
        resampled = _resample_to_grid(series, grid, grid_step_s)
        lift = _rolling_median_lift(resampled, window_size=window_steps)
        p_rank = _percentile_rank(lift)
        normalized_signals[name] = p_rank
        active_weights[name] = w_map.get(name, 0.30)

    # 2. Combine with re-normalized weights
    total_active_w = sum(active_weights.values())
    if total_active_w > 0:
        combined = np.zeros(len(grid), dtype=np.float32)
        for name, norm_arr in normalized_signals.items():
            norm_w = active_weights[name] / total_active_w
            combined += norm_w * norm_arr
    else:
        # Fallback: zero heatmap if zero signals available
        combined = np.zeros(len(grid), dtype=np.float32)

    # 3. Mask the first 3% and last 3% of the video (intros/outros always spike)
    mask_start_time = HEATMAP_MASK_PCT * duration_s
    mask_end_time = (1.0 - HEATMAP_MASK_PCT) * duration_s
    for i, t in enumerate(grid):
        if t < mask_start_time or t > mask_end_time:
            combined[i] = 0.0

    # 4. Smooth score with Gaussian / Hanning filter for stable peak detection
    if len(combined) > 5:
        kernel_size = 5
        kernel = np.hanning(kernel_size)
        kernel /= np.sum(kernel)
        smoothed = np.convolve(combined, kernel, mode="same")
    else:
        smoothed = combined.copy()

    # 5. Detect peaks with min distance 60s
    min_dist_steps = max(1, int(HEATMAP_PEAK_MIN_DISTANCE_S / grid_step_s))
    peak_indices, _ = scipy.signal.find_peaks(smoothed, distance=min_dist_steps)

    duration_min = duration_s / 60.0
    top_n_peaks = max(8, int(duration_min / 4.0))

    # Sort peaks by smoothed heat score descending
    peak_candidates = []
    for idx in peak_indices:
        t = float(grid[idx])
        score = float(smoothed[idx])
        if score > 0.0:
            peak_candidates.append((idx, t, score))

    peak_candidates.sort(key=lambda x: x[2], reverse=True)
    selected_peaks = peak_candidates[:top_n_peaks]

    # Build peak objects with ±90s context margins
    peaks: List[HeatmapPeak] = []
    raw_regions: List[Tuple[float, float, float]] = []

    for _, t, score in selected_peaks:
        r_start = max(0.0, t - 90.0)
        r_end = min(duration_s, t + 90.0)
        peaks.append(HeatmapPeak(
            timestamp_s=round(t, 2),
            heat_score=round(score, 4),
            region_start_s=round(r_start, 2),
            region_end_s=round(r_end, 2),
        ))
        raw_regions.append((r_start, r_end, score))

    # 6. Merge overlapping hot regions and cap at max 35% of video
    hot_regions = _merge_and_cap_regions(raw_regions, duration_s, max_coverage_pct=HEATMAP_MAX_COVERAGE_PCT)
    total_hot_duration = sum(e - s for s, e, _ in hot_regions)
    coverage_pct = round((total_hot_duration / max(1.0, duration_s)) * 100.0, 1)

    return FusionResult(
        grid_s=grid,
        heat_scores=np.round(smoothed, 4),
        peaks=peaks,
        hot_regions=hot_regions,
        signals_used=list(normalized_signals.keys()),
        coverage_pct=coverage_pct,
    )


def _merge_and_cap_regions(
    regions: List[Tuple[float, float, float]],
    total_duration_s: float,
    max_coverage_pct: float = HEATMAP_MAX_COVERAGE_PCT,
) -> List[Tuple[float, float, float]]:
    """
    Merge overlapping regions. If total coverage exceeds max_coverage_pct,
    keep higher-scoring regions until capped at 35% of video.
    """
    if not regions:
        return []

    # Sort by heat score descending first
    sorted_by_score = sorted(regions, key=lambda x: x[2], reverse=True)
    max_allowed_s = total_duration_s * max_coverage_pct

    selected: List[Tuple[float, float, float]] = []
    current_covered_s = 0.0

    for s, e, score in sorted_by_score:
        dur = e - s
        if current_covered_s + dur <= max_allowed_s:
            selected.append((s, e, score))
            current_covered_s += dur
        elif current_covered_s < max_allowed_s:
            # Partially include up to max
            remaining = max_allowed_s - current_covered_s
            selected.append((s, s + remaining, score))
            current_covered_s += remaining
            break

    # Now merge any overlapping intervals among selected
    if not selected:
        return []

    selected.sort(key=lambda x: x[0])
    merged: List[Tuple[float, float, float]] = []
    curr_s, curr_e, curr_score = selected[0]

    for next_s, next_e, next_score in selected[1:]:
        if next_s <= curr_e:
            curr_e = max(curr_e, next_e)
            curr_score = max(curr_score, next_score)
        else:
            merged.append((round(curr_s, 2), round(curr_e, 2), round(curr_score, 4)))
            curr_s, curr_e, curr_score = next_s, next_e, next_score

    merged.append((round(curr_s, 2), round(curr_e, 2), round(curr_score, 4)))
    return merged
