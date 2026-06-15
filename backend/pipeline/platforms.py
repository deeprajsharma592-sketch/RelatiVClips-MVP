"""
Universal short-form clip format.

SIMPLIFIED 2026-06-15: TikTok, Reels, and Shorts all want the same thing:
  - 9:16 vertical
  - 22-30s duration
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
  - 22-30s (sweet spot: 26s)
  - 9:16 vertical
  - ALL CAPS hooks (best performer across all 3 platforms)
  - 5-8 hashtags (algorithmic sweet spot)
  - Vibe: scroll-stopping, open-loop, "watch till the end"
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List


@dataclass
class ClipFormat:
    """Single universal output format. Replaces the old 3-platform spec."""
    name: str = "universal"
    min_duration_s: float = 22.0
    max_duration_s: float = 30.0
    target_duration_s: float = 26.0
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


def adjust_clip_to_format(start: float, end: float) -> tuple:
    """
    Adjust a candidate clip's [start, end] to fit the universal 22-30s window.
    Returns (new_start, new_end, adjustment_reason).
    """
    duration = end - start
    if duration < FORMAT.min_duration_s:
        new_duration = min(FORMAT.target_duration_s, FORMAT.max_duration_s)
        extension = new_duration - duration
        half = extension / 2
        new_start = max(0, start - half)
        new_end = new_start + new_duration
        return new_start, new_end, f"extended_to_{new_duration:.0f}s"
    elif duration > FORMAT.max_duration_s:
        new_duration = FORMAT.max_duration_s
        # Trim from the end (keeps the hook intact)
        new_end = start + new_duration
        return start, new_end, f"trimmed_to_{new_duration:.0f}s"
    return start, end, "in_range"


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
