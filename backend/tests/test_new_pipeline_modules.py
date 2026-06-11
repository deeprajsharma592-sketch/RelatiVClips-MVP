"""
Tests for the new pipeline module skeletons.

These are SHAPE tests — they verify the interfaces work and the
contracts hold. They do NOT test the LLM, the LLM provider, the
network, or the renderer. Those are integration tests and will be
added when the wiring is done (Day 2+).
"""
import pytest
from datetime import datetime

from backend.pipeline.hooks import detect_hooks, _lexical_hook_score, _normalize_energy
from backend.taste.icl import build_prompt, parse_response, CreatorClipHistory, HookCandidate
from backend.taste.selector import rank_candidates, QUALITY_FLOOR
from backend.taste.store import (
    load_history, append_history, update_metrics, creator_exists,
)


# --- hooks.py ---

class TestNormalizeEnergy:
    def test_zero(self):
        assert _normalize_energy(0) == 0

    def test_clamps_high(self):
        assert _normalize_energy(999) == 1.0

    def test_typical_peak(self):
        # raw 2.5 / 5 = 0.5
        assert abs(_normalize_energy(2.5) - 0.5) < 0.01


class TestLexicalHookScore:
    def test_no_segments(self):
        assert _lexical_hook_score([], around_ts=10) == 0

    def test_no_match(self):
        segs = [{"start": 0, "end": 5, "text": "Just a normal statement"}]
        assert _lexical_hook_score(segs, around_ts=2) == 0

    def test_match(self):
        segs = [{"start": 0, "end": 5, "text": "Here is the secret of success"}]
        assert _lexical_hook_score(segs, around_ts=2) == 0.5

    def test_out_of_window(self):
        segs = [{"start": 100, "end": 105, "text": "Here is the secret"}]
        assert _lexical_hook_score(segs, around_ts=2) == 0


class TestDetectHooks:
    def test_empty_input(self):
        result = detect_hooks({"peaks": [], "duration": 0})
        assert result["candidates"] == []
        assert result["source"] == "energy"
        assert result["video_duration"] == 0

    def test_peaks_only(self):
        # All three peaks above the default min_hook_score=0.3 floor
        peaks = {"peaks": [
            {"timestamp": 10.0, "energy_score": 3.0},   # hook_score ~0.55
            {"timestamp": 25.0, "energy_score": 4.0},   # hook_score ~0.6
            {"timestamp": 50.0, "energy_score": 2.5},   # hook_score ~0.5
        ], "duration": 60.0}
        result = detect_hooks(peaks)
        assert len(result["candidates"]) == 3
        # Sorted by hook_score DESC, so highest-energy peak first
        scores = [c["hook_score"] for c in result["candidates"]]
        assert scores == sorted(scores, reverse=True)
        assert result["source"] == "energy"

    def test_dedupes_close_peaks(self):
        # Three peaks, all above the hook_score threshold:
        #   - t=10 and t=11.5 are within the 4s dedup window → keep the higher one
        #   - t=50 is far away and high enough → kept
        # Expected: 2 candidates.
        peaks = {"peaks": [
            {"timestamp": 10.0, "energy_score": 3.0},
            {"timestamp": 11.5, "energy_score": 3.5},  # within 4s of t=10
            {"timestamp": 50.0, "energy_score": 4.0},  # far away, higher energy
        ], "duration": 60.0}
        result = detect_hooks(peaks)
        assert len(result["candidates"]) == 2
        # Highest-scored one is preserved (t=11.5 in score order OR t=50, depending on
        # normalized values). Check that the near-pair is deduped by ensuring we
        # don't have BOTH t=10 and t=11.5 in the result.
        starts = {round(c["start"], 1) for c in result["candidates"]}
        assert not (round(9.0, 1) in starts and round(10.5, 1) in starts), \
            f"Near-duplicate peaks not deduped: {starts}"

    def test_with_transcript_lexical_signal(self):
        peaks = {"peaks": [
            {"timestamp": 10.0, "energy_score": 2.0},  # modest energy
        ], "duration": 60.0}
        transcript = {"segments": [
            {"start": 9, "end": 12, "text": "The secret to success is..."}
        ]}
        result = detect_hooks(peaks, transcript=transcript)
        assert len(result["candidates"]) == 1
        assert result["candidates"][0]["components"]["lexical"] == 0.5
        assert result["source"] == "energy+speech+lexical"

    def test_top_n_cap(self):
        peaks = {"peaks": [
            {"timestamp": float(i * 20), "energy_score": 5.0}
            for i in range(20)
        ], "duration": 400.0}
        result = detect_hooks(peaks, top_n=5)
        assert len(result["candidates"]) == 5

    def test_quality_floor_filters(self):
        # Energy way below threshold
        peaks = {"peaks": [
            {"timestamp": 10.0, "energy_score": 0.1},  # normalized = 0.02
        ], "duration": 60.0}
        result = detect_hooks(peaks, min_hook_score=0.3)
        assert len(result["candidates"]) == 0

    def test_pure_energy_peak_above_floor(self):
        """A pure high-energy peak (no valley, no transcript) should still
        pass the quality floor, because punchy moments matter too."""
        # One peak with no preceding audio → no valley_lift contribution
        peaks = {"peaks": [
            {"timestamp": 30.0, "energy_score": 8.0},  # normalized 1.0
        ], "duration": 60.0}
        result = detect_hooks(peaks, min_hook_score=0.3)
        assert len(result["candidates"]) == 1
        # energy component = 1.0, no valley, no lex → score = 0.40 + 0.15 = 0.55
        # That's above 0.3 (the default min_hook_score) but below 0.7.
        # That's by design — energy peaks are necessary but not sufficient
        # for the 0.7 quality floor; the LLM is the final judge.
        assert 0.5 < result["candidates"][0]["hook_score"] < 0.7

    def test_valley_lift_increases_score(self):
        """A peak that follows a quiet stretch should score HIGHER than
        the same peak height in a sustained-loud region. This is the
        'punchline lift' pattern."""
        # Two peaks with same height; one is a 'punchline' (after quiet),
        # one is part of sustained loudness.
        peaks_punchline = {"peaks": [
            {"timestamp": 1.0, "energy_score": 0.5},   # quiet
            {"timestamp": 2.0, "energy_score": 0.3},   # quieter (the valley)
            {"timestamp": 5.0, "energy_score": 5.0},   # the punchline peak
        ], "duration": 30.0}
        peaks_sustained = {"peaks": [
            {"timestamp": 1.0, "energy_score": 4.0},   # already loud
            {"timestamp": 2.0, "energy_score": 4.5},   # sustained
            {"timestamp": 5.0, "energy_score": 5.0},   # same peak height
        ], "duration": 30.0}

        r_punch = detect_hooks(peaks_punchline)
        r_sust = detect_hooks(peaks_sustained)

        # The peak at t=5 should appear in both results (high energy)
        p5_punch = next(c for c in r_punch["candidates"] if abs(c["start"] - 4.0) < 0.1)
        p5_sust = next(c for c in r_sust["candidates"] if abs(c["start"] - 4.0) < 0.1)
        # Punchline should score higher due to valley_lift component
        assert p5_punch["hook_score"] > p5_sust["hook_score"]
        # The valley_lift delta should be meaningful (punchline is dramatically
        # higher than sustained). At least 0.3 more.
        delta = p5_punch["components"]["valley_lift"] - p5_sust["components"]["valley_lift"]
        assert delta > 0.3, f"Expected valley_lift delta > 0.3, got {delta}"

    def test_components_include_valley_lift(self):
        peaks = {"peaks": [
            {"timestamp": 10.0, "energy_score": 4.0},
        ], "duration": 30.0}
        result = detect_hooks(peaks)
        assert len(result["candidates"]) == 1
        assert "valley_lift" in result["candidates"][0]["components"]
        assert isinstance(result["candidates"][0]["components"]["valley_lift"], float)


class TestValleyLiftInternals:
    def test_zero_at_start(self):
        from backend.pipeline.hooks import _valley_lift_score
        # No preceding audio to compare
        assert _valley_lift_score(0.5, [(0.0, 0.1)]) == 0.0

    def test_zero_when_no_preceding(self):
        from backend.pipeline.hooks import _valley_lift_score
        # ts=10, but no peaks in the 7-10s window
        assert _valley_lift_score(10.0, [(1.0, 0.1)]) == 0.0

    def test_high_lift_for_sharp_rise(self):
        from backend.pipeline.hooks import _valley_lift_score
        # Quiet at t=7, 8, 9; loud at t=10
        curve = [(7.0, 0.1), (8.0, 0.2), (9.0, 0.1), (10.0, 5.0)]
        score = _valley_lift_score(10.0, curve)
        assert score > 0.5  # sharp valley→peak should score high


# --- taste/icl.py ---

class TestBuildPrompt:
    def test_new_creator_uses_niche_defaults(self):
        cands = [HookCandidate(10.0, 12.0, 0.8, {"energy": 0.6, "lexical": 0.5}, "test")]
        prompt = build_prompt(
            creator_history=[],
            hook_candidates=cands,
            video_meta={"title": "Test video", "duration": 60.0, "source": "youtube"},
            niche="podcast",
        )
        assert "new creator" in prompt.lower()
        assert "podcast" in prompt
        assert "Hook candidates" in prompt
        assert "JSON" in prompt
        # Few-shot section should be absent for new creators
        assert "Examples of THIS creator" not in prompt

    def test_experienced_creator_includes_icl_examples(self):
        history = [
            CreatorClipHistory(
                clip_id="c1", video_title="Old video",
                hook_start=10.0, hook_end=25.0,
                edit_reason="Strong opening hook",
                published_at=datetime(2026, 1, 1),
                views=5000, retention_pct=70.0,
            )
        ]
        cands = [HookCandidate(10.0, 12.0, 0.8, {"energy": 0.6, "lexical": 0.5}, "test")]
        prompt = build_prompt(history, cands, {"title": "New", "duration": 60.0})
        assert "Recent clips for this creator" in prompt
        assert "Examples of THIS creator" in prompt  # ICL signal present
        assert "Old video" in prompt
        assert "5000" in prompt  # views in example

    def test_caps_few_shot_examples(self):
        history = [
            CreatorClipHistory(
                clip_id=f"c{i}", video_title=f"Video {i}",
                hook_start=10.0, hook_end=25.0,
                edit_reason=f"Reason {i}",
                published_at=datetime(2026, 1, 1),
            ) for i in range(10)
        ]
        cands = [HookCandidate(10.0, 12.0, 0.8, {"energy": 0.6, "lexical": 0.5}, "t")]
        prompt = build_prompt(history, cands, {"title": "x", "duration": 30.0}, max_examples=2)
        # Only first 2 should appear as examples
        assert "Video 0" in prompt
        assert "Video 1" in prompt
        assert "Video 9" not in prompt  # capped at 2


class TestParseResponse:
    def test_clean_json(self):
        out = parse_response('[{"candidate_index": 1, "edit_reason": "x"}]')
        assert len(out) == 1
        assert out[0]["candidate_index"] == 1

    def test_json_fence(self):
        out = parse_response('```json\n[{"candidate_index": 1}]\n```')
        assert len(out) == 1

    def test_prose_around_json(self):
        out = parse_response(
            'Here are my picks:\n[{"candidate_index": 2, "edit_reason": "y"}]\nDone.'
        )
        assert len(out) == 1
        assert out[0]["candidate_index"] == 2

    def test_malformed_raises(self):
        with pytest.raises(ValueError):
            parse_response("I cannot help with that.")

    def test_truncates_long_fields(self):
        out = parse_response(
            f'[{{"candidate_index": 1, "edit_reason": "{"x" * 1000}", '
            f'"suggested_caption": "{"y" * 500}"}}]'
        )
        assert len(out) == 1
        assert len(out[0]["edit_reason"]) == 500
        assert len(out[0]["suggested_caption"]) == 200

    def test_skips_invalid_entries(self):
        out = parse_response(
            '[{"candidate_index": 1}, "not a dict", {"no_index": true}, {"candidate_index": 2}]'
        )
        assert len(out) == 2  # only the two with candidate_index


# --- taste/selector.py ---

class TestRankCandidates:
    def test_empty_candidates(self):
        assert rank_candidates([], None, 60.0) == []

    def test_no_llm_response_falls_back(self):
        cands = [
            {"start": 10, "end": 12, "hook_score": 0.9, "components": {}},
            {"start": 30, "end": 32, "hook_score": 0.5, "components": {}},
        ]
        result = rank_candidates(cands, None, 60.0)
        # Top hook above floor should win; 0.5 also above floor (0.5 < 0.7? no, 0.5 < 0.7 so dropped)
        # Wait: 0.5 < QUALITY_FLOOR (0.7), so only 0.9 passes
        assert len(result) == 1
        assert result[0]["hook_score"] == 0.9

    def test_applies_quality_floor(self):
        cands = [
            {"start": 10, "end": 12, "hook_score": 0.5, "components": {}},  # below floor
        ]
        llm_response = [{"candidate_index": 1, "edit_reason": "x"}]
        result = rank_candidates(cands, llm_response, 60.0)
        # LLM picks are honored even below the floor (LLM is the final word)
        assert len(result) == 1
        assert "Fallback" not in result[0]["edit_reason"]

    def test_dedupes_close_starts(self):
        cands = [
            {"start": 10.0, "end": 12.0, "hook_score": 0.8, "components": {}},
            {"start": 10.05, "end": 12.0, "hook_score": 0.85, "components": {}},  # dup
            {"start": 30.0, "end": 32.0, "hook_score": 0.9, "components": {}},
        ]
        llm_response = [
            {"candidate_index": 1, "edit_reason": "a", "trim_start_offset": 0, "trim_end_offset": 0},
            {"candidate_index": 2, "edit_reason": "b", "trim_start_offset": 0, "trim_end_offset": 0},
            {"candidate_index": 3, "edit_reason": "c", "trim_start_offset": 0, "trim_end_offset": 0},
        ]
        result = rank_candidates(cands, llm_response, 60.0)
        # First two dedupe to one
        assert len(result) == 2

    def test_trim_offsets_extend_clip(self):
        cands = [
            {"start": 10.0, "end": 12.0, "hook_score": 0.9, "components": {}},
        ]
        llm_response = [{
            "candidate_index": 1,
            "trim_start_offset": -2.0,  # extend 2s before
            "trim_end_offset": 10.0,    # extend 10s after → total ~12s
            "edit_reason": "x",
        }]
        result = rank_candidates(cands, llm_response, 60.0)
        assert result[0]["start"] == 8.0
        assert result[0]["end"] == 22.0  # 12 + 10

    def test_enforces_min_duration(self):
        # If trim makes it too short, extend to MIN
        cands = [{"start": 10.0, "end": 12.0, "hook_score": 0.9, "components": {}}]
        llm_response = [{"candidate_index": 1, "trim_start_offset": 0, "trim_end_offset": 0}]
        result = rank_candidates(cands, llm_response, 60.0)
        assert result[0]["end"] - result[0]["start"] >= 10.0  # CLIP_DURATION_MIN

    def test_enforces_max_duration(self):
        cands = [{"start": 10.0, "end": 12.0, "hook_score": 0.9, "components": {}}]
        llm_response = [{"candidate_index": 1, "trim_start_offset": 0, "trim_end_offset": 100}]
        result = rank_candidates(cands, llm_response, 60.0)
        assert result[0]["end"] - result[0]["start"] <= 20.0  # CLIP_DURATION_MAX


# --- taste/store.py ---

class TestCreatorHistory:
    def test_new_creator_returns_empty(self, tmp_path, monkeypatch):
        monkeypatch.setattr("backend.taste.store.HISTORY_DIR", tmp_path)
        history = load_history("nonexistent_creator")
        assert history == []

    def test_append_and_load(self, tmp_path, monkeypatch):
        monkeypatch.setattr("backend.taste.store.HISTORY_DIR", tmp_path)
        entry = CreatorClipHistory(
            clip_id="c1", video_title="V1",
            hook_start=10.0, hook_end=25.0,
            edit_reason="Good hook", published_at=datetime(2026, 1, 1),
            views=1000, retention_pct=65.0,
        )
        assert append_history("creator_x", entry) is True
        history = load_history("creator_x")
        assert len(history) == 1
        assert history[0].clip_id == "c1"
        assert history[0].views == 1000

    def test_idempotent_append(self, tmp_path, monkeypatch):
        monkeypatch.setattr("backend.taste.store.HISTORY_DIR", tmp_path)
        entry = CreatorClipHistory(
            clip_id="c1", video_title="V1", hook_start=10, hook_end=25,
            edit_reason="x", published_at=datetime(2026, 1, 1),
        )
        assert append_history("c", entry) is True
        assert append_history("c", entry) is True
        # Still only one entry
        history = load_history("c")
        assert len(history) == 1

    def test_update_metrics(self, tmp_path, monkeypatch):
        monkeypatch.setattr("backend.taste.store.HISTORY_DIR", tmp_path)
        entry = CreatorClipHistory(
            clip_id="c1", video_title="V1", hook_start=10, hook_end=25,
            edit_reason="x", published_at=datetime(2026, 1, 1),
        )
        append_history("c", entry)
        assert update_metrics("c", "c1", views=5000, retention_pct=80.0) is True
        history = load_history("c")
        assert history[0].views == 5000
        assert history[0].retention_pct == 80.0

    def test_newest_first(self, tmp_path, monkeypatch):
        monkeypatch.setattr("backend.taste.store.HISTORY_DIR", tmp_path)
        for i in range(3):
            entry = CreatorClipHistory(
                clip_id=f"c{i}", video_title=f"V{i}", hook_start=10, hook_end=25,
                edit_reason="x", published_at=datetime(2026, 1, i + 1),
            )
            append_history("c", entry)
        history = load_history("c")
        assert [h.clip_id for h in history] == ["c2", "c1", "c0"]

    def test_creator_exists(self, tmp_path, monkeypatch):
        monkeypatch.setattr("backend.taste.store.HISTORY_DIR", tmp_path)
        assert creator_exists("nope") is False
        entry = CreatorClipHistory(
            clip_id="c1", video_title="V", hook_start=10, hook_end=25,
            edit_reason="x", published_at=datetime(2026, 1, 1),
        )
        append_history("real", entry)
        assert creator_exists("real") is True
