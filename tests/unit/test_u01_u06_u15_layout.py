"""
Unit tests for S6 Layout Planner (U01-U06, U15).
Written before implementation as required by Rule 8.
"""

import pytest
from framing.s6_layout import plan_layout


@pytest.fixture
def base_config():
    return {
        "layout": {
            "min_hold_s": 2.0,
            "single_enter_hold_s": 3.0,
            "stack_enter_changes": 2,
            "stack_enter_window_s": 6.0,
            "switch_lead_s": 0.12,
            "snap_to_word_boundary": True,
            "transition": "hard_cut",
        },
        "turns": {
            "backchannel_max_s": 0.6,
        }
    }


def test_u01_fast_alternation_stays_stacked(base_config):
    """U01: A/B alternate every 1 s for 20 s -> STACK throughout, at most 1 initial switch."""
    duration = 20.0
    # Turns alternating every 1.0s
    turns = []
    for i in range(20):
        spk = "P1" if i % 2 == 0 else "P2"
        turns.append({
            "t_start": float(i),
            "t_end": float(i + 1),
            "speaker": spk,
            "is_backchannel": False,
        })
    shots = [{"t_start": 0.0, "t_end": 20.0, "shot_id": 0}]
    stable_tracks = ["P1", "P2"]

    layout_segments = plan_layout(turns, shots, stable_tracks, words=[], config=base_config)

    # In fast banter, layout must remain STACK(P1, P2)
    stack_segments = [s for s in layout_segments if s["state"] == "STACK"]
    assert len(stack_segments) >= 1
    # Total duration in stack should dominate (e.g. at most 1 brief switch at start)
    total_stack_dur = sum(s["t_end"] - s["t_start"] for s in stack_segments)
    assert total_stack_dur >= 17.0
    assert len(layout_segments) <= 2


def test_u02_monologue_enters_single_after_hold(base_config):
    """U02: A speaks 10 s alone -> SINGLE(A) entered after the 3 s hold."""
    duration = 10.0
    turns = [{
        "t_start": 0.0,
        "t_end": 10.0,
        "speaker": "P1",
        "is_backchannel": False,
    }]
    shots = [{"t_start": 0.0, "t_end": 10.0, "shot_id": 0}]
    stable_tracks = ["P1", "P2"]

    layout_segments = plan_layout(turns, shots, stable_tracks, words=[], config=base_config)

    # Should start in STACK then switch to SINGLE(P1) around t=3.0s (single_enter_hold_s)
    single_segments = [s for s in layout_segments if s["state"] == "SINGLE" and s.get("track") == "P1"]
    assert len(single_segments) == 1
    assert single_segments[0]["t_start"] == pytest.approx(3.0 - 0.12, abs=0.2)
    assert single_segments[0]["t_end"] == pytest.approx(10.0, abs=0.1)


def test_u03_backchannel_does_not_break_single(base_config):
    """U03: B backchannel (0.4 s) during A's monologue -> No layout change."""
    turns = [
        {"t_start": 0.0, "t_end": 10.0, "speaker": "P1", "is_backchannel": False},
        {"t_start": 5.0, "t_end": 5.4, "speaker": "P2", "is_backchannel": True}, # 0.4s backchannel
    ]
    shots = [{"t_start": 0.0, "t_end": 10.0, "shot_id": 0}]
    stable_tracks = ["P1", "P2"]

    layout_segments = plan_layout(turns, shots, stable_tracks, words=[], config=base_config)

    # Once SINGLE(P1) is entered at ~3s, it should stay SINGLE(P1) until 10s without dropping to STACK
    p1_segments = [s for s in layout_segments if s["state"] == "SINGLE" and s.get("track") == "P1"]
    assert len(p1_segments) == 1
    assert p1_segments[0]["t_end"] == pytest.approx(10.0, abs=0.1)


def test_u04_brief_unknown_gap_holds_state(base_config):
    """U04: 1.2 s unknown gap -> State held (below unknown_hold_s of 1.5s)."""
    turns = [
        {"t_start": 0.0, "t_end": 6.0, "speaker": "P1", "is_backchannel": False},
        {"t_start": 6.0, "t_end": 7.2, "speaker": "unknown", "is_backchannel": False}, # 1.2s unknown
        {"t_start": 7.2, "t_end": 10.0, "speaker": "P1", "is_backchannel": False},
    ]
    shots = [{"t_start": 0.0, "t_end": 10.0, "shot_id": 0}]
    stable_tracks = ["P1", "P2"]

    layout_segments = plan_layout(turns, shots, stable_tracks, words=[], config=base_config)

    # During the 1.2s gap, SINGLE(P1) should not be broken
    single_p1 = [s for s in layout_segments if s["state"] == "SINGLE" and s.get("track") == "P1"]
    assert len(single_p1) == 1
    assert single_p1[0]["t_end"] == pytest.approx(10.0, abs=0.2)


def test_u05_switch_deferred_until_min_hold_met(base_config):
    """U05: Trigger arrives 1.0 s after a switch -> Switch deferred until min_hold (2.0s) is met."""
    # Start in SINGLE(P1) then a switch triggers at t=1.0s
    turns = [
        {"t_start": 0.0, "t_end": 10.0, "speaker": "P1", "is_backchannel": False},
        {"t_start": 4.0, "t_end": 8.0, "speaker": "P2", "is_backchannel": False},
    ]
    shots = [{"t_start": 0.0, "t_end": 10.0, "shot_id": 0}]
    stable_tracks = ["P1", "P2"]

    layout_segments = plan_layout(turns, shots, stable_tracks, words=[], config=base_config)

    # Every segment must have duration >= min_hold_s (2.0s)
    for seg in layout_segments:
        dur = seg["t_end"] - seg["t_start"]
        assert dur >= 2.0 - 1e-3, f"Segment {seg} violated min_hold_s ({dur:.3f} < 2.0)"


def test_u06_speaker_rapid_flip_no_flicker(base_config):
    """U06: Speaker flips at 1.9 s then 2.1 s -> No layout flicker."""
    turns = [
        {"t_start": 0.0, "t_end": 1.9, "speaker": "P1", "is_backchannel": False},
        {"t_start": 1.9, "t_end": 2.1, "speaker": "P2", "is_backchannel": False},
        {"t_start": 2.1, "t_end": 6.0, "speaker": "P1", "is_backchannel": False},
    ]
    shots = [{"t_start": 0.0, "t_end": 6.0, "shot_id": 0}]
    stable_tracks = ["P1", "P2"]

    layout_segments = plan_layout(turns, shots, stable_tracks, words=[], config=base_config)

    # Must not create a 0.2s flicker segment
    for seg in layout_segments:
        assert (seg["t_end"] - seg["t_start"]) >= 2.0 - 1e-3


def test_u15_switch_snaps_to_word_boundary(base_config):
    """U15: Switch time inside a word -> Snapped to word boundary."""
    words = [
        {"word": "Hello", "start": 3.5, "end": 4.2},
        {"word": "world", "start": 4.3, "end": 4.8},
    ]
    # Raw trigger would fall at 3.9s (middle of 'Hello')
    turns = [
        {"t_start": 0.0, "t_end": 4.0, "speaker": "P1", "is_backchannel": False},
        {"t_start": 4.0, "t_end": 8.0, "speaker": "P2", "is_backchannel": False},
    ]
    shots = [{"t_start": 0.0, "t_end": 8.0, "shot_id": 0}]
    stable_tracks = ["P1", "P2"]

    layout_segments = plan_layout(turns, shots, stable_tracks, words=words, config=base_config)

    # Transition should snap to word boundary (e.g. 3.5 or 4.2/4.3), never 3.88 or 4.0 inside 'Hello'
    for seg in layout_segments[:-1]:
        cut_t = seg["t_end"]
        # Cut must be either outside words or at start/end of a word
        inside_word = any(w["start"] + 0.05 < cut_t < w["end"] - 0.05 for w in words)
        assert not inside_word, f"Cut time {cut_t:.3f} landed mid-word!"
