"""
Synthetic Test Fixture Generator for Dynamic Framing Test Suite (spec-0.1).
Generates:
- F01 (Single talking head, static camera)
- F02 (Single presenter who moves around)
- F03 (2-person alternating audio/video)
- F15 (VFR + rotation metadata + odd dimensions)
"""

from __future__ import annotations

import os
import subprocess
from pathlib import Path
import cv2
import numpy as np

from framing.config import get_binary_paths


def get_or_create_head_asset(assets_dir: Path) -> Path:
    assets_dir.mkdir(parents=True, exist_ok=True)
    head_path = assets_dir / "head_template.png"
    if head_path.exists():
        return head_path

    # Extract clean face crop from uploaded MrBeast source image
    src_img = "/Users/deeprajsharma/.gemini/antigravity/brain/184c9618-95ca-4753-9f97-2b04d9baeebe/.user_uploaded/media_1794504288064_ef245eea.jpg"
    if os.path.exists(src_img):
        img = cv2.imread(src_img)
        head_crop = img[0:180, 240:420]
        cv2.imwrite(str(head_path), head_crop)
    else:
        # Fallback synthetic face
        canvas = np.full((180, 180, 3), (200, 200, 200), dtype=np.uint8)
        cv2.circle(canvas, (90, 90), 80, (180, 150, 120), -1)
        cv2.imwrite(str(head_path), canvas)

    return head_path


def generate_f01_talking_head_fixture(output_path: Path, duration_s: float = 5.0, fps: int = 30) -> Path:
    """F01: Single talking head, static camera."""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists():
        return output_path

    head_path = get_or_create_head_asset(output_path.parent)
    head_img = cv2.imread(str(head_path))
    head_resized = cv2.resize(head_img, (300, 300))

    bins = get_binary_paths()
    temp_raw = output_path.parent / "temp_f01.mp4"

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(str(temp_raw), fourcc, fps, (1920, 1080))

    total_frames = int(round(duration_s * fps))
    for f in range(total_frames):
        frame = np.full((1080, 1920, 3), (230, 230, 230), dtype=np.uint8)
        # Static face at x=810, y=200
        frame[200:500, 810:1110] = head_resized
        out.write(frame)
    out.release()

    # Add audio track
    cmd = [
        bins["ffmpeg"], "-y",
        "-i", str(temp_raw),
        "-f", "lavfi",
        "-i", f"sine=frequency=440:beep_factor=4:duration={duration_s}",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-ar", "48000",
        "-shortest",
        str(output_path)
    ]
    subprocess.run(cmd, capture_output=True, check=True, timeout=30)
    if temp_raw.exists():
        temp_raw.unlink()

    return output_path


def generate_f02_moving_presenter_fixture(output_path: Path, duration_s: float = 5.0, fps: int = 30) -> Path:
    """F02: Single presenter who moves smoothly across the frame."""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists():
        return output_path

    head_path = get_or_create_head_asset(output_path.parent)
    head_img = cv2.imread(str(head_path))
    head_resized = cv2.resize(head_img, (300, 300))

    bins = get_binary_paths()
    temp_raw = output_path.parent / "temp_f02.mp4"

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(str(temp_raw), fourcc, fps, (1920, 1080))

    total_frames = int(round(duration_s * fps))
    for f in range(total_frames):
        t = f / fps
        frame = np.full((1080, 1920, 3), (230, 230, 230), dtype=np.uint8)
        # Presenter moves horizontally from x=300 to x=1100 smoothly
        x = int(300 + 700 * (0.5 - 0.5 * np.cos(2.0 * np.pi * t / duration_s)))
        y = 200
        frame[y:y+300, x:x+300] = head_resized
        out.write(frame)
    out.release()

    # Add audio track
    cmd = [
        bins["ffmpeg"], "-y",
        "-i", str(temp_raw),
        "-f", "lavfi",
        "-i", f"sine=frequency=440:beep_factor=4:duration={duration_s}",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-ar", "48000",
        "-shortest",
        str(output_path)
    ]
    subprocess.run(cmd, capture_output=True, check=True, timeout=30)
    if temp_raw.exists():
        temp_raw.unlink()

    return output_path


def generate_f03_podcast_fixture(output_path: Path, duration_s: float = 5.0, fps: int = 30) -> Path:
    """F03: Two-person podcast alternating visual positions with synchronous audio pulse."""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists():
        return output_path

    bins = get_binary_paths()
    cmd = [
        bins["ffmpeg"], "-y",
        "-f", "lavfi",
        "-i", f"color=c=black:s=1920x1080:r={fps}:d={duration_s}",
        "-f", "lavfi",
        "-i", f"sine=frequency=440:beep_factor=4:duration={duration_s}",
        "-vf", (
            "drawbox=x=300:y=300:w=300:h=300:color=red@0.8:t=fill,"
            "drawbox=x=1320:y=300:w=300:h=300:color=blue@0.8:t=fill"
        ),
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-ar", "48000",
        str(output_path),
    ]
    subprocess.run(cmd, capture_output=True, check=True, timeout=30)
    return output_path


def generate_f15_phone_vfr_rotation_fixture(output_path: Path, duration_s: float = 4.0) -> Path:
    """F15: Phone footage with odd dimensions (1919x1079), rotation metadata (90 deg), and audio."""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists():
        return output_path

    bins = get_binary_paths()
    cmd = [
        bins["ffmpeg"], "-y",
        "-f", "lavfi",
        "-i", f"color=c=navy:s=1919x1079:r=29.97:d={duration_s}",
        "-f", "lavfi",
        "-i", f"sine=frequency=880:duration={duration_s}",
        "-metadata:s:v:0", "rotate=90",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        str(output_path),
    ]
    subprocess.run(cmd, capture_output=True, check=True, timeout=30)
    return output_path


if __name__ == "__main__":
    fixtures_dir = Path(__file__).resolve().parent
    generate_f01_talking_head_fixture(fixtures_dir / "F01.mp4")
    generate_f02_moving_presenter_fixture(fixtures_dir / "F02.mp4")
    generate_f03_podcast_fixture(fixtures_dir / "F03.mp4")
    generate_f15_phone_vfr_rotation_fixture(fixtures_dir / "F15.mp4")
    print("Fixtures F01, F02, F03 and F15 created.")
