# RelatiV — Pipeline Starting Point

> **For opencode (or any new agent picking up Day 2 work).**
> Read this first. It's the shortest path from "I just woke up" to "I'm making progress."

## What you have right now (Day 1 end state)

```
backend/
├── pipeline/
│   ├── audio_analysis.py        # Stage 2: RMS energy peaks (existing, used)
│   ├── transcription.py         # Stage 5: faster-whisper (existing, needs refactor)
│   ├── face_detection.py        # Stage 7: YOLO (existing, used)
│   ├── renderer.py              # Stage 8: ffmpeg (existing, used)
│   ├── hooks.py                 # NEW: Stage 3 — hook detection
│   ├── surgical.py              # NEW: Stage 4 — segment-only download
│   ├── orchestrator.py          # NEW: glues all 9 stages
│   ├── cleanup.py               # existing, used
│   ├── snapshot_capturer.py     # existing
│   ├── vision_clip_selector.py  # existing
│   ├── clip_selector.py         # existing (legacy)
│   ├── transcript_fetcher.py    # existing (legacy)
│   └── __init__.py              # exports the new modules
├── taste/
│   ├── icl.py                   # NEW: ICL prompt builder + response parser
│   ├── selector.py              # NEW: rank + quality floor + dedup
│   ├── store.py                 # NEW: creator history (append-only JSON)
│   └── __init__.py
├── routers/
│   ├── youtube_router.py        # still uses legacy 6-stage; needs swap
│   └── local_router.py          # still uses legacy 6-stage; needs swap
├── utils/
│   ├── config.py                # NEW: PIPELINE_VERSION=2 added
│   └── task_store.py            # FIXED: unawaited coroutine bug
└── tests/
    ├── conftest.py              # NEW: unawaited-coroutine regression guard
    ├── test_orchestrator.py     # NEW: 7 smoke tests
    ├── test_new_pipeline_modules.py  # NEW: 35 tests for hooks/surgical/taste
    └── ...                      # 24 prior tests
```

## Start here — the 4-minute "I'm oriented" loop

```bash
# 1. Verify everything is green (1-2 min)
cd /app/RelatiV
bash scripts/quality-gate.sh          # → ✓ all gates passed
backend/.venv/bin/python -m pytest backend/tests/ -q   # → 66 passed

# 2. Read the three docs that explain the strategy (3-5 min)
cat PIPELINE-VISION.md                # 9-stage pipeline + ICL design
cat PIPELINE-QUEUE.md                 # ordered work list
cat DAY1-STATUS.md                    # what changed today

# 3. Skim the new orchestrator (5 min)
head -90 backend/pipeline/orchestrator.py
```

After that, pick the top unblocked item from `PIPELINE-QUEUE.md`.

## How to add a new lane (worktree)

```bash
cd /app/RelatiV
./scripts/spawn-worker.sh <lane-name> "<one-line task prompt>"

# Example: tomorrow's LLM provider lane
./scripts/spawn-worker.sh llm-providers \
  "Implement taste/providers/{claude,deepseek,minimax}.py as a common ABC. Wire ANTHROPIC_API_KEY. Add tests. Run quality-gate before exit."
```

This creates `/app/RelatiV-<lane-name>` as a new worktree on branch `lane/<lane-name>`, ready for `cd` + edit + `opencode run "<prompt>"`.

## How the new pipeline runs (the entry point)

```python
from backend.pipeline.orchestrator import run_new_pipeline

# Returns: {clips, hooks, transcript, video_meta, stages_run, task_id}
result = run_new_pipeline(
    source="https://youtube.com/watch?v=abc",
    creator_id="creator_123",      # optional, for ICL history
    audio_path="/path/to/audio.wav",  # pre-extracted
    progress=lambda stage, msg: print(f"[{stage}] {msg}"),
    llm_callable=my_llm_function,  # optional, falls back to energy
    stages=[1, 2, 3, 4, 5, 6, 7, 8, 9],  # or a subset for tests
)
```

## The 3 contracts you must NOT break

1. **Hook candidates from `hooks.detect_hooks` always have `start`, `end`, `hook_score >= 0`, `components`, `reason`.** The orchestrator and selector assume this shape.

2. **Taste selector I/O:**
   - Input: `candidates: List[Dict]`, `llm_response: Optional[List[Dict]]`, `video_duration: float`
   - Output: `List[Dict]` with `{start, end, hook_score, edit_reason, suggested_caption, suggested_hashtags}`
   - When `llm_response is None`: top-N fallback (3 clips, no quality floor applied — it uses ALL candidates)
   - When `llm_response` is a list: applies quality floor (0.7), dedupes within 1s, enforces duration window 10-20s

3. **`run_new_pipeline` always emits `done` as the last progress event.** Tests rely on this.

## Where the test signal lives

- `pytest backend/tests/test_orchestrator.py -v` — 7 tests, 1.6s
- `pytest backend/tests/test_new_pipeline_modules.py -v` — 35 tests, 0.6s
- `pytest backend/tests/ -q` — 66 tests, 0.6s
- `bash scripts/quality-gate.sh` — runs all of the above + frontend tsc + eslint

## Things you can ignore for now (low priority)

- `transcript_fetcher.py` — keep, but not on the new pipeline path
- `vision_clip_selector.py` — Ollama/Gemma path, off by default
- `clip_selector.py` — legacy, used by old PIPELINE_VERSION=1
- `snapshot_capturer.py` — orphan, not on the new path
- `models.py` — schema definitions, used by main.py
- The 4 PNGs in `junk/` — Deepraj decides keep/delete tomorrow

## Things to NOT do

- Don't refactor the existing 6-stage pipeline. It's the fallback.
- Don't commit anything uncommitted from main. Deepraj decides.
- Don't add new dependencies without confirming with the user. Check `requirements.txt` first.
- Don't add a new pipeline module without adding tests (60+ tests is the bar).

## Day 2 priority order (from PIPELINE-QUEUE.md)

1. **Lane: llm-providers** — implement claude/deepseek/MiniMax providers. Wire `ANTHROPIC_API_KEY`. Add smoke test that exercises a real LLM call (or mock if no key).
2. **Lane: surgical-routing** — wire `run_new_pipeline` into `routers/youtube_router.py` and `routers/local_router.py` behind `PIPELINE_VERSION=2`.
3. **Lane: transcription-segments** — refactor `transcription.py` to take a single audio segment (not full video). Update `run_new_pipeline` stage 5 to loop per segment.
4. **Lane: e2e-pipeline-test** — real-URL end-to-end test that hits a public YouTube video and asserts 3+ clip files on disk.
5. **Lane: icl-feedback-loop** — wire engagement metrics back to `taste.store.update_metrics`. Needs a webhook or polling job.

Each lane is a separate worktree. Don't do them sequentially in main.
