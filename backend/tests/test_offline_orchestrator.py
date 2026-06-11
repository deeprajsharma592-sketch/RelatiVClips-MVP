"""
Offline E2E test: replay a saved VTT through the orchestrator's taste path.

Useful when YouTube is rate-limiting us (real anti-bot response, not a code
bug). The test:
  1. Loads a previously-saved VTT from temp/ (from a real /transcript call)
  2. Builds hook candidates from the transcript segments
  3. Runs the ICL prompt against the real Claude provider
  4. Ranks the picks into final clips

This proves the ICL → Claude → selector chain works on REAL transcript text
without needing YouTube to be available.

If no VTT files exist in temp/, the test is skipped (vacuously true).
"""
import os
from pathlib import Path

import pytest

TEMP_DIR = Path("/app/RelatiV/temp")
MIN_VTT_BYTES = 5_000  # skip empty/440-byte bot-detection stubs


def _find_largest_subs_vtt() -> Path | None:
    """Find the largest saved *.en.vtt in temp/ that has real content."""
    if not TEMP_DIR.exists():
        return None
    candidates = sorted(
        TEMP_DIR.glob("*_subs.en.vtt"),
        key=lambda p: p.stat().st_size,
        reverse=True,
    )
    for c in candidates:
        if c.stat().st_size >= MIN_VTT_BYTES:
            return c
    return None


class TestOfflineOrchestrator:
    """Replay a saved VTT through the orchestrator's downstream stages."""

    def test_icl_to_claude_to_selector_chain(self):
        """Prove the taste pipeline works on real transcript text."""
        vtt = _find_largest_subs_vtt()
        if vtt is None:
            pytest.skip(
                "No saved VTT in temp/ (run the live /transcript endpoint first "
                "to seed one) — nothing to replay"
            )

        from backend.pipeline.transcript_fetcher import _parse_vtt
        from backend.taste.icl import HookCandidate, build_prompt, parse_response
        from backend.taste.selector import rank_candidates

        segments = _parse_vtt(str(vtt))
        if len(segments) < 5:
            pytest.skip(f"VTT {vtt.name} has only {len(segments)} segments — too sparse")
        print(f"\n  ✓ Loaded {vtt.name} ({vtt.stat().st_size} bytes, {len(segments)} segments)")

        # Build hook candidates from the first 15 transcript segments
        candidates = [
            HookCandidate(
                start=seg["start"],
                end=seg["end"] + 5.0,
                hook_score=0.5,
                components={"lexical": 0.3},
                reason=f"caption: {seg.get('text', '')[:60]}",
            )
            for seg in segments[:15]
        ]
        assert len(candidates) >= 5, f"Need ≥5 candidates for Claude to pick from, got {len(candidates)}"
        print(f"  ✓ Built {len(candidates)} hook candidates from transcript")

        # Build ICL prompt
        video_meta = {
            "title": "Replay (offline E2E)",
            "duration": segments[-1]["end"] + 10,
            "channel": "replay",
            "video_id": "replay",
        }
        prompt = build_prompt(
            creator_history=[],
            hook_candidates=candidates,
            video_meta=video_meta,
        )
        assert len(prompt) > 500, f"Prompt too small: {len(prompt)} chars"
        print(f"  ✓ Built ICL prompt ({len(prompt)} chars, ~{len(prompt)//4} tokens)")

        # Call Claude (real). If no key, skip the Claude-specific assertion.
        from backend.taste.providers import select_provider
        try:
            provider = select_provider()
        except Exception as e:
            pytest.skip(f"No LLM provider available: {e}")
        if provider.name == "none":
            pytest.skip("No LLM provider configured (set ANTHROPIC_API_KEY)")

        response_text = provider.generate(prompt)
        llm_picks = parse_response(response_text)
        assert llm_picks, f"Claude returned no picks. Raw: {response_text[:200]}"
        assert len(llm_picks) >= 1, f"Claude returned < 1 pick: {llm_picks}"
        print(f"  ✓ Claude returned {len(llm_picks)} picks")
        print(f"     first pick: {llm_picks[0]}")

        # Rank into final clips
        final = rank_candidates(
            [c.__dict__ for c in candidates],
            llm_picks,
            video_duration=video_meta["duration"],
        )
        assert final, "Selector returned no clips from Claude's picks"
        # Each clip must have a non-empty viral_title (one of our 2 production gates)
        for c in final:
            assert c.get("viral_title"), f"Clip missing viral_title: {c}"
            assert c.get("caption"), f"Clip missing caption: {c}"
            duration = c["end"] - c["start"]
            assert 10.0 <= duration <= 20.0, f"Clip duration out of window: {duration}s"
        print(f"  ✓ Selector ranked {len(final)} final clips with titles + captions")
        for i, c in enumerate(final):
            print(f"     [{i+1}] {c['start']:.1f}s-{c['end']:.1f}s  title={c.get('viral_title', '')}")
