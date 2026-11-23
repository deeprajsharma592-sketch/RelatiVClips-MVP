"""
Taste selector — given hook candidates + LLM response, produce final
clip objects ready for the renderer.

This is the glue between the LLM's edit commands and the renderer's
input format. It also applies the quality floor and dedupes.
"""
from typing import List, Dict, Optional, Tuple
import logging
import re

from ..utils.config import CLIP_DURATION_HARD_MIN, CLIP_DURATION_HARD_MAX

log = logging.getLogger(__name__)

# Duration bounds: sweet spot for viral short-form (Shorts / Reels / TikTok)
CLIP_DURATION_MIN = max(10.0, float(CLIP_DURATION_HARD_MIN))
CLIP_DURATION_MAX = min(60.0, float(CLIP_DURATION_HARD_MAX))
QUALITY_FLOOR = 0.7  # per PIPELINE-VISION.md: never ship < 0.7

SENTENCE_TERMINATORS = ".!?"


def snap_to_sentence_boundary(
    start: float,
    end: float,
    transcript: Optional[Dict],
    video_duration: float,
    min_dur: float = CLIP_DURATION_MIN,
    max_dur: float = CLIP_DURATION_MAX,
) -> Tuple[float, float]:
    """Snap start/end timestamps to clean sentence boundaries.

    Ensures the clip starts on the first word of a thought (not mid-syllable or
    after a cut-off phrase) and ends after a sentence-closing punctuation mark.
    """
    if not transcript or not transcript.get("segments"):
        return start, end

    segments = transcript.get("segments") or []
    snapped_start = start
    snapped_end = end

    # 1. Snap start: look for segment or sentence start within 3.5s of start
    for seg in segments:
        s_s = float(seg.get("start", 0))
        s_e = float(seg.get("end", 0))
        # If segment start is near our start, align to it
        if abs(s_s - start) <= 3.5:
            snapped_start = s_s
            break
        # If words with timestamps are available, find word after a punctuation mark
        words = seg.get("words") or []
        for i, w in enumerate(words):
            w_start = float(w.get("start", 0))
            if abs(w_start - start) <= 2.5:
                # If previous word ended with a terminator or this word is capitalized
                prev_text = words[i - 1].get("word", "") if i > 0 else "."
                if any(c in prev_text for c in SENTENCE_TERMINATORS) or w.get("word", "")[:1].isupper():
                    snapped_start = w_start
                    break

    # 2. Snap end: look for sentence ending punctuation within 4.5s of end
    for seg in reversed(segments):
        s_s = float(seg.get("start", 0))
        s_e = float(seg.get("end", 0))
        text = (seg.get("text") or "").strip()
        if any(c in text for c in SENTENCE_TERMINATORS) and abs(s_e - end) <= 4.5:
            candidate_dur = s_e - snapped_start
            if min_dur <= candidate_dur <= max_dur:
                snapped_end = s_e
                break

    # Guard bounds
    snapped_start = max(0.0, snapped_start)
    snapped_end = min(video_duration, snapped_end)
    if snapped_end - snapped_start < min_dur:
        snapped_end = min(video_duration, snapped_start + min_dur)
    if snapped_end - snapped_start > max_dur:
        snapped_end = snapped_start + max_dur

    return snapped_start, snapped_end


def rank_candidates(
    candidates: List[Dict],
    llm_response: Optional[List[Dict]],
    video_duration: float,
    transcript: Optional[Dict] = None,
) -> List[Dict]:
    """Combine hook candidates with the LLM's selection into final clips.

    Args:
        candidates: Hook candidates from stage 3.
        llm_response: Parsed output from `icl.parse_response`, or None
            if the LLM call failed.
        video_duration: Source video duration, for bounds checking.

    Returns:
        List of final clip dicts in the renderer input format:
          {start, end, hook_score, edit_reason, suggested_caption,
           suggested_hashtags}
    """
    if not candidates:
        return []

    if not llm_response:
        log.warning("No LLM response — falling back to top-N hook candidates")
        return _fallback_selection(candidates, video_duration)

    # Map LLM's moment_index (new) OR candidate_index (legacy) to actual
    # candidate. We accept both because parse_moment_response emits
    # `moment_index` while the older parse_response emitted `candidate_index`.
    final = []
    used_starts: list = []
    for sel in llm_response:
        # Normalize field names — accept both the new (moment_index / reason
        # / caption / hashtags) and legacy (candidate_index / edit_reason /
        # suggested_caption / suggested_hashtags) keys.
        idx_raw = sel.get("moment_index", sel.get("candidate_index"))
        if idx_raw is None:
            log.warning(f"LLM pick missing index field, skipping: {sel}")
            continue
        try:
            idx = int(idx_raw) - 1  # 1-indexed in both schemas
        except (TypeError, ValueError):
            log.warning(f"LLM pick has non-integer index {idx_raw!r}, skipping")
            continue
        if idx < 0 or idx >= len(candidates):
            log.warning(f"LLM referenced out-of-range candidate {idx+1}, skipping")
            continue
        cand = candidates[idx]

        # NOTE: The LLM is the final word on what makes a good clip. It can
        # pick a low-energy valley moment for narrative reasons. The quality
        # floor only applies to the energy-peak fallback path (below).
        # We do enforce duration bounds, dedup, and the video-duration cap.

        # If sel contains direct narrative start/end timestamps, honor them
        if "start" in sel and "end" in sel and float(sel["end"]) > float(sel["start"]):
            start = max(0.0, float(sel["start"]))
            end = min(video_duration, float(sel["end"]))
        else:
            # Apply trim offsets (new: trim_start/trim_end, legacy: trim_start_offset)
            start = max(0.0, cand["start"] + sel.get("trim_start", sel.get("trim_start_offset", 0)))
            end = min(video_duration, cand["end"] + sel.get("trim_end", sel.get("trim_end_offset", 0)))

        # Snap to clean sentence boundaries if transcript is present
        cand_tr = transcript or cand.get("transcript")
        if cand_tr:
            start, end = snap_to_sentence_boundary(start, end, cand_tr, video_duration)

        # Enforce duration window
        if end - start < CLIP_DURATION_MIN:
            end = min(video_duration, start + CLIP_DURATION_MIN)
        if end - start > CLIP_DURATION_MAX:
            end = start + CLIP_DURATION_MAX

        # Dedupe (within 1s of an already-selected clip)
        if any(abs(start - s) < 1.0 for s in used_starts):
            continue
        used_starts.append(start)

        # Normalize the text fields — accept either the new (caption / hashtags
        # / reason) or the legacy (suggested_caption / suggested_hashtags /
        # edit_reason) names.
        caption = sel.get("caption", sel.get("suggested_caption", "")) or ""
        hashtags = sel.get("hashtags", sel.get("suggested_hashtags", "")) or ""
        edit_reason = sel.get("reason", sel.get("edit_reason", "")) or ""

        final.append({
            "start": round(start, 3),
            "end": round(end, 3),
            "hook_score": cand.get("hook_score", 0),
            "edit_reason": edit_reason,
            "caption": caption,
            "hashtags": hashtags,
            "viral_title": sel.get("viral_title", "") or _default_viral_title(edit_reason),
        })

    if not final:
        log.warning("LLM response was empty after filtering — falling back")
        return _fallback_selection(candidates, video_duration, transcript=transcript)

    return final


def _fallback_selection(
    candidates: List[Dict],
    video_duration: float,
    transcript: Optional[Dict] = None,
) -> List[Dict]:
    """If LLM is unavailable, pick the top 3 hook candidates that meet
    the quality floor. Better than nothing; not as good as taste-aware."""
    qualified = [c for c in candidates if c.get("hook_score", 0) >= QUALITY_FLOOR]
    if not qualified:
        # If nothing meets the floor, just take top 3 (the whole point is we
        # still ship something rather than nothing).
        qualified = candidates[:3]

    final = []
    for cand in qualified[:3]:
        start = max(0.0, cand["start"])
        end = min(video_duration, start + 35.0)  # default 35s natural clip
        cand_tr = transcript or cand.get("transcript")
        if cand_tr:
            start, end = snap_to_sentence_boundary(start, end, cand_tr, video_duration)
        if end - start < CLIP_DURATION_MIN:
            end = min(video_duration, start + CLIP_DURATION_MIN)
        if end - start > CLIP_DURATION_MAX:
            end = start + CLIP_DURATION_MAX
        final.append({
            "start": round(start, 3),
            "end": round(end, 3),
            "hook_score": cand.get("hook_score", 0),
            "edit_reason": f"Fallback: top hook (score {cand.get('hook_score', 0):.2f})",
            "caption": "Highlight from the video",
            "hashtags": "#shorts #viral",
            "viral_title": "TOP MOMENT",
        })
    return final


def _default_viral_title(edit_reason: str) -> str:
    """Generate a fallback viral title when the LLM doesn't provide one.

    Pulls 2-4 strong words from the edit_reason. ALL CAPS, stop-scrolling tone.
    """
    import re
    # Words worth capitalizing (skip stopwords)
    stop = {"this", "that", "with", "from", "have", "will", "your", "they", "them", "what", "when", "make", "like", "into", "over", "just", "than", "then", "best", "good", "most", "very", "back", "work", "well"}
    words = re.findall(r"\b[A-Za-z]{3,}\b", edit_reason or "")
    picks = [w for w in words if w.lower() not in stop][:3]
    return " ".join(p.upper() for p in picks) if picks else "WATCH THIS"
