from __future__ import annotations

import os
import subprocess
import json
import urllib.request
import hashlib
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
    RENDER_VERSION,
    FFMPEG_PATH,
    FFPROBE_PATH,
    CTA_OUTRO_ENABLED,
    CTA_OUTRO_SECONDS,
)
from .clip_selector import generate_ass_subtitle, generate_simple_ass
from .captions import CAPTION_FONT_DIR, generate_viral_ass_subtitles, normalize_caption_preset
from ..utils.vram_manager import clear_gpu
from framing.layout_policy import batch_context_position

_THUMB_CACHE: Dict[str, str] = {}

_CURATED_CAPTION_FONTS = (
    ("Montserrat ExtraBold", "Montserrat-ExtraBold.ttf"),
    ("Montserrat Black", "Montserrat-Black.ttf"),
    ("Inter ExtraBold", "Inter-ExtraBold.ttf"),
    ("Poppins ExtraBold", "Poppins-ExtraBold.ttf"),
    ("Anton", "Anton-Regular.ttf"),
)


def _caption_font_for_clip(task_id: str, clip_index: int) -> tuple[str, str]:
    """Choose one of five licensed fonts, stable across retries of a clip."""
    seed = hashlib.sha256(f"{task_id}:{clip_index}".encode("utf-8")).digest()
    return _CURATED_CAPTION_FONTS[int.from_bytes(seed[:2], "big") % len(_CURATED_CAPTION_FONTS)]


def _thumbnail_cta_visual_filter(duration_s: float, escaped_font: str) -> str:
    """Build the 9:16 outro composition without artwork/text collisions.

    The source thumbnail is *contained* inside a fixed 840x472 landscape
    frame. This handles 16:9, 4:3 and YouTube fallback artwork without ever
    allowing the image to grow beyond the vertical canvas safe area.
    """
    # Final layout on a 1080x1920 canvas (all values scale with the configured
    # render size, so the same composition also works at 720x1280):
    #   360..550  headline and supporting text
    #   720..1216 fixed thumbnail card
    # The 170px breathing room makes overlap impossible even with font
    # substitution, while keeping the visual group near the optical centre.
    card_width = max(280, int(CROP_WIDTH * 0.778) // 2 * 2)
    card_height = max(158, int(card_width * 9 / 16) // 2 * 2)
    matte = max(8, round(CROP_WIDTH * 0.011))
    outer_width = card_width + (matte * 2)
    outer_height = card_height + (matte * 2)
    card_y = round(CROP_HEIGHT * 0.375)
    title_y = round(CROP_HEIGHT * 0.1875)
    subtitle_y = round(CROP_HEIGHT * 0.255)
    title_size = max(41, round(CROP_WIDTH * 0.0574))
    subtitle_size = max(21, round(CROP_WIDTH * 0.0287))
    entry_s = min(1.15, max(0.45, duration_s * 0.32))
    slide_y = (
        f"if(lt(t,{entry_s:.3f}),"
        f"H+56-(H+56-{card_y})*(0.5-0.5*cos(PI*t/{entry_s:.3f})),"
        f"{card_y})"
    )
    title_alpha = (
        "if(lt(t,0.18),0,if(lt(t,0.78),(t-0.18)/0.60,1))"
    )
    subtitle_alpha = (
        "if(lt(t,0.34),0,if(lt(t,0.94),(t-0.34)/0.60,0.88))"
    )
    fade_out_start = max(0.0, duration_s - 0.32)

    return (
        f"[0:v]split=2[bgsrc][cardsrc];"
        f"[bgsrc]scale={CROP_WIDTH}:{CROP_HEIGHT}:force_original_aspect_ratio=increase,"
        f"crop={CROP_WIDTH}:{CROP_HEIGHT},gblur=sigma=42,"
        f"eq=brightness=-0.38:saturation=0.70[bg];"
        # Fixed thumbnail viewport. `decrease` + pad means the full artwork is
        # always visible; the outer 12px matte reads as a deliberate card.
        f"[cardsrc]scale={card_width}:{card_height}:force_original_aspect_ratio=decrease:flags=lanczos,"
        f"pad={card_width}:{card_height}:(ow-iw)/2:(oh-ih)/2:color=0x09090B,"
        f"pad={outer_width}:{outer_height}:{matte}:{matte}:color=0x18181B[card];"
        f"[bg][card]overlay=x=(W-w)/2:y='{slide_y}':eval=frame,"
        f"drawtext=fontfile='{escaped_font}':text='WATCH THE FULL STORY':"
        f"fontcolor=white:fontsize={title_size}:x=(w-text_w)/2:y={title_y}:"
        f"borderw=3:bordercolor=black@0.48:alpha='{title_alpha}',"
        f"drawtext=fontfile='{escaped_font}':text='The rest is on YouTube  →':"
        f"fontcolor=0xE4E4E7:fontsize={subtitle_size}:x=(w-text_w)/2:y={subtitle_y}:"
        f"alpha='{subtitle_alpha}',"
        f"fade=t=in:st=0:d=0.34,"
        f"fade=t=out:st={fade_out_start:.2f}:d=0.32,"
        f"format=yuv420p[v]"
    )


def _media_profile(path: str | Path) -> Dict[str, float]:
    """Read the output cadence/audio rate so the CTA can concatenate cleanly."""
    profile = {"fps": 30.0, "audio_rate": 48000.0}
    try:
        result = subprocess.run(
            [
                FFPROBE_PATH,
                "-v", "error",
                "-show_entries", "stream=codec_type,avg_frame_rate,sample_rate",
                "-of", "json",
                str(path),
            ],
            capture_output=True,
            text=True,
            timeout=15,
        )
        if result.returncode != 0:
            return profile
        streams = json.loads(result.stdout or "{}").get("streams", [])
        video = next((s for s in streams if s.get("codec_type") == "video"), {})
        audio = next((s for s in streams if s.get("codec_type") == "audio"), {})
        rate = str(video.get("avg_frame_rate") or "30/1")
        numerator, denominator = rate.split("/", 1)
        fps = float(numerator) / max(float(denominator), 1.0)
        if 1 <= fps <= 120:
            profile["fps"] = fps
        sample_rate = float(audio.get("sample_rate") or 48000)
        if sample_rate > 0:
            profile["audio_rate"] = sample_rate
    except Exception:
        pass
    return profile


def _append_thumbnail_cta(
    output_path: Path,
    source_path: str | Path,
    source_audio_start_s: float,
    video_id: str,
    task_id: str,
    clip_index: int,
    duration_s: float = 4.0,
    font_file: str = "Poppins-ExtraBold.ttf",
) -> bool:
    """Append a thumbnail CTA while continuing the next source-audio seconds."""
    if duration_s <= 0 or not output_path.exists() or not Path(source_path).exists():
        return False
    thumbnail = _fetch_youtube_thumbnail(video_id, task_id)
    if not thumbnail:
        print(f"[Renderer] CTA skipped for clip {clip_index}: YouTube thumbnail unavailable")
        return False

    profile = _media_profile(output_path)
    fps = profile["fps"]
    audio_rate = int(profile["audio_rate"])
    cta_path = TEMP_DIR / f"cta_{task_id}_{clip_index}.mp4"
    joined_path = TEMP_DIR / f"joined_{task_id}_{clip_index}.mp4"
    concat_list = TEMP_DIR / f"concat_{task_id}_{clip_index}.txt"
    font_path = CAPTION_FONT_DIR / font_file
    escaped_font = str(font_path.as_posix()).replace(":", "\\:").replace("'", "\\'")

    visual_filter = _thumbnail_cta_visual_filter(duration_s, escaped_font)
    # Check whether source has an audio stream
    has_audio = True
    try:
        probe = subprocess.run(
            [
                FFPROBE_PATH, "-v", "error",
                "-select_streams", "a",
                "-show_entries", "stream=codec_type",
                "-of", "csv=p=0",
                str(source_path),
            ],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if not probe.stdout.strip():
            has_audio = False
    except Exception:
        has_audio = True

    if has_audio:
        audio_input = ["-ss", str(max(0.0, source_audio_start_s)), "-t", str(duration_s), "-i", str(source_path)]
        audio_filter = (
            f"[1:a]aresample={audio_rate},apad=pad_dur={duration_s},"
            f"atrim=0:{duration_s},asetpts=PTS-STARTPTS,"
            f"afade=t=out:st={max(0.0, duration_s - 0.3):.2f}:d=0.3[a]"
        )
    else:
        audio_input = ["-f", "lavfi", "-t", str(duration_s), "-i", f"anullsrc=r={audio_rate}:cl=stereo"]
        audio_filter = f"[1:a]asetpts=PTS-STARTPTS[a]"

    cta_cmd = [
        FFMPEG_PATH, "-y", "-hide_banner", "-loglevel", "error",
        "-loop", "1", "-framerate", str(fps), "-t", str(duration_s), "-i", thumbnail,
        *audio_input,
        "-filter_complex", f"{visual_filter};{audio_filter}",
        "-map", "[v]", "-map", "[a]",
        "-r", str(fps), "-c:v", "libx264", "-preset", "fast", "-crf", "18",
        "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-ar", str(audio_rate),
        "-t", str(duration_s), "-movflags", "+faststart", str(cta_path),
    ]
    try:
        made_cta = subprocess.run(cta_cmd, capture_output=True, text=True, timeout=90)
        if made_cta.returncode != 0 or not cta_path.exists() or cta_path.stat().st_size < 1024:
            print(f"[Renderer] CTA generation failed: {made_cta.stderr[-500:]}")
            return False

        def _concat_line(path: Path) -> str:
            return "file '" + str(path.resolve()).replace("'", "'\\''") + "'"

        concat_list.write_text(
            _concat_line(output_path) + "\n" + _concat_line(cta_path) + "\n",
            encoding="utf-8",
        )
        copy_cmd = [
            FFMPEG_PATH, "-y", "-hide_banner", "-loglevel", "error",
            "-f", "concat", "-safe", "0", "-i", str(concat_list),
            "-c", "copy", "-movflags", "+faststart", str(joined_path),
        ]
        joined = subprocess.run(copy_cmd, capture_output=True, text=True, timeout=45)
        if joined.returncode != 0 or not joined_path.exists() or joined_path.stat().st_size < 1024:
            # Rare codec/timebase mismatch: re-encode the joined streams safely.
            fallback_cmd = [
                FFMPEG_PATH, "-y", "-hide_banner", "-loglevel", "error",
                "-i", str(output_path), "-i", str(cta_path),
                "-filter_complex", "[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a]",
                "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "fast",
                "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k",
                "-movflags", "+faststart", str(joined_path),
            ]
            joined = subprocess.run(fallback_cmd, capture_output=True, text=True, timeout=180)
        if joined.returncode != 0 or not joined_path.exists() or joined_path.stat().st_size < 1024:
            print(f"[Renderer] CTA concatenation failed: {joined.stderr[-500:]}")
            return False
        os.replace(joined_path, output_path)
        print(f"[Renderer] Added {duration_s:.1f}s thumbnail CTA to clip {clip_index}")
        return True
    except Exception as exc:
        print(f"[Renderer] CTA append failed for clip {clip_index}: {exc}")
        return False
    finally:
        cta_path.unlink(missing_ok=True)
        joined_path.unlink(missing_ok=True)
        concat_list.unlink(missing_ok=True)


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
        "-preset", FFMPEG_PRESET if FFMPEG_PRESET in ("ultrafast","superfast","veryfast","faster","fast","medium","slow","slower","veryslow") else "veryfast",
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

    coarse_seek = max(0.0, float(clip_start) - 5.0)
    fine_seek = max(0.0, float(clip_start) - coarse_seek)
    cmd.extend([
        "-ss", f"{coarse_seek:.3f}",
        "-i", video_path,
        "-ss", f"{fine_seek:.3f}",
        "-t", f"{max(0.1, float(clip_end) - float(clip_start)):.3f}",
        "-avoid_negative_ts", "make_zero",
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
        filters.append("scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2")
    else:
        # Proper 9:16 vertical crop from landscape without stretching
        target_crop_w = int(src_height * 9 / 16)
        target_crop_w = min(src_width, (target_crop_w // 2) * 2)
        target_crop_h = (src_height // 2) * 2

        if x_offset and 0 < x_offset < src_width:
            crop_x = int(x_offset - target_crop_w // 2)
            crop_x = max(0, min(crop_x, src_width - target_crop_w))
        else:
            crop_x = (src_width - target_crop_w) // 2
        crop_y = 0

        crop_x = (crop_x // 2) * 2
        print(f"[Renderer] 9:16 Crop: {target_crop_w}x{target_crop_h} from source {src_width}x{src_height} at ({crop_x},{crop_y})")
        filters.append(f"crop={target_crop_w}:{target_crop_h}:{crop_x}:{crop_y}")
        filters.append("scale=1080:1920:flags=lanczos+accurate_rnd")
        filters.append("unsharp=lx=5:ly=5:la=1.0:cx=3:cy=3:ca=0.5")

    # Add subtitle if available
    subtitle_to_use = None
    if subtitle_path and Path(subtitle_path).exists():
        sub_path = Path(subtitle_path)
        if sub_path.stat().st_size > 50:
            subtitle_to_use = sub_path.as_posix()
    
    if subtitle_to_use:
        # Escape path for FFmpeg filter parameter syntax (colons, backslashes, single quotes)
        escaped_sub = subtitle_to_use.replace("\\", "/").replace(":", "\\:").replace("'", "\\'")
        escaped_fonts = str(CAPTION_FONT_DIR.as_posix()).replace(":", "\\:").replace("'", "\\'")
        filters.append(f"ass='{escaped_sub}':fontsdir='{escaped_fonts}'")

    cmd.extend(["-vf", ",".join(filters)])

    cmd.extend([
        "-movflags", "+faststart",
        "-c:v", "libx264",
        "-preset", FFMPEG_PRESET if FFMPEG_PRESET in ("ultrafast","superfast","veryfast","faster","fast","medium","slow","slower","veryslow") else "veryfast",
        "-crf", str(FFMPEG_CQ),
        "-b:v", "8M",
        "-maxrate", "12M",
        "-bufsize", "16M",
        "-pix_fmt", "yuv420p",
    ])

    cmd.extend([
        "-c:a", "aac",
        "-b:a", FFMPEG_AUDIO_BITRATE,
        "-ar", "44100",
        "-af", f"afade=t=out:st={max(0.1, (clip_end - clip_start) - 0.20):.2f}:d=0.20",
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
    # FIX 2026-06-16: segments are LOCAL FILES. FFmpeg's -ss/-t use
    # RELATIVE positions within the input file, not absolute video time.
    # Without this fix, -ss 130.4 on a 35s segment file → 0 frames → 0KB.
    #
    # Key insight: audio surgical segments have source_start = ORIGINAL clip start
    # (no padding), while video segments have source_start = PADDED download start.
    # The video_path is the source of truth for where the file actually starts.
    # audio_path segments start at their source_start; video files at their padded start.
    # video_source_start is the exact timestamp in the source video where the downloaded file begins.
    # Surgical downloads pad by SURGICAL_BUFFER_SECONDS (10s), so video_source_start = start - 10.0.
    if clip.get("video_source_start") is not None:
        source_start = float(clip["video_source_start"])
    elif clip.get("source_start") is not None:
        source_start = float(clip["source_start"])
    else:
        source_start = float(start)

    source_end = float(clip.get("video_source_end", clip.get("source_end", end)))
    # Relative positions within the local segment file
    rel_start = max(0.0, start - source_start)
    rel_end = max(rel_start, min(end, source_end) - source_start)
    duration = end - start  # target clip duration
    orig_duration = end - start  # original intended duration for metadata

    # Validate timestamps - prevent 0 KB files from invalid timestamps
    if start is None or end is None or start >= end or duration <= 0:
        if progress_callback:
            progress_callback(f"Skipping clip {clip_index}: invalid timestamps ({start} -> {end})")
        return None

    clip_id = f"{video_id}_{clip_index}_{int(start)}s"

    output_filename = f"{clip_id}.mp4"
    output_path = OUTPUTS_DIR / output_filename

    # Use a curated, deterministic font rotation for automatic captions. A
    # retry renders identically, while different output clips get visual range.
    requested_caption_font = str(clip.get("caption_font") or "studio").strip().lower()
    caption_font = normalize_caption_preset(requested_caption_font)
    selected_font_family, selected_font_file = _caption_font_for_clip(task_id, clip_index)
    style_payload = clip.get("style") if isinstance(clip.get("style"), dict) else {}
    style_overrides = dict(style_payload.get("overrides") or {})
    auto_typography = requested_caption_font in ("", "studio", "auto", "random")
    if auto_typography and not style_overrides.get("font"):
        style_overrides["font"] = {
            "family": selected_font_family,
            "file": selected_font_file,
            "weight": 900 if "Black" in selected_font_family else 800,
        }
    clip["style"] = {"preset": style_payload.get("preset") or caption_font, "overrides": style_overrides}
    if auto_typography:
        clip["caption_font_family"] = selected_font_family

    # Generate viral dynamic captions
    subtitle_path = None
    try:
        sub_file = TEMP_DIR / f"{task_id}_{clip_index}_captions.ass"
        if video_path and not clip.get("video_path"):
            clip["video_path"] = str(video_path)
        subtitle_path = generate_viral_ass_subtitles(clip, sub_file)
        if subtitle_path and Path(subtitle_path).exists():
            print(f"[Renderer] Dynamic captions generated: {subtitle_path}")
    except Exception as e:
        print(f"[Renderer] Captions generation skipped: {e}")
        subtitle_path = None

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

    dynamic_rendered = False
    layout_mode = str(clip.get("layout_mode") or "auto").lower()
    clip["caption_font"] = caption_font
    resolved_layout_mode = layout_mode
    context_position = str(
        clip.get("context_position") or batch_context_position(clip_index, task_id)
    ).lower()
    content_hint = next(
        (
            str(clip.get(key))
            for key in ("content_type", "archetype", "niche", "category")
            if clip.get(key)
        ),
        None,
    )
    valid_video_file = (
        video_path
        and isinstance(video_path, (str, Path))
        and not str(video_path).startswith("http")
        and Path(str(video_path)).exists()
    )
    if not used_still_audio and valid_video_file and not _is_audio_only(str(video_path)):
        try:
            import cv2
            cap = cv2.VideoCapture(str(video_path))
            ret, _ = cap.read()
            cap.release()
            if ret:
                print(f"[Renderer] Attempting RelatiV Dynamic Framing Engine for clip {clip_index}...")
                pretrim_path = TEMP_DIR / f"pretrim_{task_id}_{clip_index}.mp4"
                trim_cmd = [
                    FFMPEG_PATH, "-y", "-i", str(video_path),
                    # Output-side seek is frame accurate. Input-side `-ss`
                    # seeks to a preceding keyframe and can desync ASS events.
                    "-ss", str(rel_start), "-t", str(duration),
                    "-avoid_negative_ts", "make_zero",
                    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18", "-c:a", "aac", str(pretrim_path)
                ]
                subprocess.run(trim_cmd, capture_output=True, timeout=120)
                input_for_framing = str(pretrim_path) if (pretrim_path.exists() and pretrim_path.stat().st_size > 1024) else str(video_path)

                from framing.run import run_pipeline
                framing_workdir = TEMP_DIR / f"framing_{task_id}_{clip_index}"
                framing_result = run_pipeline(
                    clip_path=input_for_framing,
                    output_path=str(output_path),
                    workdir=framing_workdir,
                    subtitles_path=str(subtitle_path) if (subtitle_path and Path(subtitle_path).exists()) else None,
                    debug_overlay=False,
                    layout_mode=layout_mode,
                    context_position=context_position,
                    content_hint=content_hint,
                )
                decision = framing_result.get("layout_decision", {}) if framing_result else {}
                if framing_result and framing_result.get("subject_track"):
                    clip["subject_track"] = framing_result["subject_track"]
                if framing_result and framing_result.get("caption_layout"):
                    clip["caption_layout"] = framing_result["caption_layout"]
                resolved_layout_mode = str(decision.get("mode") or layout_mode)
                context_position = str(decision.get("context_position") or context_position)
                if output_path.exists() and output_path.stat().st_size > 1024:
                    print(f"[Renderer] Dynamic framing engine produced {output_path} ({output_path.stat().st_size // 1024} KB)")
                    dynamic_rendered = True
        except Exception as dynamic_err:
            print(f"[Renderer] Dynamic framing engine fallback to legacy ffmpeg: {dynamic_err}")
            dynamic_rendered = False

    if not dynamic_rendered:
        if ffmpeg_cmd is None:
            ffmpeg_cmd = build_ffmpeg_command(
                video_path,
                str(output_path),
                rel_start,
                rel_end,
                x_offset,
                str(subtitle_path),
                accurate_seek=True,
                face_tracking_data=face_tracking
            )

        try:
            print(f"[Renderer] Running FFmpeg command:")
            print(f"[Renderer]   Input: {video_path}")
            print(f"[Renderer]   Output: {output_path}")
            print(f"[Renderer]   rel_start: {rel_start:.1f}s, rel_end: {rel_end:.1f}s (orig {orig_duration:.0f}s)")
            print(f"[Renderer]   x_offset: {x_offset}")
            print(f"[Renderer]   CMD: {' '.join(ffmpeg_cmd)}")
            
            result = subprocess.run(
                ffmpeg_cmd,
                capture_output=True,
                text=True,
                timeout=90
            )

            # Always print stderr for debugging (ffmpeg can return 0 but write 0 bytes)
            if result.stderr:
                print(f"[Renderer] FFmpeg stderr: {result.stderr[:500]}")
            if result.stdout:
                print(f"[Renderer] FFmpeg stdout: {result.stdout[:200]}")

            if result.returncode != 0:
                print(f"FFmpeg error for clip {clip_index}: returncode={result.returncode}")
                print(f"FFmpeg stderr: {result.stderr[:1000]}")
                
                # Try simpler filter chain as fallback
                if progress_callback:
                    progress_callback("Retrying with simpler filter chain...")
                
                simpler_cmd = build_ffmpeg_command(
                    video_path,
                    str(output_path),
                    rel_start,
                    rel_end,
                    0,  # center crop
                    None,
                    accurate_seek=False,
                    face_tracking_data=None
                )
                
                print(f"[Renderer] Running simpler FFmpeg command...")
                print(f"[Renderer]   Simpler CMD: {' '.join(simpler_cmd)}")
                result = subprocess.run(
                    simpler_cmd,
                    capture_output=True,
                    text=True,
                    timeout=90
                )
                
                if result.stderr:
                    print(f"[Renderer] Simpler stderr: {result.stderr[:500]}")
                
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
        cta_added = False
        resolved_video_id = video_id
        if (
            not resolved_video_id
            or resolved_video_id in ("local", "unknown")
            or str(resolved_video_id).startswith(("yt_", "surgical_"))
        ) and clip.get("url"):
            try:
                from ..pipeline.transcript_fetcher import _extract_video_id
                extracted_id = _extract_video_id(str(clip.get("url")))
                if extracted_id:
                    resolved_video_id = extracted_id
            except Exception:
                pass

        requested_outro_seconds = min(
            4.0,
            max(0.0, float(clip.get("thumbnail_outro_seconds", CTA_OUTRO_SECONDS))),
        )
        if (
            CTA_OUTRO_ENABLED
            and requested_outro_seconds > 0
            and resolved_video_id
            and resolved_video_id not in ("local", "unknown")
            and not str(resolved_video_id).startswith(("yt_", "surgical_"))
        ):
            if progress_callback:
                progress_callback(f"Adding {requested_outro_seconds:.0f}s full-video CTA...")
            cta_added = _append_thumbnail_cta(
                output_path=output_path,
                source_path=video_path,
                source_audio_start_s=rel_end,
                video_id=resolved_video_id,
                task_id=task_id,
                clip_index=clip_index,
                duration_s=requested_outro_seconds,
                font_file=selected_font_file,
            )

        file_size_mb = round(output_path.stat().st_size / (1024 * 1024), 2)

        # Check for 0 KB files - delete them
        if file_size_mb == 0:
            if progress_callback:
                progress_callback(f"Clip {clip_index} failed: 0 KB output, deleting...")
            output_path.unlink(missing_ok=True)
            return None

        if progress_callback:
            progress_callback(f"Clip {clip_index} rendered: {output_filename} ({file_size_mb}MB)")

        # Generate thumbnail frame screenshot for frontend card display
        thumb_filename = f"{clip_id}_thumb.jpg"
        thumb_path = OUTPUTS_DIR / thumb_filename
        try:
            import cv2
            cap = cv2.VideoCapture(str(output_path))
            cap.set(cv2.CAP_PROP_POS_MSEC, 1500)
            ret, frame = cap.read()
            if not ret:
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                ret, frame = cap.read()
            cap.release()
            if ret and frame is not None:
                cv2.imwrite(str(thumb_path), frame, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
                print(f"[Renderer] Saved thumbnail screenshot: {thumb_filename}")
        except Exception as thumb_err:
            print(f"[Renderer] Thumbnail generation skipped: {thumb_err}")

        return {
            "clip_id": clip_id,
            "start": start,
            "end": end,
            "duration_s": round(duration + (requested_outro_seconds if cta_added else 0.0), 1),
            "source_duration_s": round(duration, 1),
            "cta_duration_s": round(requested_outro_seconds if cta_added else 0.0, 1),
            "cta_added": cta_added,
            "caption": clip.get("caption", ""),
            "viral_title": clip.get("viral_title", ""),
            "hashtags": clip.get("hashtags", ""),
            "file_path": str(output_path),
            "file_size_mb": file_size_mb,
            "thumbnail_url": f"/thumbnail/{clip_id}",
            "layout_mode": resolved_layout_mode,
            "context_position": context_position,
            "caption_font": caption_font,
            "caption_font_family": clip.get("caption_font_family"),
            "render_version": RENDER_VERSION,
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
