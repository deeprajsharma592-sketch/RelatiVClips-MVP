"""FFmpeg/FFprobe helpers shared by the composer, the judge and the tests."""

from __future__ import annotations

import hashlib
import json
import re
import shutil
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Sequence


class MediaError(RuntimeError):
    """FFmpeg/FFprobe failed; the message includes the tail of stderr."""


def _require(binary: str) -> str:
    found = shutil.which(binary)
    if not found:
        raise MediaError(
            f"{binary} not found on PATH. Install it first (macOS: brew install ffmpeg)."
        )
    return found


def run(cmd: Sequence[str], *, timeout: float = 300.0) -> subprocess.CompletedProcess[str]:
    started = time.monotonic()
    try:
        proc = subprocess.run(
            list(cmd),
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:  # pragma: no cover - environment dependent
        raise MediaError(f"{cmd[0]} timed out after {timeouts(timeout)}s") from exc
    if proc.returncode != 0:
        tail = "\n".join((proc.stderr or proc.stdout or "").strip().splitlines()[-12:])
        raise MediaError(f"{' '.join(cmd[:4])} failed ({proc.returncode}) after {time.monotonic() - started:.1f}s:\n{tail}")
    return proc


def timeouts(value: float) -> str:
    return f"{value:g}"


def ffprobe(path: str | Path) -> dict[str, Any]:
    ffprobe = _require("ffprobe")
    proc = run(
        [
            ffprobe,
            "-v",
            "error",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            str(path),
        ],
        timeout=60,
    )
    return json.loads(proc.stdout or "{}")


def duration_s(path: str | Path) -> float:
    info = ffprobe(path)
    try:
        return float(info["format"]["duration"])
    except (KeyError, TypeError, ValueError):
        return 0.0


def streams(path: str | Path, kind: str) -> list[dict[str, Any]]:
    info = ffprobe(path)
    return [s for s in info.get("streams", []) if s.get("codec_type") == kind]


def has_audio(path: str | Path) -> bool:
    return bool(streams(path, "audio"))


def has_video(path: str | Path) -> bool:
    return bool(streams(path, "video"))


def video_size(path: str | Path) -> tuple[int, int]:
    for s in streams(path, "video"):
        try:
            return int(s["width"]), int(s["height"])
        except (KeyError, TypeError, ValueError):
            continue
    return (0, 0)


def reencode_for_seeking(src: str | Path, dst: str | Path, *, fps: int = 30) -> Path:
    """H.264 with a keyframe every second, so frame seeking is exact and fast."""
    ffmpeg = _require("ffmpeg")
    dst = Path(dst)
    dst.parent.mkdir(parents=True, exist_ok=True)
    run(
        [
            ffmpeg,
            "-y",
            "-loglevel",
            "error",
            "-i",
            str(src),
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "18",
            "-r",
            str(fps),
            "-g",
            str(fps),
            "-keyint_min",
            str(fps),
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            "-c:a",
            "aac",
            "-b:a",
            "160k",
            str(dst),
        ],
        timeout=600,
    )
    return dst


def normalize_loudness(src: str | Path, dst: str | Path, lufs: float = -16.0) -> Path:
    """One-pass loudness normalisation for a short SFX hit."""
    ffmpeg = _require("ffmpeg")
    dst = Path(dst)
    dst.parent.mkdir(parents=True, exist_ok=True)
    run(
        [
            ffmpeg,
            "-y",
            "-loglevel",
            "error",
            "-i",
            str(src),
            "-af",
            f"loudnorm=I={lufs}:TP=-1.5:LRA=7",
            "-ar",
            "48000",
            "-ac",
            "2",
            str(dst),
        ],
        timeout=120,
    )
    return dst


def measure_lufs(path: str | Path) -> float:
    """Integrated loudness of a file, from ffmpeg's ebur128 summary."""
    ffmpeg = _require("ffmpeg")
    proc = run(
        [
            ffmpeg,
            "-hide_banner",
            "-nostats",
            "-i",
            str(path),
            "-filter_complex",
            "ebur128=peak=true",
            "-f",
            "null",
            "-",
        ],
        timeout=120,
    )
    matches = re.findall(r"I:\s*(-?\d+(?:\.\d+)?)\s*LUFS", proc.stderr or "")
    return float(matches[-1]) if matches else float("nan")


def extract_frame(src: str | Path, t: float, dst: str | Path, *, width: int = 720) -> Path:
    ffmpeg = _require("ffmpeg")
    dst = Path(dst)
    dst.parent.mkdir(parents=True, exist_ok=True)
    run(
        [
            ffmpeg,
            "-y",
            "-loglevel",
            "error",
            "-ss",
            f"{max(0.0, t):.3f}",
            "-i",
            str(src),
            "-frames:v",
            "1",
            "-vf",
            f"scale={width}:-2:flags=lanczos",
            "-q:v",
            "3",
            str(dst),
        ],
        timeout=120,
    )
    if not dst.exists() or dst.stat().st_size == 0:
        raise MediaError(f"no frame at {t}s in {src}")
    return dst


@dataclass(frozen=True)
class FrameHashes:
    count: int
    digest: str
    per_frame: tuple[str, ...]

    @classmethod
    def from_hashes(cls, hashes: Sequence[str]) -> "FrameHashes":
        joined = "".join(hashes).encode("ascii")
        return cls(count=len(hashes), digest=hashlib.sha256(joined).hexdigest(), per_frame=tuple(hashes))


def decoded_frame_hashes(path: str | Path, *, timeout: float = 600.0) -> FrameHashes:
    """Per-frame MD5 of *decoded* pixels, via ffmpeg's framemd5 muxer.

    Decoded hashes prove the rendered pictures are identical even if the
    container muxing or timestamps differ slightly.
    """
    ffmpeg = _require("ffmpeg")
    proc = run(
        [ffmpeg, "-v", "error", "-i", str(path), "-map", "0:v:0", "-f", "framemd5", "-"],
        timeout=timeout,
    )
    hashes: list[str] = []
    for line in proc.stdout.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = [p.strip() for p in line.split(",")]
        if len(parts) >= 6:
            hashes.append(parts[-1])
    return FrameHashes.from_hashes(hashes)


def audio_digest(path: str | Path, *, timeout: float = 300.0) -> str:
    """MD5 of decoded audio PCM, for audio determinism checks."""
    ffmpeg = _require("ffmpeg")
    proc = run(
        [ffmpeg, "-v", "error", "-i", str(path), "-vn", "-f", "md5", "-"],
        timeout=timeout,
    )
    return (proc.stdout or "").strip()
