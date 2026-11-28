"""Persistence: five core tables, provenance on every artifact, token accounting."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import inspect, select

import schemas.db as db


def test_tables_exist(db_session):
    engine = db_session.get_bind()
    names = set(inspect(engine).get_table_names())
    assert {"clips", "edls", "renders", "judgments", "feedback", "token_usage"} <= names


def test_edl_and_judgment_store_prompt_version_and_model(db_session, all_blocks_edl):
    clip = db.get_or_create_clip(
        db_session,
        "demo_01",
        niche="livestream_comedy",
        source_path="data/fixtures/sample_5s.mp4",
        duration_s=5.0,
    )
    edl = db.save_edl(
        db_session,
        clip,
        all_blocks_edl,
        label="v1",
        prompt_version="editor-v1.0.0",
        model_name="deepseek-chat",
        style_direction="punchy",
        temperature=0.7,
    )
    assert edl.prompt_version == "editor-v1.0.0"
    assert edl.model_name == "deepseek-chat"
    assert edl.edl["clip_id"] == "demo_01"
    assert edl.created_at is not None and isinstance(edl.created_at, datetime)

    render = db.save_render(
        db_session,
        edl,
        ok=True,
        mp4_path="data/renders/x.mp4",
        project_dir="data/renders/x",
        render_seconds=12.5,
    )
    report = {
        "clip_id": "demo_01",
        "scores": {"hook": 8, "arc": 7, "readability": 7, "overload": 6, "audio": 6},
        "critique": "At 1.2s the popup covers the caption; move it to the top right.",
        "production_ready": True,
    }
    judgment = db.save_judgment(
        db_session,
        edl,
        report,
        render_id=render.id,
        prompt_version="judge-v1.0.0",
        model_name="anthropic/claude-haiku-5.5",
    )
    assert judgment.prompt_version == "judge-v1.0.0"
    assert judgment.model_name == "anthropic/claude-haiku-5.5"
    assert judgment.hook == 8 and judgment.production_ready is True

    feedback = db.record_feedback(db_session, edl, kind="download", value=1.0, source="user")
    assert feedback.kind == "download"

    assert db_session.scalar(select(db.Clip).where(db.Clip.clip_id == "demo_01")).id == clip.id


def test_clips_are_unique_by_clip_id(db_session):
    first = db.get_or_create_clip(db_session, "same", niche="n")
    second = db.get_or_create_clip(db_session, "same", niche="n")
    assert first.id == second.id


def test_token_usage_rolls_up_per_day_and_stage(db_session):
    db.log_token_usage(
        db_session, stage="editor", model="deepseek-chat", prompt_tokens=900, completion_tokens=120
    )
    db.log_token_usage(
        db_session, stage="editor", model="deepseek-chat", prompt_tokens=700, completion_tokens=80
    )
    db.log_token_usage(
        db_session, stage="judge", model="haiku", prompt_tokens=300, completion_tokens=60
    )
    db_session.commit()  # the report runs in its own session
    rows = db.usage_by_day_and_stage()
    editor = next(r for r in rows if r["stage"] == "editor")
    judge = next(r for r in rows if r["stage"] == "judge")
    assert editor["total_tokens"] == 1600 + 200
    assert editor["calls"] == 2
    assert judge["total_tokens"] == 360
