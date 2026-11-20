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
from .s8_zoom import (
    validate_impact_words,
    detect_loudness_peaks,
    plan_zoom_events,
    compute_frame_zoom_scale,
    apply_zoom_to_crop,
)
from .s9_render import render_video
from .s10_qa import generate_qa_report


def run_pipeline(
    clip_path: str | Path,
    output_path: str | Path,
    workdir: str | Path,
    config_path: str | Path | None = None,
    words_path: str | Path | None = None,
    impact_path: str | Path | None = None,
    debug_overlay: bool = False,
    subtitles_path: str | Path | None = None,
) -> Dict[str, Any]:
    """Execute the framing pipeline end-to-end writing artifacts to workdir."""
    config = load_config(config_path)
    workdir = Path(workdir).resolve()
    workdir.mkdir(parents=True, exist_ok=True)

    # ── Stage 1: Normalize
    norm_result = normalize_media(clip_path, workdir, config)
    norm_video = norm_result["normalized_video_path"]
    audio_path = norm_result["audio_wav_path"]
    fps = norm_result["fps"]
    duration_s = norm_result["duration_s"]
    total_frames = norm_result.get("frame_count") or int(round(duration_s * fps))
    src_w = norm_result["width"]
    src_h = norm_result["height"]

    # Rebase optional words.json if provided
    words_rebased = []
    if words_path and Path(words_path).exists():
        with open(words_path, "r", encoding="utf-8") as f:
            raw_words = json.load(f)
        words_rebased = rebase_timestamps(raw_words, norm_result.get("clip_start_s", 0.0))
        with open(workdir / "words.json", "w", encoding="utf-8") as f:
            json.dump(words_rebased, f, indent=2)

    # ── Stage 2: Shot Detection
    shots_res = detect_shots(norm_video, workdir, config)
    shots = shots_res if isinstance(shots_res, list) else shots_res.get("shots", [])

    # ── Stage 3: Face Detection & Tracking
    faces_res = detect_and_track_faces(norm_video, shots, workdir, config)
    tracks = faces_res if isinstance(faces_res, list) else faces_res.get("tracks", [])

    # ── Stage 4: Speech & Diarization
    speech_data = attribute_speech_pipeline(
        wav_path=audio_path,
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
    # Aggregate samples by panel label across all track chunks
    p1_samples = sorted(
        [s for t in tracks if t.get("panel_label") == "P1" for s in t.get("samples", [])],
        key=lambda s: s["t"]
    )
    p2_samples = sorted(
        [s for t in tracks if t.get("panel_label") == "P2" for s in t.get("samples", [])],
        key=lambda s: s["t"]
    )

    # Fallback to raw tracks[0] / tracks[1] if panel_label was not set
    if not p1_samples and len(tracks) > 0:
        p1_samples = tracks[0].get("samples", [])
    if not p2_samples and len(tracks) > 1:
        p2_samples = tracks[1].get("samples", [])

    single_p1_plan = plan_camera_single_shot(p1_samples, 0, total_frames, fps, src_w, src_h, config) if p1_samples else []
    single_p2_plan = plan_camera_single_shot(p2_samples, 0, total_frames, fps, src_w, src_h, config) if p2_samples else []
    
    # STACK is only possible if both P1 and P2 exist AND represent distinct subjects
    has_two_distinct_subjects = bool(p1_samples and p2_samples and any(seg.get("state") == "STACK" for seg in layout_segments))
    stack_plan = plan_camera_stack_shot(p1_samples, p2_samples, 0, total_frames, fps, src_w, src_h, config) if has_two_distinct_subjects else []

    # ── Stage 8: Zoom Planner
    impact_candidates = []
    if impact_path and Path(impact_path).exists():
        with open(impact_path, "r", encoding="utf-8") as f:
            impact_candidates.extend(json.load(f))
    elif (workdir / "impact.json").exists():
        with open(workdir / "impact.json", "r", encoding="utf-8") as f:
            try:
                impact_candidates.extend(json.load(f))
            except Exception:
                pass

    zoom_cfg = config.get("zoom", {})
    if words_rebased and zoom_cfg.get("validate_impact_words", True):
        impact_candidates = validate_impact_words(impact_candidates, words_rebased)

    use_loudness = zoom_cfg.get("loudness_peaks", True)
    if use_loudness and (not impact_candidates or zoom_cfg.get("mode") == "both"):
        if audio_path and Path(audio_path).exists():
            loudness_candidates = detect_loudness_peaks(
                audio_path,
                min_separation_s=float(zoom_cfg.get("min_spacing_s", 4.0)),
            )
            impact_candidates.extend(loudness_candidates)

    layout_switches = [seg["t_start"] for seg in layout_segments[1:]]
    zoom_events = plan_zoom_events(
        candidate_words=impact_candidates,
        layout_switches=layout_switches,
        clip_duration_s=duration_s,
        config=config,
    )

    with open(workdir / "zoom_events.json", "w", encoding="utf-8") as f:
        json.dump(zoom_events, f, indent=2)

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

            # Stage 8: Punch-in zoom on impact
            zoom_scale = compute_frame_zoom_scale(t, zoom_events)
            if zoom_scale > 1.0001:
                crop, zoom_unsafe = apply_zoom_to_crop(
                    crop=crop,
                    zoom_scale=zoom_scale,
                    face_box=faces[0] if faces else None,
                    src_w=src_w,
                    src_h=src_h,
                    safe_margin_frac=float(config.get("camera", {}).get("safe_margin_frac", 0.05)),
                )
                is_unsafe = is_unsafe or zoom_unsafe

            plan_frames.append({
                "frame_idx": f_idx,
                "t": round(t, 4),
                "state": "SINGLE",
                "crop": crop,
                "speaker": active_speaker,
                "is_unsafe": is_unsafe,
                "faces": faces,
                "zoom_scale": round(zoom_scale, 4),
            })
        elif state == "STACK" and stack_plan:
            item = stack_plan[f_idx] if f_idx < len(stack_plan) else None
            fallback_track = item.get("single_fallback") if item else None
            if fallback_track:
                # One person is offscreen: fallback seamlessly to SINGLE of the visible person
                chosen_single = single_p2_plan if (fallback_track == "P2" and single_p2_plan) else single_p1_plan
                s_item = chosen_single[f_idx] if f_idx < len(chosen_single) else None
                crop = s_item["crop"] if s_item else [0, 0, src_w, src_h]
                is_unsafe = s_item["is_unsafe"] if s_item else False
                faces = [s_item["face_box"]] if (s_item and s_item.get("face_box")) else []
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
            else:
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
            "zoom_events": zoom_events,
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
        subtitle_path=subtitles_path,
    )

    # ── Stage 10: Generate QA Report (Metrics M1-M10, Status pass/review/fail)
    qa_artifact = generate_qa_report(
        plan_frames=plan_frames,
        layout_segments=layout_segments,
        zoom_events=zoom_events,
        tracks=tracks,
        duration_s=duration_s,
        fps=fps,
        total_source_frames=total_frames,
        frames_rendered=render_result["frames_rendered"],
        render_time_s=render_result.get("render_time_s", 1.0),
        workdir=workdir,
        config=config,
    )

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
