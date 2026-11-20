"""
Narrative-aware length policy.
Enforces soft bounds without artificial target durations:
- Hard bounds: 10s <= duration <= 150s. Reject outside.
- Never normalizes, rounds, pads, or trims clips toward a common length.
- Duration distribution is content-driven (15s punchline, 28s anecdote, 56s explanation, 90s story).
- Metadata flags:
    fits_shorts: bool (<=180s)
    fits_reels_ideal: bool (<=90s)
"""
from typing import Dict, Any, Tuple, Optional
from ..utils.config import CLIP_DURATION_HARD_MIN, CLIP_DURATION_HARD_MAX


def apply_length_policy(
    candidate: Dict[str, Any],
    min_duration_s: float = CLIP_DURATION_HARD_MIN,
    max_duration_s: float = CLIP_DURATION_HARD_MAX,
) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """
    Validates candidate duration against hard limits (10s - 150s).
    Attaches platform compatibility metadata flags.
    Rejects any clip outside hard bounds without forcing artificial duration targets.
    """
    start = float(candidate.get("start", 0.0))
    end = float(candidate.get("end", 0.0))
    duration = end - start

    if duration < min_duration_s:
        return None, f"Duration {duration:.1f}s is below hard minimum of {min_duration_s:.1f}s"

    if duration > max_duration_s:
        return None, f"Duration {duration:.1f}s exceeds hard maximum of {max_duration_s:.1f}s"

    res = dict(candidate)
    res["duration_s"] = round(duration, 2)
    # Platform metadata flags for the frontend (informative only, never constraints)
    res["fits_shorts"] = bool(duration <= 180.0)
    res["fits_reels_ideal"] = bool(duration <= 90.0)

    return res, None
