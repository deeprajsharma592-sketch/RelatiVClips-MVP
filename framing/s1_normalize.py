"""
S1 Normalize — Pure function of (clip_path, workdir, config) -> norm.json (spec-0.1).
Re-encodes to constant frame rate, 8-bit yuv420p, upright orientation, even dimensions,
and extracts mono 16 kHz WAV for VAD.
"""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .config import get_binary_paths


def probe_media(file_path: str | Path) -> Dict[str, Any]:
    """Run ffprobe to extract stream and format metadata as JSON."""
    bins = get_binary_paths()
    cmd = [
        bins["ffprobe"],
        "-v", "error",
        "-show_entries", "stream=index,codec_type,codec_name,width,height,avg_frame_rate,r_frame_rate,duration,nb_frames,tags,side_data_list",
        "-show_entries", "format=duration,size,bit_rate,tags",
        "-of", "json",
        str(file_path),
    ]

    res = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if res.returncode != 0:
        raise RuntimeError(f"ffprobe failed for {file_path}: {res.stderr}")

    return json.loads(res.stdout)


def ensure_even_dimensions(width: int, height: int) -> Tuple[int, int]:
    """Ensure width and height are even integers (U13 requirement)."""
    even_w = int(width) if int(width) % 2 == 0 else int(width) - 1
    even_h = int(height) if int(height) % 2 == 0 else int(height) - 1
    return max(2, even_w), max(2, even_h)


def rebase_timestamps(
    items: List[Dict[str, Any]],
    clip_start_s: float,
    clip_duration_s: Optional[float] = None,
) -> List[Dict[str, Any]]:
    """
    Rebase timestamped dictionaries (e.g. words.json, impact.json)
    to clip start time 0.0 (U12 requirement).
    """
    rebased: List[Dict[str, Any]] = []
    for item in items:
        new_item = dict(item)
        if "start" in item and "end" in item:
            s = float(item["start"]) - clip_start_s
            e = float(item["end"]) - clip_start_s
            if clip_duration_s is not None and (e <= 0.0 or s >= clip_duration_s):
                continue
            new_item["start"] = max(0.0, round(s, 4))
            new_item["end"] = max(0.0, round(e, 4))
            rebased.append(new_item)
        elif "t" in item:
            t = float(item["t"]) - clip_start_s
            if clip_duration_s is not None and (t < 0.0 or t > clip_duration_s):
                continue
            new_item["t"] = max(0.0, round(t, 4))
            rebased.append(new_item)
        else:
            rebased.append(new_item)

    return rebased


def extract_rotation(video_stream: Dict[str, Any]) -> int:
    """Extract display rotation degrees from stream tags or side data."""
    tags = video_stream.get("tags") or {}
    rotate_str = tags.get("rotate") or tags.get("ROTATION")
    if rotate_str:
        try:
            return int(float(rotate_str)) % 360
        except ValueError:
            pass

    side_data_list = video_stream.get("side_data_list") or []
    for sd in side_data_list:
        if "rotation" in sd:
            try:
                return int(float(sd["rotation"])) % 360
            except ValueError:
                pass

    return 0


def normalize_media(
    clip_path: str | Path,
    workdir: str | Path,
    config: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Normalize video to constant frame rate, even dimensions, 8-bit yuv420p, upright frames.
    Extracts 16 kHz mono WAV.
    Writes norm.json to workdir.
    """
    clip_path = Path(clip_path).resolve()
    workdir = Path(workdir).resolve()
    workdir.mkdir(parents=True, exist_ok=True)

    if not clip_path.exists():
        raise FileNotFoundError(f"Clip not found: {clip_path}")

    probe = probe_media(clip_path)
    streams = probe.get("streams", [])

    video_stream = next((s for s in streams if s.get("codec_type") == "video"), None)
    if not video_stream:
        raise ValueError(f"Input {clip_path} rejected: no video stream found.")

    audio_stream = next((s for s in streams if s.get("codec_type") == "audio"), None)
    has_audio = audio_stream is not None

    orig_w = int(video_stream.get("width", 0))
    orig_h = int(video_stream.get("height", 0))
    rotation = extract_rotation(video_stream)

    # Determine input FPS
    r_fps = video_stream.get("r_frame_rate", "30/1")
    try:
        num, den = map(float, r_fps.split("/"))
        raw_fps = num / den if den != 0 else 30.0
    except Exception:
        raw_fps = 30.0

    norm_cfg = config.get("normalize", {})
    min_fps = float(norm_cfg.get("target_fps_min", 24))
    max_fps = float(norm_cfg.get("target_fps_max", 60))
    default_fps = float(norm_cfg.get("default_fps", 30))

    if raw_fps <= 0 or not (1 <= raw_fps <= 240):
        target_fps = default_fps
    else:
        target_fps = float(round(raw_fps))
        target_fps = max(min_fps, min(max_fps, target_fps))

    norm_video_path = workdir / "norm.mp4"
    audio_wav_path = workdir / "audio_16k.wav"

    bins = get_binary_paths()

    # 1. Convert video to constant frame rate, even dims, 8-bit yuv420p
    # FFmpeg auto-rotates by default unless -noautorotate is passed.
    vf_filters = [
        "scale=trunc(iw/2)*2:trunc(ih/2)*2",
        "format=yuv420p",
    ]

    ffmpeg_cmd = [
        bins["ffmpeg"], "-y",
        "-i", str(clip_path),
        "-vf", ",".join(vf_filters),
        "-r", str(target_fps),
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "18",
        "-pix_fmt", "yuv420p",
    ]

    if has_audio:
        ffmpeg_cmd.extend(["-c:a", "aac", "-b:a", "160k", "-ar", "48000"])
    else:
        ffmpeg_cmd.extend(["-an"])

    ffmpeg_cmd.extend(["-movflags", "+faststart", str(norm_video_path)])

    res_norm = subprocess.run(ffmpeg_cmd, capture_output=True, text=True, timeout=180)
    if res_norm.returncode != 0:
        raise RuntimeError(f"FFmpeg normalization failed: {res_norm.stderr}")

    # 2. Extract 16 kHz mono WAV for VAD
    if has_audio:
        wav_cmd = [
            bins["ffmpeg"], "-y",
            "-i", str(norm_video_path),
            "-vn",
            "-ac", "1",
            "-ar", "16000",
            "-c:a", "pcm_s16le",
            str(audio_wav_path),
        ]
        res_wav = subprocess.run(wav_cmd, capture_output=True, text=True, timeout=60)
        if res_wav.returncode != 0:
            audio_wav_path = None
    else:
        audio_wav_path = None

    # Probe normalized file for ground truth dimensions & frame count
    norm_probe = probe_media(norm_video_path)
    norm_v_stream = next(s for s in norm_probe.get("streams", []) if s.get("codec_type") == "video")
    norm_w = int(norm_v_stream.get("width"))
    norm_h = int(norm_v_stream.get("height"))
    duration_s = float(norm_probe.get("format", {}).get("duration", 0.0))

    is_portrait = norm_h > norm_w

    norm_artifact = {
        "clip_path": str(clip_path),
        "normalized_video_path": str(norm_video_path),
        "audio_wav_path": str(audio_wav_path) if audio_wav_path else None,
        "width": norm_w,
        "height": norm_h,
        "fps": target_fps,
        "duration_s": duration_s,
        "has_audio": has_audio,
        "is_portrait": is_portrait,
        "original_metadata": {
            "width": orig_w,
            "height": orig_h,
            "rotation": rotation,
            "raw_fps": raw_fps,
        },
        "config_hash": config.get("_meta", {}).get("config_hash", ""),
        "versions": config.get("_meta", {}).get("versions", {}),
    }

    norm_json_path = workdir / "norm.json"
    with open(norm_json_path, "w", encoding="utf-8") as f:
        json.dump(norm_artifact, f, indent=2)

    return norm_artifact
