"""
LLM chain with circuit breaker and provider fallback.

Goal: never let a single provider failure take down the pipeline.

Selection logic (controlled by env LLM_PROVIDER):
  - "claude"   → use Claude only (elite tier)
  - "deepseek" → use DeepSeek only (budget tier)
  - "both"     → try Claude first, fall back to DeepSeek on failure
  - "auto"     → highest-priority available (claude > deepseek > minimax)

On every LLM call failure we update a per-provider circuit breaker. If a
provider has failed N times in a row (default 3), we skip it for the
cooldown window (default 60s) and try the next one in the chain.

If all providers fail (or none are configured), we fall back to the
energy-based heuristic via `taste.selector._fallback_selection`.
"""
import logging
import os
import time
from threading import Lock
from typing import Callable, List, Optional, Tuple

# Import config FIRST so load_dotenv() has run before reading env.
from ..utils import config  # noqa: F401 — side effect: load_dotenv
from ..utils.config import (
    LLM_PROVIDER,
    LLM_CIRCUIT_BREAKER_THRESHOLD,
    LLM_CIRCUIT_BREAKER_RESET_S,
    ANTHROPIC_API_KEY,
    DEEPSEEK_API_KEY,
)

log = logging.getLogger(__name__)


# --- Circuit breaker state (per-process, in-memory) ---
# Maps provider name -> {"failures": int, "opened_at": float | None}
_BREAKER_STATE: dict = {}
_BREAKER_LOCK = Lock()


def _breaker_key(provider_name: str) -> str:
    return provider_name.lower()


def _is_breaker_open(provider_name: str) -> bool:
    """Return True if the breaker is open (provider should be skipped)."""
    key = _breaker_key(provider_name)
    with _BREAKER_LOCK:
        st = _BREAKER_STATE.get(key)
        if not st:
            return False
        if st["failures"] < LLM_CIRCUIT_BREAKER_THRESHOLD:
            return False
        opened_at = st.get("opened_at")
        if opened_at is None:
            return False
        # Auto-reset after cooldown
        if time.monotonic() - opened_at > LLM_CIRCUIT_BREAKER_RESET_S:
            log.info(f"Circuit breaker reset for {provider_name}")
            st["failures"] = 0
            st["opened_at"] = None
            return False
        return True


def _record_success(provider_name: str) -> None:
    with _BREAKER_LOCK:
        _BREAKER_STATE[_breaker_key(provider_name)] = {
            "failures": 0,
            "opened_at": None,
        }


def _record_failure(provider_name: str, error: str) -> None:
    with _BREAKER_LOCK:
        key = _breaker_key(provider_name)
        st = _BREAKER_STATE.setdefault(key, {"failures": 0, "opened_at": None})
        st["failures"] += 1
        if st["failures"] >= LLM_CIRCUIT_BREAKER_THRESHOLD and st["opened_at"] is None:
            st["opened_at"] = time.monotonic()
            log.warning(
                f"Circuit breaker OPENED for {provider_name} after "
                f"{st['failures']} consecutive failures. Last error: {error}"
            )


def breaker_status() -> dict:
    """Snapshot of circuit breaker state (for /healthz-style diagnostics)."""
    with _BREAKER_LOCK:
        return {
            k: {
                "failures": v["failures"],
                "opened_at": v["opened_at"],
                "open": _is_breaker_open(k),
            }
            for k, v in _BREAKER_STATE.items()
        }


# --- Provider callable factory ---


def _build_claude_callable() -> Optional[Callable[[str], str]]:
    """Return a callable that calls Claude, or None if not configured."""
    if not ANTHROPIC_API_KEY:
        return None
    try:
        from .claude_client import _build_viral_prompt
    except ImportError:
        return None
    # Use the existing select_clips_with_claude flow, but extract a plain
    # "prompt → text" callable for the chain. We do this by re-using
    # select_clips_with_claude's internal httpx call pattern is heavy; instead
    # we build a simpler "send prompt, return text" wrapper here.
    def _call(prompt: str) -> str:
        from . import cost_control, model_router
        import httpx
        max_out = cost_control.LLM_MAX_OUTPUT_TOKENS
        # Use the router to pick the model (and enable prompt caching for Haiku)
        model_name, tier, _ = model_router.pick_model()
        # System prompt (user-defined 2026-06-15). Cached after first call so
        # subsequent calls only pay $0.10/MTok for this ~50-token block.
        system_prompt = (
            "Analyze the audio and text data. Provide the timestamps for the "
            "best clip, followed by a short, 4 to 5-word note explaining what "
            "is happening, and a brief, single-sentence reason for why this "
            "segment was selected."
        )
        # Prompt caching: split into stable (cacheable) + variable parts.
        # Our ICL prompt is ~800 stable tokens, followed by per-request context.
        # Splitting at the last "---" line — the ICL ends with examples, the
        # variable context is the new moment data after that.
        # Strategy: mark the first ~80% of the prompt as cacheable.
        split_point = int(len(prompt) * 0.80)
        # Find the last newline before split_point so we don't cut mid-line
        last_nl = prompt.rfind("\n", 0, split_point)
        if last_nl > 0:
            split_point = last_nl
        cacheable = prompt[:split_point]
        variable = prompt[split_point:]
        use_cache = (
            model_name.startswith("claude-")
            and "haiku" in model_name
        )
        with httpx.Client(timeout=120.0) as client:
            payload = {
                "model": model_name,
                "max_tokens": max_out,
                "messages": [{"role": "user", "content": prompt}],
            }
            if use_cache:
                # Build system array: system_prompt (stable, cached) +
                # cacheable portion of user prompt (mostly-stable, cached)
                payload["system"] = [
                    {
                        "type": "text",
                        "text": system_prompt,
                        "cache_control": {"type": "ephemeral"},
                    },
                    {
                        "type": "text",
                        "text": cacheable,
                        "cache_control": {"type": "ephemeral"},
                    },
                ]
                # Move the variable part of user prompt to messages
                payload["messages"] = [{"role": "user", "content": variable}]
            else:
                # No cache (e.g. Sonnet) — system prompt still sent but
                # billed at standard input rate
                payload["system"] = system_prompt
            r = client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json=payload,
            )
        if r.status_code != 200:
            raise RuntimeError(
                f"Claude API error {r.status_code}: {r.text[:300]}"
            )
        body = r.json()
        # Record real token usage from the response
        usage = body.get("usage", {})
        in_tok = int(usage.get("input_tokens", 0))
        out_tok = int(usage.get("output_tokens", 0))
        cache_read = int(usage.get("cache_read_input_tokens", 0))
        if in_tok or out_tok:
            cost_control.record_call(model_name, in_tok, out_tok, cache_read=cache_read)
            # Estimate cost and feed the router
            est_cost = cost_control.estimate_cost_usd(
                model_name, in_tok, out_tok, cache_read=cache_read
            )
            model_router.record_pick(model_name, est_cost)
        for block in body.get("content", []):
            if block.get("type") == "text":
                return block.get("text", "")
        raise RuntimeError("Claude returned no text block")

    return _call


def _build_deepseek_callable() -> Optional[Callable[[str], str]]:
    """Return a callable that calls DeepSeek, or None if not configured."""
    if not DEEPSEEK_API_KEY:
        return None
    from .deepseek_client import generate as _ds_generate
    return _ds_generate


def _build_groq_callable() -> Optional[Callable[[str], str]]:
    """Return a callable that calls Groq, or None if not configured."""
    if not os.getenv("GROQ_API_KEY", ""):
        return None
    from .groq_client import generate as _groq_generate
    return _groq_generate


def _build_minimax_callable() -> Optional[Callable[[str], str]]:
    """Return a callable that calls MiniMax M3, or None if not configured.

    MiniMax is the cheap-fallback tier — always-on safety net per user request
    2026-06-15. OpenAI-compatible, so the same call pattern as Groq works.
    """
    if not os.getenv("MINIMAX_API_KEY", ""):
        return None
    from .minimax_client import generate as _minimax_generate
    return _minimax_generate


# --- The chain ---


def _provider_chain() -> List[Tuple[str, Callable[[str], str]]]:
    """Return ordered list of (provider_name, callable) based on LLM_PROVIDER.

    Empty list means no provider is configured — callers must fall back
    to the energy-based heuristic.
    """
    groq = _build_groq_callable()
    claude = _build_claude_callable()
    deepseek = _build_deepseek_callable()
    minimax = _build_minimax_callable()

    if LLM_PROVIDER == "claude":
        return [("claude", claude)] if claude else []
    if LLM_PROVIDER == "deepseek":
        return [("deepseek", deepseek)] if deepseek else []
    if LLM_PROVIDER == "groq":
        return [("groq", groq)] if groq else []
    if LLM_PROVIDER == "minimax":
        return [("minimax", minimax)] if minimax else []
    if LLM_PROVIDER == "both":
        chain = []
        if claude:
            chain.append(("claude", claude))
        if deepseek:
            chain.append(("deepseek", deepseek))
        if minimax:
            chain.append(("minimax", minimax))
        if groq:
            chain.append(("groq", groq))
        return chain
    # "auto" / default: claude > deepseek > groq > minimax
    # (MiniMax is the cheap-fallback safety net per user 2026-06-15)
    chain = []
    if claude:
        chain.append(("claude", claude))
    if deepseek:
        chain.append(("deepseek", deepseek))
    if groq:
        chain.append(("groq", groq))
    if minimax:
        chain.append(("minimax", minimax))
    return chain


def call_with_fallback(prompt: str) -> Tuple[Optional[str], Optional[str]]:
    """Try each provider in the chain until one succeeds.

    Returns (response_text, provider_name_used). Both are None on total
    failure — caller must then use the energy-based fallback.
    """
    chain = _provider_chain()
    if not chain:
        log.info("LLM chain is empty (no provider configured)")
        return None, None

    for name, fn in chain:
        if _is_breaker_open(name):
            log.info(f"Skipping {name}: circuit breaker open")
            continue
        try:
            text = fn(prompt)
            if text:
                _record_success(name)
                log.info(f"LLM call succeeded via {name}")
                return text, name
        except Exception as e:
            _record_failure(name, str(e)[:200])
            log.warning(f"LLM call via {name} failed: {e}")
            continue

    log.warning("All LLM providers failed (or breakers open)")
    return None, None


def available_providers() -> List[str]:
    """Return the names of providers that are configured (ignoring breakers)."""
    names = []
    if ANTHROPIC_API_KEY:
        names.append("claude")
    if DEEPSEEK_API_KEY:
        names.append("deepseek")
    if os.getenv("GROQ_API_KEY", ""):
        names.append("groq")
    if os.getenv("MINIMAX_API_KEY", ""):
        names.append("minimax")
    return names


def chain_status() -> dict:
    """Health summary: which providers are configured, breaker states,
    current LLM_PROVIDER mode. Useful for ops dashboards."""
    return {
        "mode": LLM_PROVIDER,
        "providers_configured": available_providers(),
        "circuit_breakers": breaker_status(),
    }
