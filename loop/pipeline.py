"""End-to-end pipeline: one clip in, a judged winner out.

    load clip -> generate N variants (style/temperature) -> compose+render in
    parallel -> judge each -> select winner -> record preference + memory

Every step is persisted. A failed variant is recorded and skipped; it never kills
the run.
"""

from __future__ import annotations

import json
import shutil
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Sequence

import engine_config
from composer import compose
from composer.render import RenderResult, render as render_project
from editor import STYLE_DIRECTIONS, generate_edl
from judge import JudgeResult, judge_clip
from schemas import db

from . import clipdata, config, memory, selection


@dataclass
class VariantResult:
    index: int
    style_direction: str
    temperature: float
    ok: bool = False
    edl: dict[str, Any] | None = None
    edl_id: int | None = None
    render: RenderResult | None = None
    judge: JudgeResult | None = None
    weighted: float = 0.0
    production_ready: bool = False
    project_dir: str = ""
    error: str = ""
    tokens: int = 0

    @property
    def scores(self) -> dict[str, int]:
        return (self.judge.scores if self.judge else {}) or {}

    @property
    def critique(self) -> str:
        return ((self.judge.report or {}).get("critique") if self.judge else "") or ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "index": self.index,
            "style_direction": self.style_direction,
            "temperature": self.temperature,
            "ok": self.ok,
            "edl_id": self.edl_id,
            "weighted": self.weighted,
            "production_ready": self.production_ready,
            "scores": self.scores,
            "mp4": self.render.mp4_path if self.render else "",
            "render_seconds": round(self.render.render_seconds, 2) if self.render else 0,
            "tokens": self.tokens,
            "error": self.error,
        }


@dataclass
class RunResult:
    clip_id: str
    run_id: int | None = None
    ok: bool = False
    variants: list[VariantResult] = field(default_factory=list)
    winner: VariantResult | None = None
    worst: VariantResult | None = None
    reason: str = ""
    error: str = ""
    notes: list[str] = field(default_factory=list)
    tokens: int = 0
    render_seconds: float = 0.0
    elapsed_s: float = 0.0
    examples_path: str = ""
    winner_mp4: str = ""
    winner_edl_path: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "clip_id": self.clip_id,
            "run_id": self.run_id,
            "ok": self.ok,
            "reason": self.reason,
            "error": self.error,
            "notes": self.notes,
            "tokens": self.tokens,
            "render_seconds": round(self.render_seconds, 2),
            "elapsed_s": round(self.elapsed_s, 2),
            "winner": self.winner.to_dict() if self.winner else None,
            "worst": self.worst.to_dict() if self.worst else None,
            "variants": [v.to_dict() for v in self.variants],
            "examples_path": self.examples_path,
            "winner_mp4": self.winner_mp4,
        }


def _style_plan(count: int, styles: Sequence[str] | None) -> list[str]:
    allowed = [s for s in (styles or STYLE_DIRECTIONS) if s in STYLE_DIRECTIONS] or ["punchy"]
    return [allowed[i % len(allowed)] for i in range(count)]


def _temperatures(styles: Sequence[str]) -> list[float]:
    base = {"minimal": 0.45, "punchy": 0.7, "chaotic": 0.95}
    return [round(base.get(s, 0.7) + 0.06 * (i % 3), 2) for i, s in enumerate(styles)]


def _render_variant(variant: VariantResult, clip: clipdata.ClipData, out_root: Path) -> None:
    project_dir = out_root / f"proj_v{variant.index}"
    mp4 = out_root / f"v{variant.index}_{variant.style_direction}.mp4"
    try:
        composed = compose(
            variant.edl,
            clip.source_path,
            clip.transcript,
            out_dir=project_dir,
            duration_s=clip.duration_s or None,
        )
        if not composed.ok:
            variant.error = "; ".join(composed.errors)
            variant.render = RenderResult(ok=False, error=variant.error)
            return
        variant.project_dir = composed.project_dir
        variant.render = render_project(composed.project_dir, mp4, workers=1)
        if not variant.render.ok:
            variant.error = variant.render.error
    except Exception as exc:  # a broken variant must not kill the run
        variant.error = f"{type(exc).__name__}: {exc}"
        variant.render = RenderResult(ok=False, error=variant.error)


def run(
    clip_id: str,
    *,
    variants: int | None = None,
    styles: Sequence[str] | None = None,
    use_mock: bool | None = None,
    workers: int | None = None,
    refine: bool = True,
    label: str = "",
    db_url: str | None = None,
) -> RunResult:
    settings = engine_config.settings()
    started = time.monotonic()
    clip = clipdata.load_clip(clip_id)
    if clip is None:
        return RunResult(clip_id=clip_id, ok=False, error=f"unknown clip '{clip_id}'")

    count = int(variants or settings.default_variants)
    style_plan = _style_plan(count, styles)
    temperatures = _temperatures(style_plan)
    out_root = settings.renders_dir / clip_id
    out_root.mkdir(parents=True, exist_ok=True)

    result = RunResult(clip_id=clip_id, notes=[])
    results: list[VariantResult] = []

    with db.session_scope(db_url) as session:
        clip_row = clipdata.register(clip, session)
        run_row = db.save_run(
            session,
            clip_row,
            variant_count=count,
            label=label,
            config={
                "styles": style_plan,
                "temperatures": temperatures,
                "mock": use_mock,
                "workers": workers or settings.max_render_workers,
                "weights": config.weights(),
            },
        )
        result.run_id = run_row.id

        # Phase A - generate EDLs (sequential: one model call at a time).
        for index, (style, temperature) in enumerate(zip(style_plan, temperatures)):
            edit = generate_edl(
                clip.story_plan,
                clip.transcript,
                niche=clip.niche,
                style_direction=style,
                temperature=temperature,
                variant_index=index,
                use_mock=use_mock,
                session=session,
            )
            result.tokens += edit.total_tokens
            variant = VariantResult(
                index=index,
                style_direction=style,
                temperature=temperature,
                ok=edit.ok,
                edl=edit.edl,
                tokens=edit.total_tokens,
            )
            if not edit.ok:
                variant.error = "; ".join(edit.errors) or "editor failed"
                db.save_variant(
                    session,
                    run_row,
                    index=index,
                    style_direction=style,
                    temperature=temperature,
                    status="failed",
                    error=variant.error[:900],
                )
                results.append(variant)
                continue
            edl_row = db.save_edl(
                session,
                clip_row,
                edit.edl,
                label=f"v{index}",
                style_direction=style,
                temperature=temperature,
                prompt_version=edit.prompt_version,
                model_name=edit.model,
                attempt=len(edit.attempts),
            )
            variant.edl_id = edl_row.id
            db.save_variant(
                session,
                run_row,
                index=index,
                style_direction=style,
                temperature=temperature,
                edl_id=edl_row.id,
                status="generated",
                error="",
            )
            results.append(variant)
        session.commit()

    # Phase B - compose + render in parallel, capped.
    renderable = [v for v in results if v.ok and v.edl]
    cap = max(1, min(workers or settings.max_render_workers, len(renderable) or 1))
    if renderable:
        with ThreadPoolExecutor(max_workers=cap) as pool:
            futures = {pool.submit(_render_variant, v, clip, out_root): v for v in renderable}
            for future in as_completed(futures):
                variant = futures[future]
                try:
                    future.result()
                except Exception as exc:  # defensive: _render_variant catches its own
                    variant.error = f"{type(exc).__name__}: {exc}"
                    variant.render = RenderResult(ok=False, error=variant.error)

    # Phase C - judge + persist.
    with db.session_scope(db_url) as session:
        for variant in results:
            if not variant.ok or not variant.edl:
                continue
            if not variant.render or not variant.render.ok:
                variant.ok = False
                db.save_variant(
                    session,
                    session.get(db.Run, result.run_id),
                    index=variant.index,
                    style_direction=variant.style_direction,
                    temperature=variant.temperature,
                    edl_id=variant.edl_id,
                    status="failed",
                    error=(variant.error or "render failed")[:900],
                )
                continue

            verdict = judge_clip(
                variant.render.mp4_path,
                variant.edl,
                clip.transcript,
                clip_id=clip.clip_id,
                duration_s=clip.duration_s or None,
                use_mock=use_mock,
            )
            variant.judge = verdict
            variant.tokens += verdict.total_tokens
            result.tokens += verdict.total_tokens
            edl_row = session.get(db.Edl, variant.edl_id)
            render_row = db.save_render(
                session,
                edl_row,
                ok=True,
                mp4_path=variant.render.mp4_path,
                project_dir=variant.project_dir,
                lint_errors=variant.render.lint_errors,
                warnings=variant.render.lint_warnings,
                render_seconds=variant.render.render_seconds,
            )
            if verdict.ok and verdict.report:
                variant.weighted = selection.score_variant(verdict.scores)
                variant.production_ready = bool(verdict.report.get("production_ready"))
                db.save_judgment(
                    session,
                    edl_row,
                    verdict.report,
                    render_id=render_row.id,
                    prompt_version=verdict.prompt_version,
                    model_name=verdict.model,
                )
            else:
                variant.ok = False
                variant.error = "; ".join(verdict.errors) or "judge failed"
            db.save_variant(
                session,
                session.get(db.Run, result.run_id),
                index=variant.index,
                style_direction=variant.style_direction,
                temperature=variant.temperature,
                edl_id=variant.edl_id,
                weighted_score=variant.weighted,
                production_ready=variant.production_ready,
                status="ok" if variant.ok else "failed",
                error=variant.error[:900],
            )
        session.commit()

    result.variants = results
    result.render_seconds = sum(
        v.render.render_seconds for v in results if v.render and v.render.ok
    )

    picked = selection.select(results)
    result.winner, result.worst, result.reason = picked.winner, picked.worst, picked.reason
    if not result.winner:
        result.error = result.reason
        result.elapsed_s = time.monotonic() - started
        _finalize_run(result, status="failed", db_url=db_url)
        return result

    # Phase D - preference pair, memory, and the winner artifacts.
    result.winner_mp4 = str(out_root / "winner.mp4")
    result.winner_edl_path = str(out_root / "winner.edl.json")
    shutil.copy2(result.winner.render.mp4_path, result.winner_mp4)
    Path(result.winner_edl_path).write_text(
        json.dumps(result.winner.edl, indent=2) + "\n", encoding="utf-8"
    )
    result.examples_path = str(
        memory.record_winner(
            niche=clip.niche,
            clip_id=clip.clip_id,
            edl=result.winner.edl,
            scores=result.winner.scores,
            weighted_score=result.winner.weighted,
            critique=result.winner.critique,
            style_direction=result.winner.style_direction,
        )
    )
    result.ok = True

    with db.session_scope(db_url) as session:
        run_row = session.get(db.Run, result.run_id)
        if run_row is not None:
            run_row.winner_edl_id = result.winner.edl_id
            run_row.worst_edl_id = result.worst.edl_id if result.worst else None
            run_row.status = "ok"
            run_row.total_tokens = result.tokens
            run_row.render_seconds = result.render_seconds
        if result.worst is not None and result.worst is not result.winner:
            db.save_preference(
                session,
                run_row,
                chosen_edl_id=result.winner.edl_id,
                rejected_edl_id=result.worst.edl_id,
                margin=picked.margin,
                reason=picked.reason,
            )
        session.commit()

    if refine:
        from .refine import refine_winner

        refined = refine_winner(result, clip, use_mock=use_mock, db_url=db_url)
        if refined is not None:
            result.notes.append(
                f"refinement: kept round {refined.get('kept_round')} (weighted "
                f"{refined.get('before')} -> {refined.get('after')})"
            )
            result.tokens += int(refined.get("tokens", 0))
            result.winner = refined["variant"] or result.winner
            result.winner_mp4 = str(out_root / "winner.mp4")
            result.winner_edl_path = str(out_root / "winner.edl.json")

    result.elapsed_s = time.monotonic() - started
    return result


def _finalize_run(result: RunResult, *, status: str, db_url: str | None) -> None:
    try:
        with db.session_scope(db_url) as session:
            row = session.get(db.Run, result.run_id)
            if row is not None:
                row.status = status
                row.error = result.error[:900]
                row.total_tokens = result.tokens
                row.render_seconds = result.render_seconds
            session.commit()
    except Exception:
        pass
