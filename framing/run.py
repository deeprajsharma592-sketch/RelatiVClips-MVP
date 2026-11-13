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
from .s2_shots import detect_shots
from .s3_faces import detect_and_track_faces
from .s4_speech import attribute_speech_pipeline
from .s5_turns import compute_turns
from .s6_layout import generate_layout_artifact
from .s7_camera import plan_camera_single_shot, plan_camera_stack_shot
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
    src_w = norm_result["width"]
    src_h = norm_result["height"]
    total_frames = int(round(duration_s * fps))

    # Rebase words and impact timestamps to 0.0 clip start (Rule 3, U12)
    words_rebased = rebase_timestamps(words, clip_start_s=0.0, clip_duration_s=duration_s)
    impact_rebased = rebase_timestamps(impact, clip_start_s=0.0, clip_duration_s=duration_s)

    with open(workdir / "words_rebased.json", "w", encoding="utf-8") as f:
        json.dump(words_rebased, f, indent=2)
    with open(workdir / "impact_rebased.json", "w", encoding="utf-8") as f:
        json.dump(impact_rebased, f, indent=2)

    # ── Stage 2: Shots
    shots = detect_shots(Path(norm_video), workdir, config)

    # ── Stage 3: Faces & Tracks
    tracks = detect_and_track_faces(Path(norm_video), shots, workdir, config)

    # ── Stage 4: Speech & Speaker Attribution
    speech_data = attribute_speech_pipeline(
        wav_path=Path(norm_result["audio_wav_path"]) if norm_result.get("has_audio") else None,
        tracks_data=tracks,
        total_frames=total_frames,
        fps=fps,
        workdir=workdir,
        config=config,
    )

    # ── Stage 5: Turns
    turns_data = compute_turns(
        speech_intervals=speech_data.get("intervals", []),
        workdir=workdir,
        config=config,
    )

    # ── Stage 6: Layout Planner
    layout_segments = generate_layout_artifact(
        turns=turns_data,
        shots=shots,
        tracks=tracks,
        words=words_rebased,
        workdir=workdir,
        config=config,
    )

    # ── Stage 7: Camera Paths
    p1_samples = tracks[0]["samples"] if len(tracks) > 0 else []
    p2_samples = tracks[1]["samples"] if len(tracks) > 1 else []

    single_p1_plan = plan_camera_single_shot(p1_samples, 0, total_frames, fps, src_w, src_h, config) if p1_samples else []
    single_p2_plan = plan_camera_single_shot(p2_samples, 0, total_frames, fps, src_w, src_h, config) if p2_samples else []
    stack_plan = plan_camera_stack_shot(p1_samples, p2_samples, 0, total_frames, fps, src_w, src_h, config) if (p1_samples and p2_samples) else []

    plan_frames = []
    for f_idx in range(total_frames):
        t = f_idx / fps
        seg = next((s for s in layout_segments if s["t_start"] <= t <= s["t_end"]), None)
        state = seg["state"] if seg else "FIT_BLUR"
        active_speaker = speech_data["frames"][f_idx]["speaker"] if f_idx < len(speech_data.get("frames", [])) else "unknown"

        if state == "SINGLE":
            track_label = seg.get("track", "P1")
            chosen_single = single_p2_plan if (track_label == "P2" and single_p2_plan) else single_p1_plan
            item = chosen_single[f_idx] if f_idx < len(chosen_single) else None
            crop = item["crop"] if item else [0, 0, src_w, src_h]
            is_unsafe = item["is_unsafe"] if item else False
            faces = [item["face_box"]] if (item and item.get("face_box")) else []
            plan_frames.append({
                "frame_idx": f_idx,
                "t": round(t, 4),
                "state": "SINGLE",
                "crop": crop,
                "speaker": active_speaker,
                "is_unsafe": is_unsafe,
                "faces": faces,
                "zoom_scale": 1.0,
            })
        elif state == "STACK" and stack_plan:
            item = stack_plan[f_idx] if f_idx < len(stack_plan) else None
            panels = item["panels"] if item else []
            is_unsafe = item["is_unsafe"] if item else False
            plan_frames.append({
                "frame_idx": f_idx,
                "t": round(t, 4),
                "state": "STACK",
                "panels": panels,
                "speaker": active_speaker,
                "is_unsafe": is_unsafe,
                "faces": [p["face_box"] for p in panels if p.get("face_box")],
                "zoom_scale": 1.0,
            })
        else:
            plan_frames.append({
                "frame_idx": f_idx,
                "t": round(t, 4),
                "state": "FIT_BLUR",
                "speaker": active_speaker,
                "faces": [],
                "is_unsafe": False,
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

    # ── Stage 10: Generate QA Report (Metrics M3, M4, M5)
    fallback_count = sum(1 for p in plan_frames if p.get("state") == "FIT_BLUR")
    unsafe_count = sum(1 for p in plan_frames if p.get("is_unsafe", False))
    fallback_pct = (fallback_count / max(1, total_frames)) * 100.0

    # Metric M4: switches per minute
    num_switches = max(0, len(layout_segments) - 1)
    switches_per_min = (num_switches / max(1.0, duration_s)) * 60.0

    # Metric M5: states shorter than min hold (excluding shot boundaries)
    min_hold_s = float(config.get("layout", {}).get("min_hold_s", 2.0))
    short_states = sum(1 for s in layout_segments[:-1] if (s["t_end"] - s["t_start"]) < min_hold_s - 1e-3)

    qa_artifact = {
        "status": "pass" if fallback_pct < 40.0 and short_states == 0 else "review",
        "clip_duration_s": duration_s,
        "frames_rendered": render_result["frames_rendered"],
        "total_source_frames": total_frames,
        "fallback_frames": fallback_count,
        "fallback_pct": round(fallback_pct, 2),
        "unsafe_frames": unsafe_count,
        "layout_switches": num_switches,
        "switches_per_minute": round(switches_per_min, 2),
        "short_state_violations": short_states,
        "config_hash": config.get("_meta", {}).get("config_hash"),
        "versions": config.get("_meta", {}).get("versions"),
    }
    with open(workdir / "qa.json", "w", encoding="utf-8") as f:
        json.dump(qa_artifact, f, indent=2)

    return qa_artifact

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
