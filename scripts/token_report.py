#!/usr/bin/env python3
"""Token usage report: per UTC day, per stage.

    python scripts/token_report.py               # all time
    python scripts/token_report.py --days 14
    python scripts/token_report.py --json
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import schemas.db as db  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--days", type=int, default=0, help="only the last N days")
    parser.add_argument("--json", action="store_true", help="machine-readable output")
    parser.add_argument("--db", default=None, help="override EDIT_DB_URL")
    args = parser.parse_args()

    rows = db.usage_by_day_and_stage(args.db)
    if args.days > 0:
        cutoff = sorted({r["day"] for r in rows})[-args.days :]
        rows = [r for r in rows if r["day"] in cutoff]

    if args.json:
        print(json.dumps(rows, indent=2))
        return 0

    if not rows:
        print(f"no token usage recorded ({db.database_url(args.db)})")
        return 0

    by_stage: dict[str, dict[str, int]] = defaultdict(lambda: {"prompt": 0, "completion": 0, "calls": 0})
    print(f"{'day':12s} {'stage':10s} {'calls':>6s} {'prompt':>9s} {'completion':>11s} {'total':>9s}")
    print("-" * 62)
    for row in rows:
        print(
            f"{row['day']:12s} {row['stage']:10s} {row['calls']:6d} "
            f"{row['prompt_tokens']:9d} {row['completion_tokens']:11d} {row['total_tokens']:9d}"
        )
        agg = by_stage[row["stage"]]
        agg["prompt"] += row["prompt_tokens"]
        agg["completion"] += row["completion_tokens"]
        agg["calls"] += row["calls"]

    print("-" * 62)
    grand = {"prompt": 0, "completion": 0, "calls": 0}
    for stage, agg in sorted(by_stage.items()):
        total = agg["prompt"] + agg["completion"]
        print(f"{'TOTAL':12s} {stage:10s} {agg['calls']:6d} {agg['prompt']:9d} {agg['completion']:11d} {total:9d}")
        for key in grand:
            grand[key] += agg[key]
    print(
        f"{'TOTAL':12s} {'all':10s} {grand['calls']:6d} {grand['prompt']:9d} "
        f"{grand['completion']:11d} {grand['prompt'] + grand['completion']:9d}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
