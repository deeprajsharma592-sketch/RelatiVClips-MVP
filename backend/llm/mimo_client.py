"""Xiaomi MiMo V2.6 Pro client for RelatiVSauce clip calibration.

MiMo exposes an OpenAI-compatible chat-completions endpoint. The client keeps
the stable RelatiVSauce instructions in the system message and the per-video
transcript in the user message, matching the Claude path.
"""
from __future__ import annotations

import httpx

from ..taste.icl import RELATIVSAUCE_SYSTEM_PROMPT
from ..utils.config import MIMO_API_KEY, MIMO_BASE_URL, MIMO_MODEL


def is_mimo_available() -> bool:
    return bool(MIMO_API_KEY)


def generate(prompt: str, max_tokens: int = 3000, timeout_s: float = 120.0) -> str:
    if not MIMO_API_KEY:
        raise RuntimeError("MIMO_API_KEY not set")

    payload = {
        "model": MIMO_MODEL,
        "max_completion_tokens": max_tokens,
        "temperature": 0.2,
        "thinking": {"type": "disabled"},
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": RELATIVSAUCE_SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
    }
    headers = {
        "Authorization": f"Bearer {MIMO_API_KEY}",
        "Content-Type": "application/json",
    }
    url = f"{MIMO_BASE_URL.rstrip('/')}/chat/completions"
    with httpx.Client(timeout=timeout_s, trust_env=False) as client:
        response = client.post(url, json=payload, headers=headers)
    if response.status_code != 200:
        raise RuntimeError(f"MiMo API error {response.status_code}: {response.text[:300]}")

    body = response.json()
    try:
        content = body["choices"][0]["message"]["content"] or ""
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError(f"MiMo response missing content: {body}") from exc
    if not content.strip():
        raise RuntimeError("MiMo returned empty content")

    usage = body.get("usage") or {}
    input_tokens = int(usage.get("prompt_tokens") or 0)
    output_tokens = int(usage.get("completion_tokens") or 0)
    if input_tokens or output_tokens:
        from . import cost_control
        cost_control.record_call(MIMO_MODEL, input_tokens, output_tokens)
    return content
