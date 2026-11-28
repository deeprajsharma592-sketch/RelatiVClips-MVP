"""Block library: parameter schemas, HTML fragments and deterministic GSAP anims.

The LLM never writes HTML. It picks a block type and fills parameters; this
module turns that into markup, and ``blocks/<name>/anim.js`` turns it into
seekable animation on the project's single paused timeline.

Every block directory holds:

* ``params.schema.json`` - types, ranges, defaults; used for clamping and for the
  catalog text the editor prompt embeds.
* ``fragment.html`` - the markup, with ``%%TOKEN%%`` placeholders.
* ``anim.js`` - ``window.HF_BLOCKS["<name>"] = function (tl, id, params, meta)``.
* ``demo.html`` - a standalone composition showing the block on the sample clip.
"""

from __future__ import annotations

import html
import json
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any, Callable, Iterable, Mapping, Sequence

from schemas.validate import validate

BLOCKS_DIR = Path(__file__).resolve().parent
BLOCK_TYPES: tuple[str, ...] = ("shake", "caption_style", "popup", "sfx", "zoom")

#: EDL effect types the contract allows, mapped onto the block that renders them.
ALIASES: dict[str, str] = {"motion_blur": "shake"}

CAPTION_GROUP_PAD_S = 0.06

#: The composer always renders the source footage with this id.
SOURCE_SELECTOR = "#a-roll"


def canonical_type(effect_type: str) -> str:
    key = (effect_type or "").strip()
    key = ALIASES.get(key, key)
    if key not in BLOCK_TYPES:
        raise KeyError(
            f"unknown block type '{effect_type}'; known types are "
            f"{sorted(set(BLOCK_TYPES) | set(ALIASES))}"
        )
    return key


def block_dir(block_type: str) -> Path:
    return BLOCKS_DIR / canonical_type(block_type)


@lru_cache(maxsize=None)
def load_params_schema(block_type: str) -> dict[str, Any]:
    path = block_dir(block_type) / "params.schema.json"
    return json.loads(path.read_text(encoding="utf-8"))


@lru_cache(maxsize=None)
def load_fragment(block_type: str) -> str:
    return (block_dir(block_type) / "fragment.html").read_text(encoding="utf-8")


@lru_cache(maxsize=None)
def load_anim(block_type: str) -> str:
    return (block_dir(block_type) / "anim.js").read_text(encoding="utf-8")


def default_params(block_type: str) -> dict[str, Any]:
    schema = load_params_schema(block_type)
    out: dict[str, Any] = {}
    for name, spec in (schema.get("properties") or {}).items():
        if name == "words":
            continue
        if "default" in spec:
            out[name] = spec["default"]
    return out


def validate_params(block_type: str, params: Mapping[str, Any]) -> list[str]:
    t = canonical_type(block_type)
    return validate(dict(params), load_params_schema(t))


def clamp_params(
    block_type: str, params: Mapping[str, Any] | None
) -> tuple[dict[str, Any], list[str], list[str]]:
    """Fill defaults, clamp numeric ranges, and report what was wrong.

    Returns ``(params, warnings, errors)``. Out-of-range numbers are clamped with
    a warning (the render still happens); unknown parameters, bad enums, wrong
    types and missing required fields are errors (the EDL is rejected).
    """
    t = canonical_type(block_type)
    schema = load_params_schema(t)
    props = schema.get("properties") or {}
    merged = default_params(t)
    warnings: list[str] = []
    errors: list[str] = []

    for key, value in (params or {}).items():
        if key not in props:
            allowed = ", ".join(sorted(props))
            errors.append(f"params.{key}: unknown parameter for block '{t}' (allowed: {allowed})")
            continue
        spec = props[key]
        if (
            isinstance(value, (int, float))
            and not isinstance(value, bool)
            and spec.get("type") in ("number", "integer")
        ):
            lo, hi = spec.get("minimum"), spec.get("maximum")
            if lo is not None and value < lo:
                warnings.append(f"params.{key}: {value} is below the minimum; clamped to {lo}")
                value = lo
            if hi is not None and value > hi:
                warnings.append(f"params.{key}: {value} is above the maximum; clamped to {hi}")
                value = hi
            if spec.get("type") == "integer":
                value = int(value)
        merged[key] = value

    errors.extend(validate(merged, schema))
    return merged, warnings, errors


def catalog_text() -> str:
    """Markdown block catalog for the editor prompt, generated from the schemas."""
    lines = [
        "BLOCK CATALOG (the only effects you may emit; you never write HTML)",
        "",
    ]
    for t in BLOCK_TYPES:
        schema = load_params_schema(t)
        lines.append(f"### {t} - {schema.get('description', '')}")
        required = set(schema.get("required") or [])
        for name, spec in (schema.get("properties") or {}).items():
            if name == "words":
                continue
            bits: list[str] = []
            if spec.get("enum"):
                bits.append("one of " + "|".join(str(v) for v in spec["enum"]))
            elif spec.get("type") in ("number", "integer"):
                lo, hi = spec.get("minimum"), spec.get("maximum")
                if lo is not None and hi is not None:
                    bits.append(f"{lo}..{hi}")
                else:
                    bits.append(str(spec.get("type")))
            else:
                bits.append(str(spec.get("type", "any")))
            if "default" in spec:
                bits.append(f"default {spec['default']}")
            if name in required:
                bits.append("REQUIRED")
            desc = spec.get("description", "")
            lines.append(f"- {name} ({', '.join(bits)}){': ' + desc if desc else ''}")
        if t == "shake":
            lines.append(
                "- motion_blur in the EDL (`type: \"motion_blur\"`) renders through this block; "
                "it reads the same params."
            )
        lines.append("")
    return "\n".join(lines).strip() + "\n"


# --------------------------------------------------------------------------- #
# Rendering
# --------------------------------------------------------------------------- #


@dataclass
class RenderContext:
    source: str
    duration_s: float
    words: Sequence[Mapping[str, Any]] = field(default_factory=tuple)
    resolve_asset: Callable[[str, str], str | None] | None = None
    canvas_w: int = 1080
    canvas_h: int = 1920

    def asset(self, asset_id: str, kind: str) -> str | None:
        if self.resolve_asset is None:
            return None
        return self.resolve_asset(asset_id, kind)


@dataclass
class BlockResult:
    html: str
    meta: dict[str, Any]
    warnings: list[str] = field(default_factory=list)


def _fill(template: str, mapping: Mapping[str, Any], *, where: str) -> str:
    out = template
    for key, value in mapping.items():
        out = out.replace(f"%%{key}%%", str(value))
    if "%%" in out:
        leftover = sorted({tok for tok in out.split("%%") if tok and tok.isupper()})
        raise ValueError(f"{where}: unresolved fragment tokens {leftover}")
    return out


def _num(value: float, digits: int = 3) -> str:
    return f"{round(float(value), digits):g}"


def render_block(effect: Mapping[str, Any], ctx: RenderContext) -> BlockResult:
    """Render one EDL effect to markup + the meta its anim function needs."""
    effect_type = str(effect.get("type", ""))
    block = canonical_type(effect_type)
    effect_id = str(effect.get("id", ""))
    if not effect_id:
        raise ValueError("effect.id is required to render a block")
    params = dict(effect.get("params") or {})
    start = float(effect.get("start", 0.0))
    end = float(effect.get("end", start + 0.5))
    warnings: list[str] = []

    common = {
        "ID": effect_id,
        "START": _num(start),
        "DURATION": _num(end - start),
        "SOURCE": ctx.source,
    }

    if block == "caption_style":
        built = _render_captions(effect_id, params, start, end, ctx)
        return BlockResult(
            html=built["html"],
            meta={"start": start, "groups": built["groups"], "source": SOURCE_SELECTOR},
            warnings=built["warnings"],
        )

    fragment = load_fragment(block)

    if block == "shake":
        # Motion blur is handled by the framework's shutter pass (root
        # data-motion-blur), triggered from compose.py; no extra markup here.
        return BlockResult(
            html=fragment.strip(),
            meta={"start": start, "source": SOURCE_SELECTOR},
        )

    if block == "zoom":
        return BlockResult(html=fragment.strip(), meta={"start": start, "source": SOURCE_SELECTOR})

    if block == "sfx":
        asset_id = str(params.get("asset_id", ""))
        rel = ctx.asset(asset_id, "sfx")
        if not rel:
            raise ValueError(f"sfx asset '{asset_id}' not found in data/assets/manifest.json")
        gain = float(params.get("gain", 0.8))
        duration = end - start
        fade_out = _num(min(0.25, max(0.05, duration * 0.3)))
        return BlockResult(
            html=_fill(
                fragment,
                {**common, "ASSET": rel, "GAIN": _num(gain), "FADE_OUT": fade_out},
                where=block,
            ),
            meta={"start": start},
        )

    if block == "popup":
        asset_id = str(params.get("asset_id", ""))
        rel = ctx.asset(asset_id, "popup")
        if not rel:
            raise ValueError(f"popup asset '{asset_id}' not found in data/assets/manifest.json")
        scale = float(params.get("scale", 0.55))
        width = int(round(scale * ctx.canvas_w))
        offset_x = int(round(float(params.get("offset_x", 0.0)) * ctx.canvas_w))
        offset_y = int(round(float(params.get("offset_y", 0.0)) * ctx.canvas_h))
        return BlockResult(
            html=_fill(
                fragment,
                {
                    **common,
                    "ASSET": rel,
                    "POSITION": params.get("position", "top-right"),
                    "WIDTH": width,
                    "OFFSET_X": offset_x,
                    "OFFSET_Y": offset_y,
                },
                where=block,
            ),
            meta={"start": start},
        )

    raise KeyError(f"no renderer for block '{block}'")


def normalize_words(words: Iterable[Mapping[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for w in words:
        text = str(w.get("w") or w.get("word") or w.get("text") or "").strip()
        if not text:
            continue
        try:
            start = float(w.get("start", 0.0))
            end = float(w.get("end", start + 0.2))
        except (TypeError, ValueError):
            continue
        if end <= start:
            end = start + 0.2
        out.append({"w": text, "start": start, "end": end})
    out.sort(key=lambda w: w["start"])
    return out


def _render_captions(
    effect_id: str,
    params: Mapping[str, Any],
    start: float,
    end: float,
    ctx: RenderContext,
) -> dict[str, Any]:
    warnings: list[str] = []
    style = str(params.get("style", "irl_stream"))
    max_words = int(params.get("max_words_per_group", 2))
    if style == "podcast":
        max_words = max(2, max_words)
    position = str(params.get("position", "bottom"))
    font = params.get("font_size", 72)
    uppercase = bool(params.get("uppercase", True))

    supplied = normalize_words(params.get("words") or [])
    words = supplied or [
        w for w in normalize_words(ctx.words) if w["end"] > start and w["start"] < end
    ]
    if not words:
        warnings.append(
            f"caption_style '{effect_id}': no transcript words in {start}-{end}s; nothing rendered"
        )
        return {"html": "", "groups": [], "warnings": warnings}

    # Clamp to the effect window and to the clip.
    clipped: list[dict[str, Any]] = []
    for w in words:
        s = max(start, w["start"])
        e = min(end, w["end"])
        if e - s <= 0.02:
            continue
        clipped.append({"w": w["w"], "start": s, "end": e})
    if not clipped:
        warnings.append(f"caption_style '{effect_id}': all words fell outside the clip")
        return {"html": "", "groups": [], "warnings": warnings}

    template = load_fragment("caption_style")
    head, sep, tail = template.partition('<div\n  id="%%ID%%"')
    style_html = head.strip()
    body_template = sep + tail

    groups: list[dict[str, Any]] = []
    group_html: list[str] = []
    for gi in range(0, len(clipped), max_words):
        chunk = clipped[gi : gi + max_words]
        if not chunk:
            continue
        gid = f"{effect_id}-g{len(groups)}"
        g_start = max(start, chunk[0]["start"] - 0.02)
        g_end = min(end, chunk[-1]["end"] + CAPTION_GROUP_PAD_S)
        g_dur = max(0.2, g_end - g_start)

        spans = []
        word_meta = []
        for wi, word in enumerate(chunk):
            wid = f"{gid}-w{wi}"
            spans.append(
                f'<span class="hf-cap-w" id="{wid}">{html.escape(word["w"])}</span>'
            )
            word_meta.append({"id": wid, "start": word["start"], "end": word["end"]})
        text = "".join(spans)

        block_html = _fill(
            body_template,
            {
                "ID": gid,
                "START": _num(g_start),
                "DURATION": _num(g_dur),
                "POSITION": position,
                "STYLE": style,
                "FONT": _num(font),
                "TEXT_TRANSFORM": "text-transform: uppercase;" if uppercase else "",
                "WORDS": text,
            },
            where="caption_style group",
        )
        group_html.append(block_html)
        groups.append(
            {"id": gid, "start": round(g_start, 3), "duration": round(g_dur, 3), "words": word_meta}
        )

    return {"html": style_html + "\n" + "\n".join(group_html), "groups": groups, "warnings": warnings}
