"""Load a clip's source, story plan and transcript from the DB or the fixtures."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import engine_config
from schemas import db


@dataclass
class ClipData:
    clip_id: str
    niche: str
    source_path: Path
    duration_s: float
    story_plan: dict[str, Any]
    transcript: dict[str, Any] | None
    db_id: int | None = None


def fixtures() -> dict[str, Any]:
    path = engine_config.settings().fixtures_dir / "clips.json"
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def load_clip(clip_id: str, session=None) -> ClipData | None:
    """DB row wins (it may have been edited); fixtures are the cold-start seed."""
    fixtures_dir = engine_config.settings().fixtures_dir

    def _from_db(row) -> ClipData:
        return ClipData(
            clip_id=row.clip_id,
            niche=row.niche,
            source_path=Path(row.source_path),
            duration_s=float(row.duration_s or 0.0),
            story_plan=dict(row.story_plan or {}),
            transcript=dict(row.transcript) if row.transcript else None,
            db_id=row.id,
        )

    if session is not None:
        row = db.session_get_clip(session, clip_id)
        if row is not None and row.story_plan:
            return _from_db(row)
    else:
        with db.session_scope() as own:
            row = db.session_get_clip(own, clip_id)
            if row is not None and row.story_plan:
                return _from_db(row)

    spec = fixtures().get(clip_id)
    if not spec:
        return None
    source = fixtures_dir / spec["source"]
    plan = json.loads((fixtures_dir / spec["story_plan"]).read_text(encoding="utf-8"))
    transcript = None
    if spec.get("transcript"):
        transcript = json.loads((fixtures_dir / spec["transcript"]).read_text(encoding="utf-8"))
    return ClipData(
        clip_id=clip_id,
        niche=spec.get("niche", "livestream_comedy"),
        source_path=source,
        duration_s=float(plan.get("duration_s") or 0.0),
        story_plan=plan,
        transcript=transcript,
    )


def register(clip: ClipData, session) -> Any:
    """Upsert the clip row so EDLs/renders/judgments have a parent."""
    row = db.get_or_create_clip(
        session,
        clip.clip_id,
        niche=clip.niche,
        source_path=clip.source_path,
        duration_s=clip.duration_s,
        story_plan=clip.story_plan,
        transcript=clip.transcript,
    )
    clip.db_id = row.id
    return row


def list_fixture_clips() -> list[str]:
    return sorted(fixtures())


def regression_clips(count: int = 10) -> list[str]:
    """The fixed regression set: 10 clip specs under data/regression/clips.json."""
    path = engine_config.settings().data_dir / "regression" / "clips.json"
    if path.exists():
        payload = json.loads(path.read_text(encoding="utf-8"))
        ids = [row["clip_id"] for row in payload.get("clips", [])]
        if ids:
            return ids[:count]
    base = list_fixture_clips()
    return [base[i % len(base)] for i in range(count)] if base else []
