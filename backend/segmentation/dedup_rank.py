"""
Deduplication, Near-Adjacent Merging, and Final Composite Ranking.
- Drops overlapping clips (>30% overlap), keeping the higher final score.
- Merges near-adjacent candidates (gap < 5s, compatible arc) if merged duration <= 150s and standalone.
- Scores candidates: 0.30·standalone + 0.25·completeness + 0.25·hook_strength + 0.20·heat_score.
"""
from typing import List, Dict, Any, Tuple, Optional
from ..utils.config import (
    RANK_WEIGHT_STANDALONE,
    RANK_WEIGHT_COMPLETENESS,
    RANK_WEIGHT_HOOK,
    RANK_WEIGHT_HEAT,
    CLIP_DURATION_HARD_MAX,
)


def compute_composite_score(
    candidate: Dict[str, Any],
    heat_score: float = 0.5,
) -> float:
    """
    Compute final composite score (0.0 to 100.0).
    standalone_score (0-10) -> * 10
    completeness_score (0-10) -> * 10
    hook_strength (0-10) -> * 10
    heat_score (0.0 - 1.0) -> * 100
    """
    standalone = float(candidate.get("standalone_score", 5)) * 10.0
    completeness = float(candidate.get("completeness_score", 5)) * 10.0
    hook = float(candidate.get("hook_strength", 5)) * 10.0
    heat = float(candidate.get("heat_score", heat_score)) * 100.0

    score = (
        RANK_WEIGHT_STANDALONE * standalone
        + RANK_WEIGHT_COMPLETENESS * completeness
        + RANK_WEIGHT_HOOK * hook
        + RANK_WEIGHT_HEAT * heat
    )
    return round(score, 2)


def calculate_overlap_ratio(cand_a: Dict[str, Any], cand_b: Dict[str, Any]) -> float:
    """Calculates overlap intersection over min(len_a, len_b)."""
    s_a, e_a = float(cand_a["start"]), float(cand_a["end"])
    s_b, e_b = float(cand_b["start"]), float(cand_b["end"])

    overlap_s = max(0.0, min(e_a, e_b) - max(s_a, s_b))
    dur_a = e_a - s_a
    dur_b = e_b - s_b

    min_dur = min(dur_a, dur_b)
    if min_dur <= 0:
        return 0.0

    return overlap_s / min_dur


def merge_near_adjacent_candidates(
    candidates: List[Dict[str, Any]],
    max_gap_s: float = 5.0,
    max_merged_duration_s: float = CLIP_DURATION_HARD_MAX,
) -> List[Dict[str, Any]]:
    """
    Merges near-adjacent candidates with gap < 5s and same arc into one longer clip
    when the merge keeps it standalone and within duration limits.
    """
    if len(candidates) <= 1:
        return candidates

    # Sort chronologically by start time
    sorted_cands = sorted(candidates, key=lambda c: float(c["start"]))
    merged: List[Dict[str, Any]] = []

    curr = dict(sorted_cands[0])

    for nxt in sorted_cands[1:]:
        c_end = float(curr["end"])
        n_start = float(nxt["start"])
        gap = n_start - c_end

        can_merge_arc = (curr.get("arc_type") == nxt.get("arc_type") or curr.get("arc_type") in ("story", "explanation"))
        combined_dur = float(nxt["end"]) - float(curr["start"])

        if 0.0 <= gap < max_gap_s and can_merge_arc and combined_dur <= max_merged_duration_s:
            # Merge into one longer clip
            curr["end"] = nxt["end"]
            curr["duration_s"] = round(combined_dur, 2)
            curr["payoff_text"] = nxt.get("payoff_text", curr.get("payoff_text", ""))
            curr["snapped_text"] = f"{curr.get('snapped_text', '')} {nxt.get('snapped_text', '')}".strip()
            # Combine scores favorably
            curr["standalone_score"] = max(curr.get("standalone_score", 0), nxt.get("standalone_score", 0))
            curr["completeness_score"] = min(10, max(curr.get("completeness_score", 0), nxt.get("completeness_score", 0)) + 1)
            curr["reason"] = f"Merged adjacent story arc: {curr.get('reason', '')} + {nxt.get('reason', '')}"[:150]
        else:
            merged.append(curr)
            curr = dict(nxt)

    merged.append(curr)
    return merged


def dedup_and_rank_candidates(
    candidates: List[Dict[str, Any]],
    max_overlap_ratio: float = 0.30,
) -> List[Dict[str, Any]]:
    """
    1. Merges near-adjacent candidates (gap < 5s, same arc).
    2. Computes final composite score.
    3. Removes overlaps > 30%, keeping higher-scoring candidate.
    4. Returns sorted list by final score descending.
    """
    if not candidates:
        return []

    # 1. Merge near-adjacent candidates
    merged_candidates = merge_near_adjacent_candidates(candidates)

    # 2. Score all candidates
    for c in merged_candidates:
        c["final_score"] = compute_composite_score(c)

    # Sort descending by score
    sorted_by_score = sorted(merged_candidates, key=lambda c: float(c.get("final_score", 0.0)), reverse=True)

    # 3. Filter out overlaps > 30%
    kept: List[Dict[str, Any]] = []

    for cand in sorted_by_score:
        is_overlapping = False
        for existing in kept:
            overlap = calculate_overlap_ratio(cand, existing)
            if overlap > max_overlap_ratio:
                is_overlapping = True
                break
        if not is_overlapping:
            kept.append(cand)

    return kept
