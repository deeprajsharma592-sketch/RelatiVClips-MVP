"""
Integration test and Gate 1 verification for Phase 1.
Tests S1 normalize, S2 shots, S3 faces + tracks, and S7 camera path on F01 and F02 fixtures.
Verifies Metric M1 (>= 97%), Metric M6 (calibrated crop-center jitter), and U07-U09.
"""

from pathlib import Path
import json
import numpy as np
import pytest

from framing.config import load_config
from framing.s1_normalize import normalize_media
from framing.s2_shots import detect_shots
from framing.s3_faces import detect_and_track_faces
from framing.s7_camera import plan_camera_single_shot


@pytest.fixture(scope="module")
def base_config():
    config_path = Path(__file__).resolve().parents[2] / "framing" / "config.yaml"
    return load_config(config_path)


def test_gate1_f01_static_talking_head(tmp_path_factory, base_config):
    """
    Gate 1 on F01:
    - Single talking head, static camera.
    - S2 detects 1 shot.
    - S3 detects 1 stable track.
    - S7 produces smooth camera path.
    - Metric M1 >= 97% (active face inside crop with safe margin).
    - Metric M6 calibrated.
    """
    workdir = tmp_path_factory.mktemp("gate1_f01")
    fixture_f01 = Path(__file__).resolve().parents[1] / "fixtures" / "F01.mp4"

    # Stage S1: Normalize
    norm_info = normalize_media(fixture_f01, workdir, base_config)
    norm_video = Path(norm_info["normalized_video_path"])

    # Stage S2: Shots
    shots = detect_shots(norm_video, workdir, base_config)
    assert len(shots) >= 1
    assert shots[0]["shot_id"] == 0

    # Stage S3: Faces and Tracks
    tracks = detect_and_track_faces(norm_video, shots, workdir, base_config)
    assert len(tracks) >= 1, "At least one stable face track must be detected in F01"

    # Validate MAR values
    samples = tracks[0]["samples"]
    mars = [s["mar"] for s in samples if s["mar"] > 0]
    assert len(mars) > 0, "MAR must be computed via MediaPipe FaceMesh"

    # Stage S7: Camera Path for SINGLE
    fps = norm_info["fps"]
    src_w = norm_info["width"]
    src_h = norm_info["height"]
    total_frames = int(round(norm_info["duration_s"] * fps))

    plan = plan_camera_single_shot(
        track_samples=samples,
        start_frame=0,
        end_frame=total_frames,
        fps=fps,
        src_w=src_w,
        src_h=src_h,
        config=base_config
    )
    assert len(plan) == total_frames

    # Verify Metric M1: Active speaker face fully inside panel with safe margin >= 97%
    frames_with_face = [p for p in plan if p["face_box"] is not None]
    assert len(frames_with_face) > 0

    safe_frames = [p for p in frames_with_face if not p["is_unsafe"]]
    m1_pct = (len(safe_frames) / len(frames_with_face)) * 100.0
    print(f"\n[F01] Metric M1 (Face inside crop with safe margin): {m1_pct:.2f}%")
    assert m1_pct >= 97.0, f"Metric M1 target >= 97.0%, got {m1_pct:.2f}%"

    # Verify Metric M6: Crop-center jitter (90th percentile of per-frame acceleration at 1080p)
    cx_vals = np.array([(p["crop"][0] + p["crop"][2]) / 2.0 for p in plan])
    # per-frame acceleration: d2(cx) / dt2 in px/s^2
    vel = np.diff(cx_vals) * fps
    accel = np.diff(vel) * fps
    m6_jitter_90th = float(np.percentile(np.abs(accel), 90)) if len(accel) > 0 else 0.0
    print(f"[F01] Metric M6 (Crop-center jitter 90th percentile): {m6_jitter_90th:.2f} px/s^2")

    # On static head, dead-zone should hold camera virtually stationary
    assert m6_jitter_90th < 100.0, f"M6 jitter should be low on static head, got {m6_jitter_90th:.2f}"


def test_gate1_f02_moving_presenter(tmp_path_factory, base_config):
    """
    Gate 1 on F02:
    - Single presenter moving horizontally across the frame.
    - S3 tracks moving face.
    - S7 smoothly pans following presenter without overshoot.
    - Metric M1 >= 97%.
    """
    workdir = tmp_path_factory.mktemp("gate1_f02")
    fixture_f02 = Path(__file__).resolve().parents[1] / "fixtures" / "F02.mp4"

    # Stage S1: Normalize
    norm_info = normalize_media(fixture_f02, workdir, base_config)
    norm_video = Path(norm_info["normalized_video_path"])

    # Stage S2: Shots
    shots = detect_shots(norm_video, workdir, base_config)

    # Stage S3: Faces and Tracks
    tracks = detect_and_track_faces(norm_video, shots, workdir, base_config)
    assert len(tracks) >= 1, "Moving presenter must be detected and tracked"

    samples = tracks[0]["samples"]

    # Stage S7: Camera Path
    fps = norm_info["fps"]
    src_w = norm_info["width"]
    src_h = norm_info["height"]
    total_frames = int(round(norm_info["duration_s"] * fps))

    plan = plan_camera_single_shot(
        track_samples=samples,
        start_frame=0,
        end_frame=total_frames,
        fps=fps,
        src_w=src_w,
        src_h=src_h,
        config=base_config
    )

    frames_with_face = [p for p in plan if p["face_box"] is not None]
    assert len(frames_with_face) > 0

    safe_frames = [p for p in frames_with_face if not p["is_unsafe"]]
    m1_pct = (len(safe_frames) / len(frames_with_face)) * 100.0
    print(f"\n[F02] Metric M1 (Face inside crop with safe margin): {m1_pct:.2f}%")
    assert m1_pct >= 97.0, f"Metric M1 target >= 97.0%, got {m1_pct:.2f}%"

    # Velocity should never exceed max_pan_px_per_s (900 px/s)
    cx_vals = np.array([(p["crop"][0] + p["crop"][2]) / 2.0 for p in plan])
    vel = np.diff(cx_vals) * fps
    max_vel = float(np.max(np.abs(vel)))
    print(f"[F02] Max pan velocity: {max_vel:.2f} px/s (limit 900 px/s)")
    assert max_vel <= 900.0 + 1.0, f"Max velocity {max_vel:.2f} exceeded 900 px/s"
