"""Frame sampling for the judge: the hook, effect peaks, midpoint, and the last second.

Frames are downscaled to keep vision tokens (and cost) low; the transcript is
attached at the same timestamps so the judge can connect a frame to a line.
"""

from __future__ import annotations

import base64
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Mapping, Sequence

from composer import media

FRAME_WIDTH = 512
HOOK_TIMES = (0.5, 1.5)
FINAL_SECOND = 1.0


@dataclass(frozen=True)
class Frame:
    ts: float
    label: str
    path: Path

    def data_url(self, mime: str = "image/jpeg") -> str:
        payload = base64.b64encode(self.path.read_bytes()).decode("ascii")
        return f"data:{mime};base64,{payload}"


@dataclass
class FrameSet:
    frames: list[Frame] = field(default_factory=list)
    transcript_at_frames: dict[str, str] = field(default_factory=dict)

    def as_prompt_lines(self) -> str:
        lines = []
        for frame in self.frames:
            line = self.transcript_at_frames.get(frame.label, "").strip()
            lines.append(f"- {frame.ts:.2f}s ({frame.label}): {line or '(no speech)'}")
        return "\n".join(lines)


def plan_timestamps(edl: Mapping[str, Any], duration_s: float) -> list[tuple[float, str]]:
    """Deterministic sample points: hook, effect peaks, midpoint, final second."""
    duration = max(0.5, float(duration_s))
    points: list[tuple[float, str]] = []
    for t in HOOK_TIMES:
        if t < duration:
            points.append((t, f"hook@{t:g}s"))

    effects = sorted(
        (e for e in (edl.get("effects") or []) if isinstance(e, Mapping)),
        key=lambda e: float(e.get("start", 0.0)),
    )
    for effect in effects:
        start = float(effect.get("start", 0.0))
        end = float(effect.get("end", start))
        peak = min(duration - 0.05, max(0.0, start + (end - start) * 0.5))
        points.append((round(peak, 2), f"peak:{effect.get('id', '?')}"))

    points.append((round(duration / 2, 2), "midpoint"))
    points.append((round(max(0.0, duration - FINAL_SECOND), 2), "final"))

    seen: set[float] = set()
    unique: list[tuple[float, str]] = []
    for ts, label in sorted(points):
        ts = max(0.0, min(duration - 0.05, ts))
        key = round(ts, 2)
        if key in seen:
            continue
        seen.add(key)
        unique.append((key, label))
    return unique


def transcript_snippet(
    transcript: Mapping[str, Any] | Sequence[Mapping[str, Any]] | None,
    ts: float,
    *,
    window: float = 1.4,
) -> str:
    if not transcript:
        return ""
    words = transcript.get("words") if isinstance(transcript, Mapping) else transcript
    picked = []
    for word in words or []:
        try:
            start = float(word["start"])
        except (KeyError, TypeError, ValueError):
            continue
        if ts - window <= start <= ts + window * 0.4:
            picked.append(str(word.get("w") or word.get("word") or ""))
    return " ".join(picked).strip()


def extract_frames(
    mp4_path: str | Path,
    edl: Mapping[str, Any],
    *,
    duration_s: float,
    out_dir: str | Path,
    transcript: Mapping[str, Any] | Sequence[Mapping[str, Any]] | None = None,
    width: int = FRAME_WIDTH,
) -> FrameSet:
    """Write JPEG frames and return them with aligned transcript text."""
    target = Path(out_dir)
    target.mkdir(parents=True, exist_ok=True)
    frames: list[Frame] = []
    aligned: dict[str, str] = {}
    for ts, label in plan_timestamps(edl, duration_s):
        safe = label.replace(":", "_").replace("@", "_").replace(".", "_")
        path = target / f"{ts:06.2f}_{safe}.jpg"
        if not path.exists():
            media.extract_frame(mp4_path, ts, path, width=width)
        frame = Frame(ts=ts, label=label, path=path)
        frames.append(frame)
        aligned[label] = transcript_snippet(transcript, ts)
    return FrameSet(frames=frames, transcript_at_frames=aligned)


def cleanup_frames(frame_set: FrameSet) -> None:
    for frame in frame_set.frames:
        try:
            frame.path.unlink()
        except OSError:
            pass
