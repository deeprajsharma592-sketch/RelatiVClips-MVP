"""Tests for the LLM provider abstraction.

Mocks the underlying SDKs so we can exercise the contract without keys.
"""
import pytest

from backend.taste.providers import (
    LLMProvider, ClaudeProvider, OpenRouterHaikuProvider, OpenRouterDeepSeekProvider,
    select_provider, PROVIDER_PRIORITY,
)


class TestProviderContract:
    def test_claude_unavailable_without_key(self, monkeypatch):
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
        p = ClaudeProvider()
        assert p.available() is False

    def test_claude_available_with_key(self, monkeypatch):
        monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
        # anthropic SDK may or may not be installed; treat unavailability
        # as acceptable when SDK is missing.
        p = ClaudeProvider()
        # We just verify the key check works; SDK presence is environment-dependent
        if p._anthropic is None:
            # SDK not installed → provider correctly reports unavailable
            assert p.available() is False
        else:
            assert p.available() is True

    def test_openrouter_transports_require_key(self, monkeypatch):
        monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
        assert OpenRouterHaikuProvider().available() is False
        assert OpenRouterDeepSeekProvider().available() is False
        monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
        assert OpenRouterHaikuProvider().available() is True
        assert OpenRouterDeepSeekProvider().available() is True


class TestSelectProvider:
    def test_raises_when_no_approved_provider_is_configured(self, monkeypatch):
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
        monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
        with pytest.raises(RuntimeError, match="No approved RelatiV"):
            select_provider()

    def test_priority_order(self):
        assert PROVIDER_PRIORITY == [
            ClaudeProvider,
            OpenRouterHaikuProvider,
            OpenRouterDeepSeekProvider,
        ]


class TestProviderABC:
    def test_abstract_cannot_instantiate(self):
        with pytest.raises(TypeError):
            LLMProvider()
