"""CLI: python -m loop <run|report|regression|export|feedback> ...

    python -m loop run --clip demo_01 --variants 6
    python -m loop report --days 7
    python -m loop regression --update-baseline
    python -m loop export --out data/dataset.jsonl
    python -m loop feedback --edl-id 12 --kind download
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import engine_config  # noqa: E402


def _mock_flag(args: argparse.Namespace) -> bool | None:
    if args.mock:
        return True
    if args.live:
        return False
    return None


def _styles(raw: str | None) -> list[str] | None:
    if not raw:
        return None
    return [part.strip() for part in raw.split(",") if part.strip()]


def cmd_run(args: argparse.Namespace) -> int:
    from loop.pipeline import run

    result = run(
        args.clip,
        variants=args.variants,
        styles=_styles(args.styles),
        use_mock=_mock_flag(args),
        workers=args.workers,
        refine=not args.no_refine,
        label=args.label,
    )
    if args.json:
        print(json.dumps(result.to_dict(), indent=2))
        return 0 if result.ok else 1

    ok_count = sum(1 for v in result.variants if v.ok)
    print(f"\nclip {result.clip_id}  run {result.run_id}  {ok_count}/{len(result.variants)} variants ok")
    for variant in result.variants:
        state = "ok  " if variant.ok else "FAIL"
        print(
            f"  v{variant.index} {variant.style_direction:8s} t={variant.temperature:.2f} "
            f"{state} weighted={variant.weighted:5.2f} "
            f"ready={'yes' if variant.production_ready else 'no '} "
            f"{(variant.error[:60] if variant.error else '')}"
        )
    if result.winner:
        w = result.winner
        print(
            f"\nWINNER v{w.index} ({w.style_direction}, weighted {w.weighted:.2f}, "
            f"{'production ready' if w.production_ready else 'draft'})"
        )
        print(f"  scores: {w.scores}")
        print(f"  {result.reason}")
        print(f"  critique: {w.critique[:220]}")
    else:
        print(f"\nno winner: {result.reason or result.error}")
    for note in result.notes:
        print(f"  note: {note}")
    print(
        f"\ntokens {result.tokens:,}  render {result.render_seconds:.1f}s  "
        f"wall {result.elapsed_s:.1f}s"
    )
    if result.winner_mp4:
        print(f"winner  {result.winner_mp4}")
        print(f"edl     {result.winner_edl_path}")
    if result.examples_path:
        print(f"memory  {result.examples_path}")
    return 0 if result.ok else 1


def cmd_report(args: argparse.Namespace) -> int:
    from loop import feedback

    report = feedback.weekly_report(days=args.days)
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        feedback.print_report(report)
    return 0


def cmd_regression(args: argparse.Namespace) -> int:
    from loop import regression

    regression.run_regression(
        count=args.clips,
        use_mock=_mock_flag(args),
        update_baseline=args.update_baseline,
        variants=args.variants,
    )
    return 0


def cmd_export(args: argparse.Namespace) -> int:
    from loop.export_dataset import export

    summary = export(args.out)
    print(json.dumps(summary, indent=2))
    return 0


def cmd_feedback(args: argparse.Namespace) -> int:
    from loop import feedback

    feedback_id = feedback.record(
        args.edl_id, args.kind, reason=args.reason, value=args.value, source=args.source
    )
    print(f"recorded feedback {feedback_id} for edl {args.edl_id} ({args.kind})")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python -m loop", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    run_p = sub.add_parser("run", help="clip -> variants -> judged winner")
    run_p.add_argument("--clip", required=True)
    run_p.add_argument("--variants", type=int, default=None)
    run_p.add_argument("--styles", default=None, help="comma list: punchy,minimal,chaotic")
    run_p.add_argument("--workers", type=int, default=None, help="parallel render cap")
    run_p.add_argument("--no-refine", action="store_true", help="skip the critique-rewrite round")
    run_p.add_argument("--label", default="")
    run_p.add_argument("--mock", action="store_true")
    run_p.add_argument("--live", action="store_true")
    run_p.add_argument("--json", action="store_true")
    run_p.set_defaults(func=cmd_run)

    report_p = sub.add_parser("report", help="judge vs real feedback per niche")
    report_p.add_argument("--days", type=int, default=7)
    report_p.add_argument("--json", action="store_true")
    report_p.set_defaults(func=cmd_report)

    reg_p = sub.add_parser("regression", help="fixed clip set, before/after deltas")
    reg_p.add_argument("--clips", type=int, default=10)
    reg_p.add_argument("--variants", type=int, default=1)
    reg_p.add_argument("--update-baseline", action="store_true")
    reg_p.add_argument("--mock", action="store_true")
    reg_p.add_argument("--live", action="store_true")
    reg_p.set_defaults(func=cmd_regression)

    export_p = sub.add_parser("export", help="write JSONL for fine-tuning / RL")
    export_p.add_argument("--out", default=str(engine_config.settings().data_dir / "dataset.jsonl"))
    export_p.set_defaults(func=cmd_export)

    fb_p = sub.add_parser("feedback", help="record real feedback against an EDL")
    fb_p.add_argument("--edl-id", type=int, required=True)
    fb_p.add_argument("--kind", required=True, choices=["like", "download", "dislike", "metric"])
    fb_p.add_argument("--reason", default="")
    fb_p.add_argument("--value", type=float, default=None)
    fb_p.add_argument("--source", default="user")
    fb_p.set_defaults(func=cmd_feedback)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
