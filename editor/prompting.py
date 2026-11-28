"""Prompt assembly: system prompt, niche rules, block catalog, facts, examples.

Anything that changes model behaviour is versioned under ``editor/prompts/v1/``.
The block catalog is generated from the block schemas so it can never drift.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Mapping, Sequence

import engine_config
from blocks import catalog_text

PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"
MAX_WORDS_IN_PROMPT = 140
EXAMPLE_LIMIT = 3


def prompt_version() -> str:
    return engine_config.env("EDIT_PROMPT_VERSION", default="v1")


def system_prompt_path(version: str | None = None) -> Path:
    return PROMPTS_DIR / (version or prompt_version()) / "system.md"


def load_niche(niche: str) -> str:
    path = engine_config.settings().niches_dir / f"{niche}.md"
    if not path.exists():
        available = sorted(p.stem for p in path.parent.glob("*.md"))
        raise FileNotFoundError(f"unknown niche '{niche}'; available: {available}")
    return path.read_text(encoding="utf-8").strip()


def examples_path(niche: str) -> Path:
    return engine_config.settings().niches_dir / f"{niche}.examples.json"


def load_examples(niche: str, limit: int = EXAMPLE_LIMIT) -> list[dict[str, Any]]:
    """Winning EDLs written by the learning loop, best first, mixes deduped."""
    path = examples_path(niche)
    if not path.exists():
        return []
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []
    rows = payload.get("examples") or []
    rows = sorted(rows, key=lambda r: float(r.get("weighted_score", 0)), reverse=True)

    chosen: list[dict[str, Any]] = []
    seen_mixes: set[tuple[str, ...]] = set()
    for row in rows:
        mix = tuple(sorted({e.get("type", "") for e in (row.get("edl") or {}).get("effects", [])}))
        if mix in seen_mixes:
            continue
        seen_mixes.add(mix)
        chosen.append(row)
        if len(chosen) >= limit:
            break
    return chosen


def format_examples(examples: Sequence[Mapping[str, Any]]) -> str:
    if not examples:
        return "(none yet - this is a cold start; trust the rules above)"
    blocks = []
    for row in examples:
        edl = row.get("edl") or {}
        score = row.get("weighted_score")
        critique = (row.get("critique") or "").strip()
        blocks.append(
            f"- clip {edl.get('clip_id', '?')} (weighted judge score {score}):\n"
            f"```json\n{json.dumps(edl, indent=2)}\n```\n"
            f"  why it won: {critique or 'highest judge score for this niche'}"
        )
    return "\n".join(blocks)


def build_system_prompt(
    niche: str,
    *,
    examples: Sequence[Mapping[str, Any]] | None = None,
    version: str | None = None,
) -> str:
    template = system_prompt_path(version).read_text(encoding="utf-8")
    rows = list(examples) if examples is not None else load_examples(niche)
    return (
        template.replace("{{NICHE_RULES}}", load_niche(niche))
        .replace("{{BLOCK_CATALOG}}", catalog_text().strip())
        .replace("{{FEW_SHOT}}", format_examples(rows))
    )


def compact_words(
    transcript: Mapping[str, Any] | Sequence[Mapping[str, Any]] | None,
    story_plan: Mapping[str, Any],
    *,
    limit: int = MAX_WORDS_IN_PROMPT,
) -> list[dict[str, Any]]:
    """Word timings, trimmed to the places an effect could actually land.

    Short clips keep every word. Longer ones keep words near segment boundaries,
    emphasised words (long or capitalised) and the first/last words, so the model
    still sees where a beat is without a 3,000-word transcript in the prompt.
    """
    if transcript is None:
        return []
    raw = transcript.get("words") if isinstance(transcript, Mapping) else transcript
    words: list[dict[str, Any]] = []
    for item in raw or []:
        text = str(item.get("w") or item.get("word") or "").strip()
        if not text:
            continue
        try:
            start = float(item["start"])
            end = float(item.get("end", start + 0.2))
        except (KeyError, TypeError, ValueError):
            continue
        words.append({"w": text, "start": round(start, 2), "end": round(end, 2)})
    words.sort(key=lambda w: w["start"])
    if len(words) <= limit:
        return words

    duration = float(story_plan.get("duration_s") or 0)
    boundaries = [0.0, duration]
    for seg in story_plan.get("segments") or []:
        boundaries.extend([float(seg.get("start", 0)), float(seg.get("end", 0))])

    durations = sorted(w["end"] - w["start"] for w in words)
    median = durations[len(durations) // 2] if durations else 0.2

    keep: set[int] = {0, len(words) - 1}
    for i, word in enumerate(words):
        near_boundary = any(abs(word["start"] - b) <= 0.6 for b in boundaries)
        emphasised = (word["end"] - word["start"]) > median * 1.35 or word["w"].isupper()
        if near_boundary or emphasised:
            keep.add(i)
    # Fill up to the limit evenly if the interesting words are still sparse.
    step = max(1, len(words) // max(1, limit - len(keep)))
    for i in range(0, len(words), step):
        if len(keep) >= limit:
            break
        keep.add(i)
    return [words[i] for i in sorted(keep)][:limit]


def build_user_message(
    story_plan: Mapping[str, Any],
    transcript: Mapping[str, Any] | Sequence[Mapping[str, Any]] | None,
    *,
    niche: str,
    style_direction: str,
    variant_index: int = 0,
    attempts_note: str = "",
    refine_context: str = "",
) -> str:
    words = compact_words(transcript, story_plan)
    transcript_text = " ".join(f"{w['w']}@{w['start']:.2f}-{w['end']:.2f}" for w in words) or "(no transcript)"
    payload = {
        "clip_id": story_plan.get("clip_id"),
        "niche": niche,
        "duration_s": story_plan.get("duration_s"),
        "segments": story_plan.get("segments"),
        "callbacks": story_plan.get("callbacks") or [],
    }
    lines = [
        f"STYLE DIRECTION: {style_direction}",
        f"VARIANT: {variant_index}",
        "",
        "STORY PLAN:",
        json.dumps(payload, indent=2, ensure_ascii=False),
        "",
        "TRANSCRIPT (word@start_seconds; ends shown only where useful):",
        transcript_text,
        "",
        "Return the EDL JSON only.",
    ]
    if refine_context:
        lines += ["", "THIS IS A REFINEMENT ROUND. The judge reviewed the previous edit:", refine_context]
    if attempts_note:
        lines.insert(0, attempts_note)
    if refine_context:
        lines.insert(0, "A previous EDL was judged. Read the critique below and fix the specific problems.")
        lines.insert(1, "")
    return "\n".join(lines)
