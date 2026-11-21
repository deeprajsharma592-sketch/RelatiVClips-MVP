"""
Deterministic boundary refinement after LLM candidate discovery.
1. Snap start/end to nearest narrative unit boundaries within 4s.
2. Reject dangling references at the start unless setup is provided via callbacks.
3. Reject mid-thought endings (conjunctions, trailing commas/ellipses).
4. Trim dead air: cuts leading or trailing silence beyond 0.4s.
"""
from typing import List, Dict, Any, Optional, Tuple
import re
from .units import NarrativeUnit
from ..utils.config import DEAD_AIR_MAX_S

# Phrases that indicate the opening sentence depends on previous missing context
DANGLING_START_PATTERNS = [
    r"^(and\s+so|that\'s\s+why|he\s+said|she\s+said|they\s+said|like\s+i\s+said|as\s+i\s+said)\b",
    r"^(and\s+then|so\s+then|but\s+then|which\s+is\s+why|this\s+is\s+why|because\s+of\s+that)\b",
    r"^(furthermore|moreover|consequently|in\s+addition|on\s+top\s+of\s+that)\b",
    r"^(he|she|they|it)\s+(was|were|had|is|are|did|said)\b",  # Pronouns without established subject
]

# Words/tokens that indicate the speaker was cut off mid-thought
MID_THOUGHT_END_PATTERNS = [
    r"\b(and|but|or|so|because|although|though|while|since|if|then|when|where|as|with|that)\s*[\.,?!]?$",
    r"[,;:\-—]\s*$",  # Ends on trailing comma/dash
    r"\.{2,}\s*$",    # Ends on trailing ellipsis (speaker trailed off)
]


def check_dangling_reference(text: str, has_callbacks: bool = False) -> Tuple[bool, Optional[str]]:
    """
    Returns (is_dangling, reason).
    If has_callbacks is True, an earlier setup snippet resolves the antecedent.
    """
    if has_callbacks:
        return False, None

    cleaned = text.strip().lower()
    for pattern in DANGLING_START_PATTERNS:
        if re.search(pattern, cleaned):
            return True, f"Dangling reference at start: matches pattern '{pattern}'"

    return False, None


def check_mid_thought_end(text: str) -> Tuple[bool, Optional[str]]:
    """
    Returns (is_mid_thought, reason).
    Checks if the last sentence ends on a conjunction or trailing clause.
    """
    cleaned = text.strip().lower()
    for pattern in MID_THOUGHT_END_PATTERNS:
        if re.search(pattern, cleaned):
            return True, f"Mid-thought cut at end: matches pattern '{pattern}'"

    return False, None


def snap_to_narrative_units(
    raw_start: float,
    raw_end: float,
    units: List[NarrativeUnit],
    max_search_window_s: float = 4.0,
) -> Tuple[float, float, List[NarrativeUnit]]:
    """
    Snap start to the nearest unit start at or before raw_start (within 4s).
    Snap end to the nearest unit end at or after raw_end (within 4s).
    Returns (snapped_start, snapped_end, included_units).
    """
    if not units:
        return raw_start, raw_end, []

    # 1. Snap start: look for unit start <= raw_start (prefer at or before within 4s)
    best_start = raw_start
    best_start_diff = float("inf")

    for u in units:
        diff = raw_start - u.start
        # Prefer at or before (diff >= 0)
        if 0.0 <= diff <= max_search_window_s:
            if diff < best_start_diff:
                best_start_diff = diff
                best_start = u.start
        # If none found at or before, allow slightly after (diff < 0) within 1.5s
        elif diff < 0 and abs(diff) <= 1.5:
            if abs(diff) < best_start_diff:
                best_start_diff = abs(diff)
                best_start = u.start

    # 2. Snap end: look for unit end >= raw_end (prefer at or after within 4s)
    best_end = raw_end
    best_end_diff = float("inf")

    for u in units:
        diff = u.end - raw_end
        # Prefer at or after (diff >= 0)
        if 0.0 <= diff <= max_search_window_s:
            if diff < best_end_diff:
                best_end_diff = diff
                best_end = u.end
        # If none found at or after, allow slightly before within 1.5s
        elif diff < 0 and abs(diff) <= 1.5:
            if abs(diff) < best_end_diff:
                best_end_diff = abs(diff)
                best_end = u.end

    if best_end <= best_start:
        best_end = best_start + 15.0

    included_units = [u for u in units if (u.end > best_start and u.start < best_end)]
    return best_start, best_end, included_units


def trim_dead_air(
    start: float,
    end: float,
    units: List[NarrativeUnit],
    max_dead_air_s: float = DEAD_AIR_MAX_S,
) -> Tuple[float, float]:
    """
    Cut leading or trailing silence beyond max_dead_air_s (0.4s).
    Ensures the audio doesn't start or end with dead air.
    """
    if not units:
        return start, end

    first_unit = units[0]
    last_unit = units[-1]

    # If start is more than 0.4s before the first spoken syllable, clamp it
    if (first_unit.start - start) > max_dead_air_s:
        start = first_unit.start - max_dead_air_s

    # If end is more than 0.4s after the last spoken syllable, clamp it
    if (end - last_unit.end) > max_dead_air_s:
        end = last_unit.end + max_dead_air_s

    return max(0.0, start), max(start + 1.0, end)


def ensure_payoff_included(
    start: float,
    end: float,
    payoff_text: Optional[str],
    units: List[NarrativeUnit],
    max_duration_s: float = 150.0,
) -> float:
    """
    If the LLM specified a payoff_text that occurs after the initial candidate 'end',
    extend 'end' so the full narrative payoff is captured (up to max_duration_s).
    Prevents interview/story clips from cutting off right after the question before the answer.
    """
    if not payoff_text or not units:
        return end

    clean_payoff = re.sub(r"[^\w\s]", "", str(payoff_text).lower()).strip()
    payoff_words = [w for w in clean_payoff.split() if len(w) > 3]
    if len(payoff_words) < 2:
        return end

    best_matching_unit_end = None
    for u in units:
        if u.start < start or (u.end - start) > max_duration_s:
            continue
        u_clean = re.sub(r"[^\w\s]", "", u.text.lower())
        u_words = set(u_clean.split())
        match_count = sum(1 for w in payoff_words if w in u_words)
        if match_count >= min(3, len(payoff_words)):
            best_matching_unit_end = u.end

    if best_matching_unit_end and best_matching_unit_end > end:
        return best_matching_unit_end

    return end


def refine_clip_candidate(
    candidate: Dict[str, Any],
    units: List[NarrativeUnit],
) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """
    Runs complete boundary refinement pipeline on a candidate from LLM:
    1. Ensure payoff is included (auto-extend if LLM gave question-end as clip-end).
    2. Snap to narrative units.
    3. Check dangling references.
    4. Check mid-thought ending.
    5. Trim dead air.
    Returns (refined_candidate_dict, rejection_reason).
    """
    raw_start = float(candidate.get("start", 0.0))
    raw_end = float(candidate.get("end", 0.0))

    if raw_end <= raw_start:
        return None, "Candidate end timestamp is before or equal to start timestamp"

    # Auto-extend if candidate declared a payoff_text that lands later in the narrative
    payoff_text = candidate.get("payoff_text")
    if payoff_text:
        raw_end = ensure_payoff_included(raw_start, raw_end, payoff_text, units)

    # Snap boundaries
    snapped_start, snapped_end, included_units = snap_to_narrative_units(raw_start, raw_end, units)
    if not included_units:
        return None, "No narrative units covered in candidate window"

    # Full text of the candidate
    combined_text = " ".join(u.text for u in included_units).strip()
    first_sentence = included_units[0].text
    last_sentence = included_units[-1].text

    has_callbacks = bool(candidate.get("callbacks") and len(candidate["callbacks"]) > 0)

    # Check dangling reference
    is_dangling, dangling_reason = check_dangling_reference(first_sentence, has_callbacks=has_callbacks)
    if is_dangling:
        return None, f"Rejected: {dangling_reason}"

    # Check mid-thought end
    is_mid_thought, mid_thought_reason = check_mid_thought_end(last_sentence)
    if is_mid_thought:
        return None, f"Rejected: {mid_thought_reason}"

    # Trim dead air
    clean_start, clean_end = trim_dead_air(snapped_start, snapped_end, included_units)

    refined = dict(candidate)
    refined["start"] = round(clean_start, 2)
    refined["end"] = round(clean_end, 2)
    refined["duration_s"] = round(clean_end - clean_start, 2)
    refined["snapped_text"] = combined_text
    refined["included_units_count"] = len(included_units)

    return refined, None
