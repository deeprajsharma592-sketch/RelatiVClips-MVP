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
import re
from dataclasses import asdict
from pathlib import Path
from typing import Any, Dict

from .config import load_config
from .s1_normalize import normalize_media, rebase_timestamps
from .s2_shots import detect_shots
from .s3_faces import detect_and_track_faces
from .s4_speech import attribute_speech_pipeline
from .s5_turns import compute_turns
from .s6_layout import generate_layout_artifact
from .s7_camera import plan_camera_context_shot, plan_camera_single_shot, plan_camera_stack_shot
from .layout_policy import analyze_visual_context, choose_layout
from .s8_zoom import (
    validate_impact_words,
    detect_loudness_peaks,
    plan_zoom_events,
    compute_frame_zoom_scale,
    apply_zoom_to_crop,
)
from .s9_render import context_scene_panel_height, render_video
from .s10_qa import generate_qa_report


def _face_to_output(face, crop, out_w, out_h, y_offset=0):
    """Map a source [x,y,w,h] face through the exact final crop."""
    if not face or not crop:
        return None
    if isinstance(face, dict):
        fx = float(face.get("x") or face.get("x1") or 0)
        fy = float(face.get("y") or face.get("y1") or 0)
        fw = float(face.get("w") or 0)
        fh = float(face.get("h") or 0)
    elif len(face) >= 4:
        fx, fy, fw, fh = map(float, face[:4])
    else:
        return None

    if isinstance(crop, dict):
        cx = float(crop.get("x1") or crop.get("x") or 0)
        cy = float(crop.get("y1") or crop.get("y") or 0)
        cw = float(crop.get("w") or 0)
        ch = float(crop.get("h") or 0)
    elif len(crop) >= 4:
        cx, cy, cw, ch = map(float, crop[:4])
    else:
        return None

    if cw <= 0 or ch <= 0:
        return None

    pad_x, pad_y = fw * 0.12, fh * 0.12
    x1 = (fx - pad_x - cx) * out_w / max(1.0, cw)
    y1 = (fy - pad_y - cy) * out_h / max(1.0, ch) + y_offset
    x2 = (fx + fw + pad_x - cx) * out_w / max(1.0, cw)
    y2 = (fy + fh + pad_y - cy) * out_h / max(1.0, ch) + y_offset
    return [round(max(0.0, x1), 1), round(max(y_offset, y1), 1), round(min(out_w, x2), 1), round(min(y_offset + out_h, y2), 1)]


def _build_subject_track(plan_frames, fps, out_w, out_h, scene_h):
    """Extract a cached 5fps face track in final 1080x1920 coordinates."""
    step = max(1, int(round(fps / 5.0)))
    track = []
    for item in plan_frames[::step]:
        faces = item.get("faces") or []
        box = None
        if faces:
            if item.get("state") == "CONTEXT_STACK":
                tracked_h = out_h - scene_h
                offset = scene_h if item.get("context_position") == "top" else 0
                box = _face_to_output(faces[0], item.get("crop"), out_w, tracked_h, offset)
            elif item.get("state") == "SINGLE":
                box = _face_to_output(faces[0], item.get("crop"), out_w, out_h)
            elif item.get("state") == "STACK" and item.get("panels"):
                panel = item["panels"][0]
                box = _face_to_output(panel.get("face_box"), panel.get("crop"), out_w, out_h / 2, 0)
        if box:
            track.append({"t": round(float(item.get("t", 0)), 3), "face_box": box, "person_box": None})
    return track


def _subject_safe_subtitle(subtitle_path, workdir, subject_track):
    if not subtitle_path or not Path(subtitle_path).exists() or not subject_track:
        return subtitle_path, []
    source = Path(subtitle_path)
    lines = source.read_text(encoding="utf-8", errors="replace").splitlines()
    indexed, groups, current, visible = [], [], [], None
    def seconds(value):
        h, m, rest = value.split(":"); s, cs = rest.split(".")
        return int(h) * 3600 + int(m) * 60 + int(s) + int(cs) / 100
    for index, line in enumerate(lines):
        if not line.startswith("Dialogue:"):
            continue
        fields = line.split(",", 9)
        if len(fields) != 10:
            continue
        plain = re.sub(r"\{[^}]*\}", "", fields[9]).replace(r"\N", " ").strip()
        if current and plain != visible:
            groups.append(current); current = []
        visible = plain; current.append((index, fields, seconds(fields[1]), seconds(fields[2])))
    if current: groups.append(current)
    placement_groups = [{"start": g[0][2], "end": g[-1][3], "block_size": (860, 230)} for g in groups]
    from backend.captioning.placement import choose_layout
    layout = choose_layout(placement_groups, subject_track, "impact")
    for group, position in zip(groups, layout):
        for index, fields, _, _ in group:
            fields[9] = re.sub(r"\\pos\([^)]*\)", rf"\\pos({int(position['x'])},{int(position['y'])})", fields[9])
            lines[index] = ",".join(fields)
    adjusted = workdir / "captions_subject_safe.ass"
    adjusted.write_text("\n".join(lines) + "\n", encoding="utf-8")
    (workdir / "subject_track.json").write_text(json.dumps(subject_track, indent=2), encoding="utf-8")
    return adjusted, layout


def _caption_safe_subtitle(
    subtitle_path: str | Path | None,
    workdir: Path,
    layout_mode: str,
    context_position: str,
    seam_y: int | None = None,
) -> str | Path | None:
    """Pin captions to the seam between scene and tracked panels."""
    if layout_mode != "context" or not subtitle_path or not Path(subtitle_path).exists():
        return subtitle_path
    source = Path(subtitle_path)
    text = source.read_text(encoding="utf-8", errors="replace")
    style_lines = []
    for line in text.splitlines():
        if line.startswith("Style: Default,"):
            prefix, payload = line.split(": ", 1)
            fields = payload.split(",")
            if len(fields) >= 23:
                fields[18] = "5"
                fields[21] = "0"
                line = f"{prefix}: {','.join(fields)}"
        elif line.startswith("Dialogue:") and seam_y is not None:
            prefix, payload = line.split(":", 1)
            fields = payload.lstrip().split(",", 9)
            if len(fields) == 10:
                fields[9] = rf"{{\an5\pos(540,{int(seam_y)})}}" + fields[9]
                line = f"{prefix}: {','.join(fields)}"
        style_lines.append(line)
    adjusted = workdir / "captions_context_safe.ass"
    adjusted.write_text("\n".join(style_lines) + "\n", encoding="utf-8")
    return adjusted


def run_pipeline(
    clip_path: str | Path,
    output_path: str | Path,
    workdir: str | Path,
    config_path: str | Path | None = None,
    words_path: str | Path | None = None,
    impact_path: str | Path | None = None,
    debug_overlay: bool = False,
    subtitles_path: str | Path | None = None,
    layout_mode: str = "auto",
    context_position: str = "top",
    content_hint: str | None = None,
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

    context_signals = analyze_visual_context(norm_video, tracks)
    layout_decision = choose_layout(
        requested_mode=layout_mode,
        context_position=context_position,
        content_hint=content_hint,
        signals=context_signals,
    )

    single_p1_plan = plan_camera_single_shot(p1_samples, 0, total_frames, fps, src_w, src_h, config) if p1_samples else []
    single_p2_plan = plan_camera_single_shot(p2_samples, 0, total_frames, fps, src_w, src_h, config) if p2_samples else []
    context_plan = plan_camera_context_shot(p1_samples, 0, total_frames, fps, src_w, src_h, config) if p1_samples else []
    
    # STACK is possible if both P1 and P2 exist AND either layout_decision is conversation OR a layout segment called for STACK
    has_two_distinct_subjects = bool(p1_samples and p2_samples and (layout_decision.mode == "conversation" or any(seg.get("state") == "STACK" for seg in layout_segments)))
    stack_plan = plan_camera_stack_shot(
        p1_samples,
        p2_samples,
        0,
        total_frames,
        fps,
        src_w,
        src_h,
        config,
        allow_single_fallback=(layout_decision.mode != "conversation"),
    ) if has_two_distinct_subjects else []

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

        if layout_decision.mode == "fit":
            state = "FIT_BLUR"
        elif layout_decision.mode == "context" and context_plan:
            # Gameplay, motion graphics, and screen-context clips keep the tracked face
            # stacked with the scene panel continuously without flashing FIT_BLUR or STACK.
            state = "CONTEXT_STACK"
        elif layout_decision.mode == "conversation" and stack_plan:
            # Podcast/interview clips keep both participants visible. Speaker
            # detection still drives emphasis, but does not hide the listener.
            state = "STACK"
        elif layout_decision.mode == "portrait" and state == "FIT_BLUR" and (single_p1_plan or single_p2_plan):
            # Avoid flashing full-frame FIT_BLUR mid-clip on brief face-track gaps
            state = "SINGLE"

        if state == "CONTEXT_STACK" and context_plan:
            item = context_plan[f_idx] if f_idx < len(context_plan) else None
            crop = item["crop"] if item else [0, 0, src_w, src_h]
            plan_frames.append({
                "frame_idx": f_idx,
                "t": round(t, 4),
                "state": "CONTEXT_STACK",
                "crop": crop,
                "context_position": layout_decision.context_position,
                "speaker": active_speaker,
                "is_unsafe": item["is_unsafe"] if item else False,
                "faces": [item["face_box"]] if (item and item.get("face_box")) else [],
                "zoom_scale": 1.0,
            })
        elif state == "SINGLE":
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
            "layout_decision": asdict(layout_decision),
            "zoom_events": zoom_events,
            "config_hash": config.get("_meta", {}).get("config_hash"),
            "versions": config.get("_meta", {}).get("versions"),
        }, f, indent=2)

    # ── Stage 9: Render Output
    output_cfg = config.get("output", {})
    output_w = int(output_cfg.get("width", 1080))
    output_h = int(output_cfg.get("height", 1920))
    scene_h = context_scene_panel_height(src_w, src_h, output_w, output_h)
    subject_track = _build_subject_track(plan_frames, fps, output_w, output_h, scene_h)
    subject_safe_subtitles, caption_layout = _subject_safe_subtitle(subtitles_path, workdir, subject_track)
    seam_y = scene_h if layout_decision.context_position == "top" else output_h - scene_h
    render_subtitles = _caption_safe_subtitle(
        subject_safe_subtitles,
        workdir,
        layout_decision.mode,
        layout_decision.context_position,
        seam_y,
    )
    render_result = render_video(
        norm_video_path=norm_video,
        plan_frames=plan_frames,
        output_path=output_path,
        config=config,
        debug_overlay=debug_overlay,
        subtitle_path=render_subtitles,
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

    qa_artifact["layout_decision"] = asdict(layout_decision)
    qa_artifact["subject_track"] = subject_track
    qa_artifact["caption_layout"] = caption_layout
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
    parser.add_argument("--layout-mode", choices=["auto", "portrait", "context", "conversation", "fit"], default="auto")
    parser.add_argument("--context-position", choices=["top", "bottom"], default="top")
    parser.add_argument("--content-hint", default=None)

    args = parser.parse_args()
    run_pipeline(
        clip_path=args.clip,
        output_path=args.out,
        workdir=args.workdir,
        config_path=args.config,
        words_path=args.words,
        impact_path=args.impact,
        debug_overlay=args.debug_overlay,
        layout_mode=args.layout_mode,
        context_position=args.context_position,
        content_hint=args.content_hint,
    )


if __name__ == "__main__":
    main()
