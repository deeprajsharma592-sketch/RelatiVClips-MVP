"""Regression run over a fixed clip set: before/after deltas per dimension.

Run it after any prompt, rubric or weight change. Rendering is deterministic
(``workers=1``), so a delta is the change you made - not render noise.

    python -m loop regression --update-baseline     # establish the baseline
    python -m loop regression                       # compare against it
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import engine_config

BASE_STYLES = ("punchy", "minimal", "chaotic")
DIMENSIONS = ("hook", "arc", "readability", "overload", "audio")


def specs_path() -> Path:
    return engine_config.settings().data_dir / "regression" / "clips.json"


def baseline_path() -> Path:
    return engine_config.settings().data_dir / "regression" / "baseline.json"


def build_specs(count: int = 10) -> list[dict[str, Any]]:
    from .clipdata import list_fixture_clips

    fixtures = list_fixture_clips() or ["demo_01"]
    specs = []
    for i in range(count):
        specs.append(
            {
                "label": f"reg_{i + 1:02d}",
                "clip_id": fixtures[i % len(fixtures)],
                "style": BASE_STYLES[i % len(BASE_STYLES)],
            }
        )
    return specs


def load_specs(count: int = 10) -> list[dict[str, Any]]:
    path = specs_path()
    if path.exists():
        payload = json.loads(path.read_text(encoding="utf-8"))
        specs = payload.get("clips") or []
        if specs:
            return specs[:count]
    specs = build_specs(count)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(
            {
                "notes": "Fixed regression set. Point these at real clips as they land.",
                "clips": specs,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    return specs


def _aggregate(rows: list[dict[str, Any]]) -> dict[str, Any]:
    scored = [r for r in rows if r.get("scores")]
    agg: dict[str, Any] = {"clips": len(scored), "dimensions": {}, "weighted": 0.0, "ready": 0}
    if not scored:
        return agg
    for dim in DIMENSIONS:
        values = [float(r["scores"].get(dim, 0)) for r in scored]
        agg["dimensions"][dim] = round(sum(values) / len(values), 3)
    agg["weighted"] = round(sum(float(r.get("weighted", 0)) for r in scored) / len(scored), 3)
    agg["ready"] = sum(1 for r in scored if r.get("production_ready"))
    return agg


def run_regression(
    *,
    count: int = 10,
    use_mock: bool | None = None,
    update_baseline: bool = False,
    db_url: str | None = None,
    variants: int = 1,
) -> dict[str, Any]:
    from .pipeline import run

    specs = load_specs(count)
    rows: list[dict[str, Any]] = []
    for spec in specs:
        result = run(
            spec["clip_id"],
            variants=variants,
            styles=[spec.get("style", "punchy")],
            use_mock=use_mock,
            refine=False,
            label=spec.get("label", ""),
            db_url=db_url,
        )
        winner = result.winner
        rows.append(
            {
                "label": spec.get("label"),
                "clip_id": spec["clip_id"],
                "style": spec.get("style"),
                "ok": result.ok,
                "weighted": winner.weighted if winner else 0.0,
                "production_ready": bool(winner.production_ready) if winner else False,
                "scores": winner.scores if winner else {},
                "tokens": result.tokens,
                "error": result.error,
            }
        )
        print(
            f"  {spec.get('label', spec['clip_id']):8s} {spec['clip_id']:10s} "
            f"{spec.get('style', ''):8s} {'ok' if result.ok else 'FAIL'} "
            f"{(f'{winner.weighted:.2f}' if winner else '-'):>6s}"
        )

    current = _aggregate(rows)
    baseline: dict[str, Any] = {}
    bpath = baseline_path()
    if bpath.exists():
        baseline = json.loads(bpath.read_text(encoding="utf-8"))

    print(f"\n{'dimension':14s} {'baseline':>9s} {'now':>9s} {'delta':>8s}")
    print("-" * 44)
    deltas: dict[str, float] = {}
    for dim in DIMENSIONS:
        now = current["dimensions"].get(dim)
        before = (baseline.get("dimensions") or {}).get(dim)
        if now is None:
            continue
        if before is None:
            print(f"{dim:14s} {'-':>9s} {now:9.2f} {'-':>8s}")
            continue
        delta = round(now - before, 3)
        deltas[dim] = delta
        print(f"{dim:14s} {before:9.2f} {now:9.2f} {delta:+8.2f}")
    baseline_clips = baseline.get("clips")
    if baseline_clips is not None and baseline_clips != current["clips"]:
        print(
            f"\n  note: baseline was measured on {baseline_clips} clips, this run on "
            f"{current['clips']}; compare like-for-like before trusting deltas"
        )
    before_weighted = baseline.get("weighted")
    if before_weighted is not None and current["clips"]:
        print(
            f"{'weighted':14s} {before_weighted:9.2f} {current['weighted']:9.2f} "
            f"{current['weighted'] - before_weighted:+8.2f}"
        )

    report = {
        "ran_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "specs": specs,
        "current": current,
        "baseline": baseline or None,
        "deltas": deltas,
        "rows": rows,
    }
    out = engine_config.settings().data_dir / "regression" / "last_run.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    if update_baseline:
        bpath.write_text(
            json.dumps(
                {
                    "ran_at": report["ran_at"],
                    "dimensions": current["dimensions"],
                    "weighted": current["weighted"],
                    "ready": current["ready"],
                    "clips": current["clips"],
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        print(f"\nbaseline updated -> {bpath}")
    print(f"report -> {out}")
    return report
