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
    creator_history: Optional[List["CreatorClipHistory"]] = None,
    taste_profile: Optional[Dict] = None,
    # ── RAG (2026-06-25): ChromaDB vector retrieval ──────────────────────
    # dict from rag_store.build_rag_context():
    #   {hits: [...], misses: [...], taste: {...} or None, hooks: [...]}
    rag_context: Optional[dict] = None,
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
      5. ICL examples from creator_history (when available).
      6. TASTE PROFILE (2026-06-21): creator's onboarding preferences injected
         directly into the system prompt so the LLM writes copy that matches
         the creator's specific audience and style.

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

    # 2b. TASTE PROFILE — creator's onboarding preferences (2026-06-21)
    # Injected as hard constraints so the LLM writes copy that matches
    # the creator's specific audience, style, and platform.
    if taste_profile and taste_profile.get("onboarded"):
        tp = taste_profile
        parts.append("\nCREATOR TASTE PROFILE:")
        if tp.get("niche") and tp["niche"] != "general":
            parts.append(f"  Niche: {tp['niche']}")
        if tp.get("clip_style") and tp["clip_style"] != "all":
            parts.append(f"  Clip style: {tp['clip_style']}")
        if tp.get("hook_style") and tp["hook_style"] != "all":
            parts.append(f"  Hook style: {tp['hook_style']}")
        if tp.get("audience_age") and tp["audience_age"] != "all":
            parts.append(f"  Audience age: {tp['audience_age']}")
        if tp.get("audience_location"):
            locs = ", ".join(tp["audience_location"])
            parts.append(f"  Audience location: {locs}")
        if tp.get("preferred_duration_s"):
            parts.append(f"  Preferred clip duration: ~{tp['preferred_duration_s']}s")
        if tp.get("target_platform") and tp["target_platform"] != "all":
            parts.append(f"  Target platform: {tp['target_platform']}")
        if tp.get("avoid_topics"):
            avoids = ", ".join(tp["avoid_topics"])
            parts.append(f"  AVOID these topics: {avoids}")
        parts.append("")

    # 3. RAG CONTEXT — ChromaDB vector retrieval (2026-06-25)
    # Retrieved from the creator's taste collection — only hits, misses, and
    # hooks that the model confirmed worked for this specific creator.
    # This replaces flat ICL stuffing: we send 2-3 relevant chunks instead of
    # the entire taste profile + 10 history items.
    if rag_context:
        rag_lines = []
        if rag_context.get("taste"):
            t = rag_context["taste"]
            rag_lines.append(f"  TASTE: {t['content'][:400]}")
        if rag_context.get("hits"):
            hits_block = "\n".join(
                f"  HIT #{i+1}: {h['content'][:250]} (ret={h['meta'].get('retention','?')}, ctr={h['meta'].get('ctr','?')})"
                for i, h in enumerate(rag_context["hits"][:3])
            )
            rag_lines.append(f"\nVERIFIED HITS:\n{hits_block}")
        if rag_context.get("misses"):
            misses_block = "\n".join(
                f"  MISS: {m['content'][:250]}"
                for m in rag_context["misses"][:2]
            )
            rag_lines.append(f"\nAVOID:\n{misses_block}")
        if rag_context.get("hooks"):
            hooks_block = "\n".join(
                f"  HOOK: {h['content'][:200]}"
                for h in rag_context["hooks"][:2]
            )
            rag_lines.append(f"\nHOOK PATTERNS:\n{hooks_block}")
        if rag_lines:
            parts.append("\n[TRELATIV TASTE FLYWHEEL — from creator's verified clips]\n" + "\n".join(rag_lines) + "\n")

    # 4. ICL examples (creator history)
    if creator_history:
        parts.append(
            "\nRecent clips from this creator (best to worst):"
        )
        for i, clip in enumerate(creator_history[:3]):
            views_str = f" ({clip.views} views)" if clip.views else ""
            ret_str = f" | {clip.retention_pct:.0f}% retention" if clip.retention_pct else ""
            parts.append(
                f"  [{i+1}] {clip.video_title!r}{views_str}{ret_str}\n"
                f"       Hook: {clip.edit_reason!r}"
            )
        parts.append("")

    # 4. VIDEO META
    title = (video_meta.get("title", "(no title)") or "(no title)")[:80]
    dur = float(video_meta.get("duration_s") or video_meta.get("duration") or 0)
    parts.append(f"\nVideo: {title!r} ({dur:.0f}s, target={max_picks} clips)")

    # 5. CANDIDATES — moment + retention features
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

    # 6. OUTPUT SCHEMA — strict JSON
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


def build_hybrid_narrative_prompt(
    transcript_segments: List[Dict],
    moments: List["Moment"],
    video_meta: Dict,
    max_picks: int = 4,
) -> str:
    """
    Build a hybrid prompt combining the FULL TRANSCRIPT dialogue with
    Librosa acoustic energy markers (peaks, valleys, chaotic bursts).
    
    This eliminates false positives: Claude reads the whole conversation flow,
    using audio peaks as energy hints rather than isolated clips.
    """
    parts: List[str] = []

    parts.append(
        "You are an elite short-form video editor for TikTok, YouTube Shorts, and Instagram Reels.\n"
        "You are given the FULL TIMESTAMPED TRANSCRIPT of this video, annotated with Librosa acoustic energy markers:\n"
        "  - ⚡ [HIGH ENERGY BURST] = Loud sustained acoustic volume\n"
        "  - 🔥 [CHAOTIC ENERGY MOMENT] = Sudden volume spike or rapid speech\n"
        "  - 🤫 [DRAMATIC PAUSE / VALLEY] = Silence or quiet beat\n\n"
        "CRITICAL INSTRUCTION ON FALSE POSITIVES:\n"
        "Loud audio spikes alone are often FALSE POSITIVES (microphone bumps, laughter, coughing, screaming without narrative substance).\n"
        "Do NOT pick a clip just because it is marked with ⚡.\n"
        "Instead, find the 2-4 most viral, self-contained STORIES, REVELATIONS, or LESSONS (22s to 32s each).\n"
        "A winning clip MUST have:\n"
        "  1. HOOK (0-3s): A question, shocking statement, or curiosity gap that stops the scroll.\n"
        "  2. STORY FLOW: Clear context — the listener understands what is happening without watching the rest of the video.\n"
        "  3. PAYOFF: A punchline, surprising fact, or resolution at the end.\n"
        "If an insightful story beat also aligns with an energy burst (⚡), that is ideal — but NARRATIVE COHERENCE comes first."
    )

    title = video_meta.get("title", "(no title)") or "(no title)"
    dur = float(video_meta.get("duration_s") or 0)
    parts.append(f"\nVIDEO: {title[:80]!r} (Duration: {dur:.0f}s)")

    # Build annotated transcript lines
    transcript_lines = []
    truncated_segments = transcript_segments[:600]
    for seg in truncated_segments:
        s = float(seg.get("start", 0))
        e = float(seg.get("end", 0))
        txt = seg.get("text", "").strip()
        if not txt:
            continue
        markers = []
        for m in moments:
            if not (e < m.start or s > m.end):
                if m.signal_type in ("peak", "steep_peak"):
                    markers.append("⚡ [HIGH ENERGY BURST]")
                elif m.signal_type in ("valley", "steep_valley", "silence"):
                    markers.append("🤫 [DRAMATIC PAUSE]")
                break
        marker_str = f" {markers[0]}" if markers else ""
        m_s, s_s = int(s // 60), int(s % 60)
        m_e, s_e = int(e // 60), int(e % 60)
        time_tag = f"[{m_s:02d}:{s_s:02d}-{m_e:02d}:{s_e:02d}]"
        transcript_lines.append(f"{time_tag} {txt}{marker_str}")

    parts.append("\nFULL TRANSCRIPT:\n" + "\n".join(transcript_lines))

    parts.append(
        f"\nSelect the {max_picks} most viral, self-contained story clips (45-90 seconds long, complete narrative arc).\n"
        "Return STRICT JSON only:\n"
        "{\n"
        '  "picks": [\n'
        "    {\n"
        '      "start": <float start timestamp in seconds>,\n'
        '      "end": <float end timestamp in seconds>,\n'
        '      "confidence": <float 0.5-1.0>,\n'
        '      "title": "<3-6 words ALL CAPS viral title summarizing the specific story>",\n'
        '      "hook": "<6-10 words opening hook line>",\n'
        '      "retention_bridge": "<8-15 words what keeps them watching>",\n'
        '      "caption": "<viral caption max 100 chars>",\n'
        '      "hashtags": "<3-5 space-separated tags>",\n'
        '      "reason": "<why this story beats random noise/screaming>"\n'
        "    }\n"
        "  ]\n"
        "}\n"
        "Output ONLY valid JSON. No markdown fences, no explanation."
    )

    return "\n".join(parts)


RELATIVSAUCE_RUBRIC_TEXT = """# RelatiVSauce: clip selection rubric

Version: rubric_ver = "sauce-0.1". Return this string in every output so results can be compared across prompt versions.

These weights and heuristics are starting hypotheses drawn from practitioner experience, not proven facts. They are meant to be tuned against real retention and view data.

## Process
1. Find candidate moments. A candidate is one complete, self-contained story arc between 45 and 90 seconds (target: 55-80 seconds). NEVER extract short 15-30s fragments that cut off mid-thought or before the punchline/conclusion. The clip must have a distinct Hook (0-5s), Build/Tension (5-45s), and Payoff/Resolution (45-80s). Prefer 8-20 candidates per hour of source.
2. Find the hook. The best clips open on the hook, not on setup. If the strongest line is in the middle, propose starting there and check that it still makes sense without what came before.
3. Classify the hook type (below). A candidate with no hook type is weak unless the payoff is exceptional.
4. Check reach. Does the topic connect to something broad (health, money, relationships, status, fear of falling behind)? See "Wide-funnel check".
5. Check self-containment. A cold viewer must understand the moment without the rest of the video.
6. Check accuracy and risk.
7. Score every candidate, not just the winners, and return them all.

## Hook types
Tag each candidate with the one that fits best (or none):
- contrarian: attacks a common belief or accepted advice.
- bizarre: a strange, vivid or surreal image that makes people stop.
- paradoxical: two ideas that sound incompatible but are both true.
- revealing: an early confession, failure, or raw truth.
- high_stakes: drops into a critical decision or deadline with no warm-up.
- visceral: sensory, physical detail that lands in the body, not the head.
- curiosity_gap: states a striking outcome but withholds how it happened.
- identity_challenge: speaks to how the viewer sees themselves, their job or their habits.

## Wide-funnel check
Clips reach new people when the topic has a large audience. Broad topics (health, money, relationships, fear of being left behind) travel further than narrow technical ones.
Technical or niche content usually fails as a clip when presented as a technical explanation. It works when the speaker is telling a human story through it: money made or lost, burnout, a co-founder conflict, a failure, a fear, a bet that paid off or didn't.
- Prefer the moment where the human stakes show up over the moment where the tool or architecture is explained.
- If a technical moment is the best available, say so in reason and note what framing (title, caption, first line) would make it broader.
- Do not penalize niche content that is clearly meant for a niche audience if the creator profile says so.

## Scoring (0-100)
| Component | Points | What high looks like |
|---|---|---|
| Hook strength | 0-30 | Strong hook in the first 2-3 seconds, clearly one of the types above |
| Reach | 0-25 | Broad topic or human stakes; viewer needs no prior knowledge |
| Completeness | 0-20 | Clear start, build, and landing; self-contained story (45-90s). Score 0 if cut off mid-sentence or before conclusion! |
| Payoff / ending | 0-10 | Ends on a punch, answer, or line worth rewatching; no trailing filler |
| Delivery | 0-10 | Energy, pacing, emotion, confidence; no long pauses or tangents |
| Risk penalty | 0 to -20 | Subtract for factual uncertainty, blacklisted topics, or needing missing context |

Calibration guidance:
- 80+ should be rare. Reserve it for moments you would be surprised not to see perform.
- Most candidates should land between 30 and 70.
- Do not inflate scores to look helpful. A transcript with no strong moments should return low scores and say so.

## Accuracy and risk rules
- If a clip contains numbers, dates, prices, or claims, flag needs_fact_check: true when you cannot verify them from the transcript itself. Do not fix numbers from memory.
- Never select moments that include: price predictions or financial advice presented as certain, attacks on named competitors, illegal activity, or anything on the creator's blacklist if one is provided.
- Do not select a moment whose meaning flips when clipped (sarcasm, setup-and-reversal, a quote the speaker goes on to reject). Set context_risk: "high" instead.

## 5% Experiment Policy
In ~5% of runs, include one experimental candidate marked "is_experiment": true. An experimental candidate is an unconventional, high-variance moment that would normally fall just under the 65 cutoff (score 50-64) or has an unusual angle (bizarre imagery, sudden intense confession, eccentric contrarian claim) with potential breakout upside.

## Output format
Return ONLY valid JSON, no preamble, no markdown fences:
{
  "rubric_ver": "sauce-0.1",
  "candidates": [
    {
      "start_s": 0.0,
      "end_s": 0.0,
      "hook_line": "first line of the clip as spoken",
      "hook_type": "contrarian | bizarre | paradoxical | revealing | high_stakes | visceral | curiosity_gap | identity_challenge | none",
      "broad_angle": "health | wealth | relationships | status | none",
      "scores": {
        "hook": 0, "reach": 0, "completeness": 0,
        "payoff": 0, "delivery": 0, "risk": 0
      },
      "score": 0,
      "context_risk": "low | medium | high",
      "needs_fact_check": false,
      "chosen": false,
      "is_experiment": false,
      "reason": "one sentence on why, max 25 words",
      "suggested_title": "3-6 words ALL CAPS specific viral headline, NEVER generic placeholders like THIS MOMENT HITS"
    }
  ]
}

Rules for the output:
- Candidates MUST be between 45 and 90 seconds (end_s - start_s >= 45.0).
- Set chosen: true for at most the top 3 per hour of source, and only for candidates scoring 65 or higher.
- Keep reason to one sentence (max 25 words).
- Timestamps must come directly from the transcript. Never invent them.
- Return rejected candidates too (they are training data for later).
"""


def build_relativsauce_prompt(
    transcript_segments: List[Dict],
    moments: List["Moment"],
    video_meta: Dict,
    creator_profile: Optional[Dict] = None,
    is_experiment: bool = False,
    max_picks: int = 3,
) -> str:
    """
    Build the RelatiVSauce rubric prompt (sauce-0.1).
    Keeps the rubric preamble identical for Anthropic/Claude prompt caching.
    """
    parts: List[str] = [RELATIVSAUCE_RUBRIC_TEXT.strip()]

    # Video metadata
    title = video_meta.get("title", "(no title)") or "(no title)"
    dur = float(video_meta.get("duration_s") or 0)
    parts.append(f"\n## Video Context\nTitle: {title[:100]!r}\nDuration: {dur:.0f} seconds")

    if creator_profile:
        parts.append(f"\n## Creator Profile (Overrides default weights)\n{json.dumps(creator_profile, indent=2)}")

    if is_experiment:
        parts.append(
            "\n## Active Policy: 5% EXPLORATION RUN\n"
            "This run is selected for experimental exploration! You MUST include one high-variance wildcard candidate "
            "with \"is_experiment\": true (score 50-64, bizarre, visceral, intense confession, or eccentric contrarian angle)."
        )

    # Formatted transcript lines
    transcript_lines = []
    segs = transcript_segments if transcript_segments else [
        {"start": m.start, "end": m.end, "text": m.snippet} for m in moments[:40]
    ]
    for seg in segs[:650]:
        s = float(seg.get("start", 0))
        e = float(seg.get("end", 0))
        txt = seg.get("text", "").strip()
        if not txt:
            continue
        markers = []
        for m in moments:
            if not (e < m.start or s > m.end):
                if m.signal_type in ("peak", "steep_peak"):
                    markers.append("⚡ [LOUD ACOUSTIC BURST]")
                elif m.signal_type in ("valley", "steep_valley", "silence"):
                    markers.append("🤫 [DRAMATIC PAUSE]")
                break
        marker_str = f" {markers[0]}" if markers else ""
        m_s, s_s = int(s // 60), int(s % 60)
        m_e, s_e = int(e // 60), int(e % 60)
        transcript_lines.append(f"[{m_s:02d}:{s_s:02d}-{m_e:02d}:{s_e:02d}] {txt}{marker_str}")

    parts.append("\n## Transcript with Acoustic Energy Markers\n" + "\n".join(transcript_lines))
    parts.append(
        "\nApply the RelatiVSauce rubric strictly. Score every candidate and return the JSON object with rubric_ver='sauce-0.1'. "
        "MANDATORY REQUIREMENT: Candidates MUST be between 45 and 90 seconds (end_s - start_s >= 45.0) and contain a full, self-contained story arc with Hook -> Build/Escalation -> Punchline/Landing. Every suggested_title MUST be an exciting, specific 3-6 word ALL CAPS headline (e.g. 'THE $500,000 MISTAKE'). NEVER output generic placeholders like 'THIS MOMENT HITS' or short 20s fragments. "
        "Output ONLY valid JSON. No markdown code fences, no introductory remarks."
    )

    return "\n\n".join(parts)


def parse_moment_response(llm_output: str) -> List[Dict]:
    """
    Parse the LLM's strict-JSON moment response into clip edits.

    Handles formats:
      - RELATIVSAUCE: {"rubric_ver": "sauce-0.1", "candidates": [...]}
      - NEW:          {"picks": [{"moment_index": 1, "reason": "...", ...}]}
      - LEGACY:       [{"candidate_index": 1, "edit_reason": "...", ...}]
    """
    import json
    import re

    text = (llm_output or "").strip()
    # Strip markdown code fences if present
    code_block = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if code_block:
        text = code_block.group(1).strip()
    else:
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text).strip()

    # ── Try RELATIVSAUCE format: {"rubric_ver": "sauce-0.1", "candidates": [...]} ──
    try:
        data = json.loads(text)
        if isinstance(data, dict) and "candidates" in data:
            valid = _parse_relativsauce_candidates(data["candidates"])
            if valid is not None:
                return valid
    except (json.JSONDecodeError, ValueError, KeyError):
        pass

    try:
        obj_match = re.search(r"\{[\s\S]*\}", text)
        if obj_match:
            data = json.loads(obj_match.group(0))
            if isinstance(data, dict) and "candidates" in data:
                valid = _parse_relativsauce_candidates(data["candidates"])
                if valid is not None:
                    return valid
    except (json.JSONDecodeError, ValueError, KeyError):
        pass

    # ── Try NEW format: {"picks": [...]} ───────────────────────────────
    try:
        data = json.loads(text)
        if isinstance(data, dict) and "picks" in data:
            valid = _parse_picks_array(data["picks"])
            if valid is not None:
                return valid
    except (json.JSONDecodeError, ValueError, KeyError):
        pass

    # Regex search for any embedded JSON object {...} containing picks
    try:
        obj_match = re.search(r"\{[\s\S]*\}", text)
        if obj_match:
            data = json.loads(obj_match.group(0))
            if isinstance(data, dict) and "picks" in data:
                valid = _parse_picks_array(data["picks"])
                if valid is not None:
                    return valid
    except (json.JSONDecodeError, ValueError, KeyError):
        pass

    # ── Fallback: try LEGACY format: [{"candidate_index": ...}] ─────────
    # Used by build_prompt() and old test mocks. Also handles [{"moment_index": ...}]
    try:
        match = re.search(r"\[\s*\{.*\}\s*\]", text, re.DOTALL)
        if match:
            arr = json.loads(match.group(0))
            if isinstance(arr, list):
                valid = []
                for item in arr:
                    if not isinstance(item, dict):
                        continue
                    idx_raw = item.get("candidate_index", item.get("moment_index"))
                    if idx_raw is None:
                        continue
                    try:
                        idx = int(idx_raw)
                    except (TypeError, ValueError):
                        continue
                    valid.append({
                        "moment_index": idx,
                        "trim_start": float(item.get("trim_start_offset", item.get("trim_start", 0))),
                        "trim_end": float(item.get("trim_end_offset", item.get("trim_end", 0))),
                        "confidence": 0.8,
                        "verified": True,
                        "viral_title": str(item.get("viral_title", ""))[:100].upper(),
                        "hook": str(item.get("viral_title", "") or "")[:200],
                        "retention_bridge": str(item.get("suggested_caption", "") or "")[:300],
                        "title": str(item.get("viral_title", "") or "")[:100].upper(),
                        "caption": str(item.get("suggested_caption", ""))[:200],
                        "edit_reason": str(item.get("edit_reason", ""))[:500],
                        "reason": str(item.get("edit_reason", "") or item.get("reason", ""))[:500],
                        "hashtags": str(item.get("suggested_hashtags", item.get("hashtags", "")))[:200],
                    })
                if valid:
                    return valid
    except (json.JSONDecodeError, ValueError, re.error):
        pass

    raise ValueError("LLM response is not valid JSON in new or legacy format")


def _parse_relativsauce_candidates(candidates: list) -> Optional[List[Dict]]:
    """Parse RelatiVSauce rubric candidates (sauce-0.1)."""
    if not isinstance(candidates, list):
        return None

    valid: List[Dict] = []
    # Sort candidates by score descending
    sorted_cands = sorted(
        [c for c in candidates if isinstance(c, dict)],
        key=lambda c: float(c.get("score", 0)),
        reverse=True,
    )

    for i, c in enumerate(sorted_cands):
        start_val = c.get("start_s", c.get("start"))
        end_val = c.get("end_s", c.get("end"))
        if start_val is None or end_val is None:
            continue
        try:
            start_s = float(start_val)
            end_s = float(end_val)
        except (TypeError, ValueError):
            continue
        if end_s <= start_s:
            continue

        score = float(c.get("score", 50))
        chosen = bool(c.get("chosen", False))
        is_experiment = bool(c.get("is_experiment", False))
        hook_type = str(c.get("hook_type", "none"))
        broad_angle = str(c.get("broad_angle", "none"))
        hook_line = str(c.get("hook_line", ""))
        suggested_title = str(c.get("suggested_title", ""))
        reason = str(c.get("reason", ""))
        context_risk = str(c.get("context_risk", "low"))
        needs_fact_check = bool(c.get("needs_fact_check", False))

        conf = max(0.0, min(1.0, score / 100.0))
        title = (suggested_title or hook_line[:40] or "VIRAL STORY").strip().upper()

        valid.append({
            "moment_index": i + 1,
            "start": round(start_s, 2),
            "end": round(end_s, 2),
            "trim_start": 0.0,
            "trim_end": 0.0,
            "score": score,
            "confidence": round(conf, 3),
            "verified": chosen or (score >= 65),
            "chosen": chosen,
            "is_experiment": is_experiment,
            "title": title,
            "viral_title": title,
            "hook": hook_line,
            "retention_bridge": reason,
            "caption": f"{suggested_title}\n\n{hook_line}".strip() if hook_line else suggested_title,
            "reason": reason,
            "hook_type": hook_type,
            "broad_angle": broad_angle,
            "context_risk": context_risk,
            "needs_fact_check": needs_fact_check,
            "rubric_ver": "sauce-0.1",
        })

    return valid if valid else None


def _parse_picks_array(picks: list) -> Optional[List[Dict]]:
    """Parse the 'picks' array (new format). Returns None if invalid."""
    import json

    if not isinstance(picks, list):
        return None
    valid: List[Dict] = []
    for i, p in enumerate(picks):
        if not isinstance(p, dict):
            continue
        idx_raw = p.get("moment_index")
        start_val = p.get("start", p.get("start_s"))
        end_val = p.get("end", p.get("end_s"))
        if idx_raw is None and start_val is None:
            continue
        idx = int(idx_raw) if idx_raw is not None else (i + 1)
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
        reason_str = str(p.get("reason") or "")[:500]
        item_dict = {
            "moment_index": idx,
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
            "edit_reason": reason_str,  # explicit edit_reason field for rank_candidates
            "hashtags": str(p.get("hashtags", ""))[:200],
            "reason": reason_str,
        }
        if start_val is not None:
            try:
                item_dict["start"] = float(start_val)
                item_dict["end"] = float(end_val) if end_val is not None else float(start_val) + 26.0
            except (ValueError, TypeError):
                pass
        valid.append(item_dict)
    return valid if valid else None


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
    """Build ICL prompt with creator history and surgical context.

    This is the legacy path used by tests and the old orchestrator. It
    supports ICL few-shot examples from creator history and surgical context
    markers that the new build_moment_prompt doesn't include.
    """
    parts: List[str] = []

    # 1. Creator type signal
    if not creator_history:
        parts.append("Creator profile: NEW creator — no prior clips. "
                     "Apply general best practices.")
    else:
        parts.append("Creator profile: EXPERIENCED — see recent clips below.")

    # 2. System instruction
    parts.append(
        "You are a short-form video clipper (TikTok/Reels/Shorts). "
        "For each hook candidate, write a compelling SHORT-FORM CLIP:\n"
        "  - edit_reason: why this moment works as a hook (1 sentence)\n"
        "  - suggested_caption: max 100 chars, hooky, no generic phrases\n"
        "  - suggested_hashtags: top 3-5 tags\n"
        "  - viral_title: 3-6 words, ALL CAPS, stop-scroll\n"
        "Output JSON: [{\"candidate_index\": <N>, \"edit_reason\": \"...\", ...}]"
    )

    # 3. Video meta
    title = video_meta.get("title", "(unknown)") or "(unknown)"
    dur = float(video_meta.get("duration_s") or video_meta.get("duration") or 0)
    niche_str = f" (niche: {niche})" if niche != "general" else ""
    parts.append(f"Video: {title!r} ({dur:.0f}s, target=1-3 clips){niche_str}")

    # 4. ICL examples (creator history)
    if creator_history:
        parts.append("\nRecent clips for this creator (best to worst):")
        for i, clip in enumerate(creator_history[:max_examples]):
            views_str = f" ({clip.views} views)" if clip.views else ""
            ret_str = f" | {clip.retention_pct:.0f}% retention" if clip.retention_pct else ""
            parts.append(
                f"  Video {i}: {clip.video_title!r}{views_str}{ret_str}\n"
                f"    Hook: {clip.edit_reason!r}"
            )
        parts.append("")
        parts.append("Examples of THIS creator:")
        parts.append("")

    # 5. Hook candidates
    if not hook_candidates:
        parts.append("Hook candidates: none")
    else:
        cand_lines = []
        for i, c in enumerate(hook_candidates, 1):
            snippet = c.reason or "(energy peak)"
            # Surgical context: output as SEPARATE [marker] items (not combined),
            # matching what the tests expect.
            markers: List[str] = []
            if c.surgical_padding_s:
                markers.append(f"surgery: ±{c.surgical_padding_s:.1f}s padding")
            if c.source_start is not None and c.source_end is not None:
                markers.append(f"will cut source t={c.source_start:.1f}s-{c.source_end:.1f}s")
            surgical_str = "".join(f" [{m}]" for m in markers)
            cand_lines.append(f"[{i}] t={c.start:.1f}s-{c.end:.1f}s (score={c.hook_score:.2f}){surgical_str}: {snippet!r}")
        parts.append("Hook candidates:\n" + "\n".join(cand_lines))

    # 6. Output schema
    parts.append(
        "\nReturn JSON array of picks (max 3). "
        "If only 1-2 candidates are strong, return 1-2. Honest > padded.\n"
        "[{\"candidate_index\": <int>, \"edit_reason\": \"<why this works>\", "
        "\"suggested_caption\": \"<hooky caption>\", \"suggested_hashtags\": \"<tags>\", "
        "\"viral_title\": \"<ALL CAPS TITLE>\", \"trim_start_offset\": <sec to trim from start>, "
        "\"trim_end_offset\": <sec to trim from end>}]"
    )

    return "\n".join(parts)


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
