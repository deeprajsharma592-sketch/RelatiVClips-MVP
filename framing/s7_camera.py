"""
RelatiV Dynamic Framing: Stage S7 - Camera Path and Smoothing.
Pure functional camera planner with subpixel coordinates, Gaussian smoothing,
dead zone filtering, velocity clamping, and safe margin boundary verification.
"""

from typing import List, Dict, Any, Tuple, Optional
import numpy as np
from scipy.ndimage import gaussian_filter1d


def smooth_camera_path(
    raw_positions: np.ndarray,
    crop_w: float,
    fps: float,
    config: Dict[str, Any]
) -> np.ndarray:
    """
    Apply Gaussian smoothing, dead-zone filtering, and velocity limits to camera coordinates.
    Works on 1D position arrays (e.g. X center or Y center or scale).
    """
    cam_cfg = config.get("camera", {})
    sigma_s = cam_cfg.get("gaussian_sigma_s", 0.25)
    dead_zone_frac = cam_cfg.get("dead_zone_frac", 0.04)
    max_pan_speed = cam_cfg.get("max_pan_px_per_s", 900.0)

    n_samples = len(raw_positions)
    if n_samples <= 1:
        return np.array(raw_positions, dtype=np.float64)

    # 1. Non-causal Gaussian smoothing
    sigma_frames = max(1e-3, sigma_s * fps)
    smoothed = gaussian_filter1d(raw_positions.astype(np.float64), sigma=sigma_frames, mode="nearest")

    min_raw = np.min(raw_positions)
    max_raw = np.max(raw_positions)
    smoothed = np.clip(smoothed, min_raw, max_raw)

    # 2. Dead zone filtering
    dead_zone = dead_zone_frac * crop_w
    output = np.empty_like(smoothed)
    output[0] = smoothed[0]
    for i in range(1, n_samples):
        diff = smoothed[i] - output[i - 1]
        if abs(diff) < dead_zone:
            output[i] = output[i - 1]
        else:
            output[i] = smoothed[i]

    # 3. Velocity limit
    max_step = max_pan_speed / fps
    limited = np.empty_like(output)
    limited[0] = output[0]
    for i in range(1, n_samples):
        delta = output[i] - limited[i - 1]
        if delta > max_step:
            limited[i] = limited[i - 1] + max_step
        elif delta < -max_step:
            limited[i] = limited[i - 1] - max_step
        else:
            limited[i] = output[i]

    return limited


def clamp_crop_to_frame(
    target_cx: float,
    target_cy: float,
    crop_w: float,
    crop_h: float,
    src_w: int,
    src_h: int,
    face_box: Optional[List[float]],
    config: Dict[str, Any]
) -> Tuple[float, float, List[float], bool]:
    """
    Clamps crop window [x1, y1, x2, y2] to stay inside [0, src_w, 0, src_h].
    Validates face box inside crop with safe margin.
    Returns: (clamped_cx, clamped_cy, [x1, y1, x2, y2], is_unsafe)
    """
    cam_cfg = config.get("camera", {})
    safe_margin_frac = cam_cfg.get("safe_margin_frac", 0.05)

    half_w = crop_w / 2.0
    half_h = crop_h / 2.0

    x1 = target_cx - half_w
    y1 = target_cy - half_h
    x2 = target_cx + half_w
    y2 = target_cy + half_h

    # Clamp X to frame bounds
    if x1 < 0.0:
        x1 = 0.0
        x2 = min(float(src_w), crop_w)
    elif x2 > src_w:
        x2 = float(src_w)
        x1 = max(0.0, float(src_w) - crop_w)

    # Clamp Y to frame bounds
    if y1 < 0.0:
        y1 = 0.0
        y2 = min(float(src_h), crop_h)
    elif y2 > src_h:
        y2 = float(src_h)
        y1 = max(0.0, float(src_h) - crop_h)

    clamped_cx = (x1 + x2) / 2.0
    clamped_cy = (y1 + y2) / 2.0
    crop_box = [float(x1), float(y1), float(x2), float(y2)]

    is_unsafe = False
    if face_box is not None:
        fx, fy, fw, fh = face_box
        safe_margin_x = safe_margin_frac * crop_w
        safe_margin_y = safe_margin_frac * crop_h

        if (fx < x1 + safe_margin_x or
            (fx + fw) > x2 - safe_margin_x or
            fy < y1 + safe_margin_y or
            (fy + fh) > y2 - safe_margin_y):
            is_unsafe = True

    return clamped_cx, clamped_cy, crop_box, is_unsafe


def plan_camera_single_shot(
    track_samples: List[Dict[str, Any]],
    start_frame: int,
    end_frame: int,
    fps: float,
    src_w: int,
    src_h: int,
    config: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """
    Computes smooth camera path for SINGLE speaker within a single shot.
    """
    cam_cfg = config.get("camera", {})
    single_face_height_frac = cam_cfg.get("single_face_height_frac", 0.22)
    eye_line_frac = cam_cfg.get("eye_line_frac", 0.38)
    aspect_ratio = 9.0 / 16.0

    n_frames = end_frame - start_frame
    if n_frames <= 0:
        return []

    # Map samples by frame index
    sample_by_t = {s["t"]: s["box"] for s in track_samples}
    sample_times = np.array(sorted(sample_by_t.keys()))

    raw_cx = np.zeros(n_frames, dtype=np.float64)
    raw_cy = np.zeros(n_frames, dtype=np.float64)
    raw_h = np.zeros(n_frames, dtype=np.float64)
    face_boxes: List[Optional[List[float]]] = [None] * n_frames

    for i in range(n_frames):
        curr_frame = start_frame + i
        curr_t = curr_frame / fps

        # Find closest sample or interpolate
        if len(sample_times) == 0:
            face_box = None
        else:
            # Nearest sample
            idx = int(np.argmin(np.abs(sample_times - curr_t)))
            closest_t = sample_times[idx]
            if abs(closest_t - curr_t) <= cam_cfg.get("max_gap_s", 1.0):
                face_box = sample_by_t[closest_t]
            else:
                face_box = None

        face_boxes[i] = face_box

        if face_box is not None:
            fx, fy, fw, fh = face_box
            fcx = fx + fw / 2.0
            fcy = fy + fh / 2.0

            target_crop_h = fh / single_face_height_frac
            target_crop_h = min(target_crop_h, float(src_h))
            target_crop_w = target_crop_h * aspect_ratio
            if target_crop_w > src_w:
                target_crop_w = float(src_w)
                target_crop_h = target_crop_w / aspect_ratio

            target_crop_cy = fcy + (0.5 - eye_line_frac) * target_crop_h

            raw_cx[i] = fcx
            raw_cy[i] = target_crop_cy
            raw_h[i] = target_crop_h
        else:
            # Default center framing
            def_h = float(src_h)
            def_w = def_h * aspect_ratio
            if def_w > src_w:
                def_w = float(src_w)
                def_h = def_w / aspect_ratio

            raw_cx[i] = src_w / 2.0
            raw_cy[i] = src_h / 2.0
            raw_h[i] = def_h

    # Nominal crop width for dead zone
    median_h = float(np.median(raw_h))
    nominal_w = median_h * aspect_ratio

    # Apply smoothing
    smooth_cx = smooth_camera_path(raw_cx, nominal_w, fps, config)
    smooth_cy = smooth_camera_path(raw_cy, nominal_w, fps, config)
    smooth_crop_h = smooth_camera_path(raw_h, nominal_w, fps, config)

    frame_plans = []
    for i in range(n_frames):
        curr_frame = start_frame + i
        curr_t = curr_frame / fps
        ch = float(smooth_crop_h[i])
        cw = ch * aspect_ratio
        if cw > src_w:
            cw = float(src_w)
            ch = cw / aspect_ratio

        cx, cy, crop_box, is_unsafe = clamp_crop_to_frame(
            smooth_cx[i], smooth_cy[i], cw, ch, src_w, src_h, face_boxes[i], config
        )

        frame_plans.append({
            "frame_idx": curr_frame,
            "t": round(curr_t, 4),
            "state": "SINGLE",
            "crop": [round(v, 2) for v in crop_box],
            "is_unsafe": is_unsafe,
            "face_box": face_boxes[i]
        })

    return frame_plans
