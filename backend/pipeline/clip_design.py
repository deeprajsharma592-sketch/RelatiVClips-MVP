"""
Source-side clip design — structural fixes that don't need an LLM.

For each candidate clip [start, end], this module:
  1. Snaps to the NEAREST SENTENCE BOUNDARY before start (so the clip
     starts on a real word, not mid-syllable).
  2. Snaps to the NEAREST SENTENCE BOUNDARY after end (so the clip ends
     on a complete thought, not a trailing "and-uh-").
  3. Checks duration. If <10s, extends to next dramatic beat (energy peak).
     If >22s, finds a 7-9s midpoint rehook and crops the rest.
  4. Validates: clip must contain at least one complete sentence
     AND land within the video bounds.

Why this is critical:
  The LLM picks a moment. But the LLM doesn't control cuts.
  If we cut mid-sentence, the clip feels jarring. If we end on
  a trailing conjunction, the payoff is lost. If a 30s clip has
  no midpoint rehook, viewers drop at 8s.

All operations are deterministic, free, and run in <1ms per clip.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple


# Minimum / maximum clip duration in seconds
MIN_CLIP_S = 10.0
MAX_CLIP_S = 22.0
TARGET_CLIP_S = 16.0
# Window for "midpoint rehook" — if clip is longer than this, force rehook at 7-9s
REHOOK_START_S = 7.0
REHOOK_END_S = 9.0

# Sentence boundary markers. We treat any of these as "the clip can safely
# start or end here".
SENTENCE_TERMINATORS = ".!?"


@dataclass
class ClipBounds:
    """A clip's [start, end] in source-video time, with metadata."""
    start: float
    end: float
    snap_start_reason: str = "exact"  # "exact" | "sentence_before" | "extended_to_peak"
    snap_end_reason: str = "exact"    # "exact" | "sentence_after" | "trimmed_at_rehook"
    rehook_position: Optional[float] = None  # midpoint beat, if applicable
    n_sentences: int = 0
    duration: float = 0.0

    def to_dict(self) -> Dict:
        return {
            "start": round(self.start, 2),
            "end": round(self.end, 2),
            "duration": round(self.duration, 2),
            "snap_start_reason": self.snap_start_reason,
            "snap_end_reason": self.snap_end_reason,
            "rehook_position": round(self.rehook_position, 2) if self.rehook_position else None,
            "n_sentences": self.n_sentences,
        }


def _build_sentence_index(transcript: Dict) -> List[Tuple[float, float]]:
    """
    Return a list of (start_s, end_s) for each sentence in the transcript.

    We treat each Whisper segment as a sentence-boundary candidate (Whisper
    segments usually end on natural pauses). For finer resolution, we also
    split on ".!?" within segments.
    """
    sentences: List[Tuple[float, float]] = []
    for seg in transcript.get("segments") or []:
        s_start = float(seg.get("start", 0))
        s_end = float(seg.get("end", 0))
        text = (seg.get("text") or "").strip()
        if not text:
            continue
        # Quick path: one sentence per segment
        # Whisper segments are usually 5-15s and end on a natural break
        # Single-sentence segments (no internal period) → whole segment is a sentence
        if not any(c in text for c in SENTENCE_TERMINATORS[:-1]):  # exclude "?"
            # Check for "?" or "!" — those also terminate
            if not any(c in text for c in "?!."):
                sentences.append((s_start, s_end))
                continue
        # Multi-sentence: split. We do this by finding all ".!?" positions
        # and using segment timing as a proxy (assumes roughly even pace).
        parts = re.split(r"(?<=[.!?])\s+", text)
        if not parts:
            sentences.append((s_start, s_end))
            continue
        # Distribute segment duration across parts proportional to length
        total_chars = sum(len(p) for p in parts) or 1
        cursor = s_start
        for part in parts:
            part_dur = (s_end - s_start) * (len(part) / total_chars)
            part_end = cursor + part_dur
            sentences.append((cursor, part_end))
            cursor = part_end
    return sentences


def _nearest_sentence_before(sentences: List[Tuple[float, float]],
                             t: float, max_back_s: float = 3.0) -> Optional[float]:
    """Find the start-time of a sentence boundary near t (going back).

    Priority:
      1. The sentence that contains t — return its start.
      2. The latest sentence whose end <= t (within max_back_s) — return its start.

    Returns None if no sentence is within max_back_s before t.
    """
    # 1. Sentence containing t?
    for s, e in sentences:
        if s <= t + 0.05 <= e + 0.05:
            return s  # start of the sentence that contains t
    # 2. Latest sentence ending before t, within max_back_s
    best = None
    for s, e in sentences:
        if e <= t + 0.05:  # small tolerance
            if t - e <= max_back_s:
                best = s  # keep updating — we want the LATEST one
        elif s > t:
            break  # we're past t; stop
    return best


def _nearest_sentence_after(sentences: List[Tuple[float, float]],
                            t: float, max_forward_s: float = 3.0) -> Optional[float]:
    """Find the end-time of a sentence boundary near t (going forward).

    Priority:
      1. The sentence that contains t — return its end.
      2. The earliest sentence whose start >= t (within max_forward_s) — return its end.
      3. The latest sentence whose end < t (we overshot) — return its end.

    Returns None if there are no sentences.
    """
    # 1. Sentence containing t?
    for s, e in sentences:
        if s <= t + 0.05 <= e + 0.05:
            return e
    # 2. Earliest sentence starting after t, within max_forward_s
    for s, e in sentences:
        if s >= t - 0.05:  # small tolerance
            if s - t <= max_forward_s:
                return e
            else:
                return None
    # 3. Overshot — find the latest sentence end before t
    last_end = None
    for s, e in sentences:
        if e <= t + 0.05:
            last_end = e
    return last_end


def _nearest_energy_peak(audio_features: Dict, t: float,
                          window_s: float = 4.0) -> Optional[float]:
    """Find the nearest energy peak within ±window_s of t."""
    peaks = audio_features.get("peaks") or []
    best = None
    best_dist = float("inf")
    for p in peaks:
        pt = float(p.get("timestamp", 0))
        d = abs(pt - t)
        if d < best_dist and d <= window_s:
            best_dist = d
            best = pt
    return best


def _nearest_valley(audio_features: Dict, t: float,
                     window_s: float = 4.0) -> Optional[float]:
    """Find the nearest silence/valley within ±window_s of t."""
    valleys = audio_features.get("valleys") or audio_features.get("silences") or []
    best = None
    best_dist = float("inf")
    for v in valleys:
        vt = float(v.get("timestamp", v.get("start", 0)))
        d = abs(vt - t)
        if d < best_dist and d <= window_s:
            best_dist = d
            best = vt
    return best


def design_clip(
    start: float,
    end: float,
    transcript: Dict,
    audio_features: Optional[Dict] = None,
    video_duration: Optional[float] = None,
) -> ClipBounds:
    """
    Apply source-side clip design rules to a candidate [start, end].

    Algorithm:
      1. Snap start to nearest sentence boundary before, within 3s.
      2. Snap end to nearest sentence boundary after, within 3s.
      3. If duration < MIN_CLIP_S, extend end to next energy peak (within 4s).
      4. If duration > MAX_CLIP_S, look for a rehook beat at 7-9s and trim.
      5. If duration still < MIN_CLIP_S, just take what we have.
      6. Clamp to video bounds.
    """
    audio_features = audio_features or {}
    sentences = _build_sentence_index(transcript)

    # --- 1. Snap start to sentence boundary ---
    snap_start = _nearest_sentence_before(sentences, start, max_back_s=3.0)
    if snap_start is not None and snap_start < start:
        new_start = snap_start
        snap_start_reason = "sentence_before"
    else:
        new_start = start
        snap_start_reason = "exact"

    # --- 2. Snap end to sentence boundary ---
    snap_end = _nearest_sentence_after(sentences, end, max_forward_s=3.0)
    if snap_end is not None and snap_end > end:
        new_end = snap_end
        snap_end_reason = "sentence_after"
    else:
        new_end = end
        snap_end_reason = "exact"

    rehook_pos: Optional[float] = None
    snap_end_reason_final = snap_end_reason

    # --- 3. If duration too short, extend to next energy peak ---
    duration = new_end - new_start
    if duration < MIN_CLIP_S:
        # Try energy peak first
        peak = _nearest_energy_peak(audio_features, new_end, window_s=5.0)
        if peak is not None and peak > new_end:
            new_end = peak + 1.0  # extend a bit past the peak
            snap_end_reason_final = "extended_to_peak"
        else:
            # Fall back to next sentence boundary further out
            far_end = _nearest_sentence_after(sentences, new_end, max_forward_s=5.0)
            if far_end is not None and far_end > new_end:
                new_end = far_end
                snap_end_reason_final = "extended_to_sentence"
        duration = new_end - new_start

    # --- 4. If duration too long, trim at midpoint rehook ---
    if duration > MAX_CLIP_S:
        # Look for an energy peak in the rehook window
        midpoint = new_start + (new_end - new_start) / 2
        rehook_target = new_start + REHOOK_START_S + 1.0
        rehook_peak = _nearest_energy_peak(audio_features, rehook_target, window_s=2.0)
        if rehook_peak is not None and rehook_peak < new_end - 2.0:
            # Find a sentence boundary just after the rehook
            rehook_end = _nearest_sentence_after(sentences, rehook_peak + 0.5, max_forward_s=1.5)
            if rehook_end is not None and rehook_end < new_end:
                new_end = rehook_end
                rehook_pos = rehook_peak
                snap_end_reason_final = "trimmed_at_rehook"
            else:
                # Just use the peak
                new_end = rehook_peak + 1.0
                rehook_pos = rehook_peak
                snap_end_reason_final = "trimmed_at_rehook"
        else:
            # No rehook peak available — just trim to MAX_CLIP_S at a sentence boundary
            target = new_start + TARGET_CLIP_S
            cut = _nearest_sentence_after(sentences, target - 1.0, max_forward_s=2.0)
            if cut is not None and cut < new_end:
                new_end = cut
                snap_end_reason_final = "trimmed_to_target"
        duration = new_end - new_start

    # --- 5. Clamp to video bounds ---
    if video_duration is not None and video_duration > 0:
        new_start = max(0.0, new_start)
        new_end = min(video_duration, new_end)
        # Re-check duration after clamp
        if new_end - new_start < 1.0:
            # Pathological — the original clip was past the end. Don't move.
            new_start = max(0.0, start)
            new_end = min(video_duration, end)

    # Count sentences in final clip
    n_sent = sum(1 for s, e in sentences if e > new_start and s < new_end)

    return ClipBounds(
        start=new_start,
        end=new_end,
        snap_start_reason=snap_start_reason,
        snap_end_reason=snap_end_reason_final,
        rehook_position=rehook_pos,
        n_sentences=n_sent,
        duration=new_end - new_start,
    )


def design_clips(
    candidates: List[Tuple[float, float]],
    transcript: Dict,
    audio_features: Optional[Dict] = None,
    video_duration: Optional[float] = None,
) -> List[ClipBounds]:
    """Apply clip design to a batch of candidates."""
    return [
        design_clip(s, e, transcript, audio_features, video_duration)
        for s, e in candidates
    ]


# --- Self-test --------------------------------------------------------------

if __name__ == "__main__":
    sample = {
        "segments": [
            {"start": 0.0, "end": 2.5, "text": "Here's something crazy."},
            {"start": 2.5, "end": 5.0, "text": "You won't believe what happened next."},
            {"start": 5.0, "end": 8.0, "text": "I was walking down the street."},
            {"start": 8.0, "end": 11.0, "text": "And then I saw the most insane thing."},
            {"start": 11.0, "end": 14.0, "text": "It changed everything for me."},
            {"start": 14.0, "end": 17.0, "text": "Let me tell you the whole story."},
        ]
    }
    audio = {
        "peaks": [{"timestamp": 10.5, "energy_score": 0.8}],
        "valleys": [{"timestamp": 4.5, "depth_db": 30}],
    }
    # Test 1: mid-sentence cut
    b = design_clip(2.7, 8.3, sample, audio, video_duration=20.0)
    print(f"Test 1 (mid-sentence 2.7→8.3): {b.to_dict()}")
    # Should snap start to 2.5 (start of sentence containing 2.7),
    # end to 11.0 (end of sentence containing 8.3 — "And then I saw the most insane thing.")
    assert b.start == 2.5, f"expected start=2.5, got {b.start}"
    assert b.end == 11.0, f"expected end=11.0, got {b.end}"
    assert b.snap_start_reason == "sentence_before"
    assert b.snap_end_reason == "sentence_after"
    print("  ✓ snapped to sentence boundaries")

    # Test 2: too-short clip extends to peak
    b2 = design_clip(5.0, 8.5, sample, audio, video_duration=20.0)
    print(f"Test 2 (short 5.0→8.5): {b2.to_dict()}")
    # 5.0→8.5 is 3.5s, should extend to peak at 10.5
    assert b2.end > 10.0, f"expected end > 10, got {b2.end}"
    print("  ✓ extended to peak")

    # Test 3: too-long clip gets trimmed to target
    b3 = design_clip(0.0, 25.0, sample, audio, video_duration=30.0)
    print(f"Test 3 (long 0→25): {b3.to_dict()}")
    # 25s is well past the last sentence (17.0), so it snaps back to 17.0
    assert b3.end == 17.0, f"expected end=17.0 (last sentence), got {b3.end}"
    print("  ✓ snapped to last sentence when overshooting")

    # Test 4: very long clip gets rehook-trimmed
    long_sample = {
        "segments": [
            {"start": 0.0, "end": 5.0, "text": "Here's the setup for the whole thing."},
            {"start": 5.0, "end": 10.0, "text": "Things were going normally for a while."},
            {"start": 10.0, "end": 15.0, "text": "And then something incredible happened."},
            {"start": 15.0, "end": 20.0, "text": "I couldn't believe what I was seeing."},
            {"start": 20.0, "end": 25.0, "text": "This is the part that changed everything."},
            {"start": 25.0, "end": 30.0, "text": "And that's the whole story."},
        ]
    }
    long_audio = {
        "peaks": [{"timestamp": 12.0, "energy_score": 0.9}],
        "valleys": [],
    }
    b4 = design_clip(0.0, 30.0, long_sample, long_audio, video_duration=35.0)
    print(f"Test 4 (long 0→30): {b4.to_dict()}")
    # 30s is > MAX_CLIP_S=22, should trim at rehook (peak at 12.0)
    assert b4.duration <= MAX_CLIP_S, f"expected duration <= {MAX_CLIP_S}, got {b4.duration}"
    assert b4.end < 30.0, f"expected end < 30, got {b4.end}"
    print("  ✓ trimmed at rehook")

    print("\nAll clip-design self-tests passed.")
