"""
RelatiV Multi-Segment Jump-Cut Stitching Module.

Enables seamless condensation of non-contiguous moments:
- Stitching 2+ video segments using FFmpeg complex filter.
- 40ms equal-power audio crossfade (`acrossfade`) to eliminate audio pops/clicks at the cut seam.
- Subtle 1.05x punch-in zoom on subsequent segments for deliberate, energetic jump-cut style.
- Transcript and subtitle re-indexing across stitch boundaries.
"""
from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path
from typing import Dict, List, Optional, Tuple

try:
    from ..utils.config import FFMPEG_PATH, TEMP_DIR
except Exception:
    import shutil
    FFMPEG_PATH = os.getenv("FFMPEG_PATH", shutil.which("ffmpeg") or "ffmpeg")
    TEMP_DIR = Path("./temp")


def stitch_transcripts(
    segment_transcripts: List[Dict],
    segment_durations: List[float],
) -> Dict:
    """
    Re-index and merge word-level transcripts across non-contiguous stitched segments.

    Each segment's word/segment timestamps are shifted by the cumulative duration
    of all preceding segments.
    """
    merged_segments: List[Dict] = []
    cumulative_offset = 0.0

    for i, (tr, dur) in enumerate(zip(segment_transcripts, segment_durations)):
        if not tr:
            cumulative_offset += dur
            continue

        raw_segs = tr.get("segments", [])
        for s in raw_segs:
            s_start = round(float(s.get("start", 0)) + cumulative_offset, 3)
            s_end = round(float(s.get("end", 0)) + cumulative_offset, 3)
            shifted_words = []
            for w in s.get("words", []):
                w_start = round(float(w.get("start", 0)) + cumulative_offset, 3)
                w_end = round(float(w.get("end", w.get("start", 0))) + cumulative_offset, 3)
                shifted_words.append({
                    **w,
                    "start": w_start,
                    "end": w_end,
                })
            merged_segments.append({
                **s,
                "start": s_start,
                "end": s_end,
                "words": shifted_words,
                "stitch_segment_index": i,
            })

        cumulative_offset += dur

    return {
        "segments": merged_segments,
        "language": segment_transcripts[0].get("language", "en") if segment_transcripts else "en",
        "is_stitched": True,
        "total_duration": round(cumulative_offset, 3),
    }


def build_ffmpeg_stitch_command(
    segment_paths: List[str | Path],
    output_path: str | Path,
    crossfade_duration_s: float = 0.04,
    punch_in_zoom: bool = False,
) -> List[str]:
    """
    Build an FFmpeg command to sew multiple video segments together with an
    inaudible audio crossfade and seamless video concatenation.
    """
    if len(segment_paths) < 2:
        raise ValueError("At least 2 segments are required to stitch.")

    cmd = [FFMPEG_PATH, "-y"]
    for p in segment_paths:
        cmd.extend(["-i", str(p)])

    n = len(segment_paths)

    # If punch-in zoom is requested on the second segment, apply scale & crop to segment 1
    # Example: 1.05x punch-in for high-energy YouTube Shorts / TikTok jump cut
    filter_parts = []
    if punch_in_zoom and n == 2:
        # Segment 0: keep standard
        # Segment 1: subtle 1.05x punch-in
        filter_parts.append(
            "[1:v]scale=iw*1.05:ih*1.05,crop=iw/1.05:ih/1.05[v1_punch]"
        )
        filter_parts.append(
            "[0:v][v1_punch]concat=n=2:v=1:a=0[vout]"
        )
    else:
        v_inputs = "".join(f"[{i}:v]" for i in range(n))
        filter_parts.append(f"{v_inputs}concat=n={n}:v=1:a=0[vout]")

    # Audio crossfade chain to eliminate clicks/pops at cut points
    if n == 2:
        filter_parts.append(
            f"[0:a][1:a]acrossfade=d={crossfade_duration_s}:c1=tri:c2=tri[aout]"
        )
    else:
        # For 3+ segments, concatenate audio streams cleanly
        a_inputs = "".join(f"[{i}:a]" for i in range(n))
        filter_parts.append(f"{a_inputs}concat=n={n}:v=0:a=1[aout]")

    filter_str = ";".join(filter_parts)

    cmd.extend([
        "-filter_complex", filter_str,
        "-map", "[vout]",
        "-map", "[aout]",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "18",
        "-c:a", "aac",
        "-b:a", "192k",
        str(output_path),
    ])
    return cmd


def stitch_video_segments(
    segment_paths: List[str | Path],
    output_path: str | Path,
    crossfade_duration_s: float = 0.04,
    punch_in_zoom: bool = False,
    timeout_s: int = 180,
) -> bool:
    """Execute FFmpeg stitching of multiple media parts into a single video."""
    for p in segment_paths:
        if not Path(p).exists():
            raise FileNotFoundError(f"Segment file not found: {p}")

    cmd = build_ffmpeg_stitch_command(
        segment_paths=segment_paths,
        output_path=output_path,
        crossfade_duration_s=crossfade_duration_s,
        punch_in_zoom=punch_in_zoom,
    )

    res = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout_s)
    if res.returncode != 0:
        print(f"[Stitching] FFmpeg error:\n{res.stderr}")
        return False
    return Path(output_path).exists() and Path(output_path).stat().st_size > 1024
