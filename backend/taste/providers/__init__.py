"""
LLM provider abstraction for the taste-aware clip selector.

Each provider implements the `LLMProvider` ABC:
    - name: short identifier (used in logs and metrics)
    - generate(prompt: str) -> str: send a prompt, return raw text response
    - cost_per_1k_tokens: float (0.0 for free tiers)
    - available() -> bool: check if the provider is usable in this env

Selection logic lives in `select_provider()` which picks the highest-priority
available provider.

When Claude credits land, `ClaudeProvider` becomes usable automatically.
Until then, `MiniMaxProvider` is the zero-cost default.
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


class MiniMaxProvider(LLMProvider):
    """MiniMax direct provider — zero cost, decent prompt-following.

    Default when no other provider is configured. Useful for development
    and as a free fallback.
    """

    name = "MiniMax"
    cost_per_1k_tokens = 0.0

    def __init__(self, model: str = "MiniMax/MiniMax-M3"):
        self.model = model

    def generate(self, prompt: str, max_tokens: int = 1024) -> str:
        # In a real deployment, this would call the MiniMax API.
        # For now, the orchestrator passes llm_callable directly when this
        # provider is selected, so this method is only invoked in tests
        # that exercise the provider contract.
        raise NotImplementedError(
            "MiniMaxProvider.generate must be wired with an llm_callable "
            "or replaced with a real API client. See provider_factory."
        )

    def available(self) -> bool:
        # Always available — the orchestrator supplies the callable.
        return True


class ClaudeProvider(LLMProvider):
    """Anthropic Claude provider.

    Activated when `ANTHROPIC_API_KEY` is set in the environment. Picks
    claude-3-5-sonnet by default (best cost/quality for structured output).
    """

    name = "claude"
    cost_per_1k_tokens = 0.003  # input, sonnet; output is $0.015

    def __init__(self, model: str = "claude-haiku-4-5-20251001"):
        self.model = model
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


class DeepseekProvider(LLMProvider):
    """Deepseek provider — open-source-class quality, low cost.

    Activated when `DEEPSEEK_API_KEY` is set. Useful as a middle-tier
    alternative when Claude is overkill for the task.
    """

    name = "deepseek"
    cost_per_1k_tokens = 0.00014  # input

    def __init__(self, model: str = "deepseek-chat"):
        self.model = model
        try:
            import openai  # type: ignore
            self._openai = openai
            self._client: Optional["openai.OpenAI"] = None
        except ImportError:
            self._openai = None
            self._client = None

    def _get_client(self):
        if self._client is None and self._openai is not None:
            api_key = _env("DEEPSEEK_API_KEY")
            if not api_key:
                raise RuntimeError("DEEPSEEK_API_KEY not set")
            self._client = self._openai.OpenAI(
                api_key=api_key, base_url="https://api.deepseek.com/v1"
            )
        return self._client

    def generate(self, prompt: str, max_tokens: int = 1024) -> str:
        client = self._get_client()
        if client is None:
            raise RuntimeError("openai SDK not installed (deepseek uses OpenAI-compat API)")
        resp = client.chat.completions.create(
            model=self.model,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
        return resp.choices[0].message.content or ""

    def available(self) -> bool:
        if not _env("DEEPSEEK_API_KEY"):
            return False
        if self._openai is None:
            log.warning("openai SDK not installed; DeepseekProvider unavailable")
            return False
        return True


# Priority order: claude > deepseek > MiniMax
PROVIDER_PRIORITY = [ClaudeProvider, DeepseekProvider, MiniMaxProvider]


def select_provider() -> LLMProvider:
    """Pick the highest-priority available provider.

    Falls back to MiniMaxProvider (always available) if no key is set.
    """
    for cls in PROVIDER_PRIORITY:
        try:
            p = cls()
            if p.available():
                return p
        except Exception as e:
            log.debug(f"provider {cls.__name__} init failed: {e}")
    return MiniMaxProvider()
