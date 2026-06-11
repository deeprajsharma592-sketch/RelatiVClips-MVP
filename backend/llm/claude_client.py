import json
import httpx
from typing import Optional
from ..utils.config import ANTHROPIC_API_KEY, CLAUDE_MODEL

CLAUDE_AVAILABLE = bool(ANTHROPIC_API_KEY)

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"


def is_claude_available() -> bool:
    return bool(ANTHROPIC_API_KEY)


def _build_viral_prompt(transcript: dict, audio_analysis: dict, speech_segments: list) -> str:
    segments_text = []
    for seg in transcript.get("segments", [])[:50]:
        segments_text.append(f"[{seg.get('start', 0):.1f}s - {seg.get('end', 0):.1f}s] {seg.get('text', '')}")

    transcript_snippet = "\n".join(segments_text)

    peaks = audio_analysis.get("peaks", [])
    peaks_text = "\n".join([
        f"[{p.get('timestamp', 0):.1f}s] Energy: {p.get('energy_score', 0):.4f}"
        for p in peaks[:10]
    ]) if peaks else "No energy peaks detected."

    return f"""You are a Viral Content Strategist. Identify segments with high retention potential for vertical short-form video.

ENERGY PEAKS:
{peaks_text}

TRANSCRIPT:
{transcript_snippet}

Select 3-5 clips that are the most engaging moments. Prioritize:
- Natural hooks and strong开场 statements
- Emotional peaks or surprising revelations
- Moments with high audience retention potential
- Clear, self-contained segments that work without context

Return a JSON object with this exact structure:
{{
  "clips": [
    {{
      "start": <float seconds>,
      "end": <float seconds>,
      "viral_title": "<catchy short title>",
      "caption": "<one-line description>",
      "hashtags": "<space-separated hashtags>",
      "story_score": <int 1-100>,
      "reason": "<why this clip works>"
    }}
  ]
}}

Rules:
- Each clip must be between 10-20 seconds long
- Return ONLY valid JSON, no markdown, no explanation
- Include at least 3 clips, never an empty list
- story_score should reflect viral potential (higher = more viral)"""


def select_clips_with_claude(
    transcript: dict,
    audio_analysis: dict,
    speech_segments: list,
    task_id: str,
    progress_callback=None
) -> dict:
    if not CLAUDE_AVAILABLE:
        if progress_callback:
            progress_callback("Claude API key not configured, using fallback selection")
        return _fallback_selection(transcript, audio_analysis)

    if progress_callback:
        progress_callback("Sending transcript to Claude for viral hook analysis...")

    prompt = _build_viral_prompt(transcript, audio_analysis, speech_segments)

    try:
        with httpx.Client(timeout=120.0) as client:
            response = client.post(
                ANTHROPIC_API_URL,
                headers={
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": CLAUDE_MODEL,
                    "max_tokens": 2048,
                    "messages": [
                        {"role": "user", "content": prompt}
                    ]
                }
            )

            if response.status_code != 200:
                if progress_callback:
                    progress_callback(f"Claude API error ({response.status_code}), using fallback")
                return _fallback_selection(transcript, audio_analysis)

            result = response.json()
            content = result.get("content", [])
            text = ""
            for block in content:
                if block.get("type") == "text":
                    text = block.get("text", "")
                    break

            if not text:
                if progress_callback:
                    progress_callback("Empty Claude response, using fallback")
                return _fallback_selection(transcript, audio_analysis)

            clips = _parse_claude_response(text)
            if clips:
                if progress_callback:
                    progress_callback(f"Claude selected {len(clips)} clips")
                return {"clips": clips}
            else:
                if progress_callback:
                    progress_callback("Could not parse Claude response, using fallback")
                return _fallback_selection(transcript, audio_analysis)

    except Exception as e:
        if progress_callback:
            progress_callback(f"Claude API error: {e}, using fallback")
        return _fallback_selection(transcript, audio_analysis)


def _parse_claude_response(text: str) -> list:
    text = text.strip()
    json_match = None
    import re

    obj_match = re.search(r'\{\s*"clips"\s*:', text, re.DOTALL)
    if obj_match:
        brace_count = 0
        start = obj_match.start()
        for i in range(start, len(text)):
            if text[i] == '{':
                brace_count += 1
            elif text[i] == '}':
                brace_count -= 1
                if brace_count == 0:
                    json_match = text[start:i + 1]
                    break
    else:
        array_match = re.search(r'\[.*\]', text, re.DOTALL)
        if array_match:
            json_match = '{"clips": ' + array_match.group() + '}'

    if not json_match:
        return []

    json_match = re.sub(r',\s*([\]}])', r'\1', json_match)

    try:
        parsed = json.loads(json_match)
        clips = parsed.get("clips", []) if isinstance(parsed, dict) else parsed
        return clips if isinstance(clips, list) else []
    except json.JSONDecodeError:
        return []


def _fallback_selection(transcript: dict, audio_analysis: dict) -> dict:
    clips = []
    peaks = audio_analysis.get("peaks", [])
    video_duration = audio_analysis.get("duration_s", 120)

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
