from backend.pipeline.clip_count import MAX_CLIPS_PER_RUN, resolve_target_clip_count


def test_automatic_clip_count_scales_every_five_minutes():
    assert resolve_target_clip_count(5 * 60) == 1
    assert resolve_target_clip_count(10 * 60) == 2
    assert resolve_target_clip_count(15 * 60) == 3
    assert resolve_target_clip_count(20 * 60) == 4


def test_automatic_clip_count_never_exceeds_four():
    assert resolve_target_clip_count(3 * 60 * 60) == MAX_CLIPS_PER_RUN == 4


def test_user_clip_count_overrides_duration_within_cap():
    assert resolve_target_clip_count(3 * 60 * 60, 1) == 1
    assert resolve_target_clip_count(60, 4) == 4
