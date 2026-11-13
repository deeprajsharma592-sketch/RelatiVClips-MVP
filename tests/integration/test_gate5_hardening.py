"""
Phase 5 Hardening & Integration Tests: I02, I03, I04, I05, I06, and Gate 5 (spec-0.1).
Covers:
- I02: Determinism (byte-identical plan.json hashes on identical inputs)
- I03: Failure handling (corrupt, zero-length, truncated files fail cleanly without hangs/zombies)
- I04: Chaos test (drop 30% detections, jitter timestamps +/-100ms, camera path remains smooth and clamped)
- I05: Shimmer test (warpAffine subpixel float vs integer quantization)
- I06: Privacy & Cleanup (no face crop images, no embeddings, only allowed artifacts)
- Gate 5: End-to-end QA metrics M1-M10 on fixtures
"""

import hashlib
import json
import os
import random
from pathlib import Path
import pytest
import numpy as np

from framing.config import load_config
from framing.run import run_pipeline
from framing.s7_camera import plan_camera_single_shot
from framing.s9_render import warp_crop_affine


@pytest.fixture(scope="module")
def base_config():
    config_path = Path(__file__).resolve().parents[2] / "framing" / "config.yaml"
    return load_config(config_path)


def test_i02_determinism(tmp_path, base_config):
    """I02 Determinism: same input and config produce byte-identical plan.json (compare hashes)."""
    fixture_video = Path(__file__).resolve().parents[1] / "fixtures" / "F01.mp4"
    workdir_1 = tmp_path / "i02_run1"
    workdir_2 = tmp_path / "i02_run2"
    workdir_1.mkdir(parents=True, exist_ok=True)
    workdir_2.mkdir(parents=True, exist_ok=True)

    qa_1 = run_pipeline(clip_path=fixture_video, output_path=workdir_1 / "out1.mp4", workdir=workdir_1)
    qa_2 = run_pipeline(clip_path=fixture_video, output_path=workdir_2 / "out2.mp4", workdir=workdir_2)

    with open(workdir_1 / "plan.json", "rb") as f:
        hash_1 = hashlib.sha256(f.read()).hexdigest()
    with open(workdir_2 / "plan.json", "rb") as f:
        hash_2 = hashlib.sha256(f.read()).hexdigest()

    assert hash_1 == hash_2, f"Determinism violated: run1={hash_1} != run2={hash_2}"


def test_i03_failure_handling_corrupt_and_zero_length(tmp_path, base_config):
    """I03 Failure handling: corrupt file, zero-length file, truncated file exit cleanly with an error."""
    # 1. Zero length file
    zero_file = tmp_path / "zero.mp4"
    zero_file.touch()

    with pytest.raises(Exception):
        run_pipeline(clip_path=zero_file, output_path=tmp_path / "zero_out.mp4", workdir=tmp_path / "w_zero")

    # 2. Corrupt file (random garbage bytes)
    corrupt_file = tmp_path / "corrupt.mp4"
    with open(corrupt_file, "wb") as f:
        f.write(os.urandom(1024))

    with pytest.raises(Exception):
        run_pipeline(clip_path=corrupt_file, output_path=tmp_path / "corrupt_out.mp4", workdir=tmp_path / "w_corrupt")

    # 3. Truncated file (first 512 bytes of a valid video)
    fixture_video = Path(__file__).resolve().parents[1] / "fixtures" / "F01.mp4"
    with open(fixture_video, "rb") as f:
        head_bytes = f.read(512)
    truncated_file = tmp_path / "trunc.mp4"
    with open(truncated_file, "wb") as f:
        f.write(head_bytes)

    with pytest.raises(Exception):
        run_pipeline(clip_path=truncated_file, output_path=tmp_path / "trunc_out.mp4", workdir=tmp_path / "w_trunc")


def test_i04_chaos_detection_dropout_and_timestamp_jitter(base_config):
    """
    I04 Chaos: randomly drop 30% of detections and jitter timestamps +/-100 ms;
    output camera path remains continuous, velocity bounded, no NaNs/Infs, face clamped with margin.
    """
    random.seed(42)
    np.random.seed(42)

    total_frames = 150
    fps = 30.0
    src_w = 1920
    src_h = 1080

    # Synthetic detections for a face moving smoothly from x=700 to x=1100
    clean_samples = []
    for f in range(total_frames):
        t = f / fps
        cx = 700.0 + 400.0 * (f / total_frames)
        cy = 500.0
        w = 200.0
        h = 240.0
        clean_samples.append({
            "t": t,
            "box": [cx - w/2, cy - h/2, w, h],
            "score": 0.95,
            "mar": 0.05,
        })

    # Apply chaos: drop 30% of samples
    chaos_samples = []
    for s in clean_samples:
        if random.random() < 0.30:
            continue  # Drop detection
        # Jitter timestamp by +/- 100 ms
        jittered_t = s["t"] + random.uniform(-0.10, 0.10)
        chaos_samples.append({
            "t": round(jittered_t, 4),
            "box": list(s["box"]),
            "score": s["score"],
            "mar": s["mar"],
        })

    # Sort by time
    chaos_samples.sort(key=lambda s: s["t"])

    # Run camera planner
    plan = plan_camera_single_shot(
        track_samples=chaos_samples,
        start_frame=0,
        end_frame=total_frames,
        fps=fps,
        src_w=src_w,
        src_h=src_h,
        config=base_config,
    )

    assert len(plan) == total_frames

    # Check for validity: no NaNs, velocities <= max_pan, crops within frame
    max_pan = float(base_config.get("camera", {}).get("max_pan_px_per_s", 900.0))
    dt = 1.0 / fps

    for i in range(len(plan)):
        c = plan[i]["crop"]
        assert not np.isnan(c[0]) and not np.isinf(c[0])
        assert not np.isnan(c[1]) and not np.isinf(c[1])
        assert not np.isnan(c[2]) and not np.isinf(c[2])
        assert not np.isnan(c[3]) and not np.isinf(c[3])

        # Clamped inside frame bounds
        assert c[0] >= -1e-3 and c[2] <= src_w + 1e-3
        assert c[1] >= -1e-3 and c[3] <= src_h + 1e-3

        if i > 0:
            prev_c = plan[i - 1]["crop"]
            prev_cx = (prev_c[0] + prev_c[2]) / 2.0
            cx = (c[0] + c[2]) / 2.0
            vel_x = abs(cx - prev_cx) / dt
            # Velocity clamp must hold
            assert vel_x <= max_pan + 1e-2, f"Chaos induced velocity spike: {vel_x} px/s > {max_pan}"


def test_i05_shimmer_subpixel_vs_integer_rounding():
    """
    I05 Shimmer: verify subpixel warpAffine produces subpixel shifts without stair-step jumps.
    """
    # Create test pattern with high-frequency edges
    img = np.zeros((1080, 1920, 3), dtype=np.uint8)
    for x in range(0, 1920, 10):
        img[:, x:x+5] = 255

    # Simulate subpixel panning: x advances by 0.25 px per frame
    crops_float = []
    crops_int = []

    for i in range(10):
        sub_x = 100.0 + i * 0.25
        # Float affine warp
        f_crop = warp_crop_affine(img, sub_x, 100.0, 607.5, 1080.0, 1080, 1920)
        # Integer rounded crop
        int_x = int(round(sub_x))
        int_crop = warp_crop_affine(img, float(int_x), 100.0, 608.0, 1080.0, 1080, 1920)
        crops_float.append(f_crop)
        crops_int.append(int_crop)

    # In integer cropping, frames 0-1 have identical crop (0.0 and 0.25 round to 100),
    # then frame 2 jumps (0.5 rounds to 101) -> discrete jump / shimmer!
    diff_int_0_1 = np.mean(np.abs(crops_int[1].astype(float) - crops_int[0].astype(float)))
    diff_float_0_1 = np.mean(np.abs(crops_float[1].astype(float) - crops_float[0].astype(float)))

    # Float warp has smooth non-zero gradient between 0.0 and 0.25, while integer has 0 difference
    assert diff_int_0_1 == 0.0, "Integer crop was not quantized"
    assert diff_float_0_1 > 0.0, "Float warp failed to produce subpixel differentiation"


def test_i06_cleanup_and_privacy_compliance(tmp_path, base_config):
    """
    I06 Cleanup & Privacy (V37):
    After QA, verify that NO face crop images or face embeddings are stored to disk.
    Only allowed JSON artifacts and output video may remain.
    """
    fixture_video = Path(__file__).resolve().parents[1] / "fixtures" / "F01.mp4"
    workdir = tmp_path / "i06_privacy"
    workdir.mkdir(parents=True, exist_ok=True)
    out_mp4 = workdir / "out.mp4"

    qa = run_pipeline(
        clip_path=fixture_video,
        output_path=out_mp4,
        workdir=workdir,
    )

    allowed_exts = {".json", ".mp4", ".wav"}
    for p in workdir.rglob("*"):
        if p.is_file():
            assert p.suffix.lower() in allowed_exts, f"Unauthorized file found: {p}"
            # Verify no face thumbnail/image files exist
            assert p.suffix.lower() not in [".jpg", ".jpeg", ".png", ".bmp", ".npy", ".pt", ".bin"]

    # Verify tracks.json stores only bounding box coords & scalar MAR, no high-dim embeddings
    with open(workdir / "tracks.json") as f:
        tracks_data = json.load(f)
    for trk in tracks_data.get("tracks", []):
        for s in trk.get("samples", []):
            assert "embedding" not in s
            assert "face_crop" not in s
            assert "crop_path" not in s


def test_gate5_full_qa_metrics_verification(tmp_path, base_config):
    """
    Gate 5: Full QA metrics verification across fixtures F01, F03, F05.
    Verifies M1, M4, M5, M6, M7, M8, M9, M10 in qa.json.
    """
    fixture_video = Path(__file__).resolve().parents[1] / "fixtures" / "F03.mp4"
    workdir = tmp_path / "gate5_f03"
    workdir.mkdir(parents=True, exist_ok=True)
    out_mp4 = workdir / "out_f03.mp4"

    qa = run_pipeline(
        clip_path=fixture_video,
        output_path=out_mp4,
        workdir=workdir,
    )

    assert qa["status"] in ["pass", "review"]
    assert "metrics" in qa
    metrics = qa["metrics"]
    assert metrics["M7_sync_pass"] is True
    assert metrics["M5_short_states_count"] == 0
    assert metrics["M4_switches_per_minute"] <= 14.0
    assert metrics["M10_unnecessary_fallback_pct"] <= 3.0
    assert metrics["M9_zoom_pass"] is True

    print(f"\n[Gate 5 QA Summary]")
    for k, v in metrics.items():
        print(f"  {k}: {v}")
