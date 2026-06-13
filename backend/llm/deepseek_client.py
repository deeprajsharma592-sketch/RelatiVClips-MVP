"""
DeepSeek API client — cheaper alternative to Claude for taste/hook calibration.

Why DeepSeek:
  - ~30x cheaper than Claude Sonnet for structured output tasks
  - DeepSeek-V3 / deepseek-chat is on par with Claude 3.5 Sonnet for JSON output
  - OpenAI-compatible API → drop-in for the Claude ICL flow

Wire-compatible with `select_clips_with_claude` so the orchestrator can
swap providers with zero code change. Both functions return:
    {"clips": [{"start", "end", "viral_title", "caption",
                "hashtags", "story_score", "reason"}, ...]}

Setup:
  1. Get an API key at https://platform.deepseek.com/api_keys
  2. Set DEEPSEEK_API_KEY in .env
  3. Set LLM_PROVIDER=deepseek (or "both" to chain Claude→DeepSeek)

This client is intentionally a thin wrapper. The ICL prompt lives in
`backend/taste/icl.py` so both providers see the same prompt format.
"""
import json
import logging
import re
from typing import Optional

import httpx

from ..utils.config import DEEPSEEK_API_KEY, DEEPSEEK_MODEL, DEEPSEEK_BASE_URL

log = logging.getLogger(__name__)

DEEPSEEK_AVAILABLE = bool(DEEPSEEK_API_KEY)

CHAT_COMPLETIONS_URL = f"{DEEPSEEK_BASE_URL.rstrip('/')}/chat/completions"


def is_deepseek_available() -> bool:
    return bool(DEEPSEEK_API_KEY)


def generate(prompt: str, max_tokens: int = 2048, timeout_s: float = 120.0) -> str:
    """Send a prompt to DeepSeek and return the raw text response.

    Uses the OpenAI-compatible chat/completions endpoint. Raises on any
    transport / auth error so the caller can fall back to the next provider
    in the chain.
    """
    if not DEEPSEEK_AVAILABLE:
        raise RuntimeError("DEEPSEEK_API_KEY not set")

    payload = {
        "model": DEEPSEEK_MODEL,
        "max_tokens": max_tokens,
        "temperature": 0.2,
        "messages": [{"role": "user", "content": prompt}],
        # Force JSON when the model supports it (DeepSeek-V3 does)
        "response_format": {"type": "json_object"},
    }
    headers = {
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
        "Content-Type": "application/json",
    }
    with httpx.Client(timeout=timeout_s) as client:
        r = client.post(CHAT_COMPLETIONS_URL, json=payload, headers=headers)

    if r.status_code != 200:
        raise RuntimeError(
            f"DeepSeek API error {r.status_code}: {r.text[:300]}"
        )

    body = r.json()
    try:
        return body["choices"][0]["message"]["content"] or ""
    except (KeyError, IndexError, TypeError) as e:
        raise RuntimeError(f"DeepSeek response missing content: {body}") from e


def _parse_response(text: str) -> list:
    """Parse DeepSeek's JSON response into a list of clip dicts.

    Defensive: tolerates ```json fences, leading/trailing prose, and
    minor formatting slip-ups. Returns [] on failure (caller falls back).
    """
    text = (text or "").strip()
    if not text:
        return []

    # Strip code fences
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)

    # Try parsing the whole string first
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        # Try to extract the JSON object/array
        obj_match = re.search(r'\{\s*"clips"\s*:\s*\[', text, re.DOTALL)
        if obj_match:
            brace_count = 0
            start = obj_match.start()
            for i in range(start, len(text)):
                if text[i] == '{':
                    brace_count += 1
                elif text[i] == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        text = text[start:i + 1]
                        break
            try:
                data = json.loads(text)
            except json.JSONDecodeError:
                return []
        else:
            array_match = re.search(r"\[.*\]", text, re.DOTALL)
            if array_match:
                try:
                    data = json.loads("{\"clips\": " + array_match.group() + "}")
                except json.JSONDecodeError:
                    return []
            else:
                return []

    clips = data.get("clips", []) if isinstance(data, dict) else data
    if not isinstance(clips, list):
        return []

    # Normalize each clip's required fields
    normalized = []
    for c in clips:
        if not isinstance(c, dict):
            continue
        try:
            normalized.append({
                "start": float(c.get("start", 0)),
                "end": float(c.get("end", c.get("start", 0) + 15)),
                "viral_title": str(c.get("viral_title", ""))[:100],
                "caption": str(c.get("caption", ""))[:200],
                "hashtags": str(c.get("hashtags", ""))[:200],
                "story_score": int(c.get("story_score", 0)),
                "reason": str(c.get("reason", ""))[:500],
            })
        except (TypeError, ValueError):
            continue
    return normalized


def select_clips_with_deepseek(
    prompt: str,
    fallback_to_energy: bool = True,
) -> Optional[dict]:
    """High-level entry: send ICL prompt, return {"clips": [...]}.

    Returns None on failure if `fallback_to_energy` is True (caller
    should fall back to energy-based selection). The orchestrator's
    circuit breaker wraps this call.
    """
    if not DEEPSEEK_AVAILABLE:
        log.info("DeepSeek not configured, skipping")
        return None if fallback_to_energy else {"clips": []}

    try:
        text = generate(prompt)
        clips = _parse_response(text)
        if clips:
            log.info(f"DeepSeek selected {len(clips)} clips")
            return {"clips": clips}
        log.warning("DeepSeek returned no parseable clips")
    except Exception as e:
        log.warning(f"DeepSeek API call failed: {e}")
    return None if fallback_to_energy else {"clips": []}
