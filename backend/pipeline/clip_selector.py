import json
import re
from typing import List, Dict
from pathlib import Path

from ..llm.claude_client import select_clips_with_claude, CLAUDE_AVAILABLE
from ..utils.config import CLIP_DURATION_MIN, CLIP_DURATION_MAX, NUM_CLIPS_LOCAL, TEMP_DIR

NUM_CLIPS_TO_GENERATE = NUM_CLIPS_LOCAL


def select_clips_with_claude_wrapper(
    transcript: dict,
    audio_peaks: dict,
    speech_segments: list,
    task_id: str,
    progress_callback=None
) -> dict:
    if CLAUDE_AVAILABLE:
        return select_clips_with_claude(
            transcript, audio_peaks, speech_segments,
            task_id, progress_callback
        )

    if progress_callback:
        progress_callback("Claude API key not configured, using energy-peak fallback")
    return _fallback_selection(transcript, audio_peaks)


def _fallback_selection(transcript: dict, audio_peaks: dict) -> dict:
    clips = []
    peaks = audio_peaks.get("peaks", [])
    video_duration = transcript.get("duration_s", 120)

    if peaks:
        seen_starts = []
        for peak in sorted(peaks, key=lambda p: p.get("energy_score", 0), reverse=True)[:5]:
            start = max(0, peak.get("timestamp", 0) - 5)
            is_dup = any(abs(start - s) < 15 for s in seen_starts)
            if is_dup:
                continue
            seen_starts.append(start)
            clips.append({
                "start": round(start, 2),
                "end": round(min(start + 15, video_duration), 2),
                "viral_title": "Top Moment",
                "caption": "Engaging moment detected",
                "hashtags": "#shorts #viral",
                "story_score": 70,
                "reason": f"Energy peak at {peak.get('timestamp', 0):.1f}s"
            })

    while len(clips) < 3:
        start = len(clips) * (video_duration / 3)
        clips.append({
            "start": round(start, 2),
            "end": round(min(start + 15, video_duration), 2),
            "viral_title": "Highlight",
            "caption": "Video highlight",
            "hashtags": "#shorts #viral",
            "story_score": 50,
            "reason": "Evenly distributed fallback clip"
        })

    return {"clips": clips[:5]}


def validate_clips(clips: list, video_duration: float) -> list:
    validated = []
    seen_intervals = set()
    for clip in clips:
        start = float(clip.get("start", 0))
        end = float(clip.get("end", start + 30))
        if start >= video_duration:
            start = 0
        if end > video_duration:
            end = video_duration
        if end <= start:
            end = start + min(30, video_duration - start - 0.1)
        duration = end - start
        if CLIP_DURATION_MIN <= duration <= CLIP_DURATION_MAX and end <= video_duration:
            interval_key = (round(start, 1), round(end, 1))
            if interval_key not in seen_intervals:
                seen_intervals.add(interval_key)
                validated.append({
                    "start": round(start, 2),
                    "end": round(end, 2),
                    "caption": clip.get("caption", "")[:200],
                    "viral_title": clip.get("viral_title", "")[:100],
                    "hashtags": clip.get("hashtags", "")[:200]
                })
    return validated


def generate_ass_subtitle(
    caption: str,
    start_time: float,
    end_time: float,
    output_path: Path
) -> str:
    duration = end_time - start_time
    simple_content = f"Subtitle: {caption}\nStart: {start_time}s\nEnd: {end_time}s\nDuration: {duration:.1f}s"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(simple_content)
    return str(output_path)


def format_ass_timestamp(seconds: float) -> str:
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    centiseconds = int((seconds % 1) * 100)
    return f"{hours}:{minutes:02d}:{secs:02d}.{centiseconds:02d}"


def generate_simple_ass(caption: str, duration: float, output_path: Path) -> str:
    ass_content = f"""; LibreWolf ASS Subtitles - Simple Caption
[Script Info]
Title: RelatiV Caption
ScriptType: v4.00+
WrapStyle: 0
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,Arial,72,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,3,0,2,30,30,90,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,{end_time},Caption,,0,0,0,,{caption}
"""
    ass_content = ass_content.replace("{caption}", caption).replace("{end_time}", format_ass_timestamp(duration))
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(ass_content)
    return str(output_path)
