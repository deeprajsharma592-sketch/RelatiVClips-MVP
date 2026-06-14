"""
Moment detector — the single signal source for the pipeline.

Replaces the old "download audio → run energy peaks → run hook detector" path
with a smarter, caption-first, audio-only-for-librosa flow.

Priority (cost-ordered, cheapest first):
  1. YouTube captions (free) → detect moments from word density + pauses
  2. Audio download → librosa peaks + valleys (only if captions fail)
  3. Whisper transcription of the WHOLE audio (last resort, expensive)

A "moment" is a candidate 10-25s window that might be a good clip. The
LLM is given a ranked list of moments and picks 2-5 to actually cut.

What gets detected (regardless of source):
  - HIGH-ENERGY peaks (loud shout, applause, emphasis)
  - LOW-ENERGY valleys (awkward silence, dramatic pause, awkward laugh)
  - The valley→peak PAIR is often the real hook ("I lost everything..."
    (valley, quiet) "...and then I made 10 Cr" (peak, loud))

For captions, the proxy for "energy" is word density:
  - High density (many words per second) ≈ peak (excited, fast talker)
  - Long pause between captions ≈ valley (dramatic beat, awkward silence)

The LLM doesn't need the full transcript. It only needs the candidate
moments with their signal type, score, and a short snippet (a few words
of context, NOT the whole transcript).
"""
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional, Tuple
import logging
import re

from ..taste.icl import Moment  # canonical type — defined in taste/icl.py

from ..utils.config import (
    TEMP_DIR,
    YTDLP_PATH,
    COOKIES_PATH,
    PEAK_THRESHOLD_MULTIPLIER,
    TARGET_SAMPLE_RATE,
)
from . import audio_analysis
from .transcript_fetcher import (
    _try_ytdlp_transcript,
    _download_audio,
)

log = logging.getLogger(__name__)


@dataclass
class Moment:
    """One candidate 10-25s window that might be a good clip."""
    index: int
    start: float
    end: float
    signal_type: str  # "peak" | "valley" | "density" | "silence"
    score: float
    snippet: str = ""           # 8-20 words of context, not the full transcript
    source: str = ""            # "caption_peak" | "caption_valley" | "audio_peak" | "audio_valley"
    story_position: float = 0.0 # 0.0 (start) - 1.0 (end) — where in the video is this?

    def to_prompt_line(self) -> str:
        """Format for the ICL prompt — terse, single line, ~40-60 tokens."""
        dur = self.end - self.start
        snip = (self.snippet[:60] + "…") if len(self.snippet) > 60 else self.snippet
        pos_pct = int(self.story_position * 100)
        return (
            f"[{self.index}] t={self.start:.1f}-{self.end:.1f}s ({dur:.0f}s, "
            f"{self.signal_type}, score={self.score:.2f}, pos={pos_pct}%): {snip!r}"
        )


# ---------------------------------------------------------------------------
# Caption-based moment detection (FREE path)
# ---------------------------------------------------------------------------


def _caption_moments_from_transcript(
    transcript: dict,
    video_duration_s: float,
) -> List[Moment]:
    """
    Detect candidate moments from YouTube captions alone — NO audio download.

    Signal 1: WORD DENSITY peaks — moments where many words are crammed into
              a short window. Proxy for "excited speech, fast talker, emphasis."

    Signal 2: PAUSE valleys — gaps between caption blocks. Proxy for "dramatic
              pause, awkward silence, beat before a reveal."

    Returns top 15-20 candidate moments, ranked by score.
    """
    segs = transcript.get("segments", [])
    if not segs or len(segs) < 2:
        return []

    # Compute word density per second for each segment
    densities: List[Tuple[float, float, float, int]] = []
    # tuple: (start, end, words_per_sec, word_count)
    for s in segs:
        dur = max(0.001, float(s.get("end", 0)) - float(s.get("start", 0)))
        words = len((s.get("text") or "").split())
        if words == 0:
            continue
        densities.append((float(s["start"]), float(s["end"]), words / dur, words))

    if not densities:
        return []

    # Compute mean density for thresholds
    density_values = [d[2] for d in densities]
    mean_density = sum(density_values) / len(density_values)
    peak_threshold = mean_density * 1.5  # 1.5x mean = "fast"
    valley_threshold = mean_density * 0.4  # <40% of mean = "slow / drag"

    moments: List[Moment] = []

    # Detect density peaks: cluster of high-density segments
    in_peak = False
    peak_start = 0.0
    peak_end = 0.0
    peak_words: List[str] = []
    for s in segs:
        dur = max(0.001, float(s.get("end", 0)) - float(s.get("start", 0)))
        words = len((s.get("text") or "").split())
        density = words / dur if dur > 0 else 0
        is_dense = density >= peak_threshold
        if is_dense:
            if not in_peak:
                in_peak = True
                peak_start = float(s["start"])
            peak_end = float(s["end"])
            peak_words.extend((s.get("text") or "").split())
        else:
            if in_peak:
                # End of peak region
                if peak_end - peak_start >= 2.0 and len(peak_words) >= 4:
                    snippet = " ".join(peak_words[:12])
                    moments.append(Moment(
                        index=0,  # filled in later
                        start=peak_start,
                        end=peak_end,
                        signal_type="density",
                        score=min(1.0, (peak_end - peak_start) / 15.0 * 0.7 + 0.3),
                        snippet=snippet,
                        source="caption_density",
                        story_position=peak_start / max(1.0, video_duration_s),
                    ))
                in_peak = False
                peak_words = []
    if in_peak and peak_end - peak_start >= 2.0 and peak_words:
        snippet = " ".join(peak_words[:12])
        moments.append(Moment(
            index=0,
            start=peak_start,
            end=peak_end,
            signal_type="density",
            score=min(1.0, (peak_end - peak_start) / 15.0 * 0.7 + 0.3),
            snippet=snippet,
            source="caption_density",
            story_position=peak_start / max(1.0, video_duration_s),
        ))

    # Detect pause valleys: gaps >= 1.5s between caption blocks
    for i in range(1, len(segs)):
        prev_end = float(segs[i - 1].get("end", 0))
        cur_start = float(segs[i].get("start", 0))
        gap = cur_start - prev_end
        if gap >= 1.5:
            # The valley is the gap; the clip window is ±4s around it
            clip_start = max(0, prev_end - 1.0)
            clip_end = cur_start + 4.0
            # Use surrounding text as the snippet
            before_text = (segs[i - 1].get("text") or "").strip()
            after_text = (segs[i].get("text") or "").strip()
            snippet = f"{before_text[-30:].strip()} …[pause]… {after_text[:30].strip()}".strip()
            if not snippet:
                snippet = "[dramatic pause]"
            moments.append(Moment(
                index=0,
                start=clip_start,
                end=clip_end,
                signal_type="silence",
                score=min(1.0, gap / 4.0 * 0.6 + 0.4),
                snippet=snippet,
                source="caption_pause",
                story_position=prev_end / max(1.0, video_duration_s),
            ))

    # Sort by score, take top 20
    moments.sort(key=lambda m: m.score, reverse=True)
    top = moments[:20]
    # Re-index
    for i, m in enumerate(top, 1):
        m.index = i
    return top


def _pad_with_temporal_candidates(
    moments: List["Moment"],
    video_duration_s: float,
    target_count: int = 3,
) -> List["Moment"]:
    """Ensure we always have at least `target_count` candidate moments.

    If caption-based detection returned fewer (which happens for videos with
    monotonous pacing — no density peaks, no long pauses), divide the video
    into N equal temporal segments and add a "temporal" candidate at the
    center of each segment that doesn't already contain a real moment.

    The padded candidates have low score (0.4) so they never outrank real
    density/silence peaks, but they guarantee the LLM/fallback always has
    enough material to pick from. Result: always NUM_CLIPS_YOUTUBE clips
    instead of 0-1 when captions are monotonous.
    """
    if len(moments) >= target_count or video_duration_s < 30.0:
        return moments

    seg_dur = video_duration_s / target_count
    used_segs = set()
    for m in moments:
        used_segs.add(int(m.start / seg_dur))

    padded = list(moments)
    for i in range(target_count):
        if i in used_segs:
            continue
        # Center of segment, with a 15s window (the standard clip length)
        center = (i + 0.5) * seg_dur
        start = max(0.0, center - 7.5)
        end = min(video_duration_s, center + 7.5)
        padded.append(Moment(
            index=0,  # re-indexed later
            start=round(start, 2),
            end=round(end, 2),
            signal_type="temporal",
            score=0.4,  # below real peaks (0.6+) but above noise
            snippet=f"[temporal segment {i+1}/{target_count} — {start:.0f}s to {end:.0f}s]",
            source="temporal_padding",
            story_position=center / max(1.0, video_duration_s),
        ))

    # Re-sort by score, re-index, keep top 20
    padded.sort(key=lambda m: m.score, reverse=True)
    top = padded[:20]
    for i, m in enumerate(top, 1):
        m.index = i
    return top


# ---------------------------------------------------------------------------
# Audio-based moment detection (FALLBACK path — only if captions fail)
# ---------------------------------------------------------------------------


def _audio_moments_from_file(
    audio_path: str,
    video_duration_s: float,
) -> List[Moment]:
    """
    Detect candidate moments from audio alone — peaks AND valleys via librosa.
    Used when YouTube captions are unavailable.
    """
    result = audio_analysis.analyze_audio_peaks_and_valleys(audio_path)
    moments: List[Moment] = []

    # Top 10 peaks
    for i, p in enumerate(result.get("peaks", [])[:10], 1):
        start = max(0, p["timestamp"] - 5.0)
        end = min(video_duration_s, start + 15.0)
        moments.append(Moment(
            index=i,
            start=round(start, 2),
            end=round(end, 2),
            signal_type="peak",
            score=min(1.0, p["relative_to_mean"] / 3.0),
            snippet="[audio peak — no caption text available]",
            source="audio_peak",
            story_position=start / max(1.0, video_duration_s),
        ))

    # Top 10 valleys
    for j, v in enumerate(result.get("valleys", [])[:10], 11):
        moments.append(Moment(
            index=j,
            start=v["start"],
            end=v["end"],
            signal_type="valley",
            score=v["score"],
            snippet=f"[audio valley — {v['duration_s']:.1f}s pause, depth={v['depth']:.2f}]",
            source="audio_valley",
            story_position=v["start"] / max(1.0, video_duration_s),
        ))

    moments.sort(key=lambda m: m.score, reverse=True)
    # Pad with temporal candidates if too few real audio moments
    moments = _pad_with_temporal_candidates(moments, video_duration_s, target_count=3)
    # Re-index
    for i, m in enumerate(moments[:20], 1):
        m.index = i
    return moments[:20]


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


def detect_moments(
    source: str,
    task_id: str,
    precomputed_transcript: Optional[dict] = None,
    log: Optional[Callable] = None,
) -> Tuple[List[Moment], dict]:
    """
    Detect candidate moments for the LLM. Returns (moments, info).

    info contains:
      - source: "captions" | "audio" | "none"
      - transcript: optional, the transcript used
      - audio_path: optional, the local audio file (if downloaded)
      - duration_s: video duration
      - audio_analysis: raw peaks/valleys (if audio path was used)
    """
    if log is None:
        log = lambda m: None

    info: dict = {"source": "none", "duration_s": 0.0}

    # --- PATH 1: Captions first (free) ---
    transcript = precomputed_transcript
    if not transcript or not transcript.get("segments"):
        log("  Trying YouTube captions first (no audio download)...")
        transcript = _try_ytdlp_transcript(source, task_id, log)
    else:
        log(f"  Using precomputed transcript ({len(transcript.get('segments', []))} segments)")

    if transcript and transcript.get("segments"):
        info["source"] = "captions"
        info["transcript"] = transcript
        # Estimate duration from the last caption
        segs = transcript["segments"]
        info["duration_s"] = float(segs[-1].get("end", 0))
        moments = _caption_moments_from_transcript(transcript, info["duration_s"])
        # Pad with temporal candidates if too few real moments were found
        # (guarantees NUM_CLIPS_YOUTUBE clips even for monotonous videos)
        moments = _pad_with_temporal_candidates(moments, info["duration_s"], target_count=3)
        log(f"  Built {len(moments)} candidate moments from captions (no audio download)")
        return moments, info

    # --- PATH 2: Audio fallback (librosa peaks + valleys) ---
    log("  Captions unavailable — downloading audio for librosa peaks+valleys only")
    audio_path = _download_audio(source, task_id, log)
    if not audio_path:
        log("  Audio download also failed — returning empty moments")
        return [], info

    info["source"] = "audio"
    info["audio_path"] = audio_path
    # Use librosa to get the actual duration
    try:
        import librosa
        y, sr = librosa.load(audio_path, sr=TARGET_SAMPLE_RATE, mono=True)
        info["duration_s"] = float(len(y)) / sr
    except Exception:
        info["duration_s"] = 0.0

    moments = _audio_moments_from_file(audio_path, info["duration_s"])
    log(f"  Built {len(moments)} candidate moments from audio (peaks + valleys)")
    return moments, info
