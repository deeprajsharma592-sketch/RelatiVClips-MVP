# RelatiV — Future Pipeline Vision (Day 1 hand-off)

> **Status:** Design only. **Do not implement.** Saved per Deepraj's instruction.
> **Date:** 2026-06-10 · **Source:** Deepraj's hand-drawn diagram + Discord commentary.

---

## The new pipeline (9 nodes, async/parallel where possible)

```
┌────────┐   ┌────────┐   ┌───────────┐   ┌────────┐
│ YT-DLP │ → │ Audio  │ → │ Transcript│ → │  Hook  │ ─┐
│ audio  │   │ Librosa│   │faster-wsp │   │multi-  │  │ JSON parse
│ only   │   │ >1.5s  │   │           │   │  LLM   │  │
└────────┘   └────────┘   └───────────┘   └────────┘  │
                                                      ↓
                            ┌─────────────────┐   ┌────────────┐
                            │ Video Download  │ ←─│  Hook JSON │
                            │ yt-dlp by       │   │ timestamps │
                            │ timestamps      │   └────────────┘
                            └─────────────────┘         │
                                    ↓                   ↓
                            ┌──────────────┐      ┌────────────┐
                            │ Face Detect  │      │Taste/Niche │
                            │ YOLOv10      │      │ ICL live   │
                            │ 9:16 crop    │      │ data       │
                            └──────────────┘      └────────────┘
                                    ↓                   ↓
                                    └───→ FFMPEG ←─────┘
                                           (video editor)
                                              ↓
                                           OUTPUT
                                        2-5 clips
```

## What changes vs current 6-stage pipeline

| # | Current | Future | Why it matters |
|---|---|---|---|
| 1 | **Full video download** in stage 1 (`ingestion.py`) | **Audio-only** in stage 1, **deferred video download** by hook timestamps in stage 5 | **Single biggest perf + bandwidth win.** Currently we download GBs and discard 95%. New flow: maybe 200MB total. |
| 2 | AI clip selection fused with hook logic | **Hook is its own stage** with explicit multi-LLM support (Claude, deepseek, MiniMax) | Lets you pick the right LLM per use case. Quality / cost / latency tradeoffs become configurable. |
| 3 | No "taste" concept | **NEW: Taste/Niche stage** after Hook | This is the creator's edge. Without it, every clip feels generic. With it, the engine has a *signature*. |
| 4 | `MIN_CLIPS = 3` hardcoded | **2-5 clips** decided per-video by the LLM | More honest — sometimes a video has 2 great moments, sometimes 5. |
| 5 | Face detection feeds the renderer directly | Face detection feeds both renderer AND Taste/Niche | Lets the LLM see face prominence / emotion when picking the hook. |
| 6 | One LLM call, no memory | **ICL with live data** in Taste/Niche | The moat. Every generated clip becomes signal. The engine *learns the creator* over time, in-context, no retraining. |

## The ICL loop — what "live data" likely means

In-Context Learning = putting examples into the prompt at inference time, not training. Cheap, fast, per-creator.

Deepraj said the Taste/Niche LLM should acquire taste from "live data". Candidates for what goes in the prompt:

| Source | What it provides | How to fetch |
|---|---|---|
| **Creator's own previous clips** | Style, topics, hook patterns that worked | `outputs/{creator_id}/*.json` from prior runs |
| **Performance of those clips** (if user shares) | What actually landed | Manual upload or `youtube_router` returns engagement metrics |
| **Trending clips in the same niche** | What's working *right now* | Periodic scrape of YouTube/TikTok top videos in declared niche |
| **The current video's own hook candidates** | Specific signal about THIS content | Comes from upstream Hook stage |
| **Cross-creator style library** (opt-in) | Patterns the LLM has seen work for similar creators | Anonymized prompt-cache |

**Cold-start question:** what does the prompt look like for a brand-new creator? Probably:
- "Here are the top 10 trending clips in {niche} this week"
- "Here are the 5 hook candidates from this video"
- "Generate 2-5 clip plans optimized for {niche} × {creator's stated vibe}"

After 50 videos, you have enough creator-specific data to bias the prompt toward their style.

## Multi-LLM hook layer

| LLM | Strength | Weakness | When to use |
|---|---|---|---|
| **Claude** (Sonnet 4) | Best narrative/hook reasoning, long context | Cost, latency, needs API key | Default for creators with budget |
| **Deepseek** | Cheap, surprisingly good at structured JSON | Less reliable on subtle emotion | Cost-optimized tier, batch runs |
| **MiniMax** (this model) | Fast, decent quality, no API key needed | Slightly less polish on narrative arcs | Free tier, dev mode, latency-sensitive runs |

User can pick via env var or per-creator config. Taste/Niche is the "tie-breaker" — if all three LLM hooks are similar, the cheap one wins.

## "redeem-host LLM" — clarification needed

The diagram has a phrase I can't read cleanly. Possible readings:
1. **"remote-host LLM"** — fallback to a cloud LLM when local fails
2. **"reasoning-host LLM"** — an LLM specialized for reasoning (vs. fast generation)
3. **"review-host"** — re-evaluate the URL's host (e.g., YouTube vs. Vimeo) and pick a different LLM
4. **Typo** — Deepraj meant something else entirely

**Question for Deepraj:** which one?

## Strategic notes (Hermes's review)

1. **Deferred download is the biggest single perf win.** Current code downloads the full video upfront; new flow only downloads segments around hook timestamps. Realistic estimate: **10-20× less bandwidth, 3-5× faster end-to-end** for the typical case.

2. **Multi-LLM hook layer is resilience + cost optimization.** It also means we can A/B test the hook layer against the final clip quality without touching the rest of the pipeline.

3. **Taste/Niche separation is correct.** It should NOT touch video bytes. It produces **edit commands** that FFMPEG executes. Clean separation: LLM = decision, FFMPEG = execution.

4. **ICL over live data is the moat.** No other short-form tool does per-creator taste learning in-context. This is the long-term differentiator.

5. **Output range 2-5 is healthy.** Hardcoding 3 is lazy. Let the LLM decide based on actual content quality.

## What's saved where

- `fact_store` (this session): 3 facts tagged `pipeline-vision`, `ICL`, `strategy`
- This file: `/app/RelatiV/PIPELINE-VISION.md`
- Image references: `/root/.hermes/image_cache/img_2015e9f7dfee.png`, `img_778e9d7b77d4.png`

## Open questions for Day 2 (when Deepraj unblocks)

1. **What does "redeem-host LLM" mean?**
2. **What's the ICL prompt shape for cold-start (no creator history)?**
3. **Live data source for cross-creator trends** — own scrape, or partner with a trends API (e.g., TubeFilter, TrendTok)?
4. **Taste/Niche output format** — free-form prose, structured JSON edits, or a DSL?
5. **FFMPEG edit-command surface** — what primitives does the LLM need? (trim, split, zoom, overlay text, transitions, B-roll insertion, color grade?)
6. **Per-creator vs per-niche taste** — is taste tied to a specific creator, or to a niche that any creator can opt into?
7. **Performance feedback loop** — does the user manually mark which clips worked, or do we scrape engagement from the destination platform?
