"""Calibration: compare the judge against your own ratings.

    python -m judge.calibrate --csv judge/calibration_template.csv --mock
    python -m judge.calibrate --csv my_ratings.csv            # needs a vision key
    python -m judge.calibrate --write-template my_ratings.csv

CSV columns:

    clip_id,mp4,edl,transcript,human_hook,human_arc,human_readability,human_overload,human_audio,notes

``mp4`` and ``edl`` are paths (relative to the CSV's folder). ``transcript`` is
optional. Human scores are 1-10 on the same rubric; blank cells are skipped.

Outputs per-dimension Pearson correlation, mean absolute error, and the five
biggest disagreements together with the judge's critique, because the critique is
what tells you how to fix the rubric.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from judge.judge import judge_clip  # noqa: E402

DIMENSIONS = ("hook", "arc", "readability", "overload", "audio")
COLUMNS = ["clip_id", "mp4", "edl", "transcript", *[f"human_{d}" for d in DIMENSIONS], "notes"]


def write_template(path: Path) -> None:
    rows = [
        {
            "clip_id": "demo_01",
            "mp4": "data/renders/demo_01/winner.mp4",
            "edl": "data/renders/demo_01/winner.edl.json",
            "transcript": "data/fixtures/transcript_sample.json",
            "human_hook": "8",
            "human_arc": "7",
            "human_readability": "8",
            "human_overload": "6",
            "human_audio": "7",
            "notes": "hook landed; popup at 2.1s felt late",
        }
    ]
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(rows)
    print(f"wrote {path}")


def pearson(xs: list[float], ys: list[float]) -> float:
    n = len(xs)
    if n < 2:
        return float("nan")
    mx, my = sum(xs) / n, sum(ys) / n
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    den = math.sqrt(sum((x - mx) ** 2 for x in xs) * sum((y - my) ** 2 for y in ys))
    return num / den if den else float("nan")


def _num(value: str) -> float | None:
    value = (value or "").strip()
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def calibrate(csv_path: Path, *, use_mock: bool | None = None, out_path: Path | None = None) -> dict[str, Any]:
    base = csv_path.parent
    rows = list(csv.DictReader(csv_path.open(encoding="utf-8")))
    if not rows:
        raise SystemExit(f"{csv_path} has no rows")

    records: list[dict[str, Any]] = []
    for row in rows:
        mp4 = (base / row["mp4"]).resolve() if row.get("mp4") else None
        edl_path = (base / row["edl"]).resolve() if row.get("edl") else None
        if not mp4 or not mp4.exists():
            print(f"skip {row.get('clip_id')}: missing mp4 {mp4}")
            continue
        if not edl_path or not edl_path.exists():
            print(f"skip {row.get('clip_id')}: missing edl {edl_path}")
            continue
        edl = json.loads(edl_path.read_text(encoding="utf-8"))
        transcript = None
        if row.get("transcript"):
            tpath = (base / row["transcript"]).resolve()
            if tpath.exists():
                transcript = json.loads(tpath.read_text(encoding="utf-8"))
        result = judge_clip(
            mp4,
            edl,
            transcript,
            clip_id=row.get("clip_id") or edl.get("clip_id"),
            use_mock=use_mock,
        )
        if not result.ok or not result.report:
            print(f"skip {row.get('clip_id')}: judge failed: {result.errors}")
            continue
        records.append(
            {
                "clip_id": row.get("clip_id"),
                "judge": result.report["scores"],
                "human": {d: _num(row.get(f"human_{d}", "")) for d in DIMENSIONS},
                "critique": result.report.get("critique", ""),
                "notes": row.get("notes", ""),
            }
        )

    if not records:
        raise SystemExit("no rows could be judged; check the paths in the CSV")

    report: dict[str, Any] = {"rows": len(records), "dimensions": {}, "mock": bool(use_mock)}
    print(f"\n{'dimension':14s} {'n':>3s} {'pearson':>8s} {'MAE':>6s} {'judge avg':>10s} {'human avg':>10s}")
    print("-" * 58)
    for dim in DIMENSIONS:
        pairs = [
            (float(r["judge"][dim]), float(r["human"][dim]))
            for r in records
            if r["human"].get(dim) is not None and r["judge"].get(dim) is not None
        ]
        if not pairs:
            continue
        js = [p[0] for p in pairs]
        hs = [p[1] for p in pairs]
        mae = sum(abs(j - h) for j, h in pairs) / len(pairs)
        r = pearson(js, hs)
        report["dimensions"][dim] = {
            "n": len(pairs),
            "pearson": round(r, 3) if not math.isnan(r) else None,
            "mae": round(mae, 2),
            "judge_avg": round(sum(js) / len(js), 2),
            "human_avg": round(sum(hs) / len(hs), 2),
        }
        print(
            f"{dim:14s} {len(pairs):3d} {(f'{r:8.2f}' if not math.isnan(r) else '     n/a')} "
            f"{mae:6.2f} {sum(js) / len(js):10.2f} {sum(hs) / len(hs):10.2f}"
        )

    scored = []
    for record in records:
        gaps = [
            abs(float(record["judge"][d]) - float(record["human"][d]))
            for d in DIMENSIONS
            if record["human"].get(d) is not None
        ]
        if gaps:
            scored.append((sum(gaps) / len(gaps), record))
    scored.sort(key=lambda pair: pair[0], reverse=True)

    print("\nBiggest disagreements (why the rubric needs work):")
    disagreement_rows = []
    for gap, record in scored[:5]:
        print(f"\n- {record['clip_id']} (mean gap {gap:.2f})")
        print(f"  judge: {record['judge']}")
        print(f"  human: {record['human']}")
        print(f"  judge critique: {record['critique']}")
        if record["notes"]:
            print(f"  your note: {record['notes']}")
        disagreement_rows.append(
            {"clip_id": record["clip_id"], "mean_gap": round(gap, 2), "judge": record["judge"],
             "human": record["human"], "critique": record["critique"], "notes": record["notes"]}
        )
    report["disagreements"] = disagreement_rows

    target = out_path or ROOT / "data" / "calibration" / "report.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"\nwrote {target}")
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="Calibrate the judge against human ratings.")
    parser.add_argument("--csv", type=Path, default=ROOT / "judge" / "calibration_template.csv")
    parser.add_argument("--mock", action="store_true", help="use canned reports (no API)")
    parser.add_argument("--live", action="store_true", help="force a real vision call")
    parser.add_argument("--out", type=Path, default=None)
    parser.add_argument("--write-template", type=Path, default=None,
                        help="write a starter CSV and exit")
    args = parser.parse_args()

    if args.write_template:
        write_template(args.write_template)
        return 0
    use_mock = True if args.mock else (False if args.live else None)
    if not args.csv.exists():
        print(f"{args.csv} does not exist; writing the template there first")
        write_template(args.csv)
    calibrate(args.csv, use_mock=use_mock, out_path=args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
