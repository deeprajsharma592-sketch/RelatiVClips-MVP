"""One optional critique-rewrite round, kept only if the score improves.

The judge's critique is handed back to the editor as a refinement instruction.
Max 2 rounds; each round is rendered and judged like any other variant, so a
"clever" rewrite cannot sneak in on vibes.
"""

from __future__ import annotations

from typing import Any

from composer import compose
from composer.render import render as render_project
from editor import generate_edl
from judge import judge_clip
from schemas import db

from . import clipdata, memory, selection
from .pipeline import RunResult, VariantResult


def refine_winner(
    run_result: RunResult,
    clip: clipdata.ClipData,
    *,
    use_mock: bool | None = None,
    rounds: int = 2,
    db_url: str | None = None,
) -> dict[str, Any] | None:
    winner = run_result.winner
    if winner is None or not winner.edl or not winner.critique:
        return None

    best = winner
    best_score = winner.weighted
    tokens = 0
    kept_round = 0

    with db.session_scope(db_url) as session:
        clip_row = db.session_get_clip(session, clip.clip_id)
        for round_index in range(1, rounds + 1):
            edit = generate_edl(
                clip.story_plan,
                clip.transcript,
                niche=clip.niche,
                style_direction=best.style_direction,
                temperature=min(1.0, best.temperature + 0.1),
                variant_index=100 + round_index,
                use_mock=use_mock,
                session=session,
                refine_context=best.critique,
                refine_edl=best.edl,
            )
            tokens += edit.total_tokens
            if not edit.ok:
                break

            candidate = VariantResult(
                index=100 + round_index,
                style_direction=best.style_direction,
                temperature=best.temperature,
                ok=True,
                edl=edit.edl,
                tokens=edit.total_tokens,
            )
            edl_row = db.save_edl(
                session,
                clip_row,
                edit.edl,
                label=f"refine{round_index}",
                style_direction=best.style_direction,
                temperature=candidate.temperature,
                prompt_version=edit.prompt_version,
                model_name=edit.model,
                parent_edl_id=best.edl_id,
                attempt=len(edit.attempts),
            )
            candidate.edl_id = edl_row.id

            composed = compose(
                edit.edl,
                clip.source_path,
                clip.transcript,
                out_dir=f"{run_result.winner_mp4.rsplit('/', 1)[0]}/proj_refine{round_index}",
                duration_s=clip.duration_s or None,
            )
            if not composed.ok:
                break
            candidate.project_dir = composed.project_dir
            mp4 = composed.project_dir.replace("proj_refine", "refine") + ".mp4"
            candidate.render = render_project(composed.project_dir, mp4, workers=1)
            if not candidate.render.ok:
                break

            verdict = judge_clip(
                candidate.render.mp4_path,
                edit.edl,
                clip.transcript,
                clip_id=clip.clip_id,
                duration_s=clip.duration_s or None,
                use_mock=use_mock,
            )
            candidate.judge = verdict
            candidate.tokens += verdict.total_tokens
            tokens += verdict.total_tokens
            if not verdict.ok or not verdict.report:
                break

            candidate.weighted = selection.score_variant(verdict.scores)
            candidate.production_ready = bool(verdict.report.get("production_ready"))
            render_row = db.save_render(
                session,
                edl_row,
                ok=True,
                mp4_path=candidate.render.mp4_path,
                project_dir=candidate.project_dir,
                lint_errors=candidate.render.lint_errors,
                warnings=candidate.render.lint_warnings,
                render_seconds=candidate.render.render_seconds,
            )
            db.save_judgment(
                session,
                edl_row,
                verdict.report,
                render_id=render_row.id,
                prompt_version=verdict.prompt_version,
                model_name=verdict.model,
            )

            if candidate.weighted > best_score + 0.05:
                best, best_score, kept_round = candidate, candidate.weighted, round_index
            else:
                break

        session.commit()

    if kept_round == 0:
        return {"kept_round": 0, "before": winner.weighted, "after": winner.weighted, "tokens": tokens,
                "variant": winner}

    import json
    import shutil
    from pathlib import Path

    base = Path(run_result.winner_mp4).parent
    shutil.copy2(best.render.mp4_path, base / "winner.mp4")
    (base / "winner.edl.json").write_text(json.dumps(best.edl, indent=2) + "\n", encoding="utf-8")
    memory.record_winner(
        niche=clip.niche,
        clip_id=clip.clip_id,
        edl=best.edl,
        scores=best.scores,
        weighted_score=best.weighted,
        critique=best.critique,
        style_direction=best.style_direction,
    )
    return {"kept_round": kept_round, "before": winner.weighted, "after": best.weighted,
            "tokens": tokens, "variant": best}
