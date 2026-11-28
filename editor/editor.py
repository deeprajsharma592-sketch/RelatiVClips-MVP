"""The editor: StoryPlan + transcript -> validated EDL, with a repair loop.

The model never writes HTML: it picks block types and fills params. Everything it
returns is parsed, schema-validated, safety-checked, and - on failure - handed
back as an exact error list for up to three attempts. Every attempt's tokens are
recorded so cost per stage is measurable.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any, Mapping, Sequence

import engine_config
from blocks import registry
from composer import safety
from schemas import db
from schemas.models import SCHEMA_VERSION
from schemas.validate import validate_document

from . import mock, prompting
from .llm import LLMClient, LLMError, ScriptedClient

MAX_ATTEMPTS = 3
STYLE_DIRECTIONS = ("minimal", "punchy", "chaotic")
_DEFAULT_TEMPERATURES = {"minimal": 0.45, "punchy": 0.7, "chaotic": 0.95}
_FENCE_RE = re.compile(r"^\s*```(?:json)?\s*|\s*```\s*$", re.IGNORECASE)


@dataclass
class Attempt:
    number: int
    ok: bool
    errors: list[str] = field(default_factory=list)
    prompt_tokens: int = 0
    completion_tokens: int = 0
    latency_s: float = 0.0
    raw_chars: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "number": self.number,
            "ok": self.ok,
            "errors": self.errors,
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "latency_s": round(self.latency_s, 2),
        }


@dataclass
class EditResult:
    ok: bool
    edl: dict[str, Any] | None = None
    errors: list[str] = field(default_factory=list)
    attempts: list[Attempt] = field(default_factory=list)
    model: str = ""
    prompt_version: str = "v1"
    mock: bool = False
    style_direction: str = "punchy"
    temperature: float = 0.7
    notes: list[str] = field(default_factory=list)

    @property
    def prompt_tokens(self) -> int:
        return sum(a.prompt_tokens for a in self.attempts)

    @property
    def completion_tokens(self) -> int:
        return sum(a.completion_tokens for a in self.attempts)

    @property
    def total_tokens(self) -> int:
        return self.prompt_tokens + self.completion_tokens

    def to_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "edl": self.edl,
            "errors": self.errors,
            "attempts": [a.to_dict() for a in self.attempts],
            "model": self.model,
            "prompt_version": self.prompt_version,
            "mock": self.mock,
            "style_direction": self.style_direction,
            "temperature": self.temperature,
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "notes": self.notes,
        }


def parse_json_object(text: str) -> dict[str, Any]:
    """Parse the model's reply, tolerating fences and leading prose."""
    cleaned = _FENCE_RE.sub("", text or "").strip()
    if not cleaned:
        raise ValueError("empty response")
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start < 0 or end <= start:
        raise ValueError(f"no JSON object found in response: {cleaned[:120]!r}")
    candidate = cleaned[start : end + 1]
    try:
        parsed = json.loads(candidate)
    except json.JSONDecodeError as exc:
        raise ValueError(f"invalid JSON at {exc.msg} (line {exc.lineno}, col {exc.colno})") from exc
    if not isinstance(parsed, dict):
        raise ValueError(f"expected a JSON object, got {type(parsed).__name__}")
    return parsed


def _default_temperature(style: str) -> float:
    base = _DEFAULT_TEMPERATURES.get(style, 0.7)
    return engine_config.env_float("EDIT_LLM_TEMPERATURE", base)


def _normalize(
    parsed: Mapping[str, Any],
    *,
    clip_id: str,
    niche: str,
    notes: list[str],
) -> dict[str, Any]:
    edl = dict(parsed)
    if "schema_version" not in edl:
        edl["schema_version"] = SCHEMA_VERSION
        notes.append("filled missing schema_version")
    if "clip_id" not in edl:
        edl["clip_id"] = clip_id
        notes.append("filled missing clip_id from the story plan")
    if "niche" not in edl:
        edl["niche"] = niche
        notes.append("filled missing niche")
    if "effects" not in edl:
        edl["effects"] = []
        notes.append("filled missing effects array")
    return edl


def _clip_errors(edl: Mapping[str, Any], *, clip_id: str, duration_s: float) -> list[str]:
    errors: list[str] = []
    if str(edl.get("clip_id")) != clip_id:
        errors.append(
            f"$.clip_id: must be '{clip_id}' (got {edl.get('clip_id')!r}); copy the clip_id you were given"
        )
    errors.extend(validate_document(edl, "EDL"))
    # The EDL schema keeps params open (each block owns its own schema), so the
    # block schemas are checked here too - otherwise "scale": 99 would reach the
    # composer and only be clamped there, wasting a render.
    for index, effect in enumerate(edl.get("effects") or []):
        if not isinstance(effect, Mapping):
            continue
        try:
            block = registry.canonical_type(str(effect.get("type", "")))
        except KeyError:
            continue  # already reported by the EDL schema
        for message in registry.validate_params(block, effect.get("params") or {}):
            detail = message[2:] if message.startswith("$.") else message
            errors.append(f"$.effects[{index}].params.{detail}")
    if not errors:
        errors.extend(safety.check_edl(edl, duration_s=duration_s))
    return errors


def _record_tokens(
    session: Any,
    *,
    stage: str,
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
    prompt_version: str,
    attempt: int,
    ok: bool,
    mock_flag: bool,
) -> None:
    def write(s):
        db.log_token_usage(
            s,
            stage=stage,
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            prompt_version=prompt_version,
            attempt=attempt,
            ok=ok,
            mock=mock_flag,
        )

    try:
        if session is not None:
            write(session)
        else:
            with db.session_scope() as own:
                write(own)
    except Exception:  # logging must never lose an edit
        pass


def _repair_message(errors: Sequence[str]) -> str:
    lines = [
        "Your EDL was rejected by the validator. Fix exactly these problems and return only the",
        "corrected JSON object. Do not explain, do not add fields, do not change the clip_id.",
        "",
        *[f"- {e}" for e in errors],
    ]
    return "\n".join(lines)


def generate_edl(
    story_plan: Mapping[str, Any] | Any,
    transcript: Mapping[str, Any] | Sequence[Mapping[str, Any]] | None,
    *,
    niche: str = "livestream_comedy",
    style_direction: str = "punchy",
    temperature: float | None = None,
    variant_index: int = 0,
    client: Any | None = None,
    session: Any | None = None,
    use_mock: bool | None = None,
    max_attempts: int = MAX_ATTEMPTS,
    refine_context: str = "",
    refine_edl: Mapping[str, Any] | None = None,
) -> EditResult:
    plan = json.loads(json.dumps(story_plan, default=str)) if isinstance(story_plan, Mapping) else story_plan
    if hasattr(plan, "model_dump"):
        plan = plan.model_dump(mode="json")
    plan_errors = validate_document(plan, "StoryPlan")
    style = style_direction if style_direction in STYLE_DIRECTIONS else "punchy"
    temp = _default_temperature(style) if temperature is None else float(temperature)
    is_mock = engine_config.mock_mode("editor") if use_mock is None else bool(use_mock)

    if plan_errors:
        return EditResult(
            ok=False,
            errors=plan_errors,
            model="none",
            mock=is_mock,
            style_direction=style,
            temperature=temp,
        )

    clip_id = str(plan.get("clip_id"))
    duration_s = float(plan.get("duration_s") or 0)
    version = prompting.prompt_version()

    if client is None:
        if is_mock:
            text = mock.canned_text(
                story_plan=plan,
                transcript=transcript,
                niche=niche,
                style_direction=style,
                variant_index=variant_index,
            )
            client = ScriptedClient([text] * max_attempts)
        else:
            client = LLMClient()

    try:
        system = prompting.build_system_prompt(niche)
    except FileNotFoundError as exc:
        return EditResult(
            ok=False,
            errors=[str(exc)],
            model=getattr(client, "model", ""),
            prompt_version=version,
            mock=is_mock,
            style_direction=style,
            temperature=temp,
        )

    notes: list[str] = []
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": system},
        {
            "role": "user",
            "content": prompting.build_user_message(
                plan,
                transcript,
                niche=niche,
                style_direction=style,
                variant_index=variant_index,
            )
            + (
                "\n\nPREVIOUS EDL TO IMPROVE:\n"
                + json.dumps(refine_edl, indent=2)
                + "\n\nJUDGE CRITIQUE:\n"
                + refine_context
                if refine_context
                else ""
            ),
        },
    ]

    attempts: list[Attempt] = []
    last_errors: list[str] = ["no attempt was made"]

    for number in range(1, max_attempts + 1):
        try:
            response = client.chat(messages, temperature=temp)
        except LLMError as exc:
            attempts.append(Attempt(number=number, ok=False, errors=[str(exc)]))
            return EditResult(
                ok=False,
                errors=[str(exc)],
                attempts=attempts,
                model=getattr(client, "model", ""),
                prompt_version=version,
                mock=is_mock,
                style_direction=style,
                temperature=temp,
                notes=notes,
            )

        _record_tokens(
            session,
            stage="editor",
            model=response.model,
            prompt_tokens=response.prompt_tokens,
            completion_tokens=response.completion_tokens,
            prompt_version=version,
            attempt=number,
            ok=True,
            mock_flag=is_mock,
        )

        text = response.text
        try:
            parsed = parse_json_object(text)
        except ValueError as exc:
            last_errors = [f"$: {exc}. Return one JSON object with no prose or code fences."]
            attempts.append(
                Attempt(
                    number=number,
                    ok=False,
                    errors=last_errors,
                    prompt_tokens=response.prompt_tokens,
                    completion_tokens=response.completion_tokens,
                    latency_s=response.latency_s,
                    raw_chars=len(text),
                )
            )
            messages.append({"role": "assistant", "content": text})
            messages.append({"role": "user", "content": _repair_message(last_errors)})
            continue

        edl = _normalize(parsed, clip_id=clip_id, niche=niche, notes=notes)
        errors = _clip_errors(edl, clip_id=clip_id, duration_s=duration_s)
        attempts.append(
            Attempt(
                number=number,
                ok=not errors,
                errors=errors,
                prompt_tokens=response.prompt_tokens,
                completion_tokens=response.completion_tokens,
                latency_s=response.latency_s,
                raw_chars=len(text),
            )
        )
        if not errors:
            return EditResult(
                ok=True,
                edl=edl,
                attempts=attempts,
                model=response.model,
                prompt_version=version,
                mock=is_mock,
                style_direction=style,
                temperature=temp,
                notes=notes,
            )

        last_errors = errors
        messages.append({"role": "assistant", "content": text})
        messages.append({"role": "user", "content": _repair_message(errors)})

    return EditResult(
        ok=False,
        edl=None,
        errors=last_errors,
        attempts=attempts,
        model=getattr(client, "model", ""),
        prompt_version=version,
        mock=is_mock,
        style_direction=style,
        temperature=temp,
        notes=notes,
    )


def summarize_edl(edl: Mapping[str, Any]) -> str:
    counts = safety.summarize(edl)
    parts = ", ".join(f"{k}x{v}" for k, v in sorted(counts["by_type"].items()))
    return f"{counts['total']} effects ({parts})"
