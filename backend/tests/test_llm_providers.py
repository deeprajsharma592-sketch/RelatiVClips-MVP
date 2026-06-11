"""Tests for the LLM provider abstraction.

Mocks the underlying SDKs so we can exercise the contract without keys.
"""
import os
import pytest

from backend.taste.providers import (
    LLMProvider, MiniMaxProvider, ClaudeProvider, DeepseekProvider,
    select_provider, PROVIDER_PRIORITY,
)


class TestProviderContract:
    def test_minimax_available_by_default(self):
        p = MiniMaxProvider()
        assert p.available() is True
        assert p.name == "MiniMax"
        assert p.cost_per_1k_tokens == 0.0

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

    def test_deepseek_unavailable_without_key(self, monkeypatch):
        monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
        p = DeepseekProvider()
        assert p.available() is False


class TestSelectProvider:
    def test_falls_back_to_minimax(self, monkeypatch):
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
        monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
        p = select_provider()
        # MiniMax should be the last-resort fallback
        assert p.name == "MiniMax"

    def test_priority_order(self):
        # Sanity check: claude comes first (per user preference)
        assert PROVIDER_PRIORITY[0] is ClaudeProvider
        assert PROVIDER_PRIORITY[1] is DeepseekProvider
        assert PROVIDER_PRIORITY[2] is MiniMaxProvider


class TestProviderABC:
    def test_abstract_cannot_instantiate(self):
        with pytest.raises(TypeError):
            LLMProvider()
