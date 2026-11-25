from framing.layout_policy import ContextSignals, batch_context_position, choose_layout


def _signals(**overrides):
    values = {
        "landscape": True,
        "sampled_frames": 9,
        "edge_density": 0.04,
        "scene_change": 0.03,
        "face_count": 1,
        "face_coverage": 0.04,
    }
    values.update(overrides)
    return ContextSignals(**values)


def test_four_clip_batch_is_stably_shuffled_and_balanced():
    first = [batch_context_position(i, "task-123") for i in range(1, 5)]
    second = [batch_context_position(i, "task-123") for i in range(1, 5)]
    assert first == second
    assert first.count("top") == 2
    assert first.count("bottom") == 2


def test_gaming_and_irl_hints_preserve_context():
    for hint in ("gaming", "irl_streamer"):
        decision = choose_layout("auto", "top", hint, _signals())
        assert decision.mode == "context"


def test_visual_graphics_signal_preserves_context():
    decision = choose_layout(
        "auto", "bottom", None, _signals(edge_density=0.14, face_coverage=0.03)
    )
    assert decision.mode == "context"
    assert decision.context_position == "bottom"


def test_motion_led_irl_signal_keeps_batch_position():
    decision = choose_layout(
        "auto", "bottom", None,
        _signals(edge_density=0.04, scene_change=0.16, face_coverage=0.03),
    )
    assert decision.mode == "context"
    assert decision.context_position == "bottom"


def test_normal_talking_head_stays_portrait():
    decision = choose_layout(
        "auto", "top", None, _signals(edge_density=0.03, face_coverage=0.18)
    )
    assert decision.mode == "portrait"


def test_two_person_podcast_uses_conversation_policy():
    decision = choose_layout(
        "auto", "top", "podcast", _signals(face_count=2)
    )
    assert decision.mode == "conversation"


def test_two_faces_without_hint_uses_conversation_stack():
    decision = choose_layout(
        "auto", "top", None, _signals(face_count=2)
    )
    assert decision.mode == "conversation"


def test_zero_faces_landscape_uses_fit_blur():
    decision = choose_layout(
        "auto", "top", None, _signals(face_count=0)
    )
    assert decision.mode == "fit"


def test_explicit_layout_override_wins():
    decision = choose_layout("portrait", "bottom", "gaming", _signals())
    assert decision.mode == "portrait"


def test_motion_graphics_and_gameplay_stack_face_even_with_secondary_face():
    for hint in ("motion_graphics", "gameplay", "gaming", "broll", "explainer"):
        decision = choose_layout("auto", "top", hint, _signals(face_count=2))
        assert decision.mode == "context"

    # Auto visual signal without hint catches motion graphics / gameplay HUDs
    auto_mg = choose_layout(
        "auto", "bottom", None, _signals(edge_density=0.085, face_coverage=0.13)
    )
    assert auto_mg.mode == "context"
    assert auto_mg.context_position == "bottom"
