"""
Unit tests for S7 Camera Path & Smoothing logic (U07-U09).
Written before implementation as required by Rule 8.
"""

import numpy as np
import pytest
from framing.s7_camera import smooth_camera_path, clamp_crop_to_frame


@pytest.fixture
def camera_config():
    return {
        "camera": {
            "single_face_height_frac": 0.22,
            "eye_line_frac": 0.38,
            "stack_face_height_frac": 0.35,
            "smoothing": "gaussian",
            "gaussian_sigma_s": 0.25,
            "dead_zone_frac": 0.04,
            "max_pan_px_per_s": 900,
            "max_scale_rate_per_s": 0.5,
            "safe_margin_frac": 0.05,
        }
    }


def test_u07_step_input_smoother_no_overshoot(camera_config):
    """U07: Step input to smoother -> No overshoot beyond epsilon, max pan speed respected."""
    fps = 30.0
    n_frames = 90  # 3 seconds
    # Step at t = 1.0s (frame 30) from x=400 to x=800
    raw_centers_x = np.full(n_frames, 400.0)
    raw_centers_x[30:] = 800.0
    crop_w = 607.0

    smoothed = smooth_camera_path(raw_centers_x, crop_w, fps=fps, config=camera_config)

    # 1. No overshoot: smoothed center must be strictly between 400.0 and 800.0 (plus tiny numerical eps)
    assert np.all(smoothed >= 400.0 - 1e-3)
    assert np.all(smoothed <= 800.0 + 1e-3)

    # 2. Max pan speed respected: per-second velocity must not exceed max_pan_px_per_s (900 px/s)
    diffs = np.abs(np.diff(smoothed)) * fps
    max_vel = np.max(diffs)
    assert max_vel <= 900.0 + 1.0, f"Max velocity {max_vel:.1f} exceeded 900 px/s limit"


def test_u08_deadzone_eliminates_micro_jitter(camera_config):
    """U08: +/-1% noise on face position -> Output path variance near zero (dead zone)."""
    fps = 30.0
    n_frames = 60
    # Mean position x = 500.0, crop_w = 600.0. Deadzone is 0.04 * 600 = 24 px.
    # 1% noise is +/- 6 px (well inside 24 px dead zone).
    np.random.seed(42)
    noise = np.random.uniform(-6.0, 6.0, size=n_frames)
    raw_centers = 500.0 + noise
    crop_w = 600.0

    smoothed = smooth_camera_path(raw_centers, crop_w, fps=fps, config=camera_config)

    # With dead zone filtering, camera position should hold virtually stationary
    variance = np.var(smoothed)
    assert variance < 0.2, f"Variance {variance:.4f} should be near zero with dead zone active"


def test_u09_face_at_frame_edge_clamped_with_margin(camera_config):
    """U09: Face near frame edge -> Crop clamped inside frame, face box kept within safe margin."""
    src_w, src_h = 1920, 1080
    crop_w, crop_h = 607.5, 1080.0

    # Face box right at edge x=30, y=100, w=100, h=100
    face_box = [30.0, 100.0, 100.0, 100.0]  # [x, y, w, h]
    target_cx = 80.0
    target_cy = 150.0

    clamped_cx, clamped_cy, crop_box, is_unsafe = clamp_crop_to_frame(
        target_cx, target_cy, crop_w, crop_h, src_w, src_h, face_box, config=camera_config
    )

    # 1. Crop box [x1, y1, x2, y2] must stay fully inside source frame
    x1, y1, x2, y2 = crop_box
    assert x1 >= 0.0 - 1e-3
    assert y1 >= 0.0 - 1e-3
    assert x2 <= src_w + 1e-3
    assert y2 <= src_h + 1e-3

    # 2. Face box [fx, fy, fw, fh] must lie within crop with safe margin
    safe_margin = 0.05 * crop_w
    assert (face_box[0] >= x1 + safe_margin) or not is_unsafe
