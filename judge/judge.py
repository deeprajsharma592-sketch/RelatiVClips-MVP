"""The judge: frames + transcript + EDL -> validated JudgeReport.

A vision model scores five dimensions against a versioned rubric. The report is
schema-validated and retried once with the exact errors. Mock mode produces a
rubric-shaped report from the EDL alone so the pipeline is testable offline.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Mapping, Sequence

import engine_config
from composer import media
from schemas import db
from schemas.validate import validate_document

from . import mock
from .frames import FrameSet, extract_frames
from .llm_vision import VisionClient

PROMPT_VERSION = "v1"
MAX_ATTEMPTS = 2
RUBRIC_DIR = Path(__file__).resolve().parent / "prompts"


@dataclass
class JudgeAttempt:
    number: int
    ok: bool
    errors: list[str] = field(default_factory=list)
    prompt_tokens: int = 0
    completion_tokens: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "number": self.number,
            "ok": self.ok,
            "errors": self.errors,
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
        }


@dataclass
class JudgeResult:
    ok: bool
    report: dict[str, Any] | None = None
    errors: list[str] = field(default_factory=list)
    attempts: list[JudgeAttempt] = field(default_factory=list)
    model: str = ""
    prompt_version: str = PROMPT_VERSION
    mock: bool = False
    frames: list[dict[str, Any]] = field(default_factory=list)
    temperature: float = 0.0

    @property
    def total_tokens(self) -> int:
        return sum(a.prompt_tokens + a.completion_tokens for a in self.attempts)

    @property
    def scores(self) -> dict[str, int]:
        return dict((self.report or {}).get("scores") or {})

    def to_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "report": self.report,
            "errors": self.errors,
            "attempts": [a.to_dict() for a in self.attempts],
            "model": self.model,
            "prompt_version": self.prompt_version,
            "mock": self.mock,
            "frames": self.frames,
            "temperature": self.temperature,
        }


def prompt_version() -> str:
    return engine_config.env("EDIT_JUDGE_PROMPT_VERSION", default=PROMPT_VERSION)


def load_rubric(version: str | None = None) -> str:
    path = RUBRIC_DIR / (version or prompt_version()) / "rubric.md"
    return path.read_text(encoding="utf-8")


def build_messages(
    frame_set: FrameSet,
    edl: Mapping[str, Any],
    *,
    clip_id: str,
    duration_s: float,
    rubric: str,
    repairs: Sequence[str] | None = None,
) -> list[dict[str, Any]]:
    header = [
        f"Clip: {clip_id}",
        f"Duration: {duration_s:.2f}s",
        "",
        "EDL (what the editor claims to have done):",
        json.dumps(edl, indent=2, ensure_ascii=False),
        "",
        "Frames are supplied in this order; transcript text is what is heard near each:",
        frame_set.as_prompt_lines(),
        "",
    ]
    if repairs:
        header.extend(
            [
                "Your previous report was rejected. Fix these problems and return the JSON only:",
                *[f"- {e}" for e in repairs],
                "",
            ]
        )
    header.append("Score the clip against the rubric. Return the JSON object only.")

    content: list[dict[str, Any]] = [{"type": "text", "text": "\n".join(header)}]
    for frame in frame_set.frames:
        content.append({"type": "text", "text": f"frame at {frame.ts:.2f}s ({frame.label})"})
        content.append({"type": "image_url", "image_url": {"url": frame.data_url()}})

    return [
        {"role": "system", "content": rubric},
        {"role": "user", "content": content},
    ]


def _record_tokens(
    session: Any,
    *,
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
    version: str,
    attempt: int,
    ok: bool,
    mock_flag: bool,
) -> None:
    def write(s):
        db.log_token_usage(
            s,
            stage="judge",
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            prompt_version=version,
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
    except Exception:
        pass


def judge_clip(
    mp4_path: str | Path,
    edl: Mapping[str, Any],
    transcript: Mapping[str, Any] | Sequence[Mapping[str, Any]] | None = None,
    *,
    clip_id: str | None = None,
    duration_s: float | None = None,
    frames_dir: str | Path | None = None,
    client: Any | None = None,
    session: Any | None = None,
    use_mock: bool | None = None,
    temperature: float | None = None,
    max_attempts: int = MAX_ATTEMPTS,
    keep_frames: bool = False,
) -> JudgeResult:
    mp4 = Path(mp4_path)
    version = prompt_version()
    is_mock = engine_config.mock_mode("judge") if use_mock is None else bool(use_mock)
    temp = float(engine_config.env_float("EDIT_JUDGE_TEMPERATURE", 0.0)) if temperature is None else float(temperature)
    resolved_clip = clip_id or str(edl.get("clip_id") or "clip")

    if not mp4.exists():
        return JudgeResult(
            ok=False, errors=[f"render not found: {mp4}"], mock=is_mock, temperature=temp
        )

    if duration_s is None:
        try:
            duration_s = media.duration_s(mp4)
        except media.MediaError as exc:
            return JudgeResult(ok=False, errors=[str(exc)], mock=is_mock, temperature=temp)

    target_dir = Path(frames_dir) if frames_dir else mp4.parent / f"{mp4.stem}_frames"
    try:
        frame_set = extract_frames(
            mp4, edl, duration_s=duration_s, out_dir=target_dir, transcript=transcript
        )
    except media.MediaError as exc:
        return JudgeResult(ok=False, errors=[str(exc)], mock=is_mock, temperature=temp)

    frames_meta = [{"ts": f.ts, "label": f.label} for f in frame_set.frames]

    if client is None:
        if is_mock:
            from editor.llm import ScriptedClient

            text = mock.canned_text(edl, clip_id=resolved_clip, duration_s=duration_s, transcript=transcript)
            client = ScriptedClient([text] * max_attempts, model="mock-judge")
        else:
            client = VisionClient()

    rubric = load_rubric(version)
    messages = build_messages(
        frame_set, edl, clip_id=resolved_clip, duration_s=duration_s, rubric=rubric
    )

    attempts: list[JudgeAttempt] = []
    last_errors = ["no attempt was made"]

    for number in range(1, max_attempts + 1):
        try:
            response = client.chat(messages, temperature=temp)
        except Exception as exc:  # LLMError or transport
            attempts.append(JudgeAttempt(number=number, ok=False, errors=[str(exc)]))
            if not keep_frames:
                from .frames import cleanup_frames

                cleanup_frames(frame_set)
            return JudgeResult(
                ok=False,
                errors=[str(exc)],
                attempts=attempts,
                model=getattr(client, "model", ""),
                prompt_version=version,
                mock=is_mock,
                frames=frames_meta,
                temperature=temp,
            )

        _record_tokens(
            session,
            model=response.model,
            prompt_tokens=response.prompt_tokens,
            completion_tokens=response.completion_tokens,
            version=version,
            attempt=number,
            ok=True,
            mock_flag=is_mock,
        )

        try:
            parsed = _parse(response.text)
        except ValueError as exc:
            last_errors = [f"$: {exc}"]
            attempts.append(
                JudgeAttempt(
                    number=number,
                    ok=False,
                    errors=last_errors,
                    prompt_tokens=response.prompt_tokens,
                    completion_tokens=response.completion_tokens,
                )
            )
            messages.append({"role": "assistant", "content": response.text})
            messages.append({"role": "user", "content": _repair_note(last_errors)})
            continue

        errors = validate_document(parsed, "JudgeReport")
        if str(parsed.get("clip_id")) != resolved_clip:
            errors.append(f"$.clip_id: must be '{resolved_clip}' (got {parsed.get('clip_id')!r})")
        attempts.append(
            JudgeAttempt(
                number=number,
                ok=not errors,
                errors=errors,
                prompt_tokens=response.prompt_tokens,
                completion_tokens=response.completion_tokens,
            )
        )
        if not errors:
            if not keep_frames:
                from .frames import cleanup_frames

                cleanup_frames(frame_set)
            return JudgeResult(
                ok=True,
                report=parsed,
                attempts=attempts,
                model=response.model,
                prompt_version=version,
                mock=is_mock,
                frames=frames_meta,
                temperature=temp,
            )

        last_errors = errors
        messages.append({"role": "assistant", "content": response.text})
        messages.append({"role": "user", "content": _repair_note(errors)})

    if not keep_frames:
        from .frames import cleanup_frames

        cleanup_frames(frame_set)
    return JudgeResult(
        ok=False,
        errors=last_errors,
        attempts=attempts,
        model=getattr(client, "model", ""),
        prompt_version=version,
        mock=is_mock,
        frames=frames_meta,
        temperature=temp,
    )


def _parse(text: str) -> dict[str, Any]:
    from editor.editor import parse_json_object

    return parse_json_object(text)


def _repair_note(errors: Sequence[str]) -> str:
    return (
        "The report failed validation. Fix exactly these problems and return the JSON object only:\n"
        + "\n".join(f"- {e}" for e in errors)
    )


def load_transcript(path: str | Path) -> dict[str, Any]:
    return json.loads(Path(path).read_text(encoding="utf-8"))
