"""Consistency: run the judge N times on one clip and report score variance.

High variance means the rubric is vague, not that the clip is ambiguous.

    python -m judge.consistency --mp4 data/renders/x.mp4 --edl x.edl.json
    python -m judge.consistency --clip demo_01 --runs 5
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from judge.judge import judge_clip  # noqa: E402

DIMENSIONS = ("hook", "arc", "readability", "overload", "audio")


def consistency(
    mp4: Path,
    edl: dict[str, Any],
    *,
    runs: int = 3,
    transcript: dict[str, Any] | None = None,
    use_mock: bool | None = None,
) -> dict[str, Any]:
    scores: list[dict[str, int]] = []
    for _ in range(runs):
        result = judge_clip(mp4, edl, transcript, use_mock=use_mock)
        if not result.ok or not result.report:
            print(f"judge run failed: {result.errors}")
            continue
        scores.append(result.report["scores"])

    if not scores:
        raise SystemExit("no successful judge runs")

    print(f"\nruns: {len(scores)}  clip: {edl.get('clip_id')}  mock: {bool(use_mock)}")
    print(f"{'dimension':14s} {'mean':>6s} {'stdev':>6s} {'range':>6s} {'verdict':>10s}")
    print("-" * 50)
    table: dict[str, Any] = {}
    for dim in DIMENSIONS:
        values = [s[dim] for s in scores]
        stdev = statistics.pstdev(values) if len(values) > 1 else 0.0
        verdict = "stable" if stdev < 0.5 else ("loose" if stdev < 1.0 else "vague")
        table[dim] = {
            "mean": round(statistics.fmean(values), 2),
            "stdev": round(stdev, 2),
            "range": max(values) - min(values),
            "verdict": verdict,
        }
        print(
            f"{dim:14s} {statistics.fmean(values):6.2f} {stdev:6.2f} "
            f"{max(values) - min(values):6d} {verdict:>10s}"
        )
    worst = max(table.items(), key=lambda kv: kv[1]["stdev"])
    print(f"\nMost variable dimension: {worst[0]} (stdev {worst[1]['stdev']})")
    if worst[1]["stdev"] >= 1.0:
        print("  -> tighten that rubric anchor before trusting its scores.")
    return {"runs": len(scores), "scores": scores, "table": table}


def _resolve(clip_id: str) -> tuple[Path, dict[str, Any], dict[str, Any] | None]:
    renders = Path("data") / "renders" / clip_id
    mp4 = renders / "winner.mp4"
    edl_path = renders / "winner.edl.json"
    if not edl_path.exists():
        candidates = sorted(renders.glob("*.edl.json"))
        if candidates:
            edl_path = candidates[0]
    if not mp4.exists():
        candidates = sorted(renders.glob("*.mp4"))
        if not candidates:
            raise SystemExit(f"no render for clip '{clip_id}' under {renders}")
        mp4 = candidates[0]
    edl = json.loads(edl_path.read_text())
    transcript_path = Path("data") / "fixtures" / "transcript_sample.json"
    transcript = json.loads(transcript_path.read_text()) if transcript_path.exists() else None
    return mp4, edl, transcript


def main() -> int:
    parser = argparse.ArgumentParser(description="Judge consistency check.")
    parser.add_argument("--mp4", type=Path)
    parser.add_argument("--edl", type=Path)
    parser.add_argument("--transcript", type=Path)
    parser.add_argument("--clip", default=None)
    parser.add_argument("--runs", type=int, default=3)
    parser.add_argument("--mock", action="store_true")
    parser.add_argument("--live", action="store_true")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    if args.clip:
        mp4, edl, transcript = _resolve(args.clip)
    elif args.mp4 and args.edl:
        mp4 = args.mp4
        edl = json.loads(args.edl.read_text())
        transcript = json.loads(args.transcript.read_text()) if args.transcript else None
    else:
        parser.error("pass --clip <id> or both --mp4 and --edl")
        return 2

    use_mock = True if args.mock else (False if args.live else None)
    table = consistency(mp4, edl, runs=args.runs, transcript=transcript, use_mock=use_mock)
    if args.json:
        print(json.dumps(table, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
