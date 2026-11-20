"""
Pre-render Check Pass.
Runs a verification pass on each finalized clip before rendering.
Validates:
- verdict: 'pass' | 'fail'
- issues: ['cut_mid_context', 'weak_hook', 'no_payoff', 'needs_setup', 'too_long_for_content']
- suggested_start / suggested_end
If failed with suggested bounds, re-snaps once and re-checks (max 1 retry, then drops).
Never renders a failed clip.
"""
from typing import List, Dict, Any, Optional, Tuple, Callable
import json
import re

from .units import NarrativeUnit
from .refinement import snap_to_narrative_units, check_dangling_reference, check_mid_thought_end
from ..utils.config import CLIP_DURATION_HARD_MIN, CLIP_DURATION_HARD_MAX


CHECK_PASS_SYSTEM_PROMPT = """You are a viral short-form video editor doing quality control on a proposed video clip.
Analyze the clip's transcript, hook, payoff, and duration.
Determine if the clip is a complete, self-contained micro-story (hook -> setup -> payoff).

Reject if:
- cut_mid_context: begins in the middle of an explanation or action with missing subject.
- weak_hook: first 3 seconds are filler, greeting, or unintelligible.
- no_payoff: cuts off before the punchline, answer, conclusion, or reaction lands.
- needs_setup: makes no sense without more than 15s of prior context.
- too_long_for_content: drags on with redundant rambling.

Respond ONLY with valid JSON in this exact format:
{
  "verdict": "pass" | "fail",
  "issues": [],
  "suggested_start": null,
  "suggested_end": null
}
If verdict is "fail" but can be saved by adjusting boundaries slightly, provide numeric suggested_start and/or suggested_end in seconds.
"""


def _heuristic_check(
    candidate: Dict[str, Any],
) -> Dict[str, Any]:
    """Fast programmatic fallback when LLM is unavailable or offline."""
    text = candidate.get("snapped_text", candidate.get("snippet", candidate.get("reason", ""))).strip()
    words = text.split()
    duration = float(candidate.get("duration_s", float(candidate.get("end", 0)) - float(candidate.get("start", 0))))

    issues = []
    has_callbacks = bool(candidate.get("callbacks") and len(candidate["callbacks"]) > 0)

    # 1. Check dangling reference at start
    is_dangling, _ = check_dangling_reference(text, has_callbacks=has_callbacks)
    if is_dangling:
        issues.append("needs_setup")

    # 2. Check mid-thought cut at end
    is_mid_cut, _ = check_mid_thought_end(text)
    if is_mid_cut:
        issues.append("no_payoff")

    # 3. Check duration & word density
    if duration < CLIP_DURATION_HARD_MIN or len(words) < 8:
        issues.append("weak_hook")
    elif duration > CLIP_DURATION_HARD_MAX:
        issues.append("too_long_for_content")

    # 4. Check hook text presence
    hook_text = str(candidate.get("hook_text", "")).strip()
    if not hook_text and len(words) < 15:
        issues.append("weak_hook")

    verdict = "pass" if not issues else "fail"
    return {
        "verdict": verdict,
        "issues": issues,
        "suggested_start": None,
        "suggested_end": None,
    }


def run_clip_check_pass(
    candidate: Dict[str, Any],
    units: List[NarrativeUnit],
    llm_callable: Optional[Callable[[str], str]] = None,
) -> Tuple[bool, Dict[str, Any]]:
    """
    Runs the check pass on a candidate clip.
    If fails with suggested bounds, attempts 1 re-snap and re-check.
    Returns (passed: bool, final_candidate_dict_or_check_result).
    """
    text = candidate.get("snapped_text") or candidate.get("snippet") or candidate.get("reason") or ""
    start = float(candidate.get("start", 0.0))
    end = float(candidate.get("end", 0.0))
    dur = float(candidate.get("duration_s", end - start))
    hook = candidate.get("hook_text", "")
    payoff = candidate.get("payoff_text", "")

    check_result = None

    if llm_callable:
        prompt = (
            f"{CHECK_PASS_SYSTEM_PROMPT}\n\n"
            f"CLIP TO CHECK:\n"
            f"- Start: {start:.2f}s\n"
            f"- End: {end:.2f}s\n"
            f"- Duration: {dur:.1f}s\n"
            f"- Stated Hook: {hook!r}\n"
            f"- Stated Payoff: {payoff!r}\n"
            f"- Transcript:\n{text}\n"
        )
        try:
            raw_resp = llm_callable(prompt)
            # Extract JSON
            match = re.search(r"\{.*\}", raw_resp, re.DOTALL)
            if match:
                check_result = json.loads(match.group(0))
        except Exception:
            check_result = None

    if not check_result or "verdict" not in check_result:
        check_result = _heuristic_check(candidate)

    if check_result.get("verdict") == "pass":
        candidate["check_pass"] = check_result
        return True, candidate

    # If failed, check if suggested bounds can save it (1 retry)
    s_start = check_result.get("suggested_start")
    s_end = check_result.get("suggested_end")

    if (s_start is not None or s_end is not None) and units:
        new_start = float(s_start) if s_start is not None else start
        new_end = float(s_end) if s_end is not None else end

        if new_end > new_start and (new_end - new_start) >= CLIP_DURATION_HARD_MIN:
            from .refinement import refine_clip_candidate
            retry_candidate = dict(candidate)
            retry_candidate["start"] = new_start
            retry_candidate["end"] = new_end
            refined_retry, _ = refine_clip_candidate(retry_candidate, units)

            if refined_retry:
                second_check = _heuristic_check(refined_retry)
                if second_check.get("verdict") == "pass":
                    refined_retry["check_pass"] = second_check
                    refined_retry["check_pass_resnapped"] = True
                    return True, refined_retry

    candidate["check_pass"] = check_result
    return False, candidate
