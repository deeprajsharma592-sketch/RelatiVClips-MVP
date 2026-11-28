"""Canned judge reports so tests and dry runs never need a vision API."""

from __future__ import annotations

import json
from typing import Any, Mapping, Sequence

from schemas.models import production_ready_rule


def _effects(edl: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    return [e for e in (edl.get("effects") or []) if isinstance(e, Mapping)]


def canned_report(
    edl: Mapping[str, Any],
    *,
    clip_id: str | None = None,
    duration_s: float = 5.0,
    transcript: Mapping[str, Any] | Sequence[Mapping[str, Any]] | None = None,
) -> dict[str, Any]:
    effects = _effects(edl)
    impacts = [e for e in effects if e.get("type") in ("shake", "motion_blur", "popup", "zoom")]
    captions = [e for e in effects if e.get("type") == "caption_style"]
    sfx = [e for e in effects if e.get("type") == "sfx"]
    hook_impacts = [e for e in impacts if float(e.get("start", 0)) < 1.6]
    late_impacts = [e for e in impacts if float(e.get("start", 0)) > duration_s * 0.5]

    hook = 8 if hook_impacts else 5
    arc = 8 if late_impacts else 6
    readability = 9 if captions else 3
    overload = max(4, 10 - max(0, len(impacts) - 2) * 2)
    audio = 8 if sfx else 7
    if captions and any(
        str((p.get("params") or {}).get("position", "")).startswith(("bottom", "center"))
        and float(p.get("start", 0)) < float(c.get("end", 0))
        and float(c.get("start", 0)) < float(p.get("end", 0))
        for p in effects
        if p.get("type") == "popup"
        for c in captions
    ):
        readability = 5

    scores = {
        "hook": hook,
        "arc": arc,
        "readability": readability,
        "overload": overload,
        "audio": audio,
    }
    first = effects[0] if effects else None
    if first:
        critique = (
            f"Strongest moment is {first.get('id')} at {float(first.get('start', 0)):.2f}s. "
            f"Weakest: the beat after {max(0.0, duration_s - 0.6):.2f}s could carry one more "
            "reaction, but only if it does not cover captions."
        )
    else:
        critique = (
            f"At {duration_s / 2:.2f}s there is nothing but the raw frame; add captions before "
            "any effect, and one hook accent in the first second."
        )
    return {
        "schema_version": "1.0.0",
        "clip_id": clip_id or str(edl.get("clip_id") or "clip"),
        "scores": scores,
        "critique": critique,
        "production_ready": production_ready_rule(scores),
    }


def canned_text(edl: Mapping[str, Any], **kwargs: Any) -> str:
    return json.dumps(canned_report(edl, **kwargs), indent=2)
