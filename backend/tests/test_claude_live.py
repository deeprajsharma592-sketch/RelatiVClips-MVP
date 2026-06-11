"""Live integration test: real Claude API call. Skipped if no key."""
import os
import sys

import pytest

from dotenv import load_dotenv
load_dotenv()  # Ensure .env is loaded so the key check below works


def _has_dotenv_key() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY"))


# These tests hit the real Anthropic API. They cost ~$0.001 each.
# Skip when no key is set so CI / local dev without keys still passes.
pytestmark = pytest.mark.skipif(
    not _has_dotenv_key(),
    reason="ANTHROPIC_API_KEY not set (live test)"
)


def test_select_provider_picks_claude_with_real_key():
    """When ANTHROPIC_API_KEY is set, select_provider returns ClaudeProvider."""
    from backend.taste.providers import select_provider, ClaudeProvider
    p = select_provider()
    assert isinstance(p, ClaudeProvider), f"Expected ClaudeProvider, got {type(p).__name__}"


def test_claude_round_trip_live():
    """Real API call — confirms auth + connectivity work."""
    from backend.taste.providers import ClaudeProvider
    p = ClaudeProvider()
    resp = p.generate("Reply with the single word: PONG. Nothing else.", max_tokens=10)
    assert "PONG" in resp.upper()


def test_claude_returns_structured_json():
    """Real API call — confirms Claude can produce ICL-format JSON."""
    import json
    import re
    from backend.taste.providers import ClaudeProvider
    p = ClaudeProvider()
    prompt = (
        "Return ONLY a JSON array. Each item: "
        '{"candidate_index": N, "edit_reason": "..."}. '
        "Pick the best 1 of:\n"
        "1: score=0.8, text='The secret to success'\n"
        "2: score=0.5, text='In the beginning'"
    )
    resp = p.generate(prompt, max_tokens=200)
    m = re.search(r"\[.*\]", resp, re.DOTALL)
    assert m, f"No JSON array in response: {resp!r}"
    data = json.loads(m.group(0))
    assert isinstance(data, list)
    assert len(data) >= 1
    assert "candidate_index" in data[0]
