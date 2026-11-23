"""
S9 Render — Streams frames sequentially, crops with cv2.warpAffine float transforms,
renders SINGLE, STACK (1080x960 x 2), or FIT_BLUR, and pipes BGR to ffmpeg (spec-0.1).
"""

from __future__ import annotations

import time
import sys
import cv2
import numpy as np
import subprocess
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

from .config import get_binary_paths
from .debug_overlay import draw_debug_overlay


_BEST_H264_ENCODER = None

def _get_h264_encoder_args(ffmpeg_bin: str, crf: int = 18, preset: str = "medium") -> list:
    """Detect GPU hardware-accelerated H.264 encoder with clean CPU fallback.
    Priority:
      1. h264_nvenc (NVIDIA GPU server / RunPod / EC2) -> ~1.5s render
      2. h264_videotoolbox (Apple Silicon Mac) -> ~2s render
      3. libx264 (Universal CPU fallback) -> ~9s render
    """
    global _BEST_H264_ENCODER
    if _BEST_H264_ENCODER is None:
        try:
            res = subprocess.run([ffmpeg_bin, "-encoders"], capture_output=True, text=True, timeout=5)
            stdout = res.stdout or ""
            if "h264_nvenc" in stdout:
                _BEST_H264_ENCODER = "nvenc"
            elif "h264_videotoolbox" in stdout and sys.platform == "darwin":
                _BEST_H264_ENCODER = "videotoolbox"
            else:
                _BEST_H264_ENCODER = "libx264"
        except Exception:
            _BEST_H264_ENCODER = "libx264"

    if _BEST_H264_ENCODER == "nvenc":
        return ["-c:v", "h264_nvenc", "-preset", "p4", "-cq", str(crf), "-pix_fmt", "yuv420p"]
    elif _BEST_H264_ENCODER == "videotoolbox":
        return ["-c:v", "h264_videotoolbox", "-b:v", "6500k", "-pix_fmt", "yuv420p"]
    else:
        return ["-c:v", "libx264", "-crf", str(crf), "-preset", preset, "-pix_fmt", "yuv420p"]


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


def render_center_crop_frame(frame: np.ndarray, target_w: int = 1080, target_h: int = 1920) -> np.ndarray:
    """Render direct center crop of source frame to target 9:16 (fallback style AB10)."""
    src_h, src_w = frame.shape[:2]
    crop_h = src_h
    crop_w = crop_h * (target_w / target_h)
    crop_x1 = max(0.0, (src_w - crop_w) / 2.0)
    return warp_crop_affine(frame, crop_x1, 0.0, crop_w, crop_h, target_w, target_h)


def render_scene_panel(
    frame: np.ndarray,
    target_w: int,
    target_h: int,
    anchor: str = "center",
) -> np.ndarray:
    """Fit the complete source canvas into a panel without stretching or cropping."""
    src_h, src_w = frame.shape[:2]
    scale = min(target_w / max(1, src_w), target_h / max(1, src_h))
    width = max(1, int(round(src_w * scale)))
    height = max(1, int(round(src_h * scale)))
    fitted = cv2.resize(
        frame,
        (width, height),
        interpolation=cv2.INTER_AREA if scale < 1.0 else cv2.INTER_LANCZOS4,
    )
    # A restrained near-black field preserves graphics and HUD readability; a
    # blurred duplicate behind text-heavy content makes small type less legible.
    panel = np.full((target_h, target_w, 3), (14, 14, 16), dtype=np.uint8)
    x = (target_w - width) // 2
    if anchor == "bottom":
        y = target_h - height
    elif anchor == "top":
        y = 0
    else:
        y = (target_h - height) // 2
    panel[y:y + height, x:x + width] = fitted
    return panel


def context_scene_panel_height(
    src_w: int,
    src_h: int,
    target_w: int = 1080,
    target_h: int = 1920,
) -> int:
    """Height needed to show a landscape source edge-to-edge with no void."""
    if src_w <= 0 or src_h <= 0:
        return target_h // 2
    fitted_h = int(round(target_w * (src_h / src_w)))
    return max(1, min(target_h - 1, fitted_h))


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
    subtitle_path: Optional[str | Path] = None,
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
    ]

    # Subtitle burn-in filter if provided (animated kinetic captions)
    if subtitle_path and Path(subtitle_path).exists() and Path(subtitle_path).stat().st_size > 50:
        escaped_sub = str(Path(subtitle_path).as_posix()).replace("\\", "/").replace(":", "\\:").replace("'", "\\'")
        font_dir = Path(__file__).resolve().parents[1] / "backend" / "assets" / "fonts"
        escaped_fonts = str(font_dir.as_posix()).replace(":", "\\:").replace("'", "\\'")
        ffmpeg_cmd.extend(["-vf", f"ass='{escaped_sub}':fontsdir='{escaped_fonts}'"])
        print(f"[Framing Render] Burning viral subtitles from {subtitle_path}")

    encoder_args = _get_h264_encoder_args(bins["ffmpeg"], crf=crf, preset=preset)
    ffmpeg_cmd.extend(encoder_args)
    ffmpeg_cmd.extend([
        "-c:a", "aac",
        "-b:a", "160k",
        "-shortest",
        "-movflags", "+faststart",
        str(output_path),
    ])

    stderr_log_path = output_path.parent / f"render_ffmpeg_{output_path.stem}.log"
    err_file = open(stderr_log_path, "wb")

    proc = subprocess.Popen(
        ffmpeg_cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.DEVNULL,
        stderr=err_file,
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
                elif plan and state == "CONTEXT_STACK" and "crop" in plan:
                    c = plan["crop"]
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
            fallback_style = config.get("fallback", {}).get("style", "blur_fit")
            if state == "FIT_BLUR":
                if fallback_style == "center_crop":
                    final_frame = render_center_crop_frame(frame_for_render, target_w, target_h)
                else:
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

                # Active speaker emphasis (AB8)
                stack_emphasis = config.get("stack", {}).get("emphasis", "none")
                if stack_emphasis == "dim_inactive":
                    if active_speaker == "P1":
                        bot_panel = (bot_panel.astype(np.float32) * 0.85).astype(np.uint8)
                    elif active_speaker == "P2":
                        top_panel = (top_panel.astype(np.float32) * 0.85).astype(np.uint8)

                final_frame = np.vstack([top_panel, bot_panel])
            elif state == "CONTEXT_STACK":
                c = plan.get("crop", [0, 0, src_w, src_h])
                if isinstance(c, dict):
                    cx1, cy1, cw, ch = c["x1"], c["y1"], c["w"], c["h"]
                else:
                    cx1, cy1, cw, ch = c[0], c[1], c[2] - c[0], c[3] - c[1]
                scene_h = context_scene_panel_height(src_w, src_h, target_w, target_h)
                tracked_h = target_h - scene_h
                position = plan.get("context_position", "top")
                scene_panel = render_scene_panel(frame_for_render, target_w, scene_h)
                tracked_panel = warp_crop_affine(
                    frame_for_render, cx1, cy1, cw, ch, target_w, tracked_h
                )
                if position == "bottom":
                    final_frame = np.vstack([tracked_panel, scene_panel])
                else:
                    final_frame = np.vstack([scene_panel, tracked_panel])
            else:
                if fallback_style == "center_crop":
                    final_frame = render_center_crop_frame(frame_for_render, target_w, target_h)
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
            try:
                proc.stdin.close()
            except Exception:
                pass
        err_file.close()
        proc.wait(timeout=60)

    stderr_output = ""
    if proc.returncode != 0:
        if stderr_log_path.exists():
            stderr_output = stderr_log_path.read_text(encoding="utf-8", errors="replace")
        raise RuntimeError(f"FFmpeg render pipeline failed (rc={proc.returncode}): {stderr_output[:1000]}")
    else:
        stderr_log_path.unlink(missing_ok=True)

    render_time_s = time.time() - t0

    return {
        "output_path": str(output_path),
        "frames_rendered": frame_idx,
        "total_source_frames": total_frames,
        "render_time_s": render_time_s,
    }
