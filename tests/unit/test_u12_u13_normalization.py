"""
Unit tests for S1 Normalization logic (U12, U13).
U12: Inputs offset by a known base time -> Rebased correctly
U13: Odd-size input -> Even output dimensions
"""

import pytest
from framing.s1_normalize import rebase_timestamps, ensure_even_dimensions


def test_u12_rebase_timestamps():
    """U12: Inputs offset by a known base time are rebased to 0-based clip time."""
    clip_start_s = 15.5
    raw_words = [
        {"word": "first", "start": 15.5, "end": 16.0},
        {"word": "second", "start": 16.2, "end": 17.0},
        {"word": "prior", "start": 14.0, "end": 15.0}, # before clip
    ]

    rebased = rebase_timestamps(raw_words, clip_start_s, clip_duration_s=10.0)

    # 'prior' should be filtered or clamped appropriately, inside words rebased
    assert len(rebased) == 2
    assert rebased[0]["word"] == "first"
    assert rebased[0]["start"] == pytest.approx(0.0, abs=1e-3)
    assert rebased[0]["end"] == pytest.approx(0.5, abs=1e-3)

    assert rebased[1]["word"] == "second"
    assert rebased[1]["start"] == pytest.approx(0.7, abs=1e-3)
    assert rebased[1]["end"] == pytest.approx(1.5, abs=1e-3)


def test_u13_odd_size_input_forces_even_dimensions():
    """U13: Odd-size input dimensions (e.g. 1919x1079) force even output dimensions."""
    test_cases = [
        (1919, 1079, 1918, 1078),
        (1920, 1080, 1920, 1080),
        (853, 481, 852, 480),
        (721, 1281, 720, 1280),
    ]

    for w_in, h_in, w_exp, h_exp in test_cases:
        w_out, h_out = ensure_even_dimensions(w_in, h_in)
        assert w_out % 2 == 0, f"Width {w_out} must be even"
        assert h_out % 2 == 0, f"Height {h_out} must be even"
        assert (w_out, h_out) == (w_exp, h_exp)
