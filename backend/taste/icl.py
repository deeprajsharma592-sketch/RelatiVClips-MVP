"""
In-context-learning prompt builder for the taste selector.

Pipeline v3 (this file):
  - Input is a list of "Moment" objects (NOT hook candidates, NOT full transcript).
  - Each moment has start, end, signal_type (peak/valley/density/silence),
    snippet (8-20 words of context), and a story_position (0.0-1.0).
  - Output is strict JSON: list of {moment_index, trim_start, trim_end,
    viral_title, caption, hashtags, reason}.
  - max_tokens is 512 (down from 2048) — saves ~75% on LLM output cost.

Why moments instead of full transcript:
  - Token cost: 15 moments × ~50 tokens = ~750 tokens, vs full transcript
    at ~50 segments × ~30 tokens = ~1500 tokens. Half the input.
  - Quality: the LLM picks based on STORY ARC (signal type + position) not
    on transcript content. This is intentional — the user wants hooks
    driven by CONTRAST (valley → peak) not by topic relevance.
  - Cost: 0.5× input + 0.25× output = 0.3× total LLM cost per call.

Strict JSON only. No prose, no markdown, no explanation.
"""
from typing import List, Dict, Optional
from dataclasses import dataclass
from datetime import datetime


@dataclass
class Moment:
    """A candidate clip moment (output of moment_detector)."""
    index: int
    start: float
    end: float
    signal_type: str  # "peak" | "valley" | "density" | "silence"
    score: float
    snippet: str = ""
    source: str = ""
    story_position: float = 0.0

    def to_prompt_line(self) -> str:
        dur = self.end - self.start
        snip = (self.snippet[:80] + "…") if len(self.snippet) > 80 else self.snippet
        pos_pct = int(self.story_position * 100)
        return (
            f"[{self.index}] t={self.start:.1f}-{self.end:.1f}s ({dur:.0f}s, "
            f"{self.signal_type}, score={self.score:.2f}, pos={pos_pct}%): {snip!r}"
        )


def build_moment_prompt(
    moments: List[Moment],
    video_meta: Dict,
    max_picks: int = 3,
) -> str:
    """
    Build the strict-JSON ICL prompt for the LLM.

    Output schema (strict):
    ```json
    {
      "picks": [
        {
          "moment_index": <int, 1-based from list below>,
          "trim_start": <float, seconds to trim from start (can be negative)>,
          "trim_end": <float, seconds to trim from end>,
          "viral_title": "<3-6 word title, ALL CAPS, stop-scrolling>",
          "caption": "<max 100 chars, hooky>",
          "hashtags": "<space-separated, max 5>",
          "reason": "<max 80 chars, why this works>"
        }
      ]
    }
    ```
    """
    parts: List[str] = []

    # 1. System — terse, no prose
    parts.append(
        "Pick the 2-5 most viral moments from the list. Prioritize: "
        "(1) contrast (valley→peak, silence→laugh, beat→reveal), "
        "(2) self-contained (works without context), "
        "(3) hook in first 2s. "
        "Output ONLY the JSON object, no prose."
    )

    # 2. Video meta — minimal
    title = video_meta.get("title", "(no title)") or "(no title)"
    title = title[:80]
    dur = float(video_meta.get("duration_s") or video_meta.get("duration") or 0)
    parts.append(
        f"Video: {title!r} ({dur:.0f}s)"
    )

    # 3. Signal legend
    parts.append(
        "Signals: peak=loud, valley=quiet pause, density=fast speech, silence=beat/pause"
    )

    # 4. Moments (the input)
    if not moments:
        parts.append("No candidate moments found — return empty picks array.")
    else:
        cand_lines = [m.to_prompt_line() for m in moments[:20]]
        parts.append(
            f"Candidates ({len(cand_lines)}):\n" + "\n".join(cand_lines)
        )

    # 5. Output schema — strict JSON
    parts.append(
        f"\nReturn JSON: {{\"picks\": [{{\"moment_index\": <int>, "
        f"\"trim_start\": <float, def 0>, \"trim_end\": <float, def 0>, "
        f"\"viral_title\": \"<3-6 words ALL CAPS>\", "
        f"\"caption\": \"<max 100 chars>\", \"hashtags\": \"<max 5 space-sep>\", "
        f"\"reason\": \"<max 80 chars>\"}}, ...]}}. "
        f"Return {max_picks} picks. JSON only, no markdown."
    )

    return "\n".join(parts)


def parse_moment_response(llm_output: str) -> List[Dict]:
    """
    Parse the LLM's strict-JSON moment response into clip edits.

    Returns list of:
      {
        moment_index, trim_start, trim_end, viral_title,
        caption, hashtags, reason, source_start, source_end
      }

    The caller (orchestrator) is responsible for mapping moment_index →
    actual start/end timestamps from the candidate list.
    """
    import json
    import re

    text = (llm_output or "").strip()
    # Strip code fences
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)

    # Try parsing the whole string first
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        # Find a JSON object
        obj_match = re.search(r'\{\s*"picks"\s*:\s*\[', text, re.DOTALL)
        if not obj_match:
            raise ValueError("LLM response contains no 'picks' JSON array")
        start = obj_match.start()
        brace_count = 0
        end_idx = start
        for i in range(start, len(text)):
            if text[i] == "{":
                brace_count += 1
            elif text[i] == "}":
                brace_count -= 1
                if brace_count == 0:
                    end_idx = i + 1
                    break
        text = text[start:end_idx]
        data = json.loads(text)

    if not isinstance(data, dict) or "picks" not in data:
        raise ValueError("LLM response is not a JSON object with 'picks' array")

    valid: List[Dict] = []
    for p in data["picks"]:
        if not isinstance(p, dict):
            continue
        if "moment_index" not in p:
            continue
        valid.append({
            "moment_index": int(p["moment_index"]),
            "trim_start": float(p.get("trim_start", 0)),
            "trim_end": float(p.get("trim_end", 0)),
            "viral_title": str(p.get("viral_title", ""))[:100],
            "caption": str(p.get("caption", ""))[:200],
            "hashtags": str(p.get("hashtags", ""))[:200],
            "reason": str(p.get("reason", ""))[:500],
        })
    return valid


# ---------------------------------------------------------------------------
# Backward-compat: keep the old HookCandidate / build_prompt / parse_response
# signatures intact so existing tests + ICL paths still work.
# ---------------------------------------------------------------------------


@dataclass
class CreatorClipHistory:
    """One clip that the creator previously published via RelatiV."""
    clip_id: str
    video_title: str
    hook_start: float
    hook_end: float
    edit_reason: str
    published_at: datetime
    views: Optional[int] = None
    likes: Optional[int] = None
    retention_pct: Optional[float] = None


@dataclass
class HookCandidate:
    """Legacy hook candidate. New code uses Moment instead."""
    start: float
    end: float
    hook_score: float
    components: Dict[str, float]
    reason: str
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
    """Legacy build_prompt — kept for backward compat with existing tests."""
    # Map HookCandidate → Moment so the new prompt builder handles both paths.
    fake_moments: List[Moment] = []
    for i, c in enumerate(hook_candidates, 1):
        fake_moments.append(Moment(
            index=i,
            start=c.start,
            end=c.end,
            signal_type="peak",
            score=c.hook_score,
            snippet=c.reason,
            source="legacy_hook",
            story_position=0.5,
        ))
    return build_moment_prompt(fake_moments, video_meta, max_picks=5)


def parse_response(llm_output: str) -> List[Dict]:
    """Legacy parse — kept for backward compat. New code uses parse_moment_response."""
    import json
    import re

    text = re.sub(r"^```(?:json)?\s*", "", (llm_output or "").strip())
    text = re.sub(r"\s*```$", "", text)
    match = re.search(r"\[\s*\{.*\}\s*\]", text, re.DOTALL)
    if not match:
        raise ValueError("LLM response contains no JSON array")
    text = match.group(0)
    data = json.loads(text)
    if not isinstance(data, list):
        raise ValueError("LLM response is not a JSON array")

    valid = []
    for item in data:
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
