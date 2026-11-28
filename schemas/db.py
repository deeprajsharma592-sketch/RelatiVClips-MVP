"""SQLite/SQLAlchemy persistence for the edit engine.

Schema is intentionally Postgres-compatible: no SQLite-only types, JSON columns
via ``sqlalchemy.JSON`` (mapped to JSONB on Postgres), UTC timestamps, and a
single ``create_all`` bootstrap that a future Alembic migration can replace.

Provenance is stored on every generated artifact: ``prompt_version`` and
``model_name`` on EDLs and judgments, so a score can always be traced back to
the prompt that produced the edit and the model that judged it.
"""

from __future__ import annotations

import json
import os
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator, Mapping

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
    func,
    select,
)
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker

import engine_config


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Timestamps:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )


class Clip(Timestamps, Base):
    __tablename__ = "clips"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    clip_id: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    niche: Mapped[str] = mapped_column(String(64), default="livestream_comedy")
    source_path: Mapped[str] = mapped_column(Text, default="")
    duration_s: Mapped[float] = mapped_column(Float, default=0.0)
    story_plan: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    transcript: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    notes: Mapped[str] = mapped_column(Text, default="")

    edls: Mapped[list["Edl"]] = relationship(back_populates="clip", cascade="all, delete-orphan")


class Edl(Timestamps, Base):
    __tablename__ = "edls"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    clip_id: Mapped[int] = mapped_column(ForeignKey("clips.id", ondelete="CASCADE"), index=True)
    label: Mapped[str] = mapped_column(String(64), default="base")
    niche: Mapped[str] = mapped_column(String(64), default="")
    edl: Mapped[dict] = mapped_column(JSON, nullable=False)
    style_direction: Mapped[str] = mapped_column(String(32), default="punchy")
    temperature: Mapped[float] = mapped_column(Float, default=0.7)
    prompt_version: Mapped[str] = mapped_column(String(32), default="v1")
    model_name: Mapped[str] = mapped_column(String(96), default="")
    parent_edl_id: Mapped[int | None] = mapped_column(
        ForeignKey("edls.id", ondelete="SET NULL"), nullable=True
    )
    attempt: Mapped[int] = mapped_column(Integer, default=1)

    clip: Mapped[Clip] = relationship(back_populates="edls")
    renders: Mapped[list["Render"]] = relationship(back_populates="edl", cascade="all, delete-orphan")
    judgments: Mapped[list["Judgment"]] = relationship(
        back_populates="edl", cascade="all, delete-orphan"
    )


class Render(Timestamps, Base):
    __tablename__ = "renders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    edl_id: Mapped[int] = mapped_column(ForeignKey("edls.id", ondelete="CASCADE"), index=True)
    project_dir: Mapped[str] = mapped_column(Text, default="")
    mp4_path: Mapped[str] = mapped_column(Text, default="")
    ok: Mapped[bool] = mapped_column(Boolean, default=False)
    lint_errors: Mapped[list | None] = mapped_column(JSON, nullable=True)
    warnings: Mapped[list | None] = mapped_column(JSON, nullable=True)
    render_seconds: Mapped[float] = mapped_column(Float, default=0.0)
    error: Mapped[str] = mapped_column(Text, default="")

    edl: Mapped[Edl] = relationship(back_populates="renders")


class Judgment(Timestamps, Base):
    __tablename__ = "judgments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    edl_id: Mapped[int] = mapped_column(ForeignKey("edls.id", ondelete="CASCADE"), index=True)
    render_id: Mapped[int | None] = mapped_column(
        ForeignKey("renders.id", ondelete="SET NULL"), nullable=True
    )
    report: Mapped[dict] = mapped_column(JSON, nullable=False)
    hook: Mapped[int] = mapped_column(Integer, default=0)
    arc: Mapped[int] = mapped_column(Integer, default=0)
    readability: Mapped[int] = mapped_column(Integer, default=0)
    overload: Mapped[int] = mapped_column(Integer, default=0)
    audio: Mapped[int] = mapped_column(Integer, default=0)
    production_ready: Mapped[bool] = mapped_column(Boolean, default=False)
    prompt_version: Mapped[str] = mapped_column(String(32), default="v1")
    model_name: Mapped[str] = mapped_column(String(96), default="")

    edl: Mapped[Edl] = relationship(back_populates="judgments")


class Feedback(Timestamps, Base):
    __tablename__ = "feedback"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    edl_id: Mapped[int] = mapped_column(ForeignKey("edls.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(32), default="like")  # like|download|dislike|metric
    reason: Mapped[str] = mapped_column(Text, default="")
    value: Mapped[float] = mapped_column(Float, default=1.0)
    source: Mapped[str] = mapped_column(String(64), default="user")
    payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class TokenUsage(Timestamps, Base):
    __tablename__ = "token_usage"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    stage: Mapped[str] = mapped_column(String(32), index=True)  # editor|judge|refine
    model: Mapped[str] = mapped_column(String(96), default="")
    prompt_version: Mapped[str] = mapped_column(String(32), default="v1")
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    attempt: Mapped[int] = mapped_column(Integer, default=1)
    ok: Mapped[bool] = mapped_column(Boolean, default=True)
    mock: Mapped[bool] = mapped_column(Boolean, default=False)


# --------------------------------------------------------------------------- #
# Engine / session plumbing
# --------------------------------------------------------------------------- #


def database_url(url: str | None = None) -> str:
    return url or engine_config.settings().db_url


def engine_for(url: str | None = None, echo: bool = False) -> Engine:
    resolved = database_url(url)
    if resolved.startswith("sqlite:///"):
        path = Path(resolved.replace("sqlite:///", "", 1))
        if path.parent and str(path.parent) not in ("", "."):
            path.parent.mkdir(parents=True, exist_ok=True)
    return create_engine(resolved, echo=echo, future=True)


_SESSION_FACTORY: sessionmaker[Session] | None = None
_SESSION_URL: str | None = None


def init_db(url: str | None = None, echo: bool = False) -> Engine:
    """Create all tables (idempotent) and return the engine."""
    global _SESSION_FACTORY, _SESSION_URL
    resolved = database_url(url)
    engine = engine_for(resolved, echo=echo)
    Base.metadata.create_all(engine)
    _SESSION_FACTORY = sessionmaker(bind=engine, expire_on_commit=False, future=True)
    _SESSION_URL = resolved
    return engine


def _factory(url: str | None = None) -> sessionmaker[Session]:
    global _SESSION_FACTORY, _SESSION_URL
    resolved = database_url(url)
    if _SESSION_FACTORY is None or _SESSION_URL != resolved:
        init_db(resolved)
    assert _SESSION_FACTORY is not None
    return _SESSION_FACTORY


@contextmanager
def session_scope(url: str | None = None) -> Iterator[Session]:
    factory = _factory(url)
    session = factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


# --------------------------------------------------------------------------- #
# Convenience writers
# --------------------------------------------------------------------------- #


def get_or_create_clip(
    session: Session,
    clip_id: str,
    *,
    niche: str = "livestream_comedy",
    source_path: str | Path | None = None,
    duration_s: float | None = None,
    story_plan: Mapping[str, Any] | None = None,
    transcript: Mapping[str, Any] | None = None,
) -> Clip:
    clip = session.scalar(select(Clip).where(Clip.clip_id == clip_id))
    if clip is None:
        clip = Clip(
            clip_id=clip_id,
            niche=niche,
            source_path=str(source_path or ""),
            duration_s=float(duration_s or 0.0),
        )
        session.add(clip)
        session.flush()
    if niche:
        clip.niche = niche
    if source_path:
        clip.source_path = str(source_path)
    if duration_s:
        clip.duration_s = float(duration_s)
    if story_plan is not None:
        clip.story_plan = dict(story_plan)
    if transcript is not None:
        clip.transcript = dict(transcript)
    return clip


def save_edl(
    session: Session,
    clip_row: Clip,
    edl: Mapping[str, Any],
    *,
    label: str = "base",
    style_direction: str = "punchy",
    temperature: float = 0.7,
    prompt_version: str = "v1",
    model_name: str = "",
    parent_edl_id: int | None = None,
    attempt: int = 1,
) -> Edl:
    row = Edl(
        clip_id=clip_row.id,
        label=label,
        niche=str(edl.get("niche", clip_row.niche)),
        edl=dict(edl),
        style_direction=style_direction,
        temperature=float(temperature),
        prompt_version=prompt_version,
        model_name=model_name,
        parent_edl_id=parent_edl_id,
        attempt=attempt,
    )
    session.add(row)
    session.flush()
    return row


def save_render(
    session: Session,
    edl_row: Edl,
    *,
    ok: bool,
    mp4_path: str = "",
    project_dir: str = "",
    lint_errors: list[str] | None = None,
    warnings: list[str] | None = None,
    render_seconds: float = 0.0,
    error: str = "",
) -> Render:
    row = Render(
        edl_id=edl_row.id,
        project_dir=project_dir,
        mp4_path=mp4_path,
        ok=ok,
        lint_errors=list(lint_errors or []),
        warnings=list(warnings or []),
        render_seconds=float(render_seconds),
        error=error,
    )
    session.add(row)
    session.flush()
    return row


def save_judgment(
    session: Session,
    edl_row: Edl,
    report: Mapping[str, Any],
    *,
    render_id: int | None = None,
    prompt_version: str = "v1",
    model_name: str = "",
) -> Judgment:
    scores = report.get("scores", {})
    row = Judgment(
        edl_id=edl_row.id,
        render_id=render_id,
        report=dict(report),
        hook=int(scores.get("hook", 0)),
        arc=int(scores.get("arc", 0)),
        readability=int(scores.get("readability", 0)),
        overload=int(scores.get("overload", 0)),
        audio=int(scores.get("audio", 0)),
        production_ready=bool(report.get("production_ready", False)),
        prompt_version=prompt_version,
        model_name=model_name,
    )
    session.add(row)
    session.flush()
    return row


def record_feedback(
    session: Session,
    edl_row: Edl,
    *,
    kind: str,
    reason: str = "",
    value: float = 1.0,
    source: str = "user",
    payload: Mapping[str, Any] | None = None,
) -> Feedback:
    row = Feedback(
        edl_id=edl_row.id,
        kind=kind,
        reason=reason,
        value=float(value),
        source=source,
        payload=dict(payload) if payload else None,
    )
    session.add(row)
    session.flush()
    return row


def log_token_usage(
    session: Session,
    *,
    stage: str,
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
    prompt_version: str = "v1",
    attempt: int = 1,
    ok: bool = True,
    mock: bool = False,
) -> TokenUsage:
    row = TokenUsage(
        stage=stage,
        model=model,
        prompt_version=prompt_version,
        prompt_tokens=int(prompt_tokens),
        completion_tokens=int(completion_tokens),
        total_tokens=int(prompt_tokens) + int(completion_tokens),
        attempt=int(attempt),
        ok=bool(ok),
        mock=bool(mock),
    )
    session.add(row)
    session.flush()
    return row


def usage_by_day_and_stage(url: str | None = None) -> list[dict[str, Any]]:
    """Aggregate token usage per UTC day per stage (used by scripts/token_report.py)."""
    day = func.date(TokenUsage.created_at)
    with session_scope(url) as session:
        rows = session.execute(
            select(
                day.label("day"),
                TokenUsage.stage,
                func.sum(TokenUsage.prompt_tokens).label("prompt_tokens"),
                func.sum(TokenUsage.completion_tokens).label("completion_tokens"),
                func.sum(TokenUsage.total_tokens).label("total_tokens"),
                func.count(TokenUsage.id).label("calls"),
            )
            .group_by(day, TokenUsage.stage)
            .order_by(day, TokenUsage.stage)
        ).all()
        return [
            {
                "day": str(r.day),
                "stage": r.stage,
                "prompt_tokens": int(r.prompt_tokens or 0),
                "completion_tokens": int(r.completion_tokens or 0),
                "total_tokens": int(r.total_tokens or 0),
                "calls": int(r.calls or 0),
            }
            for r in rows
        ]


def dump_json(value: Any) -> str:
    return json.dumps(value, indent=2, ensure_ascii=False, default=str)


def reset_engine_cache() -> None:
    """Tests swap DB URLs; drop the cached session factory."""
    global _SESSION_FACTORY, _SESSION_URL
    _SESSION_FACTORY = None
    _SESSION_URL = None


class Run(Timestamps, Base):
    __tablename__ = "runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    clip_id: Mapped[int] = mapped_column(ForeignKey("clips.id", ondelete="CASCADE"), index=True)
    label: Mapped[str] = mapped_column(String(64), default="")
    variant_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(24), default="running")  # running|ok|failed
    config: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    winner_edl_id: Mapped[int | None] = mapped_column(
        ForeignKey("edls.id", ondelete="SET NULL"), nullable=True
    )
    worst_edl_id: Mapped[int | None] = mapped_column(
        ForeignKey("edls.id", ondelete="SET NULL"), nullable=True
    )
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    render_seconds: Mapped[float] = mapped_column(Float, default=0.0)
    error: Mapped[str] = mapped_column(Text, default="")


class Variant(Timestamps, Base):
    __tablename__ = "variants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("runs.id", ondelete="CASCADE"), index=True)
    edl_id: Mapped[int | None] = mapped_column(
        ForeignKey("edls.id", ondelete="SET NULL"), nullable=True
    )
    index: Mapped[int] = mapped_column(Integer, default=0)
    style_direction: Mapped[str] = mapped_column(String(32), default="punchy")
    temperature: Mapped[float] = mapped_column(Float, default=0.7)
    weighted_score: Mapped[float] = mapped_column(Float, default=0.0)
    production_ready: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(24), default="pending")  # ok|failed|skipped
    error: Mapped[str] = mapped_column(Text, default="")


class Preference(Timestamps, Base):
    __tablename__ = "preferences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("runs.id", ondelete="CASCADE"), index=True)
    chosen_edl_id: Mapped[int] = mapped_column(ForeignKey("edls.id", ondelete="CASCADE"))
    rejected_edl_id: Mapped[int] = mapped_column(ForeignKey("edls.id", ondelete="CASCADE"))
    margin: Mapped[float] = mapped_column(Float, default=0.0)
    reason: Mapped[str] = mapped_column(Text, default="")
    exported: Mapped[bool] = mapped_column(Boolean, default=False)


def save_run(
    session: Session,
    clip_row: Clip,
    *,
    variant_count: int,
    config: Mapping[str, Any] | None = None,
    label: str = "",
) -> Run:
    row = Run(
        clip_id=clip_row.id,
        label=label,
        variant_count=int(variant_count),
        config=dict(config) if config else None,
    )
    session.add(row)
    session.flush()
    return row


def save_variant(
    session: Session,
    run_row: Run,
    *,
    index: int,
    style_direction: str,
    temperature: float,
    edl_id: int | None = None,
    weighted_score: float = 0.0,
    production_ready: bool = False,
    status: str = "pending",
    error: str = "",
) -> Variant:
    """Upsert by (run, index): a variant is written when generated and again when judged."""
    row = session.scalar(
        select(Variant).where(Variant.run_id == run_row.id, Variant.index == int(index))
    )
    if row is None:
        row = Variant(run_id=run_row.id, index=int(index))
        session.add(row)
    row.style_direction = style_direction
    row.temperature = float(temperature)
    if edl_id is not None:
        row.edl_id = edl_id
    row.weighted_score = float(weighted_score)
    row.production_ready = bool(production_ready)
    row.status = status
    row.error = error
    session.flush()
    return row


def save_preference(
    session: Session,
    run_row: Run,
    *,
    chosen_edl_id: int,
    rejected_edl_id: int,
    margin: float,
    reason: str = "",
) -> Preference:
    row = Preference(
        run_id=run_row.id,
        chosen_edl_id=chosen_edl_id,
        rejected_edl_id=rejected_edl_id,
        margin=float(margin),
        reason=reason,
    )
    session.add(row)
    session.flush()
    return row


def session_get_clip(session: Session, clip_id: str) -> Clip | None:
    return session.scalar(select(Clip).where(Clip.clip_id == clip_id))
