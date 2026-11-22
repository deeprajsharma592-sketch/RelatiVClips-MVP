"""Compatibility facade for the measured RelatiV ASS caption engine."""
from __future__ import annotations

import re
from pathlib import Path
from typing import Dict, Optional

from ..captioning.ass_builder import build_ass
from ..captioning.registry import FONT_DIR, get_registry, normalize_preset

CAPTION_FONT_DIR = FONT_DIR
CAPTION_PRESETS = {
    key: {**value, "font_name": value["font"]["family"]}
    for key, value in get_registry()["presets"].items()
}


def normalize_caption_preset(value: object) -> str:
    return normalize_preset(value)


def _sanitize_text(text: str) -> str:
    text = re.sub(
        r"\[(?:PAUSE|SILENCE|MUSIC|LAUGH|APPLAUSE|CHAT_SPIKE|LOUD)\]",
        "",
        str(text or ""),
        flags=re.IGNORECASE,
    )
    text = text.replace("{", "(").replace("}", ")").replace("\\", "／")
    return re.sub(r"\s+", " ", text).strip().upper()


def generate_viral_ass_subtitles(
    clip: Dict,
    output_path: Path,
    words_per_group: Optional[int] = None,
    font_name: Optional[str] = None,
    font_size: Optional[int] = None,
    highlight_color: str = "&H000AD6FF",
    text_color: str = "&H00FFFFFF",
    outline_color: str = "&H00000000",
    lead_time_s: float = 0.0,
) -> Optional[str]:
    result = build_ass(clip, Path(output_path))
    clip["caption_words"] = result.get("words", [])
    clip["caption_layout"] = result.get("layout", [])
    clip["caption_style"] = result.get("style", {})
    return result.get("path")
