"""Strict OpenRouter fallbacks for RelatiVSauce calibration.

Only the two model IDs in this module are permitted in the production
fallback chain. Do not replace them with aliases such as ``latest`` or
``auto``: aliases can silently route calibration to a different model.
"""
from __future__ import annotations

import httpx

from ..taste.icl import RELATIVSAUCE_SYSTEM_PROMPT
from ..utils.config import OPENROUTER_API_KEY, OPENROUTER_BASE_URL


OPENROUTER_HAIKU_MODEL = "anthropic/claude-haiku-5.5"
OPENROUTER_DEEPSEEK_MODEL = "deepseek/deepseek-v4.1-flash-1017"
ALLOWED_MODELS = frozenset({OPENROUTER_HAIKU_MODEL, OPENROUTER_DEEPSEEK_MODEL})


def is_openrouter_available() -> bool:
    return bool(OPENROUTER_API_KEY)


def _generate(prompt: str, *, model: str, max_tokens: int = 3000, timeout_s: float = 120.0) -> str:
    if not OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY not set")
    if model not in ALLOWED_MODELS:
        raise RuntimeError(f"Unapproved OpenRouter model: {model}")

    payload = {
        "model": model,
        "max_tokens": max_tokens,
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": RELATIVSAUCE_SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
    }
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://relativclips.com",
        "X-Title": "RelatiV Clips",
    }
    url = f"{OPENROUTER_BASE_URL.rstrip('/')}/chat/completions"
    with httpx.Client(timeout=timeout_s, trust_env=False) as client:
        response = client.post(url, json=payload, headers=headers)
    if response.status_code != 200:
        raise RuntimeError(
            f"OpenRouter {model} error {response.status_code}: {response.text[:300]}"
        )

    body = response.json()
    try:
        content = body["choices"][0]["message"]["content"] or ""
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError(f"OpenRouter {model} response missing content: {body}") from exc
    if not content.strip():
        raise RuntimeError(f"OpenRouter {model} returned empty content")

    usage = body.get("usage") or {}
    input_tokens = int(usage.get("prompt_tokens") or 0)
    output_tokens = int(usage.get("completion_tokens") or 0)
    if input_tokens or output_tokens:
        from . import cost_control
        cost_control.record_call(model, input_tokens, output_tokens)
    return content


def generate_haiku(prompt: str, max_tokens: int = 3000) -> str:
    return _generate(prompt, model=OPENROUTER_HAIKU_MODEL, max_tokens=max_tokens)


def generate_deepseek(prompt: str, max_tokens: int = 3000) -> str:
    return _generate(prompt, model=OPENROUTER_DEEPSEEK_MODEL, max_tokens=max_tokens)

