"""
Groq LLM client — OpenAI-compatible, free tier, fastest inference in the world.

Sign-up (no credit card): https://console.groq.com/ → API Keys
Free tier: 30 req/min, ~14,400 req/day on llama-3.3-70b-versatile.

The chain in chain.py will try groq first if GROQ_API_KEY is set.
"""
import logging
import os

import httpx

log = logging.getLogger(__name__)

GROQ_BASE_URL = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
# Available free models (as of 2026-06):
#   llama-3.3-70b-versatile        — best quality, 30 req/min
#   llama-3.1-8b-instant           — fastest, 30 req/min
#   mixtral-8x7b-32768             — 32K context, 30 req/min
#   gemma2-9b-it                   — Google, 15 req/min


def is_groq_available() -> bool:
    return bool(os.getenv("GROQ_API_KEY", ""))


def generate(prompt: str, model: str | None = None, max_tokens: int = 2048) -> str:
    """Call Groq chat completions (OpenAI-compatible).

    Returns the assistant's text content. Raises on any non-2xx.
    """
    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY not set")

    chosen_model = model or GROQ_MODEL
    payload = {
        "model": chosen_model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens,
        "temperature": 0.4,  # taste selection should be deterministic-ish
    }
    with httpx.Client(timeout=120.0) as client:
        r = client.post(
            f"{GROQ_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
    if r.status_code != 200:
        # Surface a clean error for the circuit breaker
        body = r.text[:400]
        raise RuntimeError(f"Groq API error {r.status_code}: {body}")
    body = r.json()
    choices = body.get("choices") or []
    if not choices:
        raise RuntimeError("Groq returned no choices")
    return choices[0].get("message", {}).get("content", "")
