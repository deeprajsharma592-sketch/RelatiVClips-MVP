"""Clip-count policy shared by API, LLM selection, cache, and rendering."""

from __future__ import annotations

import math
from typing import Optional


MAX_CLIPS_PER_RUN = 4
DEFAULT_SECONDS_PER_CLIP = 5 * 60


def resolve_target_clip_count(
    duration_s: float,
    requested_clip_count: Optional[int] = None,
) -> int:
    """Return the requested count or the duration-based default, capped at four.

    Automatic policy: one clip per five started minutes. This gives 10 minutes
    -> 2 clips, 15 minutes -> 3 clips, and 20 minutes or longer -> 4 clips.
    """
    if requested_clip_count is not None:
        return max(1, min(MAX_CLIPS_PER_RUN, int(requested_clip_count)))

    duration = max(0.0, float(duration_s or 0.0))
    if duration <= 0:
        return 2
    return max(
        1,
        min(MAX_CLIPS_PER_RUN, math.ceil(duration / DEFAULT_SECONDS_PER_CLIP)),
    )
