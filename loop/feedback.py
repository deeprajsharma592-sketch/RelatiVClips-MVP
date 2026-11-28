"""Real feedback, and the weekly check of judge-vs-audience divergence.

Feedback kinds: like, download (strong positive), dislike (+ reason), metric
(platform numbers later). The weekly report *suggests* rubric weight changes; it
never applies them.
"""

from __future__ import annotations

import statistics
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Mapping

from schemas import db
from .config import weights

SIGNAL = {"download": 10.0, "like": 8.0, "metric": 5.0, "dislike": 2.0}
VALID_KINDS = tuple(SIGNAL)


def record(
    edl_id: int,
    kind: str,
    *,
    reason: str = "",
    value: float | None = None,
    source: str = "user",
    payload: Mapping[str, Any] | None = None,
    db_url: str | None = None,
) -> int:
    if kind not in VALID_KINDS:
        raise ValueError(f"unknown feedback kind '{kind}'; expected one of {VALID_KINDS}")
    with db.session_scope(db_url) as session:
        edl_row = session.get(db.Edl, edl_id)
        if edl_row is None:
            raise KeyError(f"edl {edl_id} does not exist")
        resolved = SIGNAL[kind] if value is None else float(value)
        row = db.record_feedback(
            session,
            edl_row,
            kind=kind,
            reason=reason,
            value=resolved,
            source=source,
            payload=payload,
        )
        return row.id


def _feedback_signal(rows: list[db.Feedback]) -> float | None:
    if not rows:
        return None
    return statistics.fmean(float(r.value) for r in rows)


def weekly_report(*, days: int = 7, db_url: str | None = None) -> dict[str, Any]:
    """Compare judge score with real feedback per niche and flag divergence."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    by_niche: dict[str, dict[str, list[float]]] = defaultdict(lambda: {"judge": [], "feedback": []})
    with db.session_scope(db_url) as session:
        from sqlalchemy import select

        rows = session.execute(
            select(db.Edl, db.Judgment, db.Feedback)
            .join(db.Clip, db.Clip.id == db.Edl.clip_id)
            .outerjoin(db.Judgment, db.Judgment.edl_id == db.Edl.id)
            .outerjoin(db.Feedback, db.Feedback.edl_id == db.Edl.id)
            .where(db.Feedback.created_at >= since)
        ).all()
        for edl_row, judgment, feedback in rows:
            niche = edl_row.niche or "unknown"
            if judgment is not None:
                judge_score = statistics.fmean(
                    [judgment.hook, judgment.arc, judgment.readability, judgment.overload, judgment.audio]
                )
                by_niche[niche]["judge"].append(judge_score)
            if feedback is not None:
                by_niche[niche]["feedback"].append(float(feedback.value))

    report: dict[str, Any] = {"days": days, "niches": {}, "suggestions": []}
    for niche, bucket in sorted(by_niche.items()):
        judge_avg = statistics.fmean(bucket["judge"]) if bucket["judge"] else None
        feedback_avg = statistics.fmean(bucket["feedback"]) if bucket["feedback"] else None
        gap = None if judge_avg is None or feedback_avg is None else round(judge_avg - feedback_avg, 2)
        divergent = gap is not None and abs(gap) >= 2.0 and len(bucket["feedback"]) >= 3
        report["niches"][niche] = {
            "judge_avg": round(judge_avg, 2) if judge_avg is not None else None,
            "feedback_avg": round(feedback_avg, 2) if feedback_avg is not None else None,
            "gap": gap,
            "n_judged": len(bucket["judge"]),
            "n_feedback": len(bucket["feedback"]),
            "divergent": divergent,
        }
        if divergent:
            direction = "over-scores" if gap > 0 else "under-scores"
            heaviest = max(weights(), key=weights().get)
            report["suggestions"].append(
                f"{niche}: judge {direction} audience by {abs(gap):.1f} points. Consider "
                f"lowering '{heaviest}' weight by 0.05 and re-running the 10-clip regression. "
                "Suggestion only - edit loop/weights.json deliberately."
            )
    return report


def print_report(report: Mapping[str, Any]) -> None:
    print(f"\nJudge vs audience, last {report['days']} days")
    print(f"{'niche':24s} {'judge':>7s} {'audience':>9s} {'gap':>6s} {'n':>4s} {'flag':>6s}")
    print("-" * 60)
    for niche, row in report["niches"].items():
        print(
            f"{niche:24s} {row['judge_avg'] if row['judge_avg'] is not None else '-':>7} "
            f"{row['feedback_avg'] if row['feedback_avg'] is not None else '-':>9} "
            f"{row['gap'] if row['gap'] is not None else '-':>6} "
            f"{row['n_feedback']:>4} {'DIVERGES' if row['divergent'] else 'ok':>6}"
        )
    if report["suggestions"]:
        print("\nSuggestions (not applied):")
        for line in report["suggestions"]:
            print(f"- {line}")
