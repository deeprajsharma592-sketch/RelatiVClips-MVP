"""Tests for the surgery context in ICL prompt."""
import pytest

from backend.taste.icl import HookCandidate, build_prompt


class TestSurgeryContextInPrompt:
    def test_candidate_with_no_surgery_omits_surgery_line(self):
        c = HookCandidate(
            start=10.0, end=12.0, hook_score=0.8,
            components={"energy": 0.7}, reason="peak"
        )
        prompt = build_prompt(
            creator_history=[], hook_candidates=[c],
            video_meta={"title": "Test", "duration": 60.0},
        )
        assert "[surgery:" not in prompt
        assert "[will cut source" not in prompt

    def test_candidate_with_padding_shows_surgery_line(self):
        c = HookCandidate(
            start=10.0, end=12.0, hook_score=0.8,
            components={"energy": 0.7}, reason="peak",
            surgical_padding_s=3.0,
        )
        prompt = build_prompt(
            creator_history=[], hook_candidates=[c],
            video_meta={"title": "Test", "duration": 60.0},
        )
        assert "[surgery: ±3.0s padding]" in prompt

    def test_candidate_with_source_range_shows_cut_line(self):
        c = HookCandidate(
            start=10.0, end=12.0, hook_score=0.8,
            components={"energy": 0.7}, reason="peak",
            source_start=8.0, source_end=14.0,
        )
        prompt = build_prompt(
            creator_history=[], hook_candidates=[c],
            video_meta={"title": "Test", "duration": 60.0},
        )
        assert "[will cut source t=8.0s-14.0s]" in prompt

    def test_full_surgery_context(self):
        c = HookCandidate(
            start=10.0, end=12.0, hook_score=0.8,
            components={"energy": 0.7, "lexical": 0.3}, reason="peak",
            surgical_padding_s=5.0,
            source_start=5.0, source_end=17.0,
            source_url="https://youtube.com/watch?v=abc",
        )
        prompt = build_prompt(
            creator_history=[], hook_candidates=[c],
            video_meta={"title": "Test", "duration": 60.0},
        )
        assert "[surgery: ±5.0s padding]" in prompt
        assert "[will cut source t=5.0s-17.0s]" in prompt
