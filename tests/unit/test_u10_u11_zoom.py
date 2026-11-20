"""
Unit tests for S8 Zoom event planner (U10, U11).
Written before implementation as required by Rule 8.
"""

import pytest
from framing.s8_zoom import plan_zoom_events, validate_impact_words


@pytest.fixture
def zoom_config():
    return {
        "zoom": {
            "max_scale": 1.12,
            "ease_in_s": 0.15,
            "hold_s": 0.35,
            "ease_out_s": 0.40,
            "min_spacing_s": 4.0,
            "no_zoom_after_switch_s": 0.3,
            "validate_impact_words": True,
        }
    }


def test_u10_zoom_budget_and_spacing_constraints(zoom_config):
    """U10: 10 impact words in 8 s -> At most 2 zooms, none within 0.3s of a switch, scale <= max."""
    layout_switches = [2.0]  # Layout change at t=2.0s
    # 10 impact words packed into 8s
    candidate_words = [
        {"word": f"word_{i}", "t": 0.5 + i * 0.7, "strength": 0.9}
        for i in range(10)
    ]
    # words at 0.5, 1.2, 1.9, 2.6, 3.3, 4.0, 4.7, 5.4, 6.1, 6.8
    # Switch is at 2.0s -> no zoom within [2.0, 2.3s]
    # min_spacing is 4.0s -> In 8s window, at most 2 zooms can fit!

    zoom_events = plan_zoom_events(
        candidate_words,
        layout_switches=layout_switches,
        clip_duration_s=8.0,
        config=zoom_config,
    )

    # Must be at most 2 zooms
    assert len(zoom_events) <= 2

    # None within 0.3s after switch at 2.0s (i.e. [2.0, 2.3])
    for z in zoom_events:
        assert not (2.0 <= z["t_start"] <= 2.3)
        assert z["scale"] <= 1.12 + 1e-3

    # Consecutive zooms spaced by at least min_spacing_s (4.0s)
    if len(zoom_events) >= 2:
        assert (zoom_events[1]["t_start"] - zoom_events[0]["t_start"]) >= 4.0 - 1e-3


def test_u11_impact_word_validation_drops_hallucinations(zoom_config):
    """U11: Impact word not in words.json within +/- 0.2 s -> Dropped."""
    words_json = [
        {"word": "real", "start": 3.0, "end": 3.3},
        {"word": "impact", "start": 5.5, "end": 5.8},
    ]

    impact_json = [
        {"word": "real", "t": 3.1, "strength": 0.9},       # valid (+0.1s)
        {"word": "impact", "t": 6.2, "strength": 0.9},     # hallucinated time (+0.7s) -> drop
        {"word": "ghost", "t": 4.0, "strength": 0.9},      # word does not exist -> drop
    ]

    validated = validate_impact_words(impact_json, words_json, tolerance_s=0.2)

    assert len(validated) == 1
    assert validated[0]["word"] == "real"
    assert validated[0]["t"] == pytest.approx(3.1, abs=1e-3)
