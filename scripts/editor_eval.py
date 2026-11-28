#!/usr/bin/env python3
"""Editor acceptance check: valid EDL rate across the sample clips and styles.

    python scripts/editor_eval.py --mock          # no API key needed
    python scripts/editor_eval.py                 # live, uses EDIT_LLM_* env

Reports how many (clip, style, variant) requests produced a valid EDL within 3
attempts, how many attempts it took, and the tokens spent. The target is >= 90%.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from editor import STYLE_DIRECTIONS, generate_edl  # noqa: E402
from loop.clipdata import load_clip  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mock", action="store_true")
    parser.add_argument("--live", action="store_true")
    parser.add_argument("--clips", nargs="*", default=["demo_01", "demo_02", "demo_03"])
    parser.add_argument("--variants", type=int, default=1, help="variants per clip/style")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    use_mock = True if args.mock else (False if args.live else None)
    rows = []
    total_tokens = 0
    for clip_id in args.clips:
        clip = load_clip(clip_id)
        if clip is None:
            print(f"skip {clip_id}: not found")
            continue
        for style in STYLE_DIRECTIONS:
            for variant in range(args.variants):
                result = generate_edl(
                    clip.story_plan,
                    clip.transcript,
                    niche=clip.niche,
                    style_direction=style,
                    variant_index=variant,
                    use_mock=use_mock,
                )
                total_tokens += result.total_tokens
                rows.append(
                    {
                        "clip_id": clip_id,
                        "style": style,
                        "variant": variant,
                        "ok": result.ok,
                        "attempts": len(result.attempts),
                        "mock": result.mock,
                        "errors": result.errors[:2],
                        "effects": len((result.edl or {}).get("effects") or []),
                    }
                )
                state = "ok" if result.ok else "FAIL"
                print(
                    f"{clip_id:8s} {style:8s} v{variant} {state:4s} "
                    f"attempts={len(result.attempts)} effects={rows[-1]['effects']}"
                )

    ok = sum(1 for r in rows if r["ok"])
    rate = (ok / len(rows) * 100) if rows else 0.0
    first_try = sum(1 for r in rows if r["ok"] and r["attempts"] == 1)
    summary = {
        "requests": len(rows),
        "valid": ok,
        "rate_pct": round(rate, 1),
        "first_attempt_pct": round(first_try / len(rows) * 100, 1) if rows else 0.0,
        "tokens": total_tokens,
        "mock": rows[0]["mock"] if rows else None,
        "target_met": rate >= 90.0,
    }
    print(
        f"\n{ok}/{len(rows)} valid ({rate:.1f}%)  first-attempt {summary['first_attempt_pct']:.1f}%  "
        f"tokens {total_tokens:,}  target >= 90%: {'PASS' if summary['target_met'] else 'FAIL'}"
    )
    if args.json:
        print(json.dumps({"summary": summary, "rows": rows}, indent=2))
    return 0 if summary["target_met"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
