"""
Hook detection — Stage 3 of the new pipeline.

Responsibility: turn (audio peaks + transcript) into a ranked list of
*hook candidates*. A hook candidate is a moment that's worth turning
into a short-form clip.

The new pipeline (see PIPELINE-VISION.md) does hook detection BEFORE
surgical download, so we only transcribe + render the segments that
matter. This module is the gate that decides "what matters".

The 6-stage pipeline had hook detection implicitly baked into
`clip_selector.py` after transcription. Splitting it out lets us:
  - Skip transcription for moments that won't become clips
  - Reuse the same hook candidates across multiple downstream stages
  - Plug in different scoring models (energy-only / energy+lexical /
    energy+vision) without touching the rest of the pipeline

Scoring components (in priority order):
  1. Energy spike (loud = emotionally charged; cheap, always-on)
  2. Speech transition (a pause → speech = "a new thought" = hook-worthy)
  3. Lexical hook signals (questions, surprise words, emphasis markers)
  4. (Future) Vision-based "this is when the face is most animated"

Returns:
  {
    "candidates": [
      {
        "start": float,           # seconds, inclusive
        "end": float,             # seconds, exclusive (start + 1s default)
        "hook_score": float,      # 0.0-1.0
        "components": {...},      # sub-scores for explainability
        "reason": str,            # human-readable why-this-is-a-hook
      }
    ],
    "source": "energy|energy+speech|energy+speech+lexical",
    "video_duration": float,
  }
"""
from typing import List, Dict, Optional, Callable
import logging

log = logging.getLogger(__name__)


# Lexical hooks: words/phrases that often mark a viral moment.
# Cheap, language-aware, expandable.
_LEXICAL_HOOKS_EN = {
    "the secret", "you won't believe", "wait what", "watch this",
    "here's why", "the truth", "actually", "in fact", "honestly",
    "naturally", "obviously", "the thing is", "let me show you",
    "the real reason", "what nobody tells you", "i was wrong",
    "the mistake", "the trick", "the hack", "pro tip", "warning",
}


def _lexical_hook_score(segments: List[Dict], around_ts: float, window_s: float = 3.0) -> float:
    """Score 0-1 for how 'hooky' the transcript is around `around_ts`.

    Looks at segments that overlap with [around_ts - window_s, around_ts + window_s].
    Returns 0 if no hook phrase is found, 1 if multiple are found.
    """
    if not segments:
        return 0.0
    hits = 0
    for seg in segments:
        if seg["end"] < around_ts - window_s or seg["start"] > around_ts + window_s:
            continue
        text = seg.get("text", "").lower()
        for phrase in _LEXICAL_HOOKS_EN:
            if phrase in text:
                hits += 1
                break
    return min(1.0, hits * 0.5)


def _energy_curve(peaks: List[Dict], duration: float) -> List[tuple]:
    """Reconstruct a coarse energy curve from sparse peak data.

    Returns list of (timestamp, energy_score) sorted by time. Used for
    valley-lift computation. NOTE: this is a sparse reconstruction — the
    real per-frame energy lives in librosa frames inside `analyze_audio_peaks`.
    For Day 2+ we should expose the full frame array; for now, this is a
    serviceable approximation for the valley detector.
    """
    return sorted(
        ((float(p.get("timestamp", 0)), float(p.get("energy_score", 0)))
         for p in peaks),
        key=lambda x: x[0],
    )


def _valley_lift_score(
    ts: float,
    peaks_sorted_by_time: List[tuple],
    window_s: float = 3.0,
) -> float:
    """Score 0-1 for "punchline lift" — how much the energy at `ts` rises
    from the preceding valley.

    Comedy / emphasis signature: high energy AFTER a low-energy stretch.
    Pure energy peaks miss this because the absolute peak height can be
    lower than sustained-loudness regions.

    Returns 0 if ts is near the start (no preceding audio to compare).
    Returns 0-1 where 1 = a very deep valley followed by a sharp peak.
    """
    if not peaks_sorted_by_time or ts < window_s:
        return 0.0

    # Average energy in the [ts - window_s, ts - 0.1] window
    preceding = [
        e for (t, e) in peaks_sorted_by_time
        if ts - window_s <= t < ts - 0.1
    ]
    if not preceding:
        return 0.0

    valley_energy = sum(preceding) / len(preceding)
    # The current peak's energy comes from the caller (normalized).
    # We compare normalized current to normalized valley.
    current_norm = _normalize_energy(_current_energy_at(ts, peaks_sorted_by_time))
    valley_norm = _normalize_energy(valley_energy)
    lift = max(0.0, current_norm - valley_norm)
    return min(1.0, lift * 1.5)  # 1.5x to spread the distribution


def _current_energy_at(ts: float, peaks_sorted_by_time: List[tuple]) -> float:
    """Find the energy of the peak closest to ts (within 1s)."""
    best = 0.0
    for t, e in peaks_sorted_by_time:
        if abs(t - ts) <= 1.0 and e > best:
            best = e
    return best


def detect_hooks(
    audio_peaks: Dict,
    transcript: Optional[Dict] = None,
    speech_segments: Optional[List[Dict]] = None,
    top_n: int = 10,
    min_hook_score: float = 0.3,
    progress_callback: Optional[Callable] = None,
) -> Dict:
    """Detect hook candidates from audio peaks + (optional) transcript.

    Args:
        audio_peaks: Output of `analyze_audio_peaks()` — has 'peaks' list.
        transcript: Optional output of `fetch_transcript()` or
            `transcribe_audio()` — has 'segments' list.
        speech_segments: Optional output of `estimate_speech_segments()`.
        top_n: Return at most this many candidates.
        min_hook_score: Drop candidates below this hook_score (0-1).
        progress_callback: Optional callable(str) for status updates.

    Returns:
        dict with `candidates`, `source`, `video_duration`. See module docstring.
    """
    if progress_callback:
        progress_callback("Detecting hook candidates from audio + transcript...")

    peaks = audio_peaks.get("peaks", [])
    duration = audio_peaks.get("duration", 0.0)
    segments = (transcript or {}).get("segments", [])

    # Pre-compute the time-sorted energy curve for valley detection.
    energy_curve = _energy_curve(peaks, duration)

    candidates = []
    seen_starts: List[float] = []

    for peak in sorted(peaks, key=lambda p: p.get("energy_score", 0), reverse=True):
        ts = float(peak.get("timestamp", 0))
        if any(abs(ts - s) < 4.0 for s in seen_starts):  # dedupe within 4s
            continue

        energy = float(peak.get("energy_score", 0))
        lex = _lexical_hook_score(segments, around_ts=ts)
        valley = _valley_lift_score(ts, energy_curve)

        # Weighted blend. Valley lift is weighted heavily because it captures
        # the punchline / dramatic-pause pattern that pure energy misses.
        # Weights tuned for sparse-peak data; will be learned from creator
        # feedback in the ICL loop.
        hook_score = (
            0.40 * _normalize_energy(energy)
            + 0.20 * lex
            + 0.25 * valley
            + 0.15 * 1.0  # baseline for any detected peak
        )
        if hook_score < min_hook_score:
            continue

        seen_starts.append(ts)
        reason_parts = [f"Energy={energy:.2f}", f"lexical={lex:.2f}", f"valley_lift={valley:.2f}"]
        candidates.append({
            "start": round(ts - 1.0, 3),
            "end": round(ts + 1.0, 3),  # 2s window; renderer will expand
            "hook_score": round(hook_score, 3),
            "components": {
                "energy": round(_normalize_energy(energy), 3),
                "lexical": round(lex, 3),
                "valley_lift": round(valley, 3),
            },
            "reason": " | ".join(reason_parts) + f" @ {ts:.1f}s",
        })

    candidates.sort(key=lambda c: c["hook_score"], reverse=True)
    candidates = candidates[:top_n]

    if not segments:
        source = "energy"
    elif any(c["components"]["lexical"] > 0 for c in candidates):
        source = "energy+speech+lexical"
    else:
        source = "energy+speech"
    if progress_callback:
        progress_callback(f"Found {len(candidates)} hook candidates ({source})")

    return {
        "candidates": candidates,
        "source": source,
        "video_duration": duration,
    }


def _normalize_energy(raw: float) -> float:
    """Map raw energy_score to 0-1. Energy scores are 0-N where N depends
    on the source audio; empirically 0-5 covers 99% of cases. Clamp to 1.0."""
    return min(1.0, max(0.0, float(raw) / 5.0))
