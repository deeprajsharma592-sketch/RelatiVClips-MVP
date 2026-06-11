"""
Taste / Niche — Stage 6 of the new pipeline.

This package is the LLM-driven clip selector that sits BETWEEN hook
detection (stage 3) and rendering (stage 8). Its job: given a list of
hook candidates plus context about the creator, pick the 2-5 clips
that will actually perform.

Key design points (per PIPELINE-VISION.md):
  1. The LLM only produces EDIT COMMANDS — it never touches video bytes.
     FFMPEG does the actual work. This keeps the LLM decoupled from the
     renderer and lets us swap renderers without retraining.
  2. Three LLM providers, cost/quality tiers:
       - MiniMax (default): fast, cheap, good enough for most cases
       - deepseek: medium cost, good for international content
       - claude: highest quality, used for "final cut" reroll only
  3. ICL (in-context learning): every call gets the creator's recent
     clip history + this video's hook candidates in the prompt. The
     prompt grows smarter over time, the model stays frozen.
  4. Quality floor: never ship a clip with hook_score < 0.7. Better to
     ship 2 bangers than 5 maybes.

What this package provides:
  - `taste.icl.build_prompt(creator_history, hook_candidates, video_meta) -> str`
  - `taste.icl.parse_response(llm_output) -> List[ClipEdit]`
  - `taste.selector.rank_candidates(candidates, llm_response) -> List[Clip]`
  - `taste.store.CreatorHistory` — append-only memory of creator's clips

What this package does NOT do (yet):
  - Make the actual LLM HTTP call. That's the caller's job (we want
    to keep provider logic out of the core).
  - Render the clips. That's stage 8 (`renderer.py`).
  - Track per-creator feedback. That's the ICL loop wiring (Day 3+).
"""
from . import icl, selector, store

__all__ = ["icl", "selector", "store"]
