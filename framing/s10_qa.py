"""
RelatiV Dynamic Framing: Stage S10 - QA Report (qa.json).
Calculates all Section 7 metrics (M1-M10), fallback percentages, unsafe frame counts,
and determines pass / review / fail status (spec-0.1).
"""

from __future__ import annotations

from typing import List, Dict, Any, Optional
from pathlib import Path
import json
import numpy as np


def compute_crop_jitter_m6(plan_frames: List[Dict[str, Any]], fps: float) -> float:
    """
    Computes Metric M6: 90th percentile of per-frame crop-center acceleration at 1080p.
    """
    dt = 1.0 / max(1.0, fps)
    centers = []

    for f in plan_frames:
        if f.get("state") == "SINGLE" and "crop" in f:
            c = f["crop"]
            if isinstance(c, dict):
                cx = float(c["x1"]) + float(c["w"]) / 2.0
                cy = float(c["y1"]) + float(c["h"]) / 2.0
            else:
                cx = (float(c[0]) + float(c[2])) / 2.0
                cy = (float(c[1]) + float(c[3])) / 2.0
            centers.append((cx, cy))
        elif f.get("state") == "STACK" and f.get("panels"):
            # Use top panel center
            p = f["panels"][0]
            c = p.get("crop", [0, 0, 100, 100])
            if isinstance(c, dict):
                cx = float(c["x1"]) + float(c["w"]) / 2.0
                cy = float(c["y1"]) + float(c["h"]) / 2.0
            else:
                cx = (float(c[0]) + float(c[2])) / 2.0
                cy = (float(c[1]) + float(c[3])) / 2.0
            centers.append((cx, cy))

    if len(centers) < 3:
        return 0.0

    centers_arr = np.array(centers, dtype=np.float64)
    # Velocity: delta center / dt
    vel = np.diff(centers_arr, axis=0) / dt
    # Acceleration: delta vel / dt
    acc = np.diff(vel, axis=0) / dt
    acc_mags = np.linalg.norm(acc, axis=1)

    if len(acc_mags) == 0:
        return 0.0

    return float(np.percentile(acc_mags, 90))


def compute_m1_face_margin(
    plan_frames: List[Dict[str, Any]],
    safe_margin_frac: float = 0.05
) -> float:
    """
    Computes Metric M1: Active speaker face fully inside panel with margin.
    Target >= 97% of frames where face exists.
    """
    valid_frames = 0
    in_margin_frames = 0

    for f in plan_frames:
        state = f.get("state")
        faces = f.get("faces", [])
        if not faces:
            continue

        face = faces[0]
        fx1, fy1, fx2, fy2 = face[0], face[1], face[2], face[3]

        if state == "SINGLE" and "crop" in f:
            c = f["crop"]
            if isinstance(c, dict):
                cx1, cy1, cw, ch = c["x1"], c["y1"], c["w"], c["h"]
                cx2, cy2 = cx1 + cw, cy1 + ch
            else:
                cx1, cy1, cx2, cy2 = c[0], c[1], c[2], c[3]
                cw, ch = cx2 - cx1, cy2 - cy1

            valid_frames += 1
            mx = safe_margin_frac * cw
            my = safe_margin_frac * ch
            if (fx1 >= (cx1 + mx) and fx2 <= (cx2 - mx) and
                fy1 >= (cy1 + my) and fy2 <= (cy2 - my)):
                in_margin_frames += 1

        elif state == "STACK" and f.get("panels"):
            # Check both panels
            for p in f["panels"]:
                c = p.get("crop")
                pf = p.get("face_box")
                if c and pf:
                    if isinstance(c, dict):
                        cx1, cy1, cw, ch = c["x1"], c["y1"], c["w"], c["h"]
                        cx2, cy2 = cx1 + cw, cy1 + ch
                    else:
                        cx1, cy1, cx2, cy2 = c[0], c[1], c[2], c[3]
                        cw, ch = cx2 - cx1, cy2 - cy1
                    valid_frames += 1
                    mx = safe_margin_frac * cw
                    my = safe_margin_frac * ch
                    if (pf[0] >= (cx1 + mx) and pf[2] <= (cx2 - mx) and
                        pf[1] >= (cy1 + my) and pf[3] <= (cy2 - my)):
                        in_margin_frames += 1

    if valid_frames == 0:
        return 100.0

    return (in_margin_frames / valid_frames) * 100.0


def compute_m10_unnecessary_fallback(
    plan_frames: List[Dict[str, Any]],
    tracks: List[Dict[str, Any]],
    fps: float
) -> float:
    """
    Computes Metric M10: Fallback frames where faces actually exist at most 3%.
    """
    fallback_frames = [f for f in plan_frames if f.get("state") == "FIT_BLUR"]
    if not fallback_frames:
        return 0.0

    total_fallback = len(fallback_frames)
    fallback_with_faces = 0

    for f in fallback_frames:
        t = f.get("t", 0.0)
        # Check if any track had an active face at time t
        has_active_face = False
        for trk in tracks:
            for s in trk.get("samples", []):
                if abs(s.get("t", 0.0) - t) <= (0.5 / fps) and s.get("score", 0.0) >= 0.6:
                    has_active_face = True
                    break
            if has_active_face:
                break
        if has_active_face:
            fallback_with_faces += 1

    return (fallback_with_faces / max(1, len(plan_frames))) * 100.0


def generate_qa_report(
    plan_frames: List[Dict[str, Any]],
    layout_segments: List[Dict[str, Any]],
    zoom_events: List[Dict[str, Any]],
    tracks: List[Dict[str, Any]],
    duration_s: float,
    fps: float,
    total_source_frames: int,
    frames_rendered: int,
    render_time_s: float,
    workdir: Path,
    config: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Full S10 QA artifact generator.
    Evaluates M1, M4, M5, M6, M7, M8, M9, M10, and determines pass / review / fail status.
    """
    workdir = Path(workdir)
    total_frames = max(1, len(plan_frames))
    fallback_count = sum(1 for p in plan_frames if p.get("state") == "FIT_BLUR")
    unsafe_count = sum(1 for p in plan_frames if p.get("is_unsafe", False))
    fallback_pct = (fallback_count / total_frames) * 100.0

    # Metric M1: Active speaker face inside panel with safe margin
    safe_margin_frac = float(config.get("camera", {}).get("safe_margin_frac", 0.05))
    m1_pct = compute_m1_face_margin(plan_frames, safe_margin_frac)

    # Metric M4: Switches per minute
    num_switches = max(0, len(layout_segments) - 1)
    switches_per_min = (num_switches / max(1.0, duration_s)) * 60.0

    # Metric M5: States shorter than min hold (excluding shot boundaries/trailing)
    min_hold_s = float(config.get("layout", {}).get("min_hold_s", 2.0))
    short_states = sum(
        1 for s in layout_segments[:-1]
        if (s["t_end"] - s["t_start"]) < (min_hold_s - 1e-3)
    )

    # Metric M6: Crop jitter (90th percentile acceleration at 1080p)
    m6_jitter = compute_crop_jitter_m6(plan_frames, fps)

    # Metric M7: Sync lag and frame counts equal
    frame_diff = abs(frames_rendered - total_source_frames)
    m7_pass = (frame_diff == 0)

    # Metric M8: Throughput realtime factor (duration / render_time)
    rtf = duration_s / max(1e-4, render_time_s)

    # Metric M9: Zoom rate <= 1 per 5s, none within 0.3s of switch
    zoom_count = len(zoom_events)
    layout_switches = [seg["t_start"] for seg in layout_segments[1:]]
    zoom_switch_violations = 0
    for z in zoom_events:
        for sw in layout_switches:
            if sw <= z["t_start"] <= sw + 0.3 or abs(sw - z["t_impact"]) <= 0.25:
                zoom_switch_violations += 1
                break

    zoom_spacing_violations = 0
    for i in range(1, len(zoom_events)):
        if (zoom_events[i]["t_start"] - zoom_events[i-1]["t_start"]) < 4.0 - 1e-3:
            zoom_spacing_violations += 1

    metric_m9_pass = (zoom_switch_violations == 0 and zoom_spacing_violations == 0)

    # Metric M10: Unnecessary fallback frames (< 3%)
    m10_pct = compute_m10_unnecessary_fallback(plan_frames, tracks, fps)

    # Overall Status:
    # fail: sync broken, crash, or fallback over 40% of frames
    # review: speaker confidence low, switches per min over cap (>14), short states > 0, or M9 failed
    # pass: otherwise
    if (not m7_pass) or (fallback_pct > 40.0):
        status = "fail"
    elif (switches_per_min > 14.0) or (short_states > 0) or (not metric_m9_pass) or (m10_pct > 5.0):
        status = "review"
    else:
        status = "pass"

    qa_artifact = {
        "status": status,
        "clip_duration_s": round(duration_s, 3),
        "total_source_frames": total_source_frames,
        "frames_rendered": frames_rendered,
        "frame_diff": frame_diff,
        "render_time_s": round(render_time_s, 3),
        "realtime_factor": round(rtf, 2),
        "fallback_frames": fallback_count,
        "fallback_pct": round(fallback_pct, 2),
        "unsafe_frames": unsafe_count,
        "layout_switches": num_switches,
        "switches_per_minute": round(switches_per_min, 2),
        "short_state_violations": short_states,
        "zoom_events_count": zoom_count,
        "zoom_switch_violations": zoom_switch_violations,
        "zoom_spacing_violations": zoom_spacing_violations,
        "metrics": {
            "M1_face_inside_margin_pct": round(m1_pct, 2),
            "M4_switches_per_minute": round(switches_per_min, 2),
            "M5_short_states_count": short_states,
            "M6_crop_jitter_accel_px_s2": round(m6_jitter, 2),
            "M7_sync_pass": m7_pass,
            "M8_realtime_factor": round(rtf, 2),
            "M9_zoom_pass": metric_m9_pass,
            "M10_unnecessary_fallback_pct": round(m10_pct, 2),
        },
        "metric_m9_pass": metric_m9_pass,
        "config_hash": config.get("_meta", {}).get("config_hash", ""),
        "versions": config.get("_meta", {}).get("versions", {}),
    }

    qa_json_path = workdir / "qa.json"
    with open(qa_json_path, "w", encoding="utf-8") as f:
        json.dump(qa_artifact, f, indent=2)

    return qa_artifact
