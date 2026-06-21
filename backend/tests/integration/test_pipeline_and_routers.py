"""
Integration tests — verify the main pipeline and router wiring end-to-end.

These tests mock external I/O (LLM, YouTube download, Whisper) so they run fast
and reliably without network access or API keys.
"""
from unittest.mock import MagicMock, patch

import pytest


# ──────────────────────────────────────────────────────────────────────────────
# 1. Full pipeline: run_new_pipeline → clips returned via mocked LLM
# ──────────────────────────────────────────────────────────────────────────────

def test_orchestrator_end_to_end_with_mock_llm():
    """Smoke-test run_new_pipeline: mocked hook detection + surgical + LLM → clips returned."""
    import sys
    sys.path.insert(0, "/app/RelatiV/backend")
    sys.path.insert(0, "/app/RelatiV")

    from backend.pipeline.orchestrator import run_new_pipeline
    from backend.pipeline import audio_analysis
    from backend.pipeline import surgical as surgical_module
    from backend.pipeline import hooks as hook_stage

    # Fake energy peaks (used by stage 2 for video duration)
    fake_peaks = {
        "peaks": [{"timestamp": 2.5, "energy_score": 1.0}],
        "duration": 10.0,
    }
    # Fake surgical segments
    fake_segments = [
        {
            "source_start": 1.5, "source_end": 3.5,
            "audio_path": "/fake/seg1.wav",
            "transcript": {"text": "test segment"},
        },
    ]
    # Fake hook candidates so stage 3 produces output and stage 4 runs
    fake_hooks = {
        "candidates": [
            {"start": 1.5, "end": 3.5, "hook_score": 0.9, "reason": "test"},
        ],
        "source": "energy+speech",
        "video_duration": 10.0,
    }

    mock_seg = MagicMock()
    mock_seg.start = 0.0
    mock_seg.end = 5.0
    mock_seg.text = "hello world test segment"

    mock_whisper = MagicMock()
    mock_whisper.segments = [mock_seg]
    mock_whisper.text = "hello world test segment"

    def fake_llm(prompt: str) -> str:
        # rank_candidates maps LLM 'reason'/'edit_reason' → clip['edit_reason']
        # and 'viral_title'/'title' → clip['viral_title']
        return (
            '{"picks": ['
            '{"moment_index": 1, "confidence": 0.85, '
            '"hook": "This is a test moment", '
            '"retention_bridge": "This is the retention bridge text here", '
            '"viral_title": "TEST MOMENT", '
            '"hashtags": "#test #clip #relativ", '
            '"reason": "This is a test moment"}'
            ']}'
        )

    # Patch audio analysis (stage 2), hook detection (stage 3), surgical (stage 4)
    with patch.object(audio_analysis, "analyze_audio_peaks", return_value=fake_peaks), \
         patch.object(hook_stage, "detect_hooks", return_value=fake_hooks), \
         patch.object(surgical_module, "surgical_extract_local", return_value=fake_segments):
        result = run_new_pipeline(
            source="/fake/video.mp4",
            creator_id=None,
            audio_path="/fake/audio.wav",
            llm_callable=fake_llm,
            precomputed_transcript=mock_whisper,
            stages=[1, 2, 3, 4, 5, 6, 7, 8, 9],
        )

    assert "clips" in result
    assert isinstance(result["clips"], list)
    assert len(result["clips"]) == 1, f"Expected 1 clip, got {len(result['clips'])}"
    clip = result["clips"][0]
    # rank_candidates maps LLM 'hook' → 'edit_reason', 'title' → 'viral_title'
    assert clip["edit_reason"] == "This is a test moment"
    assert clip["viral_title"] == "TEST MOMENT"


def test_orchestrator_falls_back_to_energy_when_llm_returns_invalid_json():
    """Invalid LLM JSON → orchestrator catches ValueError → returns energy clips."""
    import sys
    sys.path.insert(0, "/app/RelatiV/backend")

    from backend.pipeline.orchestrator import run_new_pipeline
    from backend.pipeline import audio_analysis

    fake_peaks = {
        "peaks": [{"start": 0.0, "end": 5.0, "rms": 0.5, "score": 0.7}],
        "duration": 5.0,
    }

    mock_seg = MagicMock()
    mock_seg.start = 0.0
    mock_seg.end = 5.0
    mock_seg.text = "test segment"

    mock_whisper = MagicMock()
    mock_whisper.segments = [mock_seg]
    mock_whisper.text = "test segment"

    def fake_llm(prompt: str) -> str:
        return "This is not JSON at all!!!"

    with patch.object(audio_analysis, "analyze_audio_peaks", return_value=fake_peaks):
        result = run_new_pipeline(
            source="/fake/video.mp4",
            creator_id=None,
            audio_path="/fake/audio.wav",
            llm_callable=fake_llm,
            precomputed_transcript=mock_whisper,
            stages=[1, 2, 3, 4, 5, 6, 7, 8, 9],
        )

    assert "clips" in result
    assert isinstance(result["clips"], list)


# ──────────────────────────────────────────────────────────────────────────────
# 2. parse_moment_response handles both new-format and legacy-format JSON
#    — raises ValueError for unrecognised input (caller catches it)
# ──────────────────────────────────────────────────────────────────────────────

def test_parse_moment_response_new_format():
    """New format: {picks: [{moment_index, confidence, ...}]}."""
    import sys
    sys.path.insert(0, "/app/RelatiV/backend")
    from backend.taste.icl import parse_moment_response

    result = parse_moment_response(
        '{"picks": ['
        '{"moment_index": 1, "confidence": 0.9, '
        '"hook": "Test hook", "retention_bridge": "Test bridge", '
        '"title": "TITLE", "hashtags": "#a #b"}'
        ']}'
    )
    assert isinstance(result, list)
    assert len(result) == 1
    assert result[0]["moment_index"] == 1
    assert result[0]["confidence"] == 0.9


def test_parse_moment_response_legacy_format():
    """Legacy format: bare array [{candidate_index, edit_reason, ...}]."""
    import sys
    sys.path.insert(0, "/app/RelatiV/backend")
    from backend.taste.icl import parse_moment_response

    result = parse_moment_response(
        '[{"candidate_index": 2, "edit_reason": "Strong opening", '
        '"suggested_caption": "test caption", "suggested_hashtags": "#x", '
        '"viral_title": "VIRAL TITLE", "trim_start_offset": -2, '
        '"trim_end_offset": 8}]'
    )
    assert isinstance(result, list)
    assert len(result) == 1
    assert result[0]["moment_index"] == 2  # mapped from candidate_index
    assert "Strong opening" in result[0]["edit_reason"]


def test_parse_moment_response_invalid_raises_value_error():
    """Non-JSON or unrecognised schema raises ValueError (caller handles it)."""
    import sys
    sys.path.insert(0, "/app/RelatiV/backend")
    from backend.taste.icl import parse_moment_response

    # Not JSON at all → ValueError
    with pytest.raises(ValueError):
        parse_moment_response("This is not JSON")
    with pytest.raises(ValueError):
        parse_moment_response("")
    # Valid JSON but wrong schema → ValueError
    with pytest.raises(ValueError):
        parse_moment_response('[{"foo": "bar"}]')


# ──────────────────────────────────────────────────────────────────────────────
# 3. build_archetype_aware_prompt — Moment objects + creator history
#    Note: "entertainment" is not in archetype_specific_guidance dict, so it
#    falls back to "general". Use "story" which IS in the dict.
# ──────────────────────────────────────────────────────────────────────────────

def test_archetype_aware_prompt_includes_creator_history():
    """Creator history appears in the archetype-aware prompt."""
    import sys
    sys.path.insert(0, "/app/RelatiV/backend")
    from backend.taste.icl import (
        build_archetype_aware_prompt,
        CreatorClipHistory,
        Moment,
    )

    history = [
        CreatorClipHistory(
            clip_id="c1", video_title="Past viral hit",
            hook_start=5.0, hook_end=20.0,
            edit_reason="Shocking reveal",
            published_at=None, views=100000, retention_pct=75.0,
        ),
    ]
    moments = [
        Moment(
            index=1, start=10.0, end=15.0,
            signal_type="peak", score=0.85,
            snippet="test moment",
        ),
    ]
    prompt = build_archetype_aware_prompt(
        moments=moments,
        video_meta={"title": "New Video", "duration_s": 60.0},
        archetype="story",  # "story" IS in archetype_specific_guidance dict
        archetype_confidence=0.9,
        retention_scores=None,
        max_picks=3,
        creator_history=history,
    )

    assert "Past viral hit" in prompt
    assert "100000" in prompt  # views (no comma)
    assert "Shocking reveal" in prompt
    assert "ARCHETYPE: story" in prompt


def test_surgical_context_basic_archetype_prompt_renders():
    """Basic archetype-aware prompt renders correctly with Moment input."""
    import sys
    sys.path.insert(0, "/app/RelatiV/backend")
    from backend.taste.icl import build_archetype_aware_prompt, Moment

    moments = [
        Moment(
            index=1, start=10.0, end=15.0,
            signal_type="peak", score=0.82,
            snippet="peak moment",
        ),
    ]
    prompt = build_archetype_aware_prompt(
        moments=moments,
        video_meta={"title": "Test", "duration_s": 30.0},
        archetype="general",
        archetype_confidence=0.0,
        retention_scores=None,
        max_picks=3,
        creator_history=None,
    )

    assert "ARCHETYPE: general" in prompt
    assert "Candidates (1)" in prompt
    assert "peak moment" in prompt
    # Should NOT have the old "Hook candidates" label
    assert "Hook candidates" not in prompt


# ──────────────────────────────────────────────────────────────────────────────
# 4. config module loads and has required pipeline settings
# ──────────────────────────────────────────────────────────────────────────────

def test_config_module_has_required_pipeline_settings():
    """Backend config must have core pipeline settings defined."""
    import sys
    sys.path.insert(0, "/app/RelatiV/backend")
    from backend.utils import config

    assert hasattr(config, "TEMP_DIR"), "TEMP_DIR missing"
    assert hasattr(config, "YTDLP_PATH"), "YTDLP_PATH missing"
    assert hasattr(config, "FFMPEG_PATH"), "FFMPEG_PATH missing"
    assert hasattr(config, "FFPROBE_PATH"), "FFPROBE_PATH missing"
    assert hasattr(config, "NUM_CLIPS_LOCAL"), "NUM_CLIPS_LOCAL missing"
    assert hasattr(config, "TARGET_SAMPLE_RATE"), "TARGET_SAMPLE_RATE missing"
    # 16kHz is required for faster-whisper compatibility
    assert config.TARGET_SAMPLE_RATE == 16000
    assert config.NUM_CLIPS_LOCAL >= 1


# ──────────────────────────────────────────────────────────────────────────────
# 5. Cost-control: record_call updates counters, budget_exceeded guards spend
# ──────────────────────────────────────────────────────────────────────────────

def test_cost_control_record_call_updates_counters():
    """record_call should increment calls, input tokens, and output tokens."""
    import sys
    sys.path.insert(0, "/app/RelatiV/backend")
    from backend.llm import cost_control

    before = cost_control.cost_status()
    init_calls = before.get("calls_today", 0)
    init_in = before.get("input_tokens_today", 0)
    init_out = before.get("output_tokens_today", 0)

    # Record one call (small, well under $0.50 daily budget)
    cost_control.record_call("deepseek-v4-flash", input_tokens=100, output_tokens=50)

    after = cost_control.cost_status()
    assert after["calls_today"] == init_calls + 1
    assert after["input_tokens_today"] == init_in + 100
    assert after["output_tokens_today"] == init_out + 50
    assert after["spent_today_usd"] > 0.0
    # One tiny call should NOT trigger budget exceeded
    assert cost_control.budget_exceeded() is False
