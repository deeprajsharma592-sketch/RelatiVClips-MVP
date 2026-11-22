from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from .placement import choose_layout
from .registry import FONT_DIR, merge_style

STOPWORDS = {"a", "an", "the", "and", "or", "but", "is", "are", "to", "of", "in", "on", "for", "with", "hai", "ye", "yeh", "ka", "ki", "ko", "se", "ne", "mein", "toh", "aur", "bhi", "woh"}
SIGNALS = re.compile(r"\[(?:PAUSE|SILENCE|MUSIC|LAUGH|APPLAUSE|CHAT_SPIKE|LOUD)\]", re.I)


def _clean(value: object) -> str:
    return re.sub(r"\s+", " ", SIGNALS.sub("", str(value or ""))).strip()


def _escape(value: str) -> str:
    return value.replace("\\", "／").replace("{", "（").replace("}", "）").replace("\n", r"\N")


def _ts(seconds: float) -> str:
    seconds = max(0.0, seconds)
    total = int(round(seconds * 100))
    return f"{total // 360000}:{(total // 6000) % 60:02d}:{(total // 100) % 60:02d}.{total % 100:02d}"


def _ass_color(hex_color: str, alpha: str = "00") -> str:
    value = hex_color.lstrip("#").upper().ljust(6, "0")[:6]
    return f"&H{alpha}{value[4:6]}{value[2:4]}{value[0:2]}"


def normalize_words(clip: dict) -> list[dict[str, Any]]:
    start, end = float(clip.get("start", 0)), float(clip.get("end", 30))
    duration = max(0.5, end - start)
    supplied = clip.get("words") or (clip.get("edit") or {}).get("words")
    result = []
    if supplied:
        for word in supplied:
            text = _clean(word.get("w") or word.get("word"))
            if text:
                result.append({"w": text, "start": max(0.0, float(word.get("start", 0))), "end": min(duration, float(word.get("end", 0.3))), "emph": int(word.get("emph", 0))})
        return sorted(result, key=lambda item: item["start"])
    for segment in (clip.get("transcript") or {}).get("segments", []):
        words = segment.get("words") or []
        if words:
            for word in words:
                w_start, w_end = float(word.get("start", 0)), float(word.get("end", 0.3))
                if w_end <= start or w_start >= end:
                    continue
                text = _clean(word.get("word"))
                if text:
                    emph = 2 if re.search(r"(?:[$₹]\d|\d+%?)", text) else (1 if text.isupper() and len(text) > 2 else 0)
                    result.append({"w": text, "start": max(0.0, w_start - start), "end": min(duration, w_end - start), "emph": emph})
        else:
            text_words = _clean(segment.get("text")).split()
            s, e = max(start, float(segment.get("start", start))), min(end, float(segment.get("end", end)))
            step = max(0.12, (e - s) / max(1, len(text_words)))
            for idx, text in enumerate(text_words):
                result.append({"w": text, "start": s - start + idx * step, "end": s - start + (idx + 1) * step, "emph": 0})
    if not result:
        fallback = _clean(clip.get("caption") or clip.get("viral_title")).split()
        step = min(0.45, max(0.22, (duration - 0.4) / max(1, len(fallback))))
        for index, text in enumerate(fallback):
            word_start = 0.2 + index * step
            if word_start >= duration:
                break
            result.append({"w": text, "start": word_start, "end": min(duration, word_start + step), "emph": 0})
    return sorted(result, key=lambda item: item["start"])


def _groups(words: list[dict], style: dict) -> list[dict]:
    groups, current = [], []
    max_words, max_chars = int(style["max_words_per_group"]), int(style["max_chars_per_line"])
    for word in words:
        pause = word["start"] - current[-1]["end"] if current else 0
        projected = len(" ".join(w["w"] for w in current + [word]))
        if current and (len(current) >= max_words or pause > 0.35 or projected > max_chars * int(style["lines_max"]) or re.search(r"[.!?]$", current[-1]["w"])):
            groups.append({"start": current[0]["start"], "end": current[-1]["end"] + 0.15, "words": current})
            current = []
        current.append(word)
    if current:
        groups.append({"start": current[0]["start"], "end": current[-1]["end"] + 0.15, "words": current})
    return groups


def _font_width(text: str, font_path: Path, size: int) -> float:
    try:
        from PIL import ImageFont
        font = ImageFont.truetype(str(font_path), size=size)
        return float(font.getlength(text))
    except Exception:
        return len(text) * size * 0.57


def _fit_lines(group: dict, style: dict) -> tuple[list[list[dict]], int, tuple[int, int]]:
    size = int(style["sizes"]["normal"])
    font_path = FONT_DIR / style["font"]["file"]
    lines: list[list[dict]] = [[]]
    for word in group["words"]:
        candidate = " ".join(w["w"] for w in lines[-1] + [word])
        if lines[-1] and _font_width(candidate, font_path, size) > 920 and len(lines) < int(style["lines_max"]):
            lines.append([])
        lines[-1].append(word)
    longest = max((_font_width(" ".join(w["w"] for w in line), font_path, size) for line in lines), default=1)
    while longest > 920 and size > int(style["sizes"]["normal"] * 0.70):
        size = int(size * 0.96)
        longest = max(_font_width(" ".join(w["w"] for w in line), font_path, size) for line in lines)
    return lines, size, (int(min(920, longest)), int(len(lines) * size * 1.18))


def build_ass(clip: dict, output_path: Path, style_payload: object = None) -> dict:
    style_payload = style_payload or clip.get("style") or {"preset": clip.get("caption_font")}
    style = merge_style(style_payload)
    words = normalize_words(clip)
    if not words:
        return {"path": None, "groups": [], "layout": []}
    if style["case"] == "upper":
        for word in words: word["w"] = word["w"].upper()
    groups = _groups(words, style)
    fitted = []
    for group in groups:
        lines, size, block = _fit_lines(group, style)
        group.update({"lines": lines, "font_size": size, "block_size": block})
        fitted.append(group)
    position_mode = ((style_payload or {}).get("overrides") or {}).get("position_mode", "auto") if isinstance(style_payload, dict) else "auto"
    if position_mode == "auto":
        layout = choose_layout(fitted, clip.get("subject_track"), style["id"])
    else:
        y = int(style["position"]["y_percent"] * 1920)
        layout = [{"group_id": i, "slot": position_mode, "x": int(style["position"].get("x", 540)), "y": y, "scale": 1.0, "face_overlap": 0} for i in range(len(fitted))]
    primary, accent, accent2 = (_ass_color(style["colors"][key]) for key in ("primary", "accent", "accent2"))
    outline, shadow = _ass_color(style["colors"]["outline"]), _ass_color(style["colors"]["shadow"], "80")
    header = f"""[Script Info]\nTitle: RelatiV Captions\nScriptType: v4.00+\nWrapStyle: 2\nPlayResX: 1080\nPlayResY: 1920\nScaledBorderAndShadow: yes\nYCbCr Matrix: TV.709\n\n[V4+ Styles]\nFormat: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\nStyle: Default,{style['font']['family']},{style['sizes']['normal']},{primary},{primary},{outline},{shadow},0,0,0,0,100,100,{style['letter_spacing']},0,1,{style['outline_px']},{style['shadow_px']},5,0,0,0,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"""
    events = []
    for index, group in enumerate(fitted):
        pos = layout[index]
        flat = group["words"]
        boundaries = [max(flat[i]["start"], flat[i - 1]["start"] if i else 0) for i in range(len(flat))]
        boundaries.append(max(group["end"], boundaries[-1] + 0.08))
        for active, word in enumerate(flat):
            rendered_lines = []
            cursor = 0
            for line in group["lines"]:
                rendered = []
                for item in line:
                    text = _escape(item["w"])
                    color = accent if cursor == active else (accent2 if item.get("emph", 0) else primary)
                    deva = r"{\fnNoto Sans Devanagari Bold}" if re.search(r"[\u0900-\u097F]", text) else ""
                    reset = r"{\fn}" if deva else ""
                    if style["id"] == "stack":
                        factor = 1.7 if item.get("emph") == 2 else (0.55 if item["w"].lower().strip(".,!?") in STOPWORDS else 1.0)
                        rendered.append(r"{\fs" + str(int(group["font_size"] * factor)) + r"\c" + color + "}" + deva + text + reset)
                    else:
                        rendered.append(r"{\fs" + str(group["font_size"]) + r"\c" + color + "}" + deva + text + reset)
                    cursor += 1
                rendered_lines.append(" ".join(rendered))
            prefix = rf"{{\an5\pos({int(pos['x'])},{int(pos['y'])})}}"
            if active == 0:
                prefix = rf"{{\an5\pos({int(pos['x'])},{int(pos['y'])})\fscx82\fscy82\t(0,90,\fscx108\fscy108)\t(90,160,\fscx100\fscy100)}}"
            events.append(f"Dialogue: 0,{_ts(boundaries[active])},{_ts(boundaries[active + 1])},Default,,0,0,0,,{prefix}" + r"\N".join(rendered_lines))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(header + "\n".join(events) + "\n", encoding="utf-8")
    return {"path": str(output_path), "groups": fitted, "layout": layout, "words": words, "style": style}
