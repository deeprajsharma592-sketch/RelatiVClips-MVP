"""
Point Weights and Reason Codes Configuration for RelatiV Feedback System.

This single configuration module defines the points assigned to user feedback events
and the valid dislike reason codes. It is imported by both the API validation layer
and the preference aggregation pipelines.

Tuning Weights:
- Adjust the values in `FEEDBACK_WEIGHTS` directly.
- Download is the strongest signal (+3) and is enforced server-side to award
  points only once per (user, clip) pair.
- Unlike and undislike symmetrically reverse the earlier positive or negative values.

Adding a New Reason Code:
1. Add the new code key to `DISLIKE_REASONS` with its human-readable label.
2. If desired, map it in any downstream scoring heuristics.
3. The frontend `DislikeFeedbackPopup` reads these codes or renders the matching labels.
"""

from typing import Dict, List, Optional

# Core point weights per event type (computed strictly server-side)
FEEDBACK_WEIGHTS: Dict[str, int] = {
    "like": 1,
    "download": 3,
    "dislike": -2,
    "dismiss_popup": -2,
    "unlike": -1,
    "undislike": 2,
}

# Allowed dislike reason codes and their human-readable descriptions
DISLIKE_REASONS: Dict[str, str] = {
    "hook_bad": "Hook is not good",
    "face_track_bad": "Face not tracked well",
    "no_context": "Wrong moment / no context",
    "captions_bad": "Captions are off",
    "length_bad": "Too long / too short",
    "other": "Other",
}

# List of valid reason code keys
VALID_REASON_CODES: List[str] = list(DISLIKE_REASONS.keys())

# Default versions
DEFAULT_MODEL_VERSION: str = "relativ-v2.0"
DEFAULT_CLIP_VERSION: str = "1.0"


def get_base_points(event_type: str) -> int:
    """Return point delta for a given feedback event type.
    
    Raises ValueError if event_type is not recognized.
    """
    if event_type not in FEEDBACK_WEIGHTS:
        raise ValueError(f"Unknown feedback event type: '{event_type}'. Valid types: {list(FEEDBACK_WEIGHTS.keys())}")
    return FEEDBACK_WEIGHTS[event_type]


def validate_reason_codes(codes: Optional[List[str]]) -> List[str]:
    """Validate that provided reason codes are allowed.
    
    Returns sanitized list of unique valid reason codes.
    """
    if not codes:
        return []
    invalid = [c for c in codes if c not in DISLIKE_REASONS]
    if invalid:
        raise ValueError(f"Invalid reason code(s): {invalid}. Valid codes: {VALID_REASON_CODES}")
    # Deduplicate while preserving order
    seen = set()
    return [c for c in codes if not (c in seen or seen.add(c))]
