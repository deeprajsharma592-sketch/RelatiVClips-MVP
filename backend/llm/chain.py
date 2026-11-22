"""
LLM chain with circuit breaker and provider fallback.

Goal: never let a single provider failure take down the pipeline.

The production calibration order is fixed and cannot be configured:
  1. Claude Haiku 4.5 via Anthropic
  2. Claude Haiku 4.5 via OpenRouter
  3. DeepSeek V4.1 Flash 1017 via OpenRouter

No auto-router, latest alias, MiMo, Groq, MiniMax, or other model is allowed
in this path.

On every LLM call failure we update a per-provider circuit breaker. If a
provider has failed N times in a row (default 3), we skip it for the
cooldown window (default 60s) and try the next one in the chain.

If all providers fail (or none are configured), we fall back to the
energy-based heuristic via `taste.selector._fallback_selection`.
"""
import logging
import os
import time
from threading import RLock
from typing import Callable, List, Optional, Tuple

# Import config FIRST so load_dotenv() has run before reading env.
from ..utils import config  # noqa: F401 — side effect: load_dotenv
from ..utils.config import (
    LLM_PROVIDER,
    LLM_CIRCUIT_BREAKER_THRESHOLD,
    LLM_CIRCUIT_BREAKER_RESET_S,
    ANTHROPIC_API_KEY,
    OPENROUTER_API_KEY,
)

log = logging.getLogger(__name__)


# --- Circuit breaker state (per-process, in-memory) ---
# Maps provider name -> {"failures": int, "opened_at": float | None}
_BREAKER_STATE: dict = {}
_BREAKER_LOCK = RLock()
_AVAILABLE_CLAUDE_MODELS: Optional[List[str]] = None


def _get_available_claude_models() -> List[str]:
    """Auto-detect valid models directly from Anthropic API to prevent 404 errors."""
    global _AVAILABLE_CLAUDE_MODELS
    if _AVAILABLE_CLAUDE_MODELS is not None:
        return _AVAILABLE_CLAUDE_MODELS
    import httpx
    try:
        with httpx.Client(timeout=5.0, trust_env=False) as client:
            r = client.get(
                "https://api.anthropic.com/v1/models",
                headers={
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                },
            )
            if r.status_code == 200:
                data = r.json()
                models = [m.get("id") for m in data.get("data", []) if m.get("id")]
                if models:
                    _AVAILABLE_CLAUDE_MODELS = models
                    log.info(f"Discovered available Anthropic models: {models}")
                    return _AVAILABLE_CLAUDE_MODELS
            else:
                log.warning(f"Anthropic /v1/models returned HTTP {r.status_code}: {r.text[:200]}")
    except Exception as e:
        log.warning(f"Could not auto-fetch Anthropic models list: {e}")
    return []


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
        # All approved providers share the exact stable calibration instructions.
        from ..taste.icl import RELATIVSAUCE_SYSTEM_PROMPT
        system_prompt = RELATIVSAUCE_SYSTEM_PROMPT
        candidate_models = ["claude-haiku-4-5-20251001"]

        last_error = None
        for current_model in candidate_models:
            try:
                print(f"[Claude] Calling Anthropic API with model: {current_model}...")
                with httpx.Client(timeout=90.0, trust_env=False) as client:
                    payload = {
                        "model": current_model,
                        "max_tokens": max_out,
                        # The master V2 prompt is identical across videos. Mark
                        # only this stable system block cacheable; the transcript
                        # remains a normal request-specific user message.
                        "system": [{
                            "type": "text",
                            "text": system_prompt,
                            "cache_control": {"type": "ephemeral"},
                        }],
                        "messages": [{"role": "user", "content": prompt}],
                    }
                    r = client.post(
                        "https://api.anthropic.com/v1/messages",
                        headers={
                            "x-api-key": ANTHROPIC_API_KEY,
                            "anthropic-version": "2023-06-01",
                            "anthropic-beta": "prompt-caching-2024-07-31",
                            "content-type": "application/json",
                        },
                        json=payload,
                    )
                if r.status_code == 200:
                    body = r.json()
                    usage = body.get("usage", {})
                    in_tok = int(usage.get("input_tokens", 0))
                    out_tok = int(usage.get("output_tokens", 0))
                    cache_read = int(usage.get("cache_read_input_tokens", 0))
                    if in_tok or out_tok:
                        cost_control.record_call(current_model, in_tok, out_tok, cache_read=cache_read)
                        est_cost = cost_control.estimate_cost_usd(
                            current_model, in_tok, out_tok, cache_read=cache_read
                        )
                        model_router.record_pick(current_model, est_cost)
                    for block in body.get("content", []):
                        if block.get("type") == "text":
                            print(f"[Claude] SUCCESS with {current_model} (tokens: in={in_tok}, out={out_tok})")
                            return block.get("text", "")
                    full_text = "".join(b.get("text", "") for b in body.get("content", []) if isinstance(b, dict))
                    if full_text:
                        print(f"[Claude] SUCCESS with {current_model} (combined text, tokens: in={in_tok}, out={out_tok})")
                        return full_text
                    raise RuntimeError(f"Claude returned no text block: {body}")
                last_error = f"Claude API error {r.status_code}: {r.text[:300]}"
                print(f"[Claude] Model {current_model} returned HTTP {r.status_code}: {r.text[:150]}")
                continue
            except Exception as exc:
                last_error = f"Claude model {current_model} call exception: {exc}"
                print(f"[Claude] Model {current_model} exception: {exc}")
                continue
        raise RuntimeError(last_error or "Claude API call failed")

    return _call


def _build_openrouter_haiku_callable() -> Optional[Callable[[str], str]]:
    if not OPENROUTER_API_KEY:
        return None
    from .openrouter_client import generate_haiku
    return generate_haiku


def _build_openrouter_deepseek_callable() -> Optional[Callable[[str], str]]:
    if not OPENROUTER_API_KEY:
        return None
    from .openrouter_client import generate_deepseek
    return generate_deepseek


# --- The chain ---


def _provider_chain(provider_override: Optional[str] = None) -> List[Tuple[str, Callable[[str], str]]]:
    """Return the immutable approved chain; ``provider_override`` is ignored."""
    claude = _build_claude_callable()
    openrouter_haiku = _build_openrouter_haiku_callable()
    openrouter_deepseek = _build_openrouter_deepseek_callable()
    chain: List[Tuple[str, Callable[[str], str]]] = []
    if claude:
        chain.append(("anthropic_direct_haiku_4_5", claude))
    if openrouter_haiku:
        chain.append(("openrouter_haiku_4_5", openrouter_haiku))
    if openrouter_deepseek:
        chain.append(("openrouter_deepseek_v4_1_flash_1017", openrouter_deepseek))
    return chain


def call_with_fallback(prompt: str, provider_override: Optional[str] = None) -> Tuple[Optional[str], Optional[str]]:
    """Try each provider in the chain until one succeeds.

    Returns (response_text, provider_name_used). Both are None on total
    failure — caller must then use the energy-based fallback.
    """
    chain = _provider_chain(provider_override)
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
        names.append("anthropic_direct_haiku_4_5")
    if OPENROUTER_API_KEY:
        names.extend(["openrouter_haiku_4_5", "openrouter_deepseek_v4_1_flash_1017"])
    return names


def chain_status() -> dict:
    """Health summary: which providers are configured, breaker states,
    current LLM_PROVIDER mode. Useful for ops dashboards."""
    return {
        "mode": LLM_PROVIDER,
        "providers_configured": available_providers(),
        "circuit_breakers": breaker_status(),
    }
