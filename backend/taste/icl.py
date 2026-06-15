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
from dataclasses import dataclass, field
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
        "You see BOTH audio descriptors (energy peaks, valleys, "
        "transitions) AND text snippets. For each candidate, rate its "
        "STORY QUALITY as confidence 0.0-1.0 — a 'compelling story-type "
        "clip' is one where the audio+text together indicate a real "
        "narrative beat: a strong reaction, a punchline, a reveal, a "
        "hot take, a turn of events. Use this guide:\n"
        "  0.9-1.0  = CLEAR story beat (laugh, reveal, \"I couldn't "
        "believe it\", numbers, intensifiers, payoff)\n"
        "  0.7-0.8  = LIKELY story beat (contrast, fast speech, "
        "emotional peak, dramatic pause)\n"
        "  0.5-0.6  = POSSIBLE (something is happening, but context "
        "is thin)\n"
        "  0.3-0.4  = WEAK (filler, transition, just talking)\n"
        "  0.0-0.2  = NO STORY (generic padding, repeated words, "
        "silence, no narrative signal)\n"
        "Be honest. The user wants 1-3 STRONG clips, not 3 weak ones. "
        "If only 1 candidate is compelling, return 1 pick. "
        "Output ONLY the JSON object, no prose."
    )

    # 2. Video meta — minimal
    title = video_meta.get("title", "(no title)") or "(no title)"
    title = title[:80]
    dur = float(video_meta.get("duration_s") or video_meta.get("duration") or 0)
    parts.append(
        f"Video: {title!r} ({dur:.0f}s, target=1-3 clips, ~1 per 3-5min)"
    )

    # 3. Signal legend
    parts.append(
        "Signals: peak=loud, valley=quiet pause, density=fast speech, "
        "silence=beat/pause, steep_peak=sudden loud, steep_valley=sudden quiet"
    )

    # 4. Moments (the input)
    if not moments:
        parts.append("No candidate moments found — return empty picks array.")
    else:
        cand_lines = [m.to_prompt_line() for m in moments[:20]]
        parts.append(
            f"Candidates ({len(cand_lines)}):\n" + "\n".join(cand_lines)
        )

    # 5. Output schema — strict JSON with confidence 0.0-1.0
    parts.append(
        f"\nReturn JSON: {{\"picks\": [{{\"moment_index\": <int>, "
        f"\"trim_start\": <float, def 0>, \"trim_end\": <float, def 0>, "
        f"\"confidence\": <float 0.0-1.0 — how strong is this as a story beat?>, "
        f"\"viral_title\": \"<3-6 words ALL CAPS>\", "
        f"\"caption\": \"<max 100 chars>\", \"hashtags\": \"<max 5 space-sep>\", "
        f"\"reason\": \"<max 80 chars>\"}}, ...]}}. "
        f"Return {max_picks} picks. Use confidence honestly: 1.0 = "
        f"unmissable, 0.5 = worth showing, 0.2 = filler. JSON only, no markdown."
    )

    return "\n".join(parts)


def build_archetype_aware_prompt(
    moments: List["Moment"],
    video_meta: Dict,
    archetype: str = "general",
    archetype_confidence: float = 0.0,
    retention_scores: Optional[Dict[int, Dict[str, float]]] = None,
    max_picks: int = 3,
) -> str:
    """
    New (2026-06-15) archetype-aware prompt.

    Key changes from build_moment_prompt:
      1. Passes archetype + confidence so the LLM knows what content type
         it's writing for. This unlocks archetype-specific hooks.
      2. Passes per-moment 8-feature retention scores (0-1 each).
      3. Asks for THREE specific fields per pick:
         - hook: 6-10 words, the first thing the viewer hears (open loop)
         - retention_bridge: 8-15 words, "and then what" / "but here's the thing"
         - title: 3-6 words, ALL CAPS, for thumbnail/UI
         (legacy: caption, hashtags, reason are also accepted)
      4. Stricter structure: includes archetype-specific guidance.

    The LLM is no longer asked to "find a story" — it's given candidates
    that are pre-scored and pre-typed. It only writes COPY.

    Token cost: ~400 in + ~500 out. Same as before.
    """
    import os
    try:
        from ..pipeline.archetype import archetype_specific_guidance
    except ImportError:
        archetype_specific_guidance = lambda a: ""

    parts: List[str] = []

    # 1. SYSTEM — explicit 3-job instruction
    parts.append(
        "You are a short-form video editor (TikTok/Reels/Shorts). You do "
        "THREE things for each pick:\n"
        "  1. HOOK (6-10 words): the FIRST thing the viewer sees/hears. "
        "Must create an OPEN LOOP — a question, surprise, or curiosity gap "
        "that they want closed.\n"
        "  2. RETENTION BRIDGE (8-15 words): the 'and then what?' that "
        "keeps them watching. Connect the hook to a payoff.\n"
        "  3. TITLE (3-6 words, ALL CAPS): for thumbnail/UI. "
        "Stop-scrolling, specific, not generic.\n\n"
        "Be SPECIFIC to the moment. Reference the actual content, not "
        "abstract patterns. Avoid 'TOP MOMENT', 'YOU WON'T BELIEVE' as a "
        "literal phrase — find the precise beat."
    )

    # 2. ARCHETYPE — context for the LLM
    arch_conf = f" (conf {archetype_confidence:.2f})" if archetype_confidence else ""
    parts.append(
        f"ARCHETYPE: {archetype}{arch_conf}\n"
        f"{archetype_specific_guidance(archetype)}"
    )

    # 3. VIDEO META
    title = (video_meta.get("title", "(no title)") or "(no title)")[:80]
    dur = float(video_meta.get("duration_s") or video_meta.get("duration") or 0)
    parts.append(f"\nVideo: {title!r} ({dur:.0f}s, target={max_picks} clips)")

    # 4. CANDIDATES — moment + retention features
    if not moments:
        parts.append("No candidate moments found — return empty picks array.")
    else:
        cand_lines = []
        for m in moments[:20]:
            base = m.to_prompt_line() if hasattr(m, "to_prompt_line") else str(m)
            # Append retention features if provided
            if retention_scores and m.index in retention_scores:
                feats = retention_scores[m.index]
                feat_str = " ".join(
                    f"{k}={v:.2f}" for k, v in feats.items()
                    if k in ("composite", "energy_peak", "power_words", "question",
                             "numbers", "first_person", "speech_rate")
                )
                base = f"{base}  [retention: {feat_str}]"
            cand_lines.append(base)
        parts.append(
            f"\nCandidates ({len(cand_lines)}):\n" + "\n".join(cand_lines)
        )

    # 5. OUTPUT SCHEMA — strict JSON
    parts.append(
        f"\nReturn JSON: {{\"picks\": [{{"
        f"\"moment_index\": <int 1-based from list above>, "
        f"\"confidence\": <float 0.0-1.0>, "
        f"\"hook\": \"<6-10 words, the OPEN LOOP>\", "
        f"\"retention_bridge\": \"<8-15 words, the 'and then what?'>\", "
        f"\"title\": \"<3-6 words ALL CAPS>\", "
        f"\"hashtags\": \"<3-5 space-sep tags>\""
        f"}}, ...]}}\n"
        f"Return {max_picks} picks. If only 1-2 candidates are real story "
        f"beats, return 1-2 picks. Honest > padded. JSON only, no markdown, "
        f"no prose before/after."
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
        # Confidence: float 0.0-1.0. Backward compat with old "verified"
        # field — if confidence is missing but verified is present, map
        # True→0.9, False→0.2.
        conf_raw = p.get("confidence", None)
        if conf_raw is None:
            if "verified" in p:
                conf_raw = 0.9 if p.get("verified") else 0.2
            else:
                conf_raw = 0.5  # unknown → middle
        try:
            confidence = float(conf_raw)
        except (TypeError, ValueError):
            confidence = 0.5
        confidence = max(0.0, min(1.0, confidence))
        # New 3-job schema: hook, retention_bridge, title
        # Fall back to legacy field names if not present.
        hook = str(
            p.get("hook")
            or p.get("viral_title")
            or ""
        )[:200]
        retention_bridge = str(
            p.get("retention_bridge")
            or p.get("caption")
            or ""
        )[:300]
        title = str(
            p.get("title")
            or p.get("viral_title")
            or hook[:60]
        )[:100].upper()
        valid.append({
            "moment_index": int(p["moment_index"]),
            "trim_start": float(p.get("trim_start", 0)),
            "trim_end": float(p.get("trim_end", 0)),
            "confidence": confidence,
            # Backward-compat: expose a "verified" boolean for old code paths
            "verified": confidence >= 0.5,
            "viral_title": title,  # legacy alias
            "hook": hook,
            "retention_bridge": retention_bridge,
            "title": title,
            "caption": retention_bridge or str(p.get("caption", ""))[:200],  # legacy alias
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
