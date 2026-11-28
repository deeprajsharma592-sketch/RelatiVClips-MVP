"""Run ``hyperframes lint`` then ``hyperframes render`` and return structured results.

Rendering never raises: a lint error, a missing file, a bad composition or a
timeout all come back as ``RenderResult(ok=False, ...)`` so the pipeline can keep
going and the failure is persisted against the variant that caused it.
"""

from __future__ import annotations

import json
import subprocess
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Mapping

import engine_config

_ERROR_SEVERITIES = {"error", "fatal", "critical"}


@dataclass
class RenderResult:
    ok: bool
    mp4_path: str = ""
    lint_errors: list[str] = field(default_factory=list)
    lint_warnings: list[str] = field(default_factory=list)
    render_seconds: float = 0.0
    error: str = ""
    command: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "mp4_path": self.mp4_path,
            "lint_errors": self.lint_errors,
            "lint_warnings": self.lint_warnings,
            "render_seconds": round(self.render_seconds, 3),
            "error": self.error,
        }


def _cli() -> list[str]:
    return list(engine_config.settings().hyperframes_cli)


def _finding_text(finding: Mapping[str, Any]) -> str:
    rule = finding.get("rule") or finding.get("code") or finding.get("id") or ""
    message = (
        finding.get("message")
        or finding.get("detail")
        or finding.get("text")
        or finding.get("title")
        or json.dumps(finding, sort_keys=True)
    )
    where = finding.get("file") or finding.get("path") or ""
    if where:
        message = f"{Path(str(where)).name}: {message}"
    return f"{rule}: {message}" if rule else str(message)


def lint(project_dir: str | Path, *, timeout: float = 180.0) -> dict[str, Any]:
    """Return ``{"ok", "errors", "warnings", "info", "raw"}`` for a project."""
    cmd = [*_cli(), "lint", str(project_dir), "--json"]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, check=False)
    except subprocess.TimeoutExpired:
        return {
            "ok": False,
            "errors": [f"lint timed out after {timeout:g}s"],
            "warnings": [],
            "info": [],
            "raw": {},
            "command": cmd,
        }
    except FileNotFoundError as exc:
        return {
            "ok": False,
            "errors": [f"hyperframes CLI not found: {exc}"],
            "warnings": [],
            "info": [],
            "raw": {},
            "command": cmd,
        }

    payload: dict[str, Any] = {}
    text = (proc.stdout or "").strip()
    if text:
        start = text.find("{")
        if start >= 0:
            try:
                payload = json.loads(text[start:])
            except json.JSONDecodeError:
                payload = {}
    if not payload:
        tail = "\n".join((proc.stderr or proc.stdout or "").strip().splitlines()[-8:])
        return {
            "ok": False,
            "errors": [f"lint produced no JSON ({proc.returncode}): {tail}"],
            "warnings": [],
            "info": [],
            "raw": {},
            "command": cmd,
        }

    errors: list[str] = []
    warnings: list[str] = []
    info: list[str] = []
    for finding in payload.get("findings", []) or []:
        severity = str(finding.get("severity") or finding.get("level") or "error").lower()
        text_line = _finding_text(finding)
        if severity in _ERROR_SEVERITIES:
            errors.append(text_line)
        elif severity in {"warning", "warn"}:
            warnings.append(text_line)
        else:
            info.append(text_line)

    if payload.get("errorCount") and not errors:
        errors.append(f"{payload['errorCount']} lint error(s) reported without findings")

    return {
        "ok": payload.get("ok", not errors) and not errors,
        "errors": errors,
        "warnings": warnings,
        "info": info,
        "raw": payload,
        "command": cmd,
    }


def render(
    project_dir: str | Path,
    out_path: str | Path | None = None,
    *,
    fps: int | None = None,
    quality: str = "looks",
    timeout: float = 1200.0,
    run_lint: bool = True,
    workers: int | None = None,
) -> RenderResult:
    """Lint, then render. Returns a structured result and never raises."""
    project = Path(project_dir)
    if not project.exists():
        return RenderResult(ok=False, error=f"project directory not found: {project}")

    lint_errors: list[str] = []
    lint_warnings: list[str] = []
    if run_lint:
        linted = lint(project)
        lint_errors = list(linted["errors"])
        lint_warnings = list(linted["warnings"])
        if lint_errors:
            return RenderResult(
                ok=False,
                lint_errors=lint_errors,
                lint_warnings=lint_warnings,
                error="lint failed; render skipped",
                command=list(linted.get("command") or []),
            )

    settings = engine_config.settings()
    if out_path is None:
        target = settings.renders_dir / f"{project.name}.mp4"
    else:
        target = Path(out_path)
    target.parent.mkdir(parents=True, exist_ok=True)

    cmd = [
        *_cli(),
        "render",
        str(project),
        "--output",
        str(target),
        "--fps",
        str(fps or settings.fps),
        "--quality",
        quality,
        "--quiet",
    ]
    resolved_workers = workers if workers is not None else settings.render_workers
    if resolved_workers:
        cmd.extend(["--workers", str(resolved_workers)])
    started = time.monotonic()
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, check=False)
    except subprocess.TimeoutExpired:
        return RenderResult(
            ok=False,
            lint_errors=lint_errors,
            lint_warnings=lint_warnings,
            render_seconds=time.monotonic() - started,
            error=f"render timed out after {timeout:g}s",
            command=cmd,
        )
    elapsed = time.monotonic() - started
    if proc.returncode != 0 or not target.exists():
        tail = "\n".join((proc.stderr or proc.stdout or "").strip().splitlines()[-12:])
        return RenderResult(
            ok=False,
            lint_errors=lint_errors,
            lint_warnings=lint_warnings,
            render_seconds=elapsed,
            error=f"render failed ({proc.returncode}):\n{tail}",
            command=cmd,
        )
    return RenderResult(
        ok=True,
        mp4_path=str(target),
        lint_errors=lint_errors,
        lint_warnings=lint_warnings,
        render_seconds=elapsed,
        command=cmd,
    )


def render_and_persist(
    compose_result: Any,
    *,
    out_path: str | Path | None = None,
    quality: str = "looks",
) -> RenderResult:
    """Convenience wrapper: render a :class:`composer.compose.ComposeResult`."""
    if not getattr(compose_result, "ok", False):
        return RenderResult(
            ok=False,
            error="compose failed: " + "; ".join(getattr(compose_result, "errors", []) or []),
        )
    return render(compose_result.project_dir, out_path, quality=quality)
