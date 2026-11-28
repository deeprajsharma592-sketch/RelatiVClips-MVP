"""Export training data: (clip, EDL, judge, feedback) rows and preference pairs.

JSONL, one object per line, so it loads with ``datasets``/``jsonlines`` directly.

    python -m loop export --out data/dataset.jsonl
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from sqlalchemy import select

from schemas import db


def _rows(db_url: str | None) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    samples: list[dict[str, Any]] = []
    prefs: list[dict[str, Any]] = []
    with db.session_scope(db_url) as session:
        edls = session.execute(
            select(db.Edl, db.Clip)
            .join(db.Clip, db.Clip.id == db.Edl.clip_id)
            .order_by(db.Edl.id)
        ).all()
        for edl_row, clip_row in edls:
            judgments = session.scalars(
                select(db.Judgment).where(db.Judgment.edl_id == edl_row.id).order_by(db.Judgment.id.desc())
            ).all()
            feedback = session.scalars(
                select(db.Feedback).where(db.Feedback.edl_id == edl_row.id)
            ).all()
            renders = session.scalars(select(db.Render).where(db.Render.edl_id == edl_row.id)).all()
            samples.append(
                {
                    "type": "clip_edl",
                    "clip": {
                        "clip_id": clip_row.clip_id,
                        "niche": clip_row.niche,
                        "duration_s": clip_row.duration_s,
                        "story_plan": clip_row.story_plan,
                        "transcript": clip_row.transcript,
                    },
                    "edl": edl_row.edl,
                    "meta": {
                        "edl_id": edl_row.id,
                        "style_direction": edl_row.style_direction,
                        "temperature": edl_row.temperature,
                        "prompt_version": edl_row.prompt_version,
                        "model_name": edl_row.model_name,
                        "mp4": renders[0].mp4_path if renders else "",
                    },
                    "judge": judgments[0].report if judgments else None,
                    "feedback": [
                        {"kind": f.kind, "reason": f.reason, "value": f.value, "source": f.source}
                        for f in feedback
                    ],
                }
            )

        pairs = session.scalars(select(db.Preference)).all()
        for pair in pairs:
            chosen = session.get(db.Edl, pair.chosen_edl_id)
            rejected = session.get(db.Edl, pair.rejected_edl_id)
            if not chosen or not rejected:
                continue
            prefs.append(
                {
                    "type": "preference",
                    "chosen": chosen.edl,
                    "rejected": rejected.edl,
                    "margin": pair.margin,
                    "reason": pair.reason,
                    "edl_ids": [chosen.id, rejected.id],
                }
            )
    return samples, prefs


def export(out_path: str | Path, *, db_url: str | None = None) -> dict[str, Any]:
    target = Path(out_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    samples, prefs = _rows(db_url)
    with target.open("w", encoding="utf-8") as handle:
        for row in samples:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")
        for row in prefs:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")
    return {
        "path": str(target),
        "clip_edl": len(samples),
        "preference": len(prefs),
        "lines": len(samples) + len(prefs),
    }
