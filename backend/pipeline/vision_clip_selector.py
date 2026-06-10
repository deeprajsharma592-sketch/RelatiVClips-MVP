"""
Vision-Enabled Clip Selector for RelatiV

Captures high-engagement video frames and analyzes them with vision models
to select the best clips for viral short-form content.

This combines:
- Audio energy peaks (from Librosa) - identifies high-engagement moments
- Vision analysis (Gemma4 E4B or similar) - understands visual content
- Transcript analysis - semantic quality of dialogue
- Speech boundaries - ensures clips start/end during speech
"""

import json
import re
import httpx
import cv2
import numpy as np
from typing import List, Dict, Optional
from pathlib import Path
from datetime import datetime
from ..utils.config import (
    CLIP_DURATION_MIN,
    CLIP_DURATION_MAX,
    NUM_CLIPS_LOCAL,
    TEMP_DIR,
    TARGET_SAMPLE_RATE,
    OLLAMA_BASE_URL,
)

VISION_MODEL = "gemma-4-e4b-it"
TEXT_MODEL = "llama3.2:1b"
OLLAMA_SYSTEM_PROMPT = "You are a helpful assistant that outputs ONLY valid JSON."

NUM_CLIPS_TO_GENERATE = NUM_CLIPS_LOCAL


def extract_frame_at_timestamp(video_path: str, timestamp: float) -> Optional[np.ndarray]:
    """Extract a single video frame at the given timestamp."""
    cap = cv2.VideoCapture(video_path)
    cap.set(cv2.CAP_PROP_POS_MSEC, timestamp * 1000)
    ret, frame = cap.read()
    cap.release()
    return frame if ret else None


def save_frame_as_image(frame: np.ndarray, output_path: Path) -> str:
    """Save a frame as PNG image file."""
    cv2.imwrite(str(output_path), frame)
    return str(output_path)


def get_high_engagement_frames(
    video_path: str,
    audio_peaks: dict,
    num_frames: int = 5
) -> List[dict]:
    """
    Extract frames at high-engagement timestamps (audio peaks).
    
    For vision analysis, we need the actual frame images, not just timestamps.
    
    Args:
        video_path: Path to video file
        audio_peaks: Dict with peaks from audio_analysis.py
        num_frames: Number of top frames to extract
        
    Returns:
        List of dicts with frame_path, timestamp, energy_score
    """
    print(f"[VisionClip] Extracting {num_frames} high-engagement frames...")
    
    frames_dir = TEMP_DIR / "vision_frames"
    frames_dir.mkdir(exist_ok=True)
    
    top_peaks = audio_peaks.get("peaks", [])[:num_frames]
    
    extracted_frames = []
    for i, peak in enumerate(top_peaks):
        timestamp = peak["timestamp"]
        energy_score = peak["energy_score"]
        
        frame = extract_frame_at_timestamp(video_path, timestamp)
        if frame is not None:
            frame_path = frames_dir / f"peak_frame_{i}_{timestamp:.1f}s.png"
            save_frame_as_image(frame, frame_path)
            
            extracted_frames.append({
                "frame_path": str(frame_path),
                "timestamp": timestamp,
                "energy_score": energy_score,
                "relative_energy": peak.get("relative_to_mean", 1.0)
            })
            print(f"  [VisionClip] Extracted frame at {timestamp:.1f}s (energy: {energy_score:.4f})")
        else:
            print(f"  [VisionClip] Failed to extract frame at {timestamp:.1f}s")
    
    return extracted_frames


def analyze_frame_with_vision(
    frame_path: str,
    timestamp: float,
    energy_context: str,
    task_id: str,
    progress_callback=None
) -> dict:
    """
    Analyze a video frame using vision-capable model (Gemma4 E4B).
    
    Sends the image to Ollama with vision model for visual understanding.
    
    Args:
        frame_path: Path to frame image
        timestamp: Video timestamp
        energy_context: Audio energy context
        task_id: Task identifier
        progress_callback: Optional callback
        
    Returns:
        Dict with vision analysis results
    """
    if progress_callback:
        progress_callback(f"Analyzing frame at {timestamp:.1f}s with vision model...")
    
    try:
        import base64
        
        with open(frame_path, "rb") as f:
            image_data = base64.b64encode(f.read()).decode("utf-8")
        
        prompt = f"""Analyze this video frame for viral clip potential.

Timestamp: {timestamp:.1f}s
Audio Energy: {energy_context}

Evaluate the frame for:
1. Visual appeal (composition, lighting, focus)
2. Subject engagement (facing camera, expression, energy)
3. Content quality (clear, professional, interesting)
4. Viral potential (hook moments, visual impact)

Return ONLY valid JSON:
{{
  "timestamp": {timestamp:.1f},
  "visual_score": 0-10,
  "engagement_score": 0-10,
  "viral_potential": 0-10,
  "analysis": "brief description of visual content",
  "suitable_for_clip": true/false
}}"""

        with httpx.Client(timeout=120.0) as client:
            response = client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": VISION_MODEL,
                    "prompt": prompt,
                    "images": [image_data],
                    "stream": False,
                    "options": {"temperature": 0.3, "num_predict": 512}
                }
            )
            
            if response.status_code == 200:
                result = response.json()
                generated_text = result.get("response", "")
                
                try:
                    analysis = json.loads(generated_text)
                    return {
                        "timestamp": timestamp,
                        "frame_path": frame_path,
                        "analysis": analysis,
                        "success": True
                    }
                except json.JSONDecodeError:
                    pass
            
            if progress_callback:
                progress_callback(f"Vision model unavailable, using text-only fallback")
                
    except httpx.ConnectError:
        print(f"[VisionClip] Ollama not connected - using text-only analysis")
    except Exception as e:
        print(f"[VisionClip] Vision analysis error: {e}")
    
    return {
        "timestamp": timestamp,
        "frame_path": frame_path,
        "analysis": None,
        "success": False
    }


def select_clips_with_vision(
    video_path: str,
    transcript: dict,
    audio_peaks: dict,
    speech_segments: list,
    task_id: str,
    progress_callback=None
) -> dict:
    """
    Select viral clips using combined vision + text + audio analysis.
    
    This is the main entry point that orchestrates:
    1. Extract high-engagement frames from video
    2. Analyze frames with vision model (if available)
    3. Combine with transcript + audio analysis
    4. Select best clips using LLM with all context
    
    Args:
        video_path: Path to video file
        transcript: Transcript from faster-whisper
        audio_peaks: Energy peaks from Librosa
        speech_segments: Valid speech time ranges
        task_id: Task identifier
        progress_callback: Optional callback
        
    Returns:
        dict with selected clips
    """
    if progress_callback:
        progress_callback("Starting vision-enabled clip selection...")
    
    print(f"[VisionClip] Starting vision-enabled selection for task {task_id}")
    
    frames_info = get_high_engagement_frames(video_path, audio_peaks, num_frames=5)
    
    vision_analyses = []
    if frames_info:
        if progress_callback:
            progress_callback(f"Analyzing {len(frames_info)} frames with vision model...")
        
        for frame_info in frames_info:
            energy_context = f"{frame_info['energy_score']:.4f} ({frame_info['relative_energy']:.1f}x mean)"
            analysis = analyze_frame_with_vision(
                frame_path=frame_info["frame_path"],
                timestamp=frame_info["timestamp"],
                energy_context=energy_context,
                task_id=task_id,
                progress_callback=progress_callback
            )
            vision_analyses.append(analysis)
    
    clips = select_clips_combined(
        video_path=video_path,
        transcript=transcript,
        audio_peaks=audio_peaks,
        speech_segments=speech_segments,
        vision_analyses=vision_analyses,
        task_id=task_id,
        progress_callback=progress_callback
    )
    
    return clips


def select_clips_combined(
    video_path: str,
    transcript: dict,
    audio_peaks: dict,
    speech_segments: list,
    vision_analyses: list,
    task_id: str,
    progress_callback=None
) -> dict:
    """
    Select clips using combined analysis from all sources.
    
    Builds a rich context prompt including:
    - Vision analysis results (if available)
    - Audio energy peaks
    - Transcript with timestamps
    - Speech boundaries
    
    Args:
        All analysis results plus task_id
        
    Returns:
        dict with selected clips
    """
    if progress_callback:
        progress_callback("Building combined analysis prompt...")
    
    segments_text = []
    for seg in transcript["segments"][:50]:
        words = [w["word"] for w in seg.get("words", [])]
        word_str = " ".join(words) if words else seg["text"]
        segments_text.append(f"[{seg['start']:.1f}s - {seg['end']:.1f}s] {word_str}")
    transcript_snippet = "\n".join(segments_text)

    peaks_text = "\n".join([
        f"[{p['timestamp']:.1f}s] Energy: {p['energy_score']:.4f} ({p['relative_to_mean']:.1f}x mean)"
        for p in audio_peaks["peaks"][:15]
    ])

    vision_text = ""
    if vision_analyses:
        successful_analyses = [a for a in vision_analyses if a.get("success") and a.get("analysis")]
        if successful_analyses:
            vision_text = "\n\nVISION ANALYSIS (high-engagement frames):\n"
            for analysis in successful_analyses:
                data = analysis["analysis"]
                vision_text += f"[{data.get('timestamp', analysis['timestamp']):.1f}s] "
                vision_text += f"Visual: {data.get('visual_score', 'N/A')}/10, "
                vision_text += f"Engagement: {data.get('engagement_score', 'N/A')}/10, "
                vision_text += f"Viral: {data.get('viral_potential', 'N/A')}/10, "
                vision_text += f"Analysis: {data.get('analysis', 'N/A')}\n"
    else:
        vision_text = "\n\nVISION ANALYSIS: Not available (using text-only fallback)"

    prompt = f"""You are a viral clip selector for short-form video content.

TASK: Select the {NUM_CLIPS_TO_GENERATE} most engaging {CLIP_DURATION_MIN}-{CLIP_DURATION_MAX} second clips.

CRITERIA:
1. High energy moments (emphasis, emotion, impact)
2. Complete thoughts (no mid-sentence cuts)
3. Valuable information or insight
4. Conversational hooks or questions
5. Visual appeal (if vision data available)

AUDIO ENERGY PEAKS:
{peaks_text}

VISION ANALYSIS{vision_text}

TRANSCRIPT:
{transcript_snippet}

SPEECH BOUNDARIES:
{', '.join([f"{s['start']:.1f}s-{s['end']:.1f}s" for s in speech_segments[:10]])}

CONSTRAINTS:
- Each clip: {CLIP_DURATION_MIN}-{CLIP_DURATION_MAX} seconds
- Non-overlapping clips
- Prefer moments where energy AND meaningful dialogue align

OUTPUT (ONLY valid JSON):
{{"clips": [{{"start": 0.0, "end": 30.0, "caption": "...", "viral_title": "...", "hashtags": "..."}}]}}"""

    try:
        with httpx.Client(timeout=300.0) as client:
            response = client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": TEXT_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.3, "num_predict": 2048}
                }
            )
            
            if response.status_code == 200:
                result = response.json()
                generated_text = result.get("response", "")
                
                clips_data = extract_json_array(generated_text)
                
                if clips_data:
                    return process_clips_response(clips_data, transcript, task_id, progress_callback)
                    
    except Exception as e:
        print(f"[VisionClip] LLM error: {e}")
    
    return process_clips_response(None, transcript, task_id, progress_callback)


def extract_json_array(text):
    """Extract JSON array from text."""
    try:
        match = re.search(r"(\[.*\])", text, re.DOTALL)
        if match:
            return json.loads(match.group(1))
        
        text = text.strip()
        start_idx = text.find("{")
        if start_idx == -1:
            return None
        
        brace_count = 0
        end_idx = -1
        for i in range(start_idx, len(text)):
            if text[i] == "{":
                brace_count += 1
            elif text[i] == "}":
                brace_count -= 1
                if brace_count == 0:
                    end_idx = i
                    break
        
        if end_idx > start_idx:
            json_str = text[start_idx:end_idx+1]
            return json.loads(json_str)
        
        return None
    except Exception:
        return None


def process_clips_response(
    clips_data,
    transcript: dict,
    task_id: str,
    progress_callback=None
) -> dict:
    """Process LLM response and validate clips."""
    
    if clips_data is None or (isinstance(clips_data, dict) and not clips_data.get("clips")):
        clips = []
    elif isinstance(clips_data, list):
        clips = clips_data
    else:
        clips = clips_data.get("clips", [])
    
    video_duration = transcript.get("duration_s", 9999)
    validated_clips = []
    
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
            validated_clips.append({
                "start": round(start, 2),
                "end": round(end, 2),
                "caption": clip.get("caption", "")[:200],
                "viral_title": clip.get("viral_title", "")[:100],
                "hashtags": clip.get("hashtags", "")[:200]
            })
    
    if len(validated_clips) == 0:
        validated_clips = generate_fallback_clips(transcript, task_id, progress_callback)
    
    if progress_callback:
        progress_callback(f"Selected {len(validated_clips)} clips")
    
    return {"clips": validated_clips, "task_id": task_id}


def generate_fallback_clips(
    transcript: dict,
    task_id: str,
    progress_callback=None
) -> list:
    """Fallback when vision or LLM analysis fails."""
    
    if progress_callback:
        progress_callback("Using speech-based fallback for clip selection...")
    
    speech_segments = []
    for seg in transcript["segments"]:
        if seg["text"].strip():
            speech_segments.append({
                "start": seg["start"],
                "end": seg["end"]
            })
    
    if not speech_segments:
        return []
    
    all_speech_start = min(s["start"] for s in speech_segments)
    all_speech_end = max(s["end"] for s in speech_segments)
    total_speech = all_speech_end - all_speech_start
    
    clips = []
    current_pos = all_speech_start
    
    while current_pos + CLIP_DURATION_MIN <= all_speech_end and len(clips) < NUM_CLIPS_TO_GENERATE:
        clip_end = min(current_pos + CLIP_DURATION_MAX, all_speech_end)
        
        if clip_end - current_pos >= CLIP_DURATION_MIN:
            clips.append({
                "start": round(current_pos, 2),
                "end": round(clip_end, 2),
                "caption": "Selected clip",
                "viral_title": "Viral Clip",
                "hashtags": "#shorts #viral #trending"
            })
        
        current_pos += CLIP_DURATION_MIN
    
    return clips[:NUM_CLIPS_TO_GENERATE]


def cleanup_vision_frames(task_id: str):
    """Clean up extracted vision frames after processing."""
    frames_dir = TEMP_DIR / "vision_frames"
    if frames_dir.exists():
        for f in frames_dir.glob(f"peak_frame_*_{task_id}*.png"):
            try:
                f.unlink()
            except:
                pass