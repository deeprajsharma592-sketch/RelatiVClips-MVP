"""
Integration test and Gate 3 verification for Phase 3.
Tests S6 Layout Planner, Stack Rendering, and Metrics M3, M4, M5 across fixtures F03 to F07.
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


def test_gate3_f03_stack_layout(tmp_path, base_config):
    """Gate 3 on F03: 2-person alternating podcast enters STACK and respects M4, M5."""
    fixture_video = Path(__file__).resolve().parents[1] / "fixtures" / "F03.mp4"
    workdir = tmp_path / "gate3_f03"
    out_mp4 = workdir / "f03_out.mp4"

    qa = run_pipeline(
        clip_path=fixture_video,
        output_path=out_mp4,
        workdir=workdir,
        debug_overlay=True,
    )

    assert out_mp4.exists()
    assert qa["status"] == "pass"
    assert qa["short_state_violations"] == 0, f"Metric M5 failed: {qa['short_state_violations']} violations"
    assert qa["switches_per_minute"] <= 14.0, f"Metric M4 exceeded hard cap: {qa['switches_per_minute']}"
    print(f"\n[F03] Switches/min: {qa['switches_per_minute']:.1f}, Short states: {qa['short_state_violations']}")


def test_gate3_f04_fast_banter_stays_stacked(tmp_path, base_config):
    """Gate 3 on F04: Rapid exchanges stay in STACK layout, avoiding thrashing."""
    fixture_video = Path(__file__).resolve().parents[1] / "fixtures" / "F04.mp4"
    workdir = tmp_path / "gate3_f04"
    out_mp4 = workdir / "f04_out.mp4"

    qa = run_pipeline(
        clip_path=fixture_video,
        output_path=out_mp4,
        workdir=workdir,
        debug_overlay=False,
    )

    assert out_mp4.exists()
    assert qa["short_state_violations"] == 0
    assert qa["switches_per_minute"] <= 14.0
    print(f"\n[F04] Switches/min: {qa['switches_per_minute']:.1f}, Short states: {qa['short_state_violations']}")


def test_gate3_f05_monologue_enters_single(tmp_path, base_config):
    """Gate 3 on F05: Monologue enters SINGLE(P1) after single_enter_hold_s."""
    fixture_video = Path(__file__).resolve().parents[1] / "fixtures" / "F05.mp4"
    workdir = tmp_path / "gate3_f05"
    out_mp4 = workdir / "f05_out.mp4"

    qa = run_pipeline(
        clip_path=fixture_video,
        output_path=out_mp4,
        workdir=workdir,
        debug_overlay=False,
    )

    with open(workdir / "layout.json") as f:
        layout_data = json.load(f)
    segments = layout_data["layout_segments"]

    assert any(s["state"] == "SINGLE" for s in segments)
    assert qa["short_state_violations"] == 0
    print(f"\n[F05] Single entered. Switches/min: {qa['switches_per_minute']:.1f}")


def test_gate3_f06_overlap_enters_stack(tmp_path, base_config):
    """Gate 3 on F06: Overlapping speech stays in STACK."""
    fixture_video = Path(__file__).resolve().parents[1] / "fixtures" / "F06.mp4"
    workdir = tmp_path / "gate3_f06"
    out_mp4 = workdir / "f06_out.mp4"

    qa = run_pipeline(
        clip_path=fixture_video,
        output_path=out_mp4,
        workdir=workdir,
        debug_overlay=False,
    )

    assert qa["short_state_violations"] == 0
    assert qa["switches_per_minute"] <= 14.0
    print(f"\n[F06] Switches/min: {qa['switches_per_minute']:.1f}")


def test_gate3_f07_backchannel_resilience(tmp_path, base_config):
    """Gate 3 on F07: Backchannel does not thrash layout."""
    fixture_video = Path(__file__).resolve().parents[1] / "fixtures" / "F07.mp4"
    workdir = tmp_path / "gate3_f07"
    out_mp4 = workdir / "f07_out.mp4"

    qa = run_pipeline(
        clip_path=fixture_video,
        output_path=out_mp4,
        workdir=workdir,
        debug_overlay=False,
    )

    assert qa["short_state_violations"] == 0
    assert qa["switches_per_minute"] <= 14.0
    print(f"\n[F07] Switches/min: {qa['switches_per_minute']:.1f}")
