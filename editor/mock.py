"""Canned EDLs so tests and dry runs never touch a model API.

The mock is deliberately shaped like a competent edit: a hook accent, a payoff
accent and captions, spread so the safety rules pass. Variants rotate which
block carries the hook, which is what the pipeline needs for comparison.
"""

from __future__ import annotations

import hashlib
from typing import Any, Mapping, Sequence

from blocks import registry

STYLES = ("minimal", "punchy", "chaotic")


def _words(transcript: Mapping[str, Any] | Sequence[Mapping[str, Any]] | None) -> list[dict]:
    if transcript is None:
        return []
    raw = transcript.get("words") if isinstance(transcript, Mapping) else transcript
    return registry.normalize_words(raw or [])


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def canned_edl(
    story_plan: Mapping[str, Any],
    transcript: Mapping[str, Any] | Sequence[Mapping[str, Any]] | None,
    *,
    niche: str = "livestream_comedy",
    style_direction: str = "punchy",
    variant_index: int = 0,
) -> dict[str, Any]:
    style = style_direction if style_direction in STYLES else "punchy"
    duration = float(story_plan.get("duration_s") or 5.0)
    words = _words(transcript)
    clip_id = str(story_plan.get("clip_id") or "clip")

    seed = int(hashlib.sha1(f"{clip_id}:{style}:{variant_index}".encode()).hexdigest()[:8], 16)
    rotate = seed % 2

    caption_end = min(duration, (words[-1]["end"] + 0.25) if words else duration)
    effects: list[dict[str, Any]] = [
        {
            "id": "cap_main",
            "type": "caption_style",
            "start": 0.0,
            "end": round(caption_end, 2),
            "params": {
                "style": "podcast" if style == "minimal" else "irl_stream",
                "max_words_per_group": 3 if style == "minimal" else 2,
                "position": "bottom",
            },
            "rationale": "Captions follow the spoken words so the clip reads with sound off.",
        }
    ]

    hook_end = min(duration, 1.05)
    if rotate == 0:
        effects.append(
            {
                "id": "hook_zoom",
                "type": "zoom",
                "start": 0.18,
                "end": round(hook_end, 2),
                "params": {"scale": 1.14 if style != "chaotic" else 1.22, "origin": "center", "hold": 0.45},
                "rationale": "Punch-in on the first line of the hook so a cold viewer stops.",
            }
        )
    else:
        effects.append(
            {
                "id": "hook_shake",
                "type": "shake",
                "start": 0.2,
                "end": round(min(duration, 0.85), 2),
                "params": {"intensity": 0.5, "frequency": 7, "decay": 0.7, "motion_blur": 0.2},
                "rationale": "Shake lands on the hook word to make the open feel like an impact.",
            }
        )

    if style != "minimal" and duration > 2.4:
        effects.append({
            "id": "hook_sfx",
            "type": "sfx",
            "start": 0.2,
            "end": round(min(duration, 0.9), 2),
            "params": {"asset_id": "whoosh_soft", "gain": 0.65, "loudness_lufs": -16},
            "rationale": "Whoosh under the hook accent, ~-16 LUFS so it sits under speech.",
        })

    if style in ("punchy", "chaotic") and duration > 3.0:
        effects.append(
            {
                "id": "payoff_pop",
                "type": "popup",
                "start": round(_clamp(duration * 0.55, 2.4, duration - 1.4), 2),
                "end": round(_clamp(duration * 0.55 + 1.1, 3.5, duration - 0.2), 2),
                "params": {
                    "asset_id": "reaction_box",
                    "position": "top-right" if rotate == 0 else "top-left",
                    "scale": 0.42,
                    "enter": "pop",
                    "exit": "fade",
                },
                "rationale": "Reaction popup on the payoff line, top corner so captions stay clear.",
            }
        )

    if style == "chaotic" and duration > 4.4:
        effects.append(
            {
                "id": "payoff_zoom",
                "type": "zoom",
                "start": round(duration * 0.78, 2),
                "end": round(min(duration - 0.15, duration * 0.78 + 0.7), 2),
                "params": {"scale": 1.28, "origin": "center", "hold": 0.2},
                "rationale": "Second punch-in on the final punchline so the rehook lands.",
            }
        )

    return {
        "schema_version": "1.0.0",
        "clip_id": clip_id,
        "niche": niche,
        "effects": effects,
    }


def canned_text(**kwargs: Any) -> str:
    import json

    return json.dumps(canned_edl(**kwargs), indent=2)
