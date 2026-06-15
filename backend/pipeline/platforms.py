"""
Per-platform output configuration.

Different platforms have different "best" clip characteristics:

  TikTok  : 21-34s sweet spot, 3-5 hashtags, ALL CAPS hook, vertical 9:16
  Reels   : 15-30s sweet spot, 5-10 hashtags, mixed case, vertical 9:16
  Shorts  : 15-60s sweet spot, 3-5 hashtags, mixed case, vertical 9:16

Why this matters:
  - 2-3× view lift from platform-native cut timing
  - Same source video, 3 different cut variants = 3× the content
  - Hashtag count / placement is platform-algorithmic

Each platform also has a "vibe" — the LLM should write copy in that voice:
  - TikTok:  punchy, slang, "POV:", "tell me you..."
  - Reels:   clean, professional, "Here's why..." "The truth about..."
  - Shorts:  searchable, "How to", "What happens when..."

This module is the single source of truth for all of this.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List


@dataclass
class PlatformSpec:
    """Output format for a specific social platform."""
    name: str
    min_duration_s: float
    max_duration_s: float
    target_duration_s: float
    n_hashtags_min: int
    n_hashtags_max: int
    caption_style: str          # "all_caps" | "mixed" | "sentence"
    aspect_ratio: str           # "9:16" | "1:1" | "16:9"
    vibe_words: List[str] = field(default_factory=list)
    example_hooks: List[str] = field(default_factory=list)
    watermark_position: str = "bottom_right"  # "bottom_right" | "top_left" | "none"


# The three platforms we ship
PLATFORMS: Dict[str, PlatformSpec] = {
    "tiktok": PlatformSpec(
        name="tiktok",
        min_duration_s=21.0,
        max_duration_s=34.0,
        target_duration_s=27.0,
        n_hashtags_min=3,
        n_hashtags_max=5,
        caption_style="all_caps",
        aspect_ratio="9:16",
        vibe_words=["pov", "tell me", "no one talks about", "watch this", "this is your sign"],
        example_hooks=[
            "POV: you finally understand this",
            "Tell me you [X] without telling me",
            "Watch till the end — trust me",
            "This is your sign to [X]",
        ],
    ),
    "reels": PlatformSpec(
        name="reels",
        min_duration_s=15.0,
        max_duration_s=30.0,
        target_duration_s=22.0,
        n_hashtags_min=5,
        n_hashtags_max=10,
        caption_style="mixed",
        aspect_ratio="9:16",
        vibe_words=["here's why", "the truth", "what they don't", "save this", "share this"],
        example_hooks=[
            "Here's why this actually works",
            "The truth about [X] nobody tells you",
            "Save this for later",
            "What they don't tell you about [X]",
        ],
    ),
    "shorts": PlatformSpec(
        name="shorts",
        min_duration_s=15.0,
        max_duration_s=60.0,
        target_duration_s=35.0,
        n_hashtags_min=3,
        n_hashtags_max=5,
        caption_style="mixed",
        aspect_ratio="9:16",
        vibe_words=["how to", "what happens when", "the reason why", "did you know"],
        example_hooks=[
            "How to [X] in 30 seconds",
            "What happens when you [X]",
            "The reason why [X] works",
            "Did you know this about [X]?",
        ],
    ),
}

# Default = TikTok (most popular for short-form, most platform-native)
DEFAULT_PLATFORM = "tiktok"


def get_platform(name: str) -> PlatformSpec:
    """Get a platform spec by name, falling back to default."""
    name = (name or "").lower().strip()
    return PLATFORMS.get(name, PLATFORMS[DEFAULT_PLATFORM])


def adjust_clip_for_platform(
    start: float,
    end: float,
    platform: PlatformSpec,
) -> tuple[float, float, str]:
    """
    Adjust a candidate clip's [start, end] to fit a platform's target
    duration window. Returns (new_start, new_end, adjustment_reason).
    """
    duration = end - start
    if duration < platform.min_duration_s:
        # Extend: try to grow toward target_duration
        new_duration = min(platform.target_duration_s, platform.max_duration_s)
        # Extend equally on both sides when possible
        extension = new_duration - duration
        half = extension / 2
        new_start = max(0, start - half)
        new_end = new_start + new_duration
        return new_start, new_end, f"extended_to_{platform.name}_{new_duration:.0f}s"
    elif duration > platform.max_duration_s:
        # Trim: shrink to max_duration
        new_duration = platform.max_duration_s
        # Trim from the end (keep the hook at the front)
        new_start = start
        new_end = start + new_duration
        return new_start, new_end, f"trimmed_to_{platform.name}_{new_duration:.0f}s"
    return start, end, "in_range"


def platform_prompt_guidance(platform: PlatformSpec) -> str:
    """
    Generate a short prompt snippet to inject into the LLM call.
    Tells the LLM the target platform's vibe + hashtag count.
    """
    vibe_str = ", ".join(platform.vibe_words[:4])
    return (
        f"PLATFORM: {platform.name.upper()}\n"
        f"- Target duration: {platform.target_duration_s:.0f}s "
        f"(range {platform.min_duration_s:.0f}-{platform.max_duration_s:.0f}s)\n"
        f"- Caption style: {platform.caption_style}\n"
        f"- Hashtags: {platform.n_hashtags_min}-{platform.n_hashtags_max} tags\n"
        f"- Vibe: {vibe_str}\n"
        f"Write copy that feels native to {platform.name.upper()}, not generic."
    )


def limit_hashtags(hashtags_str: str, platform: PlatformSpec) -> str:
    """Trim hashtag string to the platform's max count."""
    if not hashtags_str:
        return ""
    # Split on whitespace OR commas
    import re
    tags = [t for t in re.split(r"[\s,]+", hashtags_str.strip()) if t]
    # Add '#' prefix if missing
    tags = [t if t.startswith("#") else f"#{t}" for t in tags]
    # Truncate to max
    tags = tags[:platform.n_hashtags_max]
    return " ".join(tags)


def style_caption(caption: str, platform: PlatformSpec) -> str:
    """Apply platform-specific caption style."""
    if platform.caption_style == "all_caps":
        return caption.upper()
    elif platform.caption_style == "sentence":
        # First letter capitalised, rest as-is
        if not caption:
            return caption
        return caption[0].upper() + caption[1:]
    else:  # mixed
        return caption


# Self-test
if __name__ == "__main__":
    for name, spec in PLATFORMS.items():
        print(f"\n=== {name.upper()} ===")
        print(f"  duration: {spec.min_duration_s:.0f}-{spec.max_duration_s:.0f}s "
              f"(target {spec.target_duration_s:.0f}s)")
        print(f"  hashtags: {spec.n_hashtags_min}-{spec.n_hashtags_max}")
        print(f"  caption:  {spec.caption_style}")
        print(f"  aspect:   {spec.aspect_ratio}")
        # Test duration adjustment
        for d in [10, 18, 27, 40, 65]:
            s, e, reason = adjust_clip_for_platform(0.0, float(d), spec)
            print(f"  {d:>3}s clip → {e-s:>4.1f}s ({reason})")
