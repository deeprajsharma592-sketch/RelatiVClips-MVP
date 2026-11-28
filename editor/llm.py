"""One OpenAI-compatible chat client for every model call.

Provider, base URL, key and model all come from env (see ``engine_config``), so
swapping DeepSeek for OpenRouter, vLLM or a local llama.cpp server is config, not
code. Retries 429/5xx with backoff; raises ``LLMError`` for anything it cannot
recover.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from typing import Any, Mapping, Sequence

import engine_config


class LLMError(RuntimeError):
    """The endpoint failed after retries, or returned an unusable body."""


@dataclass
class LLMResponse:
    text: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    model: str = ""
    latency_s: float = 0.0
    raw: dict[str, Any] = field(default_factory=dict)

    @property
    def total_tokens(self) -> int:
        return self.prompt_tokens + self.completion_tokens


def _import_requests():
    try:
        import requests  # type: ignore

        return requests
    except ImportError as exc:  # pragma: no cover - dependency is in requirements
        raise LLMError("requests is not installed; pip install requests") from exc


class LLMClient:
    """Thin wrapper over ``POST {base_url}/chat/completions``."""

    def __init__(self, config: engine_config.LLMConfig | None = None, *, max_retries: int = 3):
        self.config = config or engine_config.llm_config("editor")
        self.max_retries = max_retries

    def chat(
        self,
        messages: Sequence[Mapping[str, Any]],
        *,
        temperature: float | None = None,
        max_tokens: int | None = None,
        json_mode: bool | None = None,
    ) -> LLMResponse:
        requests = _import_requests()
        if not self.config.api_key:
            raise LLMError(
                f"no API key for stage '{self.config.stage}'. Set EDIT_LLM_API_KEY "
                "(or DEEPSEEK_API_KEY / OPENROUTER_API_KEY), or use mock mode."
            )

        payload: dict[str, Any] = {
            "model": self.config.model,
            "messages": list(messages),
            "temperature": self.config.temperature if temperature is None else temperature,
            "max_tokens": max_tokens or self.config.max_tokens,
        }
        use_json = engine_config.env_bool("EDIT_LLM_JSON_MODE", True)
        if json_mode is not None:
            use_json = json_mode
        if use_json:
            payload["response_format"] = {"type": "json_object"}

        headers = {
            "Authorization": f"Bearer {self.config.api_key}",
            "Content-Type": "application/json",
        }
        last_error = ""
        started = time.monotonic()
        for attempt in range(1, self.max_retries + 1):
            try:
                resp = requests.post(
                    self.config.endpoint,
                    headers=headers,
                    json=payload,
                    timeout=self.config.timeout_s,
                )
            except Exception as exc:  # network error
                last_error = f"{type(exc).__name__}: {exc}"
                time.sleep(min(8.0, 1.5 * attempt))
                continue

            if resp.status_code in (429, 500, 502, 503, 504) and attempt < self.max_retries:
                last_error = f"HTTP {resp.status_code}: {resp.text[:300]}"
                time.sleep(min(8.0, 1.5 * attempt))
                continue

            if resp.status_code >= 400:
                raise LLMError(
                    f"[{self.config.stage}] {self.config.model} returned HTTP {resp.status_code}: "
                    f"{resp.text[:500]}"
                )

            try:
                body = resp.json()
            except json.JSONDecodeError as exc:
                raise LLMError(f"[{self.config.stage}] non-JSON response: {resp.text[:300]}") from exc

            text = _extract_text(body)
            usage = body.get("usage") or {}
            return LLMResponse(
                text=text,
                prompt_tokens=int(usage.get("prompt_tokens") or 0),
                completion_tokens=int(usage.get("completion_tokens") or 0),
                model=str(body.get("model") or self.config.model),
                latency_s=time.monotonic() - started,
                raw=body,
            )

        raise LLMError(f"[{self.config.stage}] failed after {self.max_retries} attempts: {last_error}")


def _extract_text(body: Mapping[str, Any]) -> str:
    choices = body.get("choices") or []
    if not choices:
        raise LLMError(f"response has no choices: {json.dumps(body)[:300]}")
    message = choices[0].get("message") or {}
    content = message.get("content")
    if isinstance(content, list):
        # Some providers return content parts (text blocks).
        return "".join(
            part.get("text", "") for part in content if isinstance(part, Mapping)
        )
    return str(content or "")


def estimate_tokens(text: str) -> int:
    """Cheap fallback when a mock (or a provider) reports no usage."""
    return max(1, len(text) // 4)


class ScriptedClient:
    """A client that returns canned text in order; used by the repair-loop tests."""

    def __init__(self, texts: Sequence[str], *, model: str = "scripted"):
        self._texts = list(texts)
        self.calls: list[list[Mapping[str, Any]]] = []
        self.model = model
        self.config = engine_config.LLMConfig(
            stage="scripted", base_url="http://localhost", api_key="test", model=model
        )

    def chat(self, messages, *, temperature=None, max_tokens=None, json_mode=None) -> LLMResponse:
        self.calls.append(list(messages))
        text = self._texts.pop(0) if self._texts else ""
        return LLMResponse(
            text=text,
            prompt_tokens=estimate_tokens(json.dumps(messages)),
            completion_tokens=estimate_tokens(text),
            model=self.model,
        )
