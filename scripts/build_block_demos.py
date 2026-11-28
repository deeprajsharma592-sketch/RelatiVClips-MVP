#!/usr/bin/env python3
"""Regenerate each block's standalone demo from the registry.

The demos are generated, not hand-maintained, so they cannot drift from the
fragments and anim functions they demonstrate.

    python scripts/build_block_demos.py
    npx hyperframes render blocks/shake -c demo.html
"""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from blocks import registry  # noqa: E402

DEMO_WORDS = [
    {"w": "this", "start": 0.4, "end": 0.8},
    {"w": "is", "start": 0.82, "end": 0.98},
    {"w": "the", "start": 1.0, "end": 1.14},
    {"w": "moment", "start": 1.16, "end": 1.7},
    {"w": "it", "start": 1.72, "end": 1.86},
    {"w": "lands", "start": 1.88, "end": 2.4},
]

DEMOS = {
    "shake": ({"intensity": 0.7, "frequency": 7, "decay": 0.6, "motion_blur": 0.4}, {"start": 1.2}),
    "caption_style": (
        {"style": "irl_stream", "max_words_per_group": 2, "highlight_color": "#FFE45E"},
        {"start": 0.4},
    ),
    "popup": (
        {"asset_id": "reaction_box", "position": "top-right", "scale": 0.45},
        {"start": 1.0},
    ),
    "sfx": ({"asset_id": "impact_boom", "gain": 0.8, "loudness_lufs": -16}, {"start": 1.2}),
    "zoom": ({"scale": 1.18, "origin": "center", "hold": 0.8}, {"start": 1.0}),
}


def build(name: str) -> Path:
    params, extra = DEMOS[name]
    duration = 5.0
    effect = {
        "id": f"demo_{name}",
        "type": name,
        "start": extra.get("start", 0.5),
        "end": extra.get("start", 0.5) + (3.0 if name == "caption_style" else 1.6),
        "params": params,
        "rationale": f"Standalone demo of the {name} block.",
    }
    if name == "caption_style":
        effect["params"] = {**params, "words": DEMO_WORDS}
        effect["start"], effect["end"] = 0.3, 2.8

    ctx = registry.RenderContext(
        source="assets/source.mp4",
        duration_s=duration,
        words=DEMO_WORDS,
        resolve_asset=_demo_asset,
        canvas_w=1080,
        canvas_h=1920,
    )
    rendered = registry.render_block(effect, ctx)
    meta = dict(rendered.meta)
    if name in ("shake", "zoom"):
        meta["source"] = "#a-roll"

    demo_id = f"demo_{name}"
    html = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <title>{name} block demo</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      html, body {{ margin: 0; width: 1080px; height: 1920px; overflow: hidden; background: #000; }}
      #a-roll {{ position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: 1; }}
    </style>
  </head>
  <body>
    <div
      id="root"
      data-composition-id="{demo_id}"
      data-start="0"
      data-duration="{duration:g}"
      data-width="1080"
      data-height="1920"
    >
      <video
        id="a-roll"
        class="clip"
        src="../_sandbox/sample_5s.mp4"
        playsinline
        data-start="0"
        data-duration="{duration:g}"
        data-has-audio="true"
      ></video>
{_indent(rendered.html, 6)}
    </div>
    <script>
      window.HF_BLOCKS = window.HF_BLOCKS || {{}};
{_indent(registry.load_anim(name), 6)}
      const tl = gsap.timeline({{ paused: true }});
      HF_BLOCKS[{json.dumps(name)}](tl, {json.dumps(effect['id'])}, {json.dumps(params, sort_keys=True)}, {json.dumps(meta, sort_keys=True)});
      window.__timelines = window.__timelines || {{}};
      window.__timelines[{json.dumps(demo_id)}] = tl;
    </script>
  </body>
</html>
"""
    path = registry.block_dir(name) / "demo.html"
    path.write_text(html, encoding="utf-8")
    return path


def _demo_asset(asset_id: str, kind: str) -> str:
    """Each demo copies the one asset it needs next to itself."""
    filename = "reaction_box.png" if kind == "popup" else f"{asset_id}.wav"
    asset_dir = "popups" if kind == "popup" else "sfx"
    src = ROOT / "data" / "assets" / asset_dir / filename
    dst = registry.block_dir(kind if kind == "popup" else "sfx") / "assets" / kind / filename
    dst.parent.mkdir(parents=True, exist_ok=True)
    if src.exists() and not dst.exists():
        shutil.copy2(src, dst)
    return f"assets/{kind}/{filename}"


def _indent(text: str, spaces: int) -> str:
    pad = " " * spaces
    return "\n".join(pad + line if line.strip() else line for line in text.splitlines())


def main() -> int:
    for name in registry.BLOCK_TYPES:
        path = build(name)
        print(f"wrote {path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
