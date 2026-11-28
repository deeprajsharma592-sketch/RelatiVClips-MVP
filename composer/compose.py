"""Compose an EDL into a renderable Hyperframes project.

Pipeline: schema-validate the EDL, clamp each effect's params against its block
schema, run the safety rules, then write ``index.html`` (source video + one
timed element per block + the mixed audio) plus a vendored GSAP.

The output depends only on (EDL, source video, transcript) - no timestamps, no
random names, no absolute paths - so composing twice gives byte-identical HTML
and rendering twice gives identical decoded frames.
"""

from __future__ import annotations

import hashlib
import html
import json
import shutil
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Mapping, Sequence

import engine_config
from blocks import registry as blocks
from composer import media, safety
from composer.assets import AssetLibrary, copy_source_video
from schemas.models import SCHEMA_VERSION
from schemas.validate import validate_document

REPO_ROOT = engine_config.REPO_ROOT
GSAP_LOCAL = (
    REPO_ROOT / "hyperframes" / "node_modules" / "gsap" / "dist" / "gsap.min.js",
    REPO_ROOT / "blocks" / "_sandbox" / "node_modules" / "gsap" / "dist" / "gsap.min.js",
)
GSAP_CDN = "https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"
CANVAS_W, CANVAS_H = 1080, 1920
CLIP_NAME = "source.mp4"


@dataclass
class ComposeResult:
    ok: bool
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    project_dir: str = ""
    html_path: str = ""
    edl: dict[str, Any] = field(default_factory=dict)
    blocks: list[dict[str, Any]] = field(default_factory=list)
    source_path: str = ""
    duration_s: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "errors": self.errors,
            "warnings": self.warnings,
            "project_dir": self.project_dir,
            "html_path": self.html_path,
            "blocks": self.blocks,
            "duration_s": self.duration_s,
        }


def _as_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, Mapping):
        return json.loads(json.dumps(value, default=str))
    if hasattr(value, "model_dump"):
        return json.loads(json.dumps(value.model_dump(mode="json"), default=str))
    raise TypeError(f"expected an EDL mapping or model, got {type(value).__name__}")


def edl_hash(edl: Mapping[str, Any]) -> str:
    payload = json.dumps(edl, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha1(payload.encode("utf-8")).hexdigest()[:12]


def _vendor_gsap(project_dir: Path) -> str:
    rel = Path("assets") / "vendor" / "gsap.min.js"
    dst = project_dir / rel
    for candidate in GSAP_LOCAL:
        if candidate.exists():
            dst.parent.mkdir(parents=True, exist_ok=True)
            if not dst.exists() or dst.stat().st_size != candidate.stat().st_size:
                shutil.copy2(candidate, dst)
            return rel.as_posix()
    return GSAP_CDN


def _project_dir_for(edl: Mapping[str, Any], out_dir: Path | None) -> Path:
    if out_dir is not None:
        return Path(out_dir)
    settings = engine_config.settings()
    clip = str(edl.get("clip_id") or "clip")
    return settings.renders_dir / clip / f"proj_{edl_hash(edl)}"


def _base_project_files(project_dir: Path, clip_id: str) -> None:
    project_dir.mkdir(parents=True, exist_ok=True)
    hyperframes_json = {
        "$schema": "https://hyperframes.heygen.com/schema/hyperframes.json",
        "registry": "https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry",
        "paths": {"blocks": "compositions", "components": "compositions/components", "assets": "assets"},
        "media": {"autoProxy": False},
    }
    (project_dir / "hyperframes.json").write_text(
        json.dumps(hyperframes_json, indent=2) + "\n", encoding="utf-8"
    )
    package = {
        "name": "relativ-edit",
        "private": True,
        "type": "module",
        "scripts": {"render": "npx --yes hyperframes@0.9.104 render"},
    }
    (project_dir / "package.json").write_text(json.dumps(package, indent=2) + "\n", encoding="utf-8")
    (project_dir / "meta.json").write_text(
        json.dumps({"id": f"relativ-{clip_id}"}, indent=2) + "\n", encoding="utf-8"
    )


def compose(
    edl: Mapping[str, Any] | Any,
    video_path: str | Path,
    transcript: Mapping[str, Any] | Sequence[Mapping[str, Any]] | None = None,
    *,
    out_dir: str | Path | None = None,
    duration_s: float | None = None,
    fps: int | None = None,
    asset_library: AssetLibrary | None = None,
) -> ComposeResult:
    """Build a Hyperframes project for ``edl``. Never raises for bad input."""
    raw = _as_dict(edl)
    errors: list[str] = []
    warnings: list[str] = []

    errors.extend(validate_document(raw, "EDL"))
    if errors:
        return ComposeResult(ok=False, errors=errors, warnings=warnings, edl=raw)

    src = Path(video_path).expanduser()
    if not src.exists():
        return ComposeResult(
            ok=False,
            errors=[f"source video not found: {src}"],
            warnings=warnings,
            edl=raw,
        )

    try:
        probed = duration_s or media.duration_s(src)
    except media.MediaError as exc:
        return ComposeResult(ok=False, errors=[str(exc)], warnings=warnings, edl=raw)
    if probed <= 0:
        return ComposeResult(
            ok=False, errors=[f"could not read a duration from {src}"], warnings=warnings, edl=raw
        )

    words = _transcript_words(transcript)
    library = asset_library or AssetLibrary.load()
    settings = engine_config.settings()
    project_dir = _project_dir_for(raw, Path(out_dir) if out_dir else None)

    # Install assets only after validation succeeds, so a bad EDL leaves no mess.
    def resolve_asset(asset_id: str, kind: str) -> str | None:
        try:
            return library.install(asset_id, kind, project_dir)
        except (KeyError, FileNotFoundError) as exc:
            errors.append(f"asset: {exc}")
            return None

    clamped_effects: list[dict[str, Any]] = []
    rendered: list[blocks.BlockResult] = []
    block_calls: list[dict[str, Any]] = []
    ctx = blocks.RenderContext(
        source=f"assets/{CLIP_NAME}",
        duration_s=probed,
        words=words,
        resolve_asset=resolve_asset,
        canvas_w=CANVAS_W,
        canvas_h=CANVAS_H,
    )

    for index, effect in enumerate(raw.get("effects") or []):
        eff_id = effect.get("id", f"effect_{index}")
        try:
            block = blocks.canonical_type(str(effect.get("type", "")))
        except KeyError as exc:
            errors.append(f"{eff_id}: {exc}")
            continue
        params, clamp_warnings, param_errors = blocks.clamp_params(block, effect.get("params") or {})
        warnings.extend(f"{eff_id}: {w}" for w in clamp_warnings)
        errors.extend(f"{eff_id}: {e}" for e in param_errors)
        clamped = {
            **{k: v for k, v in effect.items() if k != "params"},
            "params": params,
        }
        clamped_effects.append(clamped)
        if param_errors:
            continue
        try:
            result = blocks.render_block(clamped, ctx)
        except (KeyError, ValueError) as exc:
            errors.append(f"{eff_id}: {exc}")
            continue
        rendered.append(result)
        block_calls.append(
            {
                "block": block,
                "id": str(eff_id),
                "type": str(effect.get("type")),
                "start": float(effect.get("start", 0.0)),
                "end": float(effect.get("end", 0.0)),
                "params": params,
                "meta": result.meta,
            }
        )
        warnings.extend(result.warnings)

    if errors:
        return ComposeResult(ok=False, errors=errors, warnings=warnings, edl=raw, duration_s=probed)

    clamped_edl = {**raw, "effects": clamped_effects, "schema_version": raw.get("schema_version", SCHEMA_VERSION)}
    safety_errors = safety.check_edl(clamped_edl, duration_s=probed, transcript=transcript)
    if safety_errors:
        return ComposeResult(
            ok=False, errors=safety_errors, warnings=warnings, edl=clamped_edl, duration_s=probed
        )

    # --- write the project -------------------------------------------------
    _base_project_files(project_dir, str(raw.get("clip_id", "clip")))
    copy_source_video(src, project_dir, name=CLIP_NAME)
    gsap_src = _vendor_gsap(project_dir)

    try:
        has_audio = media.has_audio(src)
    except media.MediaError:
        has_audio = False

    markup = "\n".join(r.html for r in rendered if r.html.strip())
    anim_blocks = sorted({c["block"] for c in block_calls})
    anim_js = "\n".join(blocks.load_anim(b) for b in anim_blocks)
    calls = []
    for call in sorted(block_calls, key=lambda c: (c["start"], c["id"])):
        params_js = json.dumps(call["params"], sort_keys=True, separators=(",", ":"))
        meta_js = json.dumps(call["meta"], sort_keys=True, separators=(",", ":"))
        calls.append(
            f'HF_BLOCKS[{json.dumps(call["block"])}](tl, {json.dumps(call["id"])}, '
            f"{params_js}, {meta_js});"
        )

    motion_blur = max(
        (
            float(c["params"].get("motion_blur", 0) or 0)
            for c in block_calls
            if c["block"] == "shake"
        ),
        default=0.0,
    )
    index_html = _render_index(
        clip_id=str(raw.get("clip_id", "clip")),
        duration=probed,
        gsap_src=gsap_src,
        markup=markup,
        anim_js=anim_js,
        calls="\n".join(calls),
        has_audio=has_audio,
        fps=fps or engine_config.settings().fps,
        motion_blur=motion_blur,
    )
    html_path = project_dir / "index.html"
    html_path.write_text(index_html, encoding="utf-8")

    (project_dir / "render.config.json").write_text(
        json.dumps(
            {
                "clip_id": raw.get("clip_id"),
                "edl_sha1": edl_hash(raw),
                "schema_version": clamped_edl.get("schema_version"),
                "duration_s": round(probed, 3),
                "warnings": warnings,
                "blocks": [
                    {k: c[k] for k in ("id", "type", "block", "start", "end")} for c in block_calls
                ],
            },
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )

    return ComposeResult(
        ok=True,
        errors=[],
        warnings=warnings,
        project_dir=str(project_dir),
        html_path=str(html_path),
        edl=clamped_edl,
        blocks=[
            {k: c[k] for k in ("id", "type", "block", "start", "end")}
            for c in sorted(block_calls, key=lambda c: (c["start"], c["id"]))
        ],
        source_path=str(src),
        duration_s=probed,
    )


def _transcript_words(
    transcript: Mapping[str, Any] | Sequence[Mapping[str, Any]] | None,
) -> list[dict[str, Any]]:
    if transcript is None:
        return []
    if isinstance(transcript, Mapping):
        raw = transcript.get("words") or []
    else:
        raw = list(transcript)
    return blocks.normalize_words(raw)


def _render_index(
    *,
    clip_id: str,
    duration: float,
    gsap_src: str,
    markup: str,
    anim_js: str,
    calls: str,
    has_audio: bool,
    fps: int,
    motion_blur: float = 0.0,
) -> str:
    duration_attr = f"{duration:.3f}".rstrip("0").rstrip(".")
    audio_attr = ' data-has-audio="true"' if has_audio else " muted"
    blur_attr = ""
    if motion_blur > 0:
        shutter = int(round(120 + 200 * min(1.0, motion_blur)))
        blur_attr = (
            f' data-motion-blur="on" data-motion-blur-shutter="{shutter}"'
            ' data-motion-blur-tier="filter"'
        )
    return f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width={CANVAS_W}, height={CANVAS_H}" />
    <title>{html.escape(clip_id)}</title>
    <script src="{gsap_src}"></script>
    <style>
      html, body {{
        margin: 0;
        padding: 0;
        width: {CANVAS_W}px;
        height: {CANVAS_H}px;
        overflow: hidden;
        background: #000;
        font-family: Inter, sans-serif;
      }}
      #a-roll {{
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        z-index: 1;
      }}
    </style>
  </head>
  <body>
    <div
      id="root"
      data-composition-id="main"
      data-start="0"
      data-duration="{duration_attr}"
      data-width="{CANVAS_W}"
      data-height="{CANVAS_H}"
      data-fps="{fps}"{blur_attr}
    >
      <video
        id="a-roll"
        class="clip"
        src="assets/{CLIP_NAME}"
        playsinline
        data-start="0"
        data-duration="{duration_attr}"
{audio_attr}
      ></video>
{_indent(markup, 6)}
    </div>
    <script>
      window.__timelines = window.__timelines || {{}};
      window.HF_BLOCKS = window.HF_BLOCKS || {{}};
{_indent(anim_js, 6)}
      const tl = gsap.timeline({{ paused: true }});
{_indent(calls, 6)}
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
"""


def _indent(text: str, spaces: int) -> str:
    pad = " " * spaces
    return "\n".join(pad + line if line.strip() else line for line in text.splitlines())
