"""
LLM provider abstraction for the taste-aware clip selector.

Each provider implements the `LLMProvider` ABC:
    - name: short identifier (used in logs and metrics)
    - generate(prompt: str) -> str: send a prompt, return raw text response
    - cost_per_1k_tokens: float (0.0 for free tiers)
    - available() -> bool: check if the provider is usable in this env

Selection is deliberately restricted to the three approved transports.
"""
import logging
from abc import ABC, abstractmethod
from typing import Optional

# Import config FIRST to ensure load_dotenv() has run before we read env.
# This makes provider init order-independent of where it was imported from.
from backend.utils import config  # noqa: F401 — side effect: load_dotenv

log = logging.getLogger(__name__)


def _env(name: str) -> str:
    """Read an env var via the loaded config, with fallback to os.environ.

    config.py runs load_dotenv() at import time, so this always sees the .env
    values regardless of import order.
    """
    import os
    return os.environ.get(name, "")


class LLMProvider(ABC):
    """Abstract base for LLM providers used in stage 6 of the pipeline."""

    name: str = "abstract"
    cost_per_1k_tokens: float = 0.0

    @abstractmethod
    def generate(self, prompt: str, max_tokens: int = 1024) -> str:
        """Send a prompt, return the raw text response. Raises on failure."""
        raise NotImplementedError

    def available(self) -> bool:
        """Return True if this provider is usable in the current environment."""
        return True


class ClaudeProvider(LLMProvider):
    """Anthropic Claude provider.

    Activated when `ANTHROPIC_API_KEY` is set in the environment. Picks
    claude-3-5-sonnet by default (best cost/quality for structured output).
    """

    name = "claude"
    cost_per_1k_tokens = 0.003  # input, sonnet; output is $0.015

    def __init__(self, model: Optional[str] = None):
        self.model = "claude-haiku-5-5"
        try:
            import anthropic  # type: ignore
            self._anthropic = anthropic
            self._client: Optional["anthropic.Anthropic"] = None
        except ImportError:
            self._anthropic = None
            self._client = None

    def _get_client(self):
        if self._client is None and self._anthropic is not None:
            api_key = _env("ANTHROPIC_API_KEY")
            if not api_key:
                raise RuntimeError("ANTHROPIC_API_KEY not set")
            self._client = self._anthropic.Anthropic(api_key=api_key)
        return self._client

    def generate(self, prompt: str, max_tokens: int = 1024) -> str:
        client = self._get_client()
        if client is None:
            raise RuntimeError("anthropic SDK not installed")
        msg = client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
        # Concatenate all text blocks
        return "".join(
            block.text for block in msg.content if getattr(block, "type", None) == "text"
        )

    def available(self) -> bool:
        if not _env("ANTHROPIC_API_KEY"):
            return False
        if self._anthropic is None:
            log.warning("anthropic SDK not installed; ClaudeProvider unavailable")
            return False
        return True


class OpenRouterHaikuProvider(LLMProvider):
    name = "openrouter_haiku_5_5"
    cost_per_1k_tokens = 0.00010
    model = "anthropic/claude-haiku-5.5"

    def generate(self, prompt: str, max_tokens: int = 1024) -> str:
        from backend.llm.openrouter_client import generate_haiku
        return generate_haiku(prompt, max_tokens=max_tokens)

    def available(self) -> bool:
        return bool(_env("OPENROUTER_API_KEY"))


class OpenRouterDeepSeekProvider(LLMProvider):
    name = "openrouter_deepseek_v4_1_flash_1017"
    cost_per_1k_tokens = 0.000036
    model = "deepseek/deepseek-v4.1-flash-1017"

    def generate(self, prompt: str, max_tokens: int = 1024) -> str:
        from backend.llm.openrouter_client import generate_deepseek
        return generate_deepseek(prompt, max_tokens=max_tokens)

    def available(self) -> bool:
        return bool(_env("OPENROUTER_API_KEY"))


# Immutable production order. Do not add auto routers or additional models.
PROVIDER_PRIORITY = [ClaudeProvider, OpenRouterHaikuProvider, OpenRouterDeepSeekProvider]


def select_provider() -> LLMProvider:
    """Pick the highest-priority available provider.

    Raises when none of the three approved transports is configured.
    """
    for cls in PROVIDER_PRIORITY:
        try:
            p = cls()
            if p.available():
                return p
        except Exception as e:
            log.debug(f"provider {cls.__name__} init failed: {e}")
    raise RuntimeError("No approved RelatiV calibration provider is configured")
