"""The learning layer: winning EDLs become few-shot examples, with no fine-tuning.

``niches/<niche>.examples.json`` is the model's memory. It is capped, pruned
(oldest low scorers go first), and the editor reads the top 3 by score with a
diverse effect mix (see ``editor.prompting.load_examples``).
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence

from editor.prompting import examples_path

MAX_EXAMPLES = 40
MIN_SCORE = 5.5


def _hash(edl: Mapping[str, Any]) -> str:
    payload = json.dumps(edl, sort_keys=True, separators=(",", ":"))
    return hashlib.sha1(payload.encode()).hexdigest()[:12]


def load(niche: str) -> dict[str, Any]:
    path = examples_path(niche)
    if not path.exists():
        return {"version": 1, "niche": niche, "examples": []}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"version": 1, "niche": niche, "examples": []}


def _prune(rows: Sequence[dict[str, Any]]) -> list[dict[str, Any]]:
    kept = [r for r in rows if float(r.get("weighted_score", 0)) >= MIN_SCORE]
    kept.sort(key=lambda r: (float(r.get("weighted_score", 0)), r.get("created_at", "")), reverse=True)
    return kept[:MAX_EXAMPLES]


def record_winner(
    *,
    niche: str,
    clip_id: str,
    edl: Mapping[str, Any],
    scores: Mapping[str, Any],
    weighted_score: float,
    critique: str = "",
    style_direction: str = "punchy",
) -> Path:
    """Append one winning EDL, dedupe by content hash, prune, and write."""
    payload = load(niche)
    rows = list(payload.get("examples") or [])
    digest = _hash(edl)
    rows = [r for r in rows if r.get("edl_hash") != digest]
    rows.append(
        {
            "edl_hash": digest,
            "clip_id": clip_id,
            "niche": niche,
            "style_direction": style_direction,
            "edl": dict(edl),
            "scores": dict(scores),
            "weighted_score": round(float(weighted_score), 3),
            "critique": critique[:600],
            "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        }
    )
    payload.update(
        {
            "version": 1,
            "niche": niche,
            "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "examples": _prune(rows),
        }
    )
    path = examples_path(niche)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return path


def effect_mix(edl: Mapping[str, Any]) -> tuple[str, ...]:
    return tuple(sorted({str(e.get("type")) for e in (edl.get("effects") or [])}))


def prompt_examples(niche: str, limit: int = 3) -> list[dict[str, Any]]:
    """Top N by score, one per effect mix."""
    rows = sorted(load(niche).get("examples") or [], key=lambda r: r.get("weighted_score", 0), reverse=True)
    chosen: list[dict[str, Any]] = []
    seen: set[tuple[str, ...]] = set()
    for row in rows:
        mix = effect_mix(row.get("edl") or {})
        if mix in seen:
            continue
        seen.add(mix)
        chosen.append(row)
        if len(chosen) >= limit:
            break
    return chosen


def stats(niche: str) -> dict[str, Any]:
    rows = load(niche).get("examples") or []
    return {
        "count": len(rows),
        "top_score": max((r.get("weighted_score", 0) for r in rows), default=0),
        "mixes": sorted({"/".join(effect_mix(r.get("edl") or {})) for r in rows}),
    }
