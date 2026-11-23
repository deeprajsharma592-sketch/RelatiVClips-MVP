from backend.pipeline.platforms import apply_finishing_window, get_format
from backend.taste.selector import snap_to_sentence_boundary


def test_universal_format_is_30_to_90_seconds():
    policy = get_format()
    assert policy.min_duration_s == 30.0
    assert policy.max_duration_s == 90.0


def test_sentence_snap_stays_inside_duration_bounds():
    transcript = {
        "segments": [
            {"start": 8.0, "end": 38.0, "text": "This is the setup."},
            {"start": 38.0, "end": 72.0, "text": "This is the complete payoff."},
            {"start": 72.0, "end": 108.0, "text": "This belongs to the next story."},
        ]
    }
    start, end = snap_to_sentence_boundary(10.0, 70.0, transcript, 180.0)
    assert start == 8.0
    assert end == 72.0
    assert 30.0 <= end - start <= 90.0


def test_finishing_window_is_user_configurable_and_bounded():
    assert apply_finishing_window(10.0, 50.0, 100.0, 3.0) == (53.0, 3.0)
    assert apply_finishing_window(10.0, 50.0, 100.0, 0.0) == (50.0, 0.0)
    assert apply_finishing_window(10.0, 99.0, 100.0, 3.0) == (100.0, 1.0)
