"""
RelatiV Dynamic Framing — CLI Orchestration Entrypoint (spec-0.1).
Usage:
  python -m framing.run --clip clip.mp4 --workdir ./work --out out.mp4 [--words words.json] [--impact impact.json] [--debug-overlay]
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict

from .config import load_config
from .s1_normalize import normalize_media, rebase_timestamps
from .s9_render import render_video


def run_pipeline(
    clip_path: str | Path,
    output_path: str | Path,
    workdir: str | Path,
    config_path: str | Path | None = None,
    words_path: str | Path | None = None,
    impact_path: str | Path | None = None,
    debug_overlay: bool = False,
) -> Dict[str, Any]:
    """Execute the framing pipeline end-to-end writing artifacts to workdir."""
    config = load_config(config_path)
    workdir = Path(workdir).resolve()
    workdir.mkdir(parents=True, exist_ok=True)

    # Load and rebase words.json if provided
    words = []
    if words_path and Path(words_path).exists():
        with open(words_path, "r", encoding="utf-8") as f:
            words = json.load(f)

    # Load and rebase impact.json if provided
    impact = []
    if impact_path and Path(impact_path).exists():
        with open(impact_path, "r", encoding="utf-8") as f:
            impact = json.load(f)

    # ── Stage 1: Normalize
    norm_result = normalize_media(clip_path, workdir, config)
    norm_video = norm_result["normalized_video_path"]
    duration_s = norm_result["duration_s"]
    fps = norm_result["fps"]
    total_frames = int(round(duration_s * fps))

    # Rebase words and impact timestamps to 0.0 clip start (Rule 3, U12)
    words_rebased = rebase_timestamps(words, clip_start_s=0.0, clip_duration_s=duration_s)
    impact_rebased = rebase_timestamps(impact, clip_start_s=0.0, clip_duration_s=duration_s)

    with open(workdir / "words_rebased.json", "w", encoding="utf-8") as f:
        json.dump(words_rebased, f, indent=2)
    with open(workdir / "impact_rebased.json", "w", encoding="utf-8") as f:
        json.dump(impact_rebased, f, indent=2)

    # ── For Phase 0 (Scaffolding / Static Crop / Fallback):
    # Generates plan.json fallback frames (FIT_BLUR or center crop)
    plan_frames = []
    for f_idx in range(total_frames):
        plan_frames.append({
            "frame_idx": f_idx,
            "t": f_idx / fps,
            "state": "FIT_BLUR",
            "speaker": "unknown",
            "zoom_scale": 1.0,
        })

    plan_json_path = workdir / "plan.json"
    with open(plan_json_path, "w", encoding="utf-8") as f:
        json.dump({
            "frames": plan_frames,
            "config_hash": config.get("_meta", {}).get("config_hash"),
            "versions": config.get("_meta", {}).get("versions"),
        }, f, indent=2)

    # ── Stage 9: Render Output
    render_result = render_video(
        norm_video_path=norm_video,
        plan_frames=plan_frames,
        output_path=output_path,
        config=config,
        debug_overlay=debug_overlay,
    )

    # ── Stage 10: Generate QA Report
    qa_artifact = {
        "status": "pass",
        "clip_duration_s": duration_s,
        "frames_rendered": render_result["frames_rendered"],
        "total_source_frames": total_frames,
        "fallback_frames": total_frames,
        "fallback_pct": 100.0,
        "config_hash": config.get("_meta", {}).get("config_hash"),
        "versions": config.get("_meta", {}).get("versions"),
    }
    with open(workdir / "qa.json", "w", encoding="utf-8") as f:
        json.dump(qa_artifact, f, indent=2)

    return qa_artifact


def main():
    parser = argparse.ArgumentParser(description="RelatiV Dynamic Framing (spec-0.1)")
    parser.add_argument("--clip", required=True, help="Input video clip path")
    parser.add_argument("--out", required=True, help="Output 1080x1920 MP4 path")
    parser.add_argument("--workdir", default="./work", help="Working directory for artifacts")
    parser.add_argument("--config", default=None, help="Path to config.yaml")
    parser.add_argument("--words", default=None, help="Path to words.json")
    parser.add_argument("--impact", default=None, help="Path to impact.json")
    parser.add_argument("--debug-overlay", action="store_true", help="Draw debug HUD, faces, and crop rects")

    args = parser.parse_args()
    run_pipeline(
        clip_path=args.clip,
        output_path=args.out,
        workdir=args.workdir,
        config_path=args.config,
        words_path=args.words,
        impact_path=args.impact,
        debug_overlay=args.debug_overlay,
    )


if __name__ == "__main__":
    main()
