"""
In-context-learning prompt builder for the taste selector.

The whole point: improve clip selection WITHOUT retraining. We feed the
LLM a richer and richer prompt over time as the creator's history grows.

Prompt structure (assembled by `build_prompt`):
  1. System: "You are a taste-aware short-form video editor. Pick the
     2-5 clips most likely to perform for THIS creator. Use only
     edit commands — never touch video bytes."
  2. Creator context: niche, audience demographics, recent clip
     performance (from CreatorHistory).
  3. This video: title, duration, hook candidates (with hook_score
     components, NOT just the score).
  4. Few-shot examples: 2-3 prior (hook → final cut) examples from
     the same creator. THIS is the ICL signal.
  5. Output schema: JSON list of {start, end, edit_reason, hook_score,
     suggested_caption, suggested_hashtags}.

The few-shot examples are the ICL "weight updates" — they teach the
model the creator's taste without retraining. As CreatorHistory grows,
this section gets richer. As it shrinks (new creator), the system
falls back to niche-level defaults from `niche_defaults.py`.
"""
from typing import List, Dict, Optional
from dataclasses import dataclass
from datetime import datetime


@dataclass
class CreatorClipHistory:
    """One clip that the creator previously published via RelatiV."""
    clip_id: str
    video_title: str
    hook_start: float
    hook_end: float
    edit_reason: str
    published_at: datetime
    # Engagement metrics, if available. Optional — older entries may not have these.
    views: Optional[int] = None
    likes: Optional[int] = None
    retention_pct: Optional[float] = None


@dataclass
class HookCandidate:
    """One hook candidate from stage 3 (hooks.py).

    Optional surgery fields (`surgical_padding_s`, `source_start`, `source_end`,
    `source_url`) are populated when stage 4 (surgical download) ran. They
    tell Claude exactly what we're about to do to the video, so it can pick
    candidates that will still make sense after the cut.
    """
    start: float  # where the hook begins in the SOURCE video
    end: float    # where the hook ends in the SOURCE video
    hook_score: float
    components: Dict[str, float]
    reason: str
    # Surgery context (optional, populated by stage 4)
    surgical_padding_s: float = 0.0
    source_start: Optional[float] = None
    source_end: Optional[float] = None
    source_url: Optional[str] = None


def build_prompt(
    creator_history: List[CreatorClipHistory],
    hook_candidates: List[HookCandidate],
    video_meta: Dict,
    niche: str = "general",
    max_examples: int = 3,
) -> str:
    """Build the full prompt to send to the LLM.

    Args:
        creator_history: Recent clips for this creator (newest first).
            Empty list is fine — system falls back to niche defaults.
        hook_candidates: Today's candidates from stage 3.
        video_meta: {title, duration, source, language, ...}
        niche: Creator's niche — used for niche-level defaults.
        max_examples: Cap on few-shot examples to keep prompt size sane.

    Returns:
        The complete prompt string. Caller is responsible for sending it
        to the LLM (any provider).
    """
    parts = []

    # 1. System
    parts.append(
        "You are a taste-aware short-form video editor. Your job: pick the "
        "2-5 clips from the candidate list below that are most likely to "
        "perform well for THIS creator on THIS platform.\n\n"
        "You produce EDIT COMMANDS only — start/end timestamps and metadata. "
        "You never touch video bytes; the renderer does that.\n"
        "Quality floor: if a candidate has hook_score < 0.7, only include "
        "it if the lexical context (e.g. it's a callback to a viral "
        "prior clip) justifies it. Better to ship 2 bangers than 5 maybes."
    )

    # 2. Creator context
    if creator_history:
        recent = creator_history[:5]
        history_lines = [
            f"  - {c.video_title} (views={c.views or '?'}, "
            f"retention={c.retention_pct or '?'}%): {c.edit_reason}"
            for c in recent
        ]
        parts.append(
            "\n\nRecent clips for this creator:\n"
            + "\n".join(history_lines)
        )
    else:
        parts.append(
            f"\n\nThis is a new creator. Use niche-level defaults for '{niche}'."
        )

    # 3. This video
    parts.append(
        f"\n\nCurrent video: {video_meta.get('title', '(no title)')}\n"
        f"Duration: {video_meta.get('duration', 0):.1f}s\n"
        f"Source: {video_meta.get('source', 'unknown')}\n"
        f"Language: {video_meta.get('language', 'en')}\n"
    )

    # 4. Few-shot examples (THE ICL SIGNAL)
    if creator_history:
        examples = creator_history[:max_examples]
        example_lines = [
            f"  Input: hook at {c.hook_start:.1f}s-{c.hook_end:.1f}s ({c.video_title})\n"
            f"  Output: clip {c.hook_start:.1f}s-{c.hook_end:.1f}s — {c.edit_reason}\n"
            f"  Result: views={c.views or '?'}, retention={c.retention_pct or '?'}%"
            for c in examples
        ]
        parts.append(
            "\n\nExamples of THIS creator's past hook→clip decisions:\n"
            + "\n\n".join(example_lines)
            + "\n\nMatch this creator's judgment in your output."
        )

    # 5. Candidates (input)
    cand_lines = []
    for i, c in enumerate(hook_candidates):
        line = (
            f"  [{i+1}] t={c.start:.1f}s-{c.end:.1f}s, hook_score={c.hook_score:.2f} "
            f"(energy={c.components.get('energy', 0):.2f}, "
            f"lexical={c.components.get('lexical', 0):.2f}) — {c.reason}"
        )
        # Surface surgery context if available — Claude uses it to avoid picks
        # that will look broken after the cut
        if c.surgical_padding_s:
            line += f" [surgery: ±{c.surgical_padding_s:.1f}s padding]"
        if c.source_start is not None and c.source_end is not None:
            line += f" [will cut source t={c.source_start:.1f}s-{c.source_end:.1f}s]"
        cand_lines.append(line)
    parts.append(
        "\n\nHook candidates (in score order):\n"
        + "\n".join(cand_lines)
    )

    # 6. Output schema
    parts.append(
        '\n\nRespond with a JSON array of clip selections. Each element:\n'
        '  {\n'
        '    "candidate_index": <1-based index from above>,\n'
        '    "trim_start_offset": <seconds to trim from start, can be negative for padding>,\n'
        '    "trim_end_offset": <seconds to trim from end>,\n'
        '    "edit_reason": "<one-sentence why this clip works for this creator>",\n'
        '    "suggested_caption": "<max 200 chars, hooky>",\n'
        '    "suggested_hashtags": "<space-separated, max 5>",\n'
        '    "viral_title": "<3-6 word title, ALL CAPS, stop-scrolling — e.g. THE SECRET NOBODY TELLS YOU>"\n'
        '  }\n\n'
        'Return 2-5 selections, ranked by predicted performance. Pure JSON, no prose.'
    )

    return "".join(parts)


def parse_response(llm_output: str) -> List[Dict]:
    """Parse the LLM's JSON response into validated clip edits.

    Defensive: tolerates ```json fences, leading/trailing prose,
    and missing optional fields. Raises ValueError on truly malformed
    input (caller should retry with a different provider or fall back
    to heuristic selection).
    """
    import json
    import re

    # Strip code fences
    text = re.sub(r"^```(?:json)?\s*", "", llm_output.strip())
    text = re.sub(r"\s*```$", "", text)

    # Find the JSON array
    match = re.search(r"\[\s*\{.*\}\s*\]", text, re.DOTALL)
    if not match:
        raise ValueError("LLM response contains no JSON array")
    text = match.group(0)

    data = json.loads(text)
    if not isinstance(data, list):
        raise ValueError("LLM response is not a JSON array")

    # Validate each entry
    valid = []
    for i, item in enumerate(data):
        if not isinstance(item, dict):
            continue
        if "candidate_index" not in item:
            continue
        valid.append({
            "candidate_index": int(item["candidate_index"]),
            "trim_start_offset": float(item.get("trim_start_offset", 0)),
            "trim_end_offset": float(item.get("trim_end_offset", 0)),
            "edit_reason": str(item.get("edit_reason", ""))[:500],
            "suggested_caption": str(item.get("suggested_caption", ""))[:200],
            "suggested_hashtags": str(item.get("suggested_hashtags", ""))[:200],
            "viral_title": str(item.get("viral_title", ""))[:100],
            })
    return valid
