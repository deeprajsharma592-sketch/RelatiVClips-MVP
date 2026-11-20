"""
Viral ASS subtitle generator for 9:16 short-form video.
Produces word-level karaoke highlighting (Opus Clip / Submagic style).
"""
import os
import re
from pathlib import Path
from typing import Dict, List, Optional


CAPTION_FONT_DIR = Path(__file__).resolve().parents[1] / "assets" / "fonts"
CAPTION_PRESETS = {
    "studio": {
        "label": "Studio",
        "font_name": "Montserrat",
        "font_size": 76,
        "words_per_group": 3,
        "outline": 5,
        "spacing": 1,
    },
    "impact": {
        "label": "Impact",
        "font_name": "Anton",
        "font_size": 84,
        "words_per_group": 3,
        "outline": 6,
        "spacing": 2,
    },
    "broadcast": {
        "label": "Broadcast",
        "font_name": "Barlow Condensed ExtraBold",
        "font_size": 88,
        "words_per_group": 4,
        "outline": 5,
        "spacing": 1,
    },
    "clean": {
        "label": "Clean",
        "font_name": "Open Sans",
        "font_size": 70,
        "words_per_group": 4,
        "outline": 4,
        "spacing": 0,
    },
}


def normalize_caption_preset(value: object) -> str:
    preset = str(value or "studio").strip().lower()
    return preset if preset in CAPTION_PRESETS else "studio"


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
    words_per_group: Optional[int] = None,
    font_name: Optional[str] = None,
    font_size: Optional[int] = None,
    highlight_color: str = "&H0000E5FF",  # Bright Yellow/Amber in &HAABBGGRR
    text_color: str = "&H00FFFFFF",       # Pure White
    outline_color: str = "&H00000000",    # Deep Black
    lead_time_s: float = float(os.getenv("CAPTION_LEAD_TIME_SECONDS", "0.5")),  # 0.5s visual anticipation
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
    preset_id = normalize_caption_preset(clip.get("caption_font") or clip.get("caption_style"))
    preset = CAPTION_PRESETS[preset_id]
    font_name = font_name or str(preset["font_name"])
    font_size = int(font_size or preset["font_size"])
    words_per_group = int(words_per_group or preset["words_per_group"])
    outline_size = int(preset["outline"])
    letter_spacing = int(preset["spacing"])

    # 1. Collect all words within [clip_start, clip_end]
    raw_words = []
    transcript = clip.get("transcript") or {}
    segments = transcript.get("segments", [])
    has_word_timestamps = any(seg.get("words") for seg in segments)

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
                    if e_rel <= s_rel:
                        e_rel = min(clip_duration, s_rel + max(1.0, len(words) * 0.35))
                    step = max(0.15, (e_rel - s_rel) / len(words))
                    for idx, w in enumerate(words):
                        clean_w = _sanitize_text(w)
                        if clean_w:
                            raw_words.append({
                                "word": clean_w,
                                "start": round(s_rel + idx * step, 3),
                                "end": round(s_rel + (idx + 1) * step, 3),
                            })

    raw_words.sort(key=lambda word: (word["start"], word["end"]))
    # Hook windows can overlap, so the same source word may be present in
    # more than one stitched Whisper segment. Suppress near-identical repeats
    # while retaining genuinely repeated speech later in the clip.
    unique_words = []
    for word in raw_words:
        normalized = re.sub(r"[^A-Z0-9']", "", word["word"])
        duplicate = any(
            normalized == re.sub(r"[^A-Z0-9']", "", prev["word"])
            and abs(word["start"] - prev["start"]) <= 0.15
            for prev in unique_words[-4:]
        )
        if not duplicate:
            unique_words.append(word)
    raw_words = unique_words

    # YouTube VTT cues contain phrase timestamps, not word timestamps. For
    # karaoke-style captions, prefer a local word-timestamped pass whenever a
    # rendered source segment is available, retaining VTT timing as fallback.
    if not has_word_timestamps:
        local_media = clip.get("video_path") or clip.get("audio_path")
        if local_media and Path(local_media).exists():
            try:
                # Monkey-patch PyAV if av>=18 where metadata_errors was removed
                try:
                    import av
                    if not hasattr(av, "_patched_metadata_errors"):
                        _orig_av_open = av.open
                        def _safe_av_open(*args, **kwargs):
                            kwargs.pop("metadata_errors", None)
                            return _orig_av_open(*args, **kwargs)
                        av.open = _safe_av_open
                        av._patched_metadata_errors = True
                except Exception:
                    pass

                from faster_whisper import WhisperModel
                from ..utils.config import WHISPER_MODEL, WHISPER_COMPUTE_TYPE
                from ..utils.vram_manager import get_vram_usage
                vram = get_vram_usage()
                dev = "cuda" if vram.get("cuda_available") else "cpu"
                ctype = WHISPER_COMPUTE_TYPE if dev == "cuda" else "int8"
                whisper_mod = WhisperModel(WHISPER_MODEL, device=dev, compute_type=ctype)
                # Video file begins at video_source_start (padded boundary)
                v_src = float(clip.get("video_source_start", clip_start))
                rel_start = max(0.0, clip_start - v_src)

                segs, _ = whisper_mod.transcribe(
                    str(local_media), word_timestamps=True, beam_size=5,
                    vad_filter=True,
                )
                whisper_words = []
                for seg in segs:
                    seg_words = getattr(seg, "words", None)
                    if seg_words:
                        for w in seg_words:
                            w_rel_start = float(w.start) - rel_start
                            w_rel_end = float(w.end) - rel_start
                            if w_rel_end > 0.0 and w_rel_start < clip_duration:
                                clean_w = _sanitize_text(w.word)
                                if clean_w:
                                    whisper_words.append({
                                        "word": clean_w,
                                        "start": max(0.0, round(w_rel_start, 3)),
                                        "end": min(clip_duration, round(w_rel_end, 3)),
                                    })
                    elif getattr(seg, "text", None):
                        words = seg.text.strip().split()
                        if words:
                            s_start = max(0.0, float(seg.start) - rel_start)
                            s_end = min(clip_duration, float(seg.end) - rel_start)
                            if s_end > s_start:
                                step = (s_end - s_start) / len(words)
                                for idx, w in enumerate(words):
                                    clean_w = _sanitize_text(w)
                                    if clean_w:
                                        whisper_words.append({
                                            "word": clean_w,
                                            "start": round(s_start + idx * step, 3),
                                            "end": round(s_start + (idx + 1) * step, 3),
                                        })
                if whisper_words:
                    raw_words = sorted(whisper_words, key=lambda word: word["start"])
            except Exception as e:
                print(f"[Captions] Clip Whisper fallback skipped: {e}")

    # Fallback 2: if still no words, synthesize kinetic subtitles from caption / viral title
    if not raw_words:
        summary_text = clip.get("caption") or clip.get("viral_title")
        if summary_text and len(summary_text.strip()) > 3:
            words = [w for w in summary_text.strip().split() if not w.startswith("#")]
            if words:
                step = min(0.45, max(0.25, (clip_duration - 1.0) / len(words)))
                for idx, w in enumerate(words):
                    clean_w = _sanitize_text(w)
                    if clean_w:
                        w_start = round(0.5 + idx * step, 3)
                        w_end = round(w_start + step, 3)
                        if w_end <= clip_duration:
                            raw_words.append({
                                "word": clean_w,
                                "start": w_start,
                                "end": w_end,
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
Style: Default,{font_name},{font_size},{text_color},&H000000FF,{outline_color},&H80000000,-1,0,0,0,100,100,{letter_spacing},0,1,{outline_size},2,2,40,40,280,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    dialogue_lines = []

    # 4. For each chunk, highlight the currently active word
    for chunk in grouped_chunks:
        c_words = chunk["words"]
        for active_idx, active_word in enumerate(c_words):
            # Apply 0.5s pre-sync anticipation so viewer reads right as word is voiced
            raw_s = active_word["start"] - lead_time_s
            raw_e = active_word["end"] - lead_time_s
            s_adj = max(0.0, raw_s)
            e_adj = max(s_adj + 0.18, raw_e)
            if s_adj >= clip_duration:
                continue
            e_adj = min(clip_duration, e_adj)
            if s_adj >= e_adj:
                continue

            w_start = _format_ass_timestamp(s_adj)
            w_end = _format_ass_timestamp(e_adj)

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

    # 5. Optional closing CTA / reward card in the final 2.2s
    from ..utils.config import ENABLE_CLOSING_CTA, CLOSING_CTA_TEXT
    cta_text = clip.get("closing_cta") or (CLOSING_CTA_TEXT if ENABLE_CLOSING_CTA else None)
    if cta_text and clip_duration >= 4.0:
        cta_start = max(0.0, clip_duration - 2.2)
        cta_end = clip_duration
        w_start = _format_ass_timestamp(cta_start)
        w_end = _format_ass_timestamp(cta_end)
        dialogue_lines.append(
            f"Dialogue: 1,{w_start},{w_end},Default,,0,0,140,,{{\\an2\\c&H00D24D\\b1\\fscx105\\fscy105}}▶ {cta_text.upper()}{{\\r}}"
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
