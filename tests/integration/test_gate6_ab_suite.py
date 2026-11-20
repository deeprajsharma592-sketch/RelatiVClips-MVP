"""
Integration test and Gate 6 verification for Phase 6.
Tests the A/B evaluation suite across experiments AB3, AB6, AB8, AB10,
verifies config isolation, config hash recording, and side-by-side video rendering.
"""

from pathlib import Path
import json
import pytest

from framing.config import load_config
from framing.ab_runner import run_ab_experiment, create_ab_split_video


@pytest.fixture(scope="module")
def base_config_path():
    return Path(__file__).resolve().parents[2] / "framing" / "config.yaml"


def test_gate6_ab3_smoothing_experiment(tmp_path, base_config_path):
    """Gate 6 on AB3: Evaluates Gaussian vs Savitzky-Golay vs One-Euro smoothing."""
    f01 = Path(__file__).resolve().parents[1] / "fixtures" / "F01.mp4"
    workdir = tmp_path / "ab3_test"

    results = run_ab_experiment(
        experiment_id="AB3_smoothing",
        fixtures=[f01],
        base_config_path=base_config_path,
        workdir=workdir,
    )

    assert "arms" in results
    assert "variant_A" in results["arms"]
    assert "variant_B" in results["arms"]
    assert "variant_C" in results["arms"]

    # Verify each arm produced distinct config hashes
    hashes = [arm["config_hash"] for arm in results["arms"].values()]
    assert len(set(hashes)) == 3, f"Config hashes must be distinct: {hashes}"

    # Verify M6 jitter was measured for each arm
    for arm_name, arm_data in results["arms"].items():
        metrics = arm_data["fixture_metrics"]["F01"]["metrics"]
        assert "M6_crop_jitter_accel_px_s2" in metrics
        print(f"\n[AB3 {arm_name}] M6 Jitter: {metrics['M6_crop_jitter_accel_px_s2']} px/s^2")


def test_gate6_ab6_zoom_scale_experiment(tmp_path, base_config_path):
    """Gate 6 on AB6: Evaluates impact zoom scales 1.12 vs 1.00 vs 1.06."""
    f05 = Path(__file__).resolve().parents[1] / "fixtures" / "F05.mp4"
    workdir = tmp_path / "ab6_test"

    results = run_ab_experiment(
        experiment_id="AB6_zoom_scale",
        fixtures=[f05],
        base_config_path=base_config_path,
        workdir=workdir,
    )

    assert len(results["arms"]) == 3
    for arm_name, arm_data in results["arms"].items():
        assert arm_data["fixture_metrics"]["F05"]["status"] in ["pass", "review"]
        print(f"\n[AB6 {arm_name}] Status: {arm_data['fixture_metrics']['F05']['status']}")


def test_gate6_ab10_fallback_look_and_split_render(tmp_path, base_config_path):
    """Gate 6 on AB10: Evaluates blur_fit vs center_crop fallback and renders split video."""
    f01 = Path(__file__).resolve().parents[1] / "fixtures" / "F01.mp4"
    workdir = tmp_path / "ab10_test"

    results = run_ab_experiment(
        experiment_id="AB10_fallback_look",
        fixtures=[f01],
        base_config_path=base_config_path,
        workdir=workdir,
    )

    arm_a_out = workdir / "AB10_fallback_look" / "variant_A" / "F01" / "F01_variant_A.mp4"
    arm_b_out = workdir / "AB10_fallback_look" / "variant_B" / "F01" / "F01_variant_B.mp4"
    split_out = workdir / "F01_AB10_split.mp4"

    split_res = create_ab_split_video(
        video_a_path=arm_a_out,
        video_b_path=arm_b_out,
        out_path=split_out,
        label_a="A: Blur-Fit",
        label_b="B: Center-Crop",
    )

    assert split_res.exists()
    assert split_res.stat().st_size > 10000
    print(f"\n[AB10 Split Video] Created: {split_res} ({split_res.stat().st_size} bytes)")
