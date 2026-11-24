"""
Universal short-form clip format.

SIMPLIFIED 2026-06-15: TikTok, Reels, and Shorts all use the same output:
  - 9:16 vertical
  - 30-90s narrative-complete duration
  - ALL CAPS hooks
  - 5-8 hashtags

Per-platform differentiation was a mistake — creators re-post the same clip
to all 3 platforms, and:
  - TikTok is banned in India (where most of our users are)
  - 3× compute for 3 different cuts didn't translate to 3× views
  - The LLM was already producing platform-agnostic great copy

The `platform` field is now kept ONLY for analytics (so we can track which
destination the user intended), not for output differentiation.

The single universal format is:
  - 30-90s, chosen by the natural story arc
  - 9:16 vertical
  - ALL CAPS hooks (best performer across all 3 platforms)
  - 5-8 hashtags (algorithmic sweet spot)
  - Vibe: scroll-stopping, open-loop, "watch till the end"
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional


from ..utils.config import CLIP_DURATION_HARD_MIN, CLIP_DURATION_HARD_MAX


@dataclass
class ClipFormat:
    """Universal output format with natural content-driven variable duration (30s - 90s)."""
    name: str = "universal"
    min_duration_s: float = CLIP_DURATION_HARD_MIN
    max_duration_s: float = CLIP_DURATION_HARD_MAX
    target_duration_s: Optional[float] = None  # No fixed target; duration is content-driven
    n_hashtags_min: int = 5
    n_hashtags_max: int = 8
    caption_style: str = "all_caps"
    aspect_ratio: str = "9:16"
    vibe_words: List[str] = field(default_factory=lambda: [
        "watch till the end", "this changes everything", "nobody talks about",
        "the truth", "here's why", "wait for it", "you need to see this",
    ])
    example_hooks: List[str] = field(default_factory=lambda: [
        "The truth about [X] nobody tells you",
        "Here's why this actually works",
        "Watch till the end — it gets better",
        "You won't believe what happens next",
    ])


# The single source of truth for all output characteristics
FORMAT = ClipFormat()


def get_format() -> ClipFormat:
    """Always returns the single universal format. (Back-compat: was get_platform)"""
    return FORMAT


def adjust_clip_to_format(start: float, end: float, video_duration: float = 0.0) -> tuple:
    """
    Validates [start, end] against hard bounds (30s - 90s).
    Does NOT normalize, round, pad, or trim clips toward a common length.
    Preserves the natural micro-story arc.
    """
    duration = end - start
    if video_duration > 0:
        start = max(0.0, start)
        end = min(video_duration, end)
        duration = end - start

    if duration < FORMAT.min_duration_s:
        # Extend end up to minimum if physically possible
        new_end = min(video_duration if video_duration > 0 else float("inf"), start + FORMAT.min_duration_s)
        return start, new_end, f"padded_to_hard_min_{FORMAT.min_duration_s:.0f}s"
    elif duration > FORMAT.max_duration_s:
        new_end = start + FORMAT.max_duration_s
        return start, new_end, f"capped_at_hard_max_{FORMAT.max_duration_s:.0f}s"

    return start, end, "in_range"


def apply_finishing_window(
    start: float,
    narrative_end: float,
    video_duration: float = 0.0,
    tail_buffer_s: float = 5.0,
) -> tuple[float, float]:
    """Append user-selected natural context after the calibrated narrative.

    The 30–90 second constraint applies to the selected story. The natural
    tail is deliberately metadata-separated so it is never mistaken for an
    LLM-selected boundary. The thumbnail outro is added later by the renderer.
    """
    requested = min(5.0, max(0.0, float(tail_buffer_s or 0.0)))
    ceiling = float(video_duration) if float(video_duration or 0.0) > 0 else narrative_end + requested
    finished_end = min(ceiling, float(narrative_end) + requested)
    return finished_end, max(0.0, finished_end - float(narrative_end))


def limit_hashtags(hashtags: List[str]) -> List[str]:
    """Limit hashtag count to format's max."""
    if isinstance(hashtags, str):
        hashtags = [h for h in hashtags.split() if h.startswith("#")]
    return hashtags[:FORMAT.n_hashtags_max]


def style_caption(caption: str) -> str:
    """Apply universal caption style: ALL CAPS, no trailing period."""
    if not caption:
        return ""
    # ALL CAPS but keep the first word capitalized properly
    # (handles acronyms, names, etc. that the LLM might have used)
    if caption.isupper():
        return caption.rstrip(".")
    return caption.upper().rstrip(".")


def prompt_guidance() -> str:
    """LLM prompt guidance for the universal format."""
    return (
        "OUTPUT FORMAT (universal short-form — works for TikTok/Reels/Shorts):\n"
        f"- Duration: {FORMAT.min_duration_s:.0f}-{FORMAT.max_duration_s:.0f}s "
        f"(target {FORMAT.target_duration_s:.0f}s)\n"
        f"- Aspect: {FORMAT.aspect_ratio} vertical\n"
        f"- Caption: ALL CAPS, {FORMAT.n_hashtags_min}-{FORMAT.n_hashtags_max} hashtags\n"
        f"- Vibe: scroll-stopping hook + retention bridge + open loop\n"
        "- Hooks that work: 'The truth about [X]', 'Nobody talks about [X]', "
        "'Watch till the end', 'Here's why this works'"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Back-compat shims (in case other code still references the old API)
# ─────────────────────────────────────────────────────────────────────────────

def get_platform(name: str = "") -> ClipFormat:
    """Back-compat: was get_platform('tiktok'|'reels'|'shorts'). Now always returns universal."""
    return FORMAT


def platform_prompt_guidance(platform=None) -> str:
    """Back-compat: was platform-specific guidance. Now universal."""
    return prompt_guidance()


def adjust_clip_for_platform(start: float, end: float, platform=None) -> tuple:
    """Back-compat: was platform-specific adjustment. Now universal."""
    return adjust_clip_to_format(start, end)
