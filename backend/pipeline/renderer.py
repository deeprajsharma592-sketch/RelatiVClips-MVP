import os
import subprocess
import json
import urllib.request
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional
from ..utils.config import (
    OUTPUTS_DIR,
    TEMP_DIR,
    CROP_WIDTH,
    CROP_HEIGHT,
    FFMPEG_PRESET,
    FFMPEG_CQ,
    FFMPEG_AUDIO_BITRATE,
    FILE_RETENTION_HOURS,
    FFMPEG_PATH
)
from .clip_selector import generate_ass_subtitle, generate_simple_ass
from ..utils.vram_manager import clear_gpu

_THUMB_CACHE: Dict[str, str] = {}


def _fetch_youtube_thumbnail(video_id: str, task_id: str) -> Optional[str]:
    """Grab the highest-res YouTube thumbnail and save it as a still for video composition.

    Returns the path to the saved JPG, or None if it failed.
    Uses the standard public YouTube thumbnail CDN — no auth, no proxy needed.
    """
    if video_id in _THUMB_CACHE and Path(_THUMB_CACHE[video_id]).exists():
        return _THUMB_CACHE[video_id]
    for suffix in ("maxresdefault", "hqdefault", "mqdefault", "sddefault", "default"):
        url = f"https://img.youtube.com/vi/{video_id}/{suffix}.jpg"
        out_path = TEMP_DIR / f"thumb_{task_id}_{video_id}_{suffix}.jpg"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=10) as r:
                data = r.read()
            if len(data) < 1000:  # YouTube returns a 1x1 placeholder for missing
                continue
            out_path.write_bytes(data)
            _THUMB_CACHE[video_id] = str(out_path)
            return str(out_path)
        except Exception:
            continue
    return None


def _generate_fallback_still(task_id: str, clip_index: int) -> str:
    """Generate a solid-color 9:16 still with the brand mark.

    Last-resort fallback if the YouTube thumbnail fetch fails for any reason.
    """
    out_path = TEMP_DIR / f"fallback_still_{task_id}_{clip_index}.jpg"
    cmd = [
        FFMPEG_PATH, "-y", "-hide_banner", "-loglevel", "error",
        "-f", "lavfi", "-i", f"color=c=0x0A0A0B:s={CROP_WIDTH}x{CROP_HEIGHT}:d=1",
        "-vf", (
            f"drawtext=text='RELATIV':fontcolor=0xFFD24D:fontsize=72:x=(w-tw)/2:y=(h-th)/2,"
            f"drawbox=x=0:y=h-200:w=iw:h=200:color=0x0A0A0B@0.7:t=fill"
        ),
        "-frames:v", "1",
        str(out_path)
    ]
    try:
        subprocess.run(cmd, capture_output=True, timeout=15)
    except Exception:
        pass
    return str(out_path) if out_path.exists() else None


def _is_audio_only(path: str) -> bool:
    """Check if the given file has only an audio stream (no video)."""
    try:
        cmd = [
            FFMPEG_PATH, "-hide_banner", "-i", path,
            "-map", "0:v", "-c", "copy", "-f", "null", "-"
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=15)
        # If the command fails with no video, ffmpeg will complain about no streams to map
        return result.returncode != 0
    except Exception:
        return False


def _build_still_audio_command(
    still_path: str,
    audio_path: str,
    output_path: str,
    duration_s: float,
    target_w: int,
    target_h: int,
) -> List[str]:
    """Compose a 9:16 video from a still image + an audio file.

    Used when the source media is audio-only (e.g. a surgical m4a segment).
    The still loops for the audio duration; the result is a real MP4 with
    H.264 video + AAC audio.
    """
    cmd = [
        FFMPEG_PATH, "-y", "-hide_banner", "-loglevel", "error",
        "-loop", "1", "-framerate", "30", "-t", str(duration_s),
        "-i", still_path,
        "-i", audio_path,
        "-vf", (
            f"scale={target_w}:{target_h}:force_original_aspect_ratio=increase,"
            f"crop={target_w}:{target_h},"
            f"gblur=sigma=0.6"
        ),
        "-c:v", "libx264",
        "-preset", FFMPEG_PRESET if FFMPEG_PRESET in ("ultrafast","superfast","veryfast","faster","fast","medium","slow","slower","veryslow") else "medium",
        "-crf", str(FFMPEG_CQ),
        "-pix_fmt", "yuv420p",
        "-tune", "stillimage",
        "-c:a", "aac",
        "-b:a", FFMPEG_AUDIO_BITRATE,
        "-ar", "44100",
        "-shortest",
        "-movflags", "+faststart",
        output_path,
    ]
    return cmd


def build_ffmpeg_command(
    video_path: str,
    output_path: str,
    clip_start: float,
    clip_end: float,
    x_offset: int,
    subtitle_path: str = None,
    accurate_seek: bool = True,
    face_tracking_data: dict = None
) -> List[str]:
    """
    Build FFmpeg command with optimized encoding for vertical video.

    Handles:
    - Vertical videos (9:16): Keep as-is, just scale to 1080p
    - Landscape videos: Center-crop to 9:16 with face tracking
    - Dynamic face tracking: Smooth pan across clip based on face positions
    """
    cmd = [FFMPEG_PATH, "-y", "-hide_banner", "-loglevel", "error"]

    cmd.extend([
        "-ss", str(clip_start),
        "-i", video_path,
        "-t", str(clip_end - clip_start)
    ])

    import cv2
    cap = cv2.VideoCapture(video_path)
    src_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    src_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    cap.release()
    
    aspect_ratio = src_height / src_width if src_width > 0 else 0
    is_vertical = aspect_ratio > 1.0  # Height > Width means vertical
    
    filters = []
    
    if is_vertical:
        filters.append("scale=1080:1920")
    else:
        crop_size = min(src_width, src_height)
        crop_w = crop_size
        crop_h = crop_size

        if x_offset and 0 < x_offset < src_width:
            crop_x = x_offset - crop_w // 2
            crop_x = max(0, min(crop_x, src_width - crop_w))
        else:
            crop_x = (src_width - crop_w) // 2
        crop_y = (src_height - crop_h) // 2

        crop_w = crop_w // 2 * 2
        crop_h = crop_h // 2 * 2
        crop_x = crop_x // 2 * 2
        crop_y = crop_y // 2 * 2

        print(f"[Renderer] Cropping {crop_w}x{crop_h} at ({crop_x},{crop_y})")
        filters.append(f"crop={crop_w}:{crop_h}:{crop_x}:{crop_y}")

        target_w = CROP_WIDTH
        target_h = CROP_HEIGHT
        filters.append(f"scale={target_w}:{target_h}")

    # Add subtitle if available
    subtitle_to_use = None
    if subtitle_path and Path(subtitle_path).exists():
        sub_path = Path(subtitle_path)
        if sub_path.stat().st_size > 50:
            subtitle_to_use = sub_path.as_posix()
    
    if subtitle_to_use:
        filters.append(f"ass={subtitle_to_use}")

    cmd.extend(["-vf", ",".join(filters)])

    cmd.extend([
        "-movflags", "+faststart",
        "-c:v", "libx264",
        "-preset", FFMPEG_PRESET if FFMPEG_PRESET in ("ultrafast","superfast","veryfast","faster","fast","medium","slow","slower","veryslow") else "medium",
        "-crf", str(FFMPEG_CQ),
        "-pix_fmt", "yuv420p",
    ])

    cmd.extend([
        "-c:a", "aac",
        "-b:a", FFMPEG_AUDIO_BITRATE,
        "-ar", "44100"
    ])

    cmd.append(output_path)

    return cmd


def render_clip(
    video_path: str,
    clip: dict,
    clip_index: int,
    video_id: str,
    task_id: str,
    progress_callback=None
) -> dict:
    """
    Render a single vertical clip with subtitles.

    WHY THIS SEPARATION:
    - Face detection calculates x_offset (in 05_face_detection.py)
    - This function handles ONLY the FFmpeg encoding
    - Clean separation = easier debugging, modular

    Args:
        video_path: Source video path
        clip: Clip dict with start, end, x_offset, caption, etc.
        clip_index: Clip number (1, 2, 3)
        video_id: YouTube video ID
        task_id: Task identifier
        progress_callback: Optional callback

    Returns:
        dict: {clip_id, file_path, file_size_mb, duration_s}
    """
    start = clip["start"]
    end = clip["end"]
    duration = end - start

    # Validate timestamps - prevent 0 KB files from invalid timestamps
    if start is None or end is None or start >= end or duration <= 0:
        if progress_callback:
            progress_callback(f"Skipping clip {clip_index}: invalid timestamps ({start} -> {end})")
        return None

    clip_id = f"{video_id}_{clip_index}_{int(start)}s"

    output_filename = f"{clip_id}.mp4"
    output_path = OUTPUTS_DIR / output_filename

    subtitle_path = None  # Skip subtitle generation

    if progress_callback:
        progress_callback(f"Rendering clip {clip_index} ({duration:.0f}s)...")

    x_offset = clip.get("x_offset", 0)
    face_tracking = clip.get("face_tracking", None)
    
    ffmpeg_cmd = None
    used_still_audio = False

    if _is_audio_only(video_path):
        # Source has no video stream. Compose a 9:16 still + the audio
        # so the user actually gets a watchable MP4 (not audio-only).
        # Falls back to a generated brand-color still if the YouTube
        # thumbnail can't be fetched.
        still_path = (
            _fetch_youtube_thumbnail(video_id, task_id)
            if video_id and video_id != "local"
            else None
        )
        if not still_path:
            still_path = _generate_fallback_still(task_id, clip_index)
        if still_path:
            used_still_audio = True
            ffmpeg_cmd = _build_still_audio_command(
                still_path=still_path,
                audio_path=video_path,
                output_path=str(output_path),
                duration_s=duration,
                target_w=CROP_WIDTH,
                target_h=CROP_HEIGHT,
            )
            print(f"[Renderer] Audio-only input — composing still+audio for clip {clip_index}")
        else:
            print(f"[Renderer] Audio-only input but no still available — falling back to original path")

    if ffmpeg_cmd is None:
        ffmpeg_cmd = build_ffmpeg_command(
            video_path,
            str(output_path),
            start,
            end,
            x_offset,
            str(subtitle_path),
            accurate_seek=True,
            face_tracking_data=face_tracking
        )

    try:
        print(f"[Renderer] Running FFmpeg command:")
        print(f"[Renderer]   Input: {video_path}")
        print(f"[Renderer]   Output: {output_path}")
        print(f"[Renderer]   Duration: {end - start}s")
        print(f"[Renderer]   x_offset: {x_offset}")
        
        result = subprocess.run(
            ffmpeg_cmd,
            capture_output=True,
            text=True,
            timeout=600
        )

        if result.returncode != 0:
            print(f"FFmpeg error for clip {clip_index}: returncode={result.returncode}")
            print(f"FFmpeg stderr: {result.stderr[:1000]}")
            
            # Try simpler filter chain as fallback
            if progress_callback:
                progress_callback("Retrying with simpler filter chain...")
            
            simpler_cmd = build_ffmpeg_command(
                video_path,
                str(output_path),
                start,
                end,
                0,  # center crop
                None,
                accurate_seek=False,
                face_tracking_data=None
            )
            
            print(f"[Renderer] Running simpler FFmpeg command...")
            result = subprocess.run(
                simpler_cmd,
                capture_output=True,
                text=True,
                timeout=600
            )
            
            if result.returncode != 0:
                print(f"Simpler FFmpeg also failed: {result.returncode}")
                print(f"stderr: {result.stderr[:500]}")
                if progress_callback:
                    progress_callback(f"FFmpeg error: {result.stderr[:200]}")
            else:
                print(f"[Renderer] Simpler command succeeded!")
                if progress_callback:
                    progress_callback("Render succeeded with simpler filter")
    except subprocess.TimeoutExpired:
        raise RuntimeError(f"Render timeout for clip {clip_index}")

    if output_path.exists():
        file_size_mb = round(output_path.stat().st_size / (1024 * 1024), 2)

        # Check for 0 KB files - delete them
        if file_size_mb == 0:
            if progress_callback:
                progress_callback(f"Clip {clip_index} failed: 0 KB output, deleting...")
            output_path.unlink(missing_ok=True)
            return None

        if progress_callback:
            progress_callback(f"Clip {clip_index} rendered: {output_filename} ({file_size_mb}MB)")

        return {
            "clip_id": clip_id,
            "start": start,
            "end": end,
            "duration_s": round(duration, 1),
            "caption": clip.get("caption", ""),
            "viral_title": clip.get("viral_title", ""),
            "hashtags": clip.get("hashtags", ""),
            "file_path": str(output_path),
            "file_size_mb": file_size_mb,
            "created_at": datetime.now().isoformat()
        }

    return None


def render_all_clips(
    video_path: str,
    clips: List[dict],
    video_id: str,
    task_id: str,
    progress_callback=None
) -> List[dict]:
    """
    Render all clips for a video.

    WHY THIS BATCH FUNCTION:
    - Sequential rendering prevents VRAM conflicts
    - FFmpeg uses ~1.5GB VRAM for AV1 encoding
    - If we ran 2 renders simultaneously = 3GB VRAM
    - Sequential = safe, stable, predictable

    Args:
        video_path: Source video path
        clips: List of clip dicts from clip selector
        video_id: YouTube video ID
        task_id: Task identifier
        progress_callback: Optional callback

    Returns:
        List of rendered clip metadata dicts
    """
    rendered_clips = []

    for i, clip in enumerate(clips):
        if progress_callback:
            progress_callback(f"Starting render for clip {i+1}/{len(clips)}...")

        result = render_clip(
            video_path,
            clip,
            i + 1,
            video_id,
            task_id,
            progress_callback
        )

        if result:
            rendered_clips.append(result)

    return rendered_clips


def cleanup_old_files(directory: Path, max_age_hours: int = FILE_RETENTION_HOURS) -> List[str]:
    """
    Delete files older than max_age_hours.

    WHY THIS IS NEEDED:
    - 2 concurrent tasks × 3 clips × ~15MB = 90MB per video
    - Over months: gigabytes of storage
    - 24-hour TTL = privacy (no long-term retention of YouTube clips)
    - Auto-cleanup = no manual management needed

    Args:
        directory: Directory to scan
        max_age_hours: Maximum file age in hours

    Returns:
        List of deleted file paths
    """
    deleted = []
    now = datetime.now()

    for file_path in directory.glob("*"):
        if file_path.is_file():
            age_seconds = (now - datetime.fromtimestamp(file_path.stat().st_mtime)).total_seconds()
            age_hours = age_seconds / 3600

            if age_hours > max_age_hours:
                try:
                    file_path.unlink()
                    deleted.append(str(file_path))
                except Exception:
                    pass

    return deleted