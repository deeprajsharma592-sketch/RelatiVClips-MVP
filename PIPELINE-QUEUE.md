# RelatiV — Pipeline Work Queue

> Generated 2026-06-10. Updated as work progresses.
> Use this to pick up where you (or opencode) left off.
>
> **⚠️ Priority shift (final 20-min update):** Taste/Niche/ICL feedback = **FUTURE scope, not now.**
> Day 2 = wire EPS official LLM into orchestrator stage 6, no taste integration. The `taste/*` modules
> stay as-is (frozen, tested, design surface only).

## Strategic direction

The 9-stage pipeline is the primary path. Old 6-stage stays as fallback (PIPELINE_VERSION=1).

| Stage | Module | Status |
|---|---|---|
| 1. URL analysis | (TBD — needs `url_analyzer.py`) | 🔴 not started |
| 2. Energy peaks | `pipeline/audio_analysis.py` | ✅ exists, used |
| 3. Hook detection | `pipeline/hooks.py` | ✅ shipped, tested |
| 4. Surgical download | `pipeline/surgical.py` | ✅ shipped, tested |
| 5. Transcription (per-segment) | `pipeline/transcription.py` | 🟡 exists, needs refactor to operate on segments not full audio |
| 6. **LLM hook selection (EPS official)** | `taste/providers/eps_official.py` (NEW) | 🔴 not started — **Day 2 priority** |
| 6 (fallback). Energy-peak selection | `taste/selector.py` (`_fallback_selection`) | ✅ works without LLM |
| 7. Face detection (parallel) | `pipeline/face_detection.py` | ✅ exists |
| 8. Render | `pipeline/renderer.py` | ✅ exists |
| 9. Captions | (currently in `clip_selector.py:generate_ass_subtitle`) | 🟡 exists, should move to `pipeline/captions.py` |

### ❄️ Frozen (do NOT develop further in Day 2-3)

- `taste/icl.py` — ICL prompt builder (design surface for future)
- `taste/selector.py` — kept as energy-peak fallback only; the ICL/LLM-response rank path is dormant
- `taste/store.py` — creator history (design surface for future)
- All `taste/*` tests stay as-is (they're the contract)

If the user asks for taste work, refer them to `PIPELINE-VISION.md` (saved for the day it becomes active).

## Queue (in execution order)

### ✅ Done today (Day 1)

- [x] Fix unawaited coroutine in `task_store.py:_run_async` (DB writes were silently dropped)
- [x] Add regression test (`conftest.py` autouse fixture)
- [x] Fix 4 frontend lint errors (setState-in-effect × 3, unescaped quote × 1)
- [x] Export `fetch_transcript` from `pipeline.__init__`
- [x] Move junk files to `junk/` (4 landing PNGs + statefile) with README
- [x] Create `pipeline/hooks.py` (stage 3) — energy + lexical scoring, dedup, quality floor
- [x] Create `pipeline/surgical.py` (stage 4) — youtube + local segment extraction
- [x] Create `taste/` package skeleton (DESIGN SURFACE ONLY, FROZEN for Day 2-3)
- [x] Create `pipeline/orchestrator.py` — 9-stage glue, runs end-to-end with energy fallback
- [x] Add `PIPELINE_VERSION=2` config flag (new) default, `=1` (legacy) opt-in
- [x] Add 42 new tests (7 orchestrator smoke + 35 module shape)
- [x] Wire new modules into `pipeline.__init__` exports
- [x] `PIPELINE-VISION.md` (saved) + `PIPELINE-QUEUE.md` (this) + `PIPELINE_STARTING_POINT.md` (orientation)

### 🟡 Day 2 (do tomorrow when EPS official creds arrive)

- [ ] **Wire EPS official LLM into stage 6** — `taste/providers/eps_official.py` implementing the
  common LLM callable interface. Endpoint = what Deepraj provides. No taste/ICL integration.
- [ ] **Refactor transcription to operate on segments** — currently it transcribes the whole audio.
  Change to: take a list of segment audio paths from stage 4, transcribe each, return per-segment transcripts.
- [ ] **Add `url_analyzer.py` (stage 1)** — extract metadata (title, duration, channel) without
  downloading the full video. Use `yt-dlp --dump-json`.
- [ ] **Wire `run_new_pipeline` into `routers/youtube_router.py` + `routers/local_router.py`** behind
  `PIPELINE_VERSION=2` flag. Old pipeline path stays as `PIPELINE_VERSION=1`.

### 🔴 Day 3+

- [ ] **End-to-end pipeline test** — `tests/test_pipeline_e2e.py`: feed a real YouTube URL, assert
  9 stages complete, assert clip files exist on disk
- [ ] **Move `generate_ass_subtitle` to `pipeline/captions.py`** (stage 9 cleanup)
- [ ] **Cloud deploy** — Vercel (frontend) + Fly/Railway/Render (backend) with Postgres
- [ ] **Real `yolov10n-face.pt`** — download proper face model, drop into `backend/models/`
- [ ] **Cleanup the 18 dirty files** — commit as `wip: existing pipeline fixes` on
  `wip/transcript-fetcher` branch

### ❄️ FUTURE (not Day 2-3)

- ICL feedback loop (Taste/Niche)
- Per-creator prompt history wiring
- Engagement metrics webhooks
- `taste/store.update_metrics` from real publication data
- Anything in `PIPELINE-VISION.md` that's not in the 9-stage flow

### ⚠️ Blocked on Deepraj (Day 2 inputs needed)

1. **EPS official cloud subscription credentials** (5 min away per last message)
2. Niche defaults (3-5 cold-start niches) — only needed when taste/ICL activates
3. **Decide the dirty-files policy** — commit them as `wip:` or restart from MVP commit?
4. **Quality floor (0.7) sanity check** — is 0.7 too strict? Too loose? Start permissive and tighten.

## Tests status

- 66 total, all passing
- Coverage:
  - `pipeline/orchestrator.py`: 7 tests (smoke)
  - `pipeline/hooks.py`: 11 tests
  - `pipeline/surgical.py`: 0 tests yet (adds when segment refactor lands)
  - `taste/icl.py`: 9 tests (frozen)
  - `taste/selector.py`: 7 tests (frozen, except `_fallback_selection` used as live fallback)
  - `taste/store.py`: 6 tests (frozen)
  - `task_store.py`: 9 tests (existing + 1 new)
  - `transcript_fetcher.py`: 7 tests (existing + 1 new)
  - misc: 10 tests

## Files added/modified today (uncommitted — your call tomorrow)

```
A junk/                                              # 5 junk files + README
A junk/README.md
A PIPELINE-VISION.md
A DAY1-QUALITY-TIPS.md
A DAY1-STATUS.md
M backend/pipeline/__init__.py                       # added 4 new exports
A backend/pipeline/hooks.py                          # NEW (stage 3)
A backend/pipeline/surgical.py                       # NEW (stage 4)
A backend/taste/__init__.py                          # NEW package
A backend/taste/icl.py                               # NEW (ICL prompt)
A backend/taste/selector.py                          # NEW (LLM result → clips)
A backend/taste/store.py                             # NEW (creator history)
A backend/tests/test_new_pipeline_modules.py         # NEW (35 tests)
M backend/utils/task_store.py                        # _run_async fix
M backend/tests/conftest.py                          # regression fixture
M frontend-next/src/app/page.tsx                     # lint fixes
M frontend-next/src/components/CookieBanner.tsx      # lint fix
```

## Lane structure (when opencode picks up)

```
lane/llm-providers           # Day 2: claude/deepseek/MiniMax providers + config wiring
lane/surgical-routing        # Day 2: refactor routers to use new pipeline order
lane/transcription-segments  # Day 2: segment-based transcription
lane/icl-feedback-loop       # Day 3+: wire engagement metrics back to ICL
lane/e2e-pipeline-test       # Day 3+: real-URL end-to-end
lane/frontend-youtube-flow   # Day 3+: missing UI flows
lane/cleanup-wip-files       # Decide: commit dirty files or restart from MVP
```
