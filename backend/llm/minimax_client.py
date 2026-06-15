"""
MiniMax M3 LLM client — OpenAI-compatible, used as cheap fallback in the tier router.

Why this provider:
  - Free / very cheap
  - OpenAI-compatible API (works with the standard chat completions format)
  - Available even when other providers are down
  - Selected by user (2026-06-15) as the primary fallback tier

Configure via env:
  MINIMAX_API_KEY  — required
  MINIMAX_BASE_URL — default https://api.minimax.io/v1
  MINIMAX_MODEL    — default minimax-m3
"""
import logging
import os

import httpx

log = logging.getLogger(__name__)

MINIMAX_BASE_URL = os.getenv("MINIMAX_BASE_URL", "https://api.minimax.io/v1")
MINIMAX_MODEL = os.getenv("MINIMAX_MODEL", "minimax-m3")


def is_minimax_available() -> bool:
    return bool(os.getenv("MINIMAX_API_KEY", ""))


def generate(prompt: str, model=None, max_tokens: int = 500) -> str:
    """Call MiniMax chat completions (OpenAI-compatible).

    Returns the assistant's text content. Raises on any non-2xx.
    """
    api_key = os.getenv("MINIMAX_API_KEY", "")
    if not api_key:
        raise RuntimeError("MINIMAX_API_KEY not set")

    chosen_model = model or MINIMAX_MODEL
    payload = {
        "model": chosen_model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens,
        "temperature": 0.4,
    }
    with httpx.Client(timeout=60.0) as client:
        r = client.post(
            f"{MINIMAX_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
    if r.status_code != 200:
        body = r.text[:400]
        raise RuntimeError(f"MiniMax API error {r.status_code}: {body}")
    body = r.json()
    choices = body.get("choices") or []
    if not choices:
        raise RuntimeError("MiniMax returned no choices")
    return choices[0].get("message", {}).get("content", "")
