"""
Integration test and Gate 4 verification for Phase 4.
Tests S8 Zoom Planner, impact word validation, cosine easing curves,
switch blackout windows, and Metric M9 across fixtures.
"""

from pathlib import Path
import json
import pytest

from framing.config import load_config
from framing.run import run_pipeline


@pytest.fixture(scope="module")
def base_config():
    config_path = Path(__file__).resolve().parents[2] / "framing" / "config.yaml"
    return load_config(config_path)


def test_gate4_f05_impact_zoom_eased_and_validated(tmp_path, base_config):
    """Gate 4 on F05: Validates impact word zoom, cosine curve, switch blackout, and M9."""
    fixture_video = Path(__file__).resolve().parents[1] / "fixtures" / "F05.mp4"
    workdir = tmp_path / "gate4_f05"
    workdir.mkdir(parents=True, exist_ok=True)
    out_mp4 = workdir / "f05_zoomed.mp4"

    # Create words.json with known words
    words_data = [
        {"word": "hello", "start": 0.5, "end": 0.8},
        {"word": "switch_conflict", "start": 3.05, "end": 3.25},
        {"word": "impact", "start": 4.10, "end": 4.40},
    ]
    words_file = workdir / "words_input.json"
    with open(words_file, "w", encoding="utf-8") as f:
        json.dump(words_data, f)

    # Candidate impact words:
    # 1. "hallucinated" -> not in words.json (should be dropped)
    # 2. "switch_conflict" at 3.15 -> within 0.3s of layout switch at 3.0s (should be dropped by blackout)
    # 3. "impact" at 4.25 -> valid impact word in SINGLE (should be planned and executed)
    impact_candidates = [
        {"word": "hallucinated", "t": 2.0, "strength": 1.0},
        {"word": "switch_conflict", "t": 3.15, "strength": 1.0},
        {"word": "impact", "t": 4.25, "strength": 0.95},
    ]
    impact_file = workdir / "impact_input.json"
    with open(impact_file, "w", encoding="utf-8") as f:
        json.dump(impact_candidates, f)

    qa = run_pipeline(
        clip_path=fixture_video,
        output_path=out_mp4,
        workdir=workdir,
        words_path=words_file,
        impact_path=impact_file,
        debug_overlay=True,
    )

    assert out_mp4.exists()
    assert qa["status"] == "pass"
    assert qa["metric_m9_pass"] is True
    assert qa["zoom_switch_violations"] == 0
    assert qa["zoom_spacing_violations"] == 0

    # Verify zoom_events.json
    with open(workdir / "zoom_events.json") as f:
        zoom_events = json.load(f)

    # Exactly 1 zoom event should survive (the "impact" word)
    assert len(zoom_events) == 1
    assert zoom_events[0]["word"] == "impact"
    assert zoom_events[0]["scale"] <= 1.12 + 1e-3
    assert zoom_events[0]["scale"] > 1.05

    # Check plan.json frame scales around impact word
    with open(workdir / "plan.json") as f:
        plan_data = json.load(f)
    frames = plan_data["frames"]

    # Frame at t=4.25s (frame_idx ~ 127) should have scale > 1.05
    impact_frames = [f for f in frames if abs(f["t"] - 4.25) < 0.05]
    assert len(impact_frames) > 0
    assert impact_frames[0]["zoom_scale"] > 1.05
    assert impact_frames[0]["zoom_scale"] <= 1.12

    # Frame before zoom starts (e.g. at t=3.5s) should have scale == 1.0
    pre_zoom_frames = [f for f in frames if abs(f["t"] - 3.5) < 0.05]
    assert len(pre_zoom_frames) > 0
    assert pre_zoom_frames[0]["zoom_scale"] == pytest.approx(1.0, abs=1e-3)

    print(f"\n[F05] Zoom events: {len(zoom_events)}, Scale at impact: {impact_frames[0]['zoom_scale']:.3f}, M9 pass: {qa['metric_m9_pass']}")


def test_gate4_f03_loudness_or_impact_rate_cap(tmp_path, base_config):
    """Gate 4 on F03: Verifies zoom rate cap (<= 1 per 5s) even with high candidate density."""
    fixture_video = Path(__file__).resolve().parents[1] / "fixtures" / "F03.mp4"
    workdir = tmp_path / "gate4_f03"
    workdir.mkdir(parents=True, exist_ok=True)
    out_mp4 = workdir / "f03_zoomed.mp4"

    # Dense candidate list (e.g. 10 candidates over 10s)
    dense_candidates = [
        {"word": f"word_{i}", "t": 1.0 + i * 0.8, "strength": 0.9}
        for i in range(10)
    ]
    # words.json matching all candidates
    words_data = [
        {"word": f"word_{i}", "start": 0.9 + i * 0.8, "end": 1.1 + i * 0.8}
        for i in range(10)
    ]
    words_file = workdir / "words_dense.json"
    with open(words_file, "w", encoding="utf-8") as f:
        json.dump(words_data, f)

    impact_file = workdir / "impact_dense.json"
    with open(impact_file, "w", encoding="utf-8") as f:
        json.dump(dense_candidates, f)

    qa = run_pipeline(
        clip_path=fixture_video,
        output_path=out_mp4,
        workdir=workdir,
        words_path=words_file,
        impact_path=impact_file,
        debug_overlay=False,
    )

    assert out_mp4.exists()
    assert qa["metric_m9_pass"] is True
    assert qa["zoom_switch_violations"] == 0
    assert qa["zoom_spacing_violations"] == 0

    with open(workdir / "zoom_events.json") as f:
        zoom_events = json.load(f)

    # In a 10s clip with min_spacing >= 4s, maximum 2 zooms can fit
    assert len(zoom_events) <= 2
    print(f"\n[F03] Dense candidates: 10 -> Planned zooms: {len(zoom_events)}, M9 pass: {qa['metric_m9_pass']}")
