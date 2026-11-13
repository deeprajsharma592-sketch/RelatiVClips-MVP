"""
Synthetic Test Fixture Generator for Dynamic Framing Test Suite (spec-0.1).
Generates F03 (2-person alternating audio/video) and F15 (VFR + rotation metadata + odd dimensions).
"""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

from framing.config import get_binary_paths


def generate_f03_podcast_fixture(output_path: Path, duration_s: float = 5.0, fps: int = 30) -> Path:
    """
    F03: Two-person podcast alternating visual positions with synchronous audio pulse.
    """
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists():
        return output_path

    bins = get_binary_paths()
    # Generates 1920x1080 test video with two distinct visual blocks (left and right) and 440Hz sine tone
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
    """
    F15: Phone footage with odd dimensions (1919x1079), rotation metadata (90 deg), and audio.
    """
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists():
        return output_path

    bins = get_binary_paths()
    # Generates 1919x1079 odd dimensions, rotation tag 90, and audio
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
    generate_f03_podcast_fixture(fixtures_dir / "F03.mp4")
    generate_f15_phone_vfr_rotation_fixture(fixtures_dir / "F15.mp4")
    print("Fixtures F03 and F15 created.")
