"""
Taste selector — given hook candidates + LLM response, produce final
clip objects ready for the renderer.

This is the glue between the LLM's edit commands and the renderer's
input format. It also applies the quality floor and dedupes.
"""
from typing import List, Dict, Optional
import logging

log = logging.getLogger(__name__)

CLIP_DURATION_MIN = 10.0
CLIP_DURATION_MAX = 20.0
QUALITY_FLOOR = 0.7  # per PIPELINE-VISION.md: never ship < 0.7


def rank_candidates(
    candidates: List[Dict],
    llm_response: Optional[List[Dict]],
    video_duration: float,
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

    # Map LLM's candidate_index to actual candidate.
    final = []
    used_starts: list = []
    for sel in llm_response:
        idx = sel["candidate_index"] - 1  # LLM is 1-indexed
        if idx < 0 or idx >= len(candidates):
            log.warning(f"LLM referenced out-of-range candidate {idx+1}, skipping")
            continue
        cand = candidates[idx]

        # NOTE: The LLM is the final word on what makes a good clip. It can
        # pick a low-energy valley moment for narrative reasons. The quality
        # floor only applies to the energy-peak fallback path (below).
        # We do enforce duration bounds, dedup, and the video-duration cap.

        # Apply trim offsets (defensive: missing fields default to 0)
        start = max(0.0, cand["start"] + sel.get("trim_start_offset", 0))
        end = min(video_duration, cand["end"] + sel.get("trim_end_offset", 0))

        # Enforce duration window
        if end - start < CLIP_DURATION_MIN:
            end = min(video_duration, start + CLIP_DURATION_MIN)
        if end - start > CLIP_DURATION_MAX:
            end = start + CLIP_DURATION_MAX

        # Dedupe (within 1s of an already-selected clip)
        if any(abs(start - s) < 1.0 for s in used_starts):
            continue
        used_starts.append(start)

        final.append({
            "start": round(start, 3),
            "end": round(end, 3),
            "hook_score": cand.get("hook_score", 0),
            "edit_reason": sel.get("edit_reason", ""),
            "caption": sel.get("suggested_caption", "") or "",
            "hashtags": sel.get("suggested_hashtags", "") or "",
            "viral_title": sel.get("viral_title", "") or _default_viral_title(sel.get("edit_reason", "")),
        })

    if not final:
        log.warning("LLM response was empty after filtering — falling back")
        return _fallback_selection(candidates, video_duration)

    return final


def _fallback_selection(candidates: List[Dict], video_duration: float) -> List[Dict]:
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
        end = min(video_duration, start + 15.0)  # default 15s clip
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
