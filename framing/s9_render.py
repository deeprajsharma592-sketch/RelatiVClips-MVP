"""
S9 Render — Streams frames sequentially, crops with cv2.warpAffine float transforms,
renders SINGLE, STACK (1080x960 x 2), or FIT_BLUR, and pipes BGR to ffmpeg (spec-0.1).
"""

from __future__ import annotations

import time
import cv2
import numpy as np
import subprocess
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

from .config import get_binary_paths
from .debug_overlay import draw_debug_overlay


def render_fit_blur_frame(frame: np.ndarray, target_w: int = 1080, target_h: int = 1920, blur_sigma: int = 30) -> np.ndarray:
    """Render scaled-to-fit video over a blurred, scaled-to-fill copy of itself (fallback style)."""
    src_h, src_w = frame.shape[:2]

    # Background: scale to fill 1080x1920, then heavy Gaussian blur
    scale_fill = max(target_w / src_w, target_h / src_h)
    bg_w = int(round(src_w * scale_fill))
    bg_h = int(round(src_h * scale_fill))
    bg_resized = cv2.resize(frame, (bg_w, bg_h), interpolation=cv2.INTER_AREA)

    # Center crop background to target_w x target_h
    start_x = (bg_w - target_w) // 2
    start_y = (bg_h - target_h) // 2
    bg_cropped = bg_resized[start_y:start_y + target_h, start_x:start_x + target_w]

    # Apply blur (blur_sigma)
    ksize = int(blur_sigma * 2) | 1
    blurred_bg = cv2.GaussianBlur(bg_cropped, (ksize, ksize), blur_sigma)

    # Foreground: scale to fit inside 1080x1920
    scale_fit = min(target_w / src_w, target_h / src_h)
    fg_w = int(round(src_w * scale_fit))
    fg_h = int(round(src_h * scale_fit))
    fg_resized = cv2.resize(frame, (fg_w, fg_h), interpolation=cv2.INTER_AREA if scale_fit < 1.0 else cv2.INTER_LANCZOS4)

    # Composite foreground centered on blurred background
    fg_x = (target_w - fg_w) // 2
    fg_y = (target_h - fg_h) // 2
    blurred_bg[fg_y:fg_y + fg_h, fg_x:fg_x + fg_w] = fg_resized

    return blurred_bg


def warp_crop_affine(
    frame: np.ndarray,
    crop_x1: float,
    crop_y1: float,
    crop_w: float,
    crop_h: float,
    target_w: int,
    target_h: int,
) -> np.ndarray:
    """
    Apply subpixel crop using float affine matrix mapping crop rect -> target rect.
    Avoids stair-step integer rounding shimmer (Rule V29).
    """
    src_pts = np.float32([
        [crop_x1, crop_y1],
        [crop_x1 + crop_w, crop_y1],
        [crop_x1, crop_y1 + crop_h],
    ])
    dst_pts = np.float32([
        [0.0, 0.0],
        [float(target_w), 0.0],
        [0.0, float(target_h)],
    ])

    M = cv2.getAffineTransform(src_pts, dst_pts)
    interp = cv2.INTER_AREA if (crop_w >= target_w) else cv2.INTER_LANCZOS4
    return cv2.warpAffine(frame, M, (target_w, target_h), flags=interp, borderMode=cv2.BORDER_REFLECT101)


def render_video(
    norm_video_path: str | Path,
    plan_frames: List[Dict[str, Any]],
    output_path: str | Path,
    config: Dict[str, Any],
    debug_overlay: bool = False,
    progress_cb: Optional[Callable[[float], None]] = None,
) -> Dict[str, Any]:
    """
    Stream source video frame-by-frame, transform per plan_frames, and pipe BGR to FFmpeg.
    """
    norm_video_path = Path(norm_video_path)
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    bins = get_binary_paths()

    cap = cv2.VideoCapture(str(norm_video_path))
    if not cap.isOpened():
        raise RuntimeError(f"Failed to open video: {norm_video_path}")

    src_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    src_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    out_cfg = config.get("output", {})
    target_w = int(out_cfg.get("width", 1080))
    target_h = int(out_cfg.get("height", 1920))
    crf = int(out_cfg.get("crf", 18))
    preset = str(out_cfg.get("preset", "medium"))

    # Spawn FFmpeg receiver process reading rawvideo from stdin pipe
    ffmpeg_cmd = [
        bins["ffmpeg"], "-y",
        "-f", "rawvideo",
        "-pix_fmt", "bgr24",
        "-s", f"{target_w}x{target_h}",
        "-r", str(fps),
        "-i", "-",
        "-i", str(norm_video_path),
        "-map", "0:v",
        "-map", "1:a?",
        "-c:v", "libx264",
        "-crf", str(crf),
        "-preset", preset,
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "160k",
        "-shortest",
        "-movflags", "+faststart",
        str(output_path),
    ]

    proc = subprocess.Popen(
        ffmpeg_cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )

    t0 = time.time()
    frame_idx = 0
    try:
        while True:
            ret, frame = cap.read()
            if not ret or frame is None:
                break

            plan = plan_frames[frame_idx] if frame_idx < len(plan_frames) else None
            state = plan.get("state", "FIT_BLUR") if plan else "FIT_BLUR"
            active_speaker = plan.get("speaker", "unknown") if plan else "unknown"
            zoom_scale = plan.get("zoom_scale", 1.0) if plan else 1.0

            if debug_overlay:
                crop_boxes_viz = []
                if plan and state == "SINGLE" and "crop" in plan:
                    c = plan["crop"]
                    if isinstance(c, dict):
                        crop_boxes_viz.append((c["x1"], c["y1"], c["x1"] + c["w"], c["y1"] + c["h"]))
                    elif isinstance(c, (list, tuple)) and len(c) >= 4:
                        crop_boxes_viz.append((c[0], c[1], c[2], c[3]))
                elif plan and state == "STACK" and "panels" in plan:
                    for p in plan["panels"]:
                        c = p.get("crop")
                        if isinstance(c, dict):
                            crop_boxes_viz.append((c["x1"], c["y1"], c["x1"] + c["w"], c["y1"] + c["h"]))
                        elif isinstance(c, (list, tuple)) and len(c) >= 4:
                            crop_boxes_viz.append((c[0], c[1], c[2], c[3]))

                frame_for_render = draw_debug_overlay(
                    frame=frame,
                    frame_idx=frame_idx,
                    t_sec=frame_idx / fps,
                    layout_state=state,
                    active_speaker=active_speaker,
                    zoom_scale=zoom_scale,
                    face_boxes=plan.get("faces", []) if plan else [],
                    crop_boxes=crop_boxes_viz,
                )
            else:
                frame_for_render = frame

            # Render frame layout
            if state == "FIT_BLUR":
                final_frame = render_fit_blur_frame(frame_for_render, target_w, target_h)
            elif state == "SINGLE":
                c = plan["crop"]
                if isinstance(c, dict):
                    cx1, cy1, cw, ch = c["x1"], c["y1"], c["w"], c["h"]
                else:
                    cx1, cy1, cw, ch = c[0], c[1], c[2] - c[0], c[3] - c[1]
                final_frame = warp_crop_affine(
                    frame_for_render,
                    cx1, cy1, cw, ch,
                    target_w, target_h
                )
            elif state == "STACK":
                panels = plan.get("panels", [])
                p1_c = panels[0]["crop"] if len(panels) > 0 else {"x1": 0, "y1": 0, "w": src_w, "h": src_h / 2}
                p2_c = panels[1]["crop"] if len(panels) > 1 else {"x1": 0, "y1": src_h / 2, "w": src_w, "h": src_h / 2}

                panel_h = target_h // 2  # 960
                top_panel = warp_crop_affine(frame_for_render, p1_c["x1"], p1_c["y1"], p1_c["w"], p1_c["h"], target_w, panel_h)
                bot_panel = warp_crop_affine(frame_for_render, p2_c["x1"], p2_c["y1"], p2_c["w"], p2_c["h"], target_w, panel_h)

                final_frame = np.vstack([top_panel, bot_panel])
            else:
                final_frame = render_fit_blur_frame(frame_for_render, target_w, target_h)

            proc.stdin.write(final_frame.tobytes())
            frame_idx += 1

            if progress_cb and total_frames > 0 and frame_idx % 30 == 0:
                progress_cb(frame_idx / total_frames)

    except BrokenPipeError:
        pass
    finally:
        cap.release()
        if proc.stdin:
            proc.stdin.close()
        stderr_output = proc.stderr.read().decode("utf-8", errors="replace") if proc.stderr else ""
        proc.wait(timeout=30)

    if proc.returncode != 0:
        raise RuntimeError(f"FFmpeg render pipeline failed (rc={proc.returncode}): {stderr_output[:1000]}")

    render_time_s = time.time() - t0

    return {
        "output_path": str(output_path),
        "frames_rendered": frame_idx,
        "total_source_frames": total_frames,
        "render_time_s": render_time_s,
    }
