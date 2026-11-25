from __future__ import annotations

import json
import shutil
import subprocess
from functools import lru_cache
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
REGISTRY_PATH = ROOT / "shared" / "caption_styles.json"
FONT_DIR = ROOT / "backend" / "assets" / "fonts"


@lru_cache(maxsize=1)
def get_registry() -> dict[str, Any]:
    with REGISTRY_PATH.open(encoding="utf-8") as handle:
        return json.load(handle)


def normalize_preset(value: object) -> str:
    preset = str(value or "impact").strip().lower()
    aliases = {"studio": "impact", "broadcast": "impact", "clean": "stack", "statement": "impact"}
    preset = aliases.get(preset, preset)
    return preset if preset in get_registry()["presets"] else "impact"


def merge_style(style: object = None) -> dict[str, Any]:
    raw = style if isinstance(style, dict) else {"preset": style}
    preset_id = normalize_preset(raw.get("preset"))
    base = json.loads(json.dumps(get_registry()["presets"][preset_id]))
    overrides = raw.get("overrides") if isinstance(raw.get("overrides"), dict) else {}
    for key in ("case", "outline_px", "shadow_px", "letter_spacing", "max_words_per_group", "language"):
        if key in overrides:
            base[key] = overrides[key]
    for key in ("colors", "position", "sizes", "font"):
        if isinstance(overrides.get(key), dict):
            base[key].update(overrides[key])
    colorway = overrides.get("colorway")
    if colorway in base.get("colorways", {}):
        base["colors"]["accent"] = base["colorways"][colorway]
    base["position"]["y_percent"] = min(0.78, max(0.10, float(base["position"].get("y_percent", 0.62))))
    return base


def validate_fonts(*, strict: bool = True) -> list[str]:
    errors = [font["file"] for font in get_registry()["fonts"] if not (FONT_DIR / font["file"]).is_file()]
    scanner = shutil.which("fc-scan")
    if scanner:
        for font in get_registry()["fonts"]:
            path = FONT_DIR / font["file"]
            if not path.is_file():
                continue
            result = subprocess.run(
                [scanner, "--format", "%{family}", str(path)],
                capture_output=True,
                text=True,
                timeout=5,
            )
            families = {name.strip() for name in result.stdout.split(",") if name.strip()}
            if result.returncode or font["family"] not in families:
                errors.append(f"{font['file']} (expected family '{font['family']}', saw '{result.stdout.strip()}')")
    if errors and strict:
        raise RuntimeError("Caption font registry mismatch: " + ", ".join(errors))
    return errors
