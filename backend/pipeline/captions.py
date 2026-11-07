"""
Viral ASS subtitle generator for 9:16 short-form video.
Produces word-level karaoke highlighting (Opus Clip / Submagic style).
"""
import re
from pathlib import Path
from typing import Dict, List, Optional


def _format_ass_timestamp(seconds: float) -> str:
    """Format float seconds to ASS format: H:MM:SS.cs (centiseconds)."""
    if seconds < 0:
        seconds = 0.0
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    centis = int(round((seconds % 1) * 100))
    if centis >= 100:
        secs += 1
        centis -= 100
    return f"{hours}:{minutes:02d}:{secs:02d}.{centis:02d}"


def _sanitize_text(text: str) -> str:
    """Clean text for ASS subtitle rendering."""
    # Replace newlines, tabs, curly braces which are ASS control characters
    text = text.replace("{", "(").replace("}", ")")
    text = re.sub(r"\s+", " ", text).strip()
    return text.upper()


def generate_viral_ass_subtitles(
    clip: Dict,
    output_path: Path,
    words_per_group: int = 3,
    font_name: str = "Arial",
    font_size: int = 76,
    highlight_color: str = "&H0000E5FF",  # Bright Yellow/Amber in &HAABBGGRR
    text_color: str = "&H00FFFFFF",       # Pure White
    outline_color: str = "&H00000000",    # Deep Black
) -> Optional[str]:
    """
    Generate an ASS subtitle file with word-by-word active highlighting.
    
    Args:
        clip: Dict with keys:
              - 'start': float (clip start in source video)
              - 'end': float (clip end in source video)
              - 'transcript': Optional dict with 'segments' -> 'words'
              - 'caption': Optional fallback string
        output_path: Destination path for .ass file
        words_per_group: How many words are shown on screen at one time
    
    Returns:
        Path string to written .ass file, or None if failed.
    """
    clip_start = float(clip.get("start", 0))
    clip_end = float(clip.get("end", clip_start + 15))
    clip_duration = max(1.0, clip_end - clip_start)

    # 1. Collect all words within [clip_start, clip_end]
    raw_words = []
    transcript = clip.get("transcript") or {}
    segments = transcript.get("segments", [])

    for seg in segments:
        seg_words = seg.get("words", [])
        if seg_words:
            for w in seg_words:
                w_start = float(w.get("start", 0))
                w_end = float(w.get("end", w_start + 0.3))
                # Check if word overlaps with clip boundary
                if w_end > clip_start and w_start < clip_end:
                    clean_w = _sanitize_text(w.get("word", ""))
                    if clean_w:
                        raw_words.append({
                            "word": clean_w,
                            "start": max(0.0, w_start - clip_start),
                            "end": min(clip_duration, w_end - clip_start),
                        })
        else:
            # Segment has text but no word timestamps
            seg_start = float(seg.get("start", 0))
            seg_end = float(seg.get("end", seg_start + 2.0))
            if seg_end > clip_start and seg_start < clip_end:
                words = seg.get("text", "").split()
                if words:
                    s_rel = max(0.0, seg_start - clip_start)
                    e_rel = min(clip_duration, seg_end - clip_start)
                    step = (e_rel - s_rel) / len(words)
                    for idx, w in enumerate(words):
                        clean_w = _sanitize_text(w)
                        if clean_w:
                            raw_words.append({
                                "word": clean_w,
                                "start": round(s_rel + idx * step, 3),
                                "end": round(s_rel + (idx + 1) * step, 3),
                            })

    # Fallback if no words from transcript: synthesize from caption
    if not raw_words:
        caption = clip.get("caption") or clip.get("viral_title") or ""
        words = caption.split()
        if not words:
            words = ["WATCH", "THIS", "MOMENT"]
        step = clip_duration / len(words)
        for idx, w in enumerate(words):
            clean_w = _sanitize_text(w)
            if clean_w:
                raw_words.append({
                    "word": clean_w,
                    "start": round(idx * step, 3),
                    "end": round((idx + 1) * step, 3),
                })

    if not raw_words:
        return None

    # 2. Chunk words into screen groups (e.g., 3 words per flash)
    grouped_chunks = []
    for i in range(0, len(raw_words), words_per_group):
        group = raw_words[i : i + words_per_group]
        if group:
            g_start = group[0]["start"]
            g_end = max(group[-1]["end"], g_start + 0.5)
            grouped_chunks.append({
                "start": g_start,
                "end": g_end,
                "words": group,
            })

    # 3. Build ASS script header with viral 9:16 layout
    # Alignment 2 = bottom-center. MarginV = 280 keeps it comfortably above UI icons
    ass_header = f"""[Script Info]
Title: RelatiV Viral Captions
ScriptType: v4.00+
WrapStyle: 0
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font_name},{font_size},{text_color},&H000000FF,{outline_color},&H80000000,-1,0,0,0,100,100,1,0,1,5,2,2,40,40,280,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    dialogue_lines = []

    # 4. For each chunk, highlight the currently active word
    for chunk in grouped_chunks:
        c_words = chunk["words"]
        for active_idx, active_word in enumerate(c_words):
            w_start = _format_ass_timestamp(active_word["start"])
            w_end = _format_ass_timestamp(active_word["end"])
            if active_word["start"] >= active_word["end"]:
                continue

            # Render words in this chunk: active word gets highlight color + slight scale pop
            rendered_words = []
            for j, w in enumerate(c_words):
                if j == active_idx:
                    rendered_words.append(
                        r"{\c" + highlight_color + r"\fscx108\fscy108}" + w["word"] + r"{\r}"
                    )
                else:
                    rendered_words.append(
                        r"{\c" + text_color + r"}" + w["word"]
                    )

            event_text = " ".join(rendered_words)
            dialogue_lines.append(
                f"Dialogue: 0,{w_start},{w_end},Default,,0,0,0,,{event_text}"
            )

    full_ass = ass_header + "\n".join(dialogue_lines) + "\n"

    try:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(full_ass)
        return str(output_path)
    except Exception as e:
        print(f"[Captions] Error saving ASS file: {e}")
        return None
