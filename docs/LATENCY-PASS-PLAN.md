# Latency pass plan — queued for after 4-6h of iteration (per CTO directive)

> **Status:** Plan, not implementation. Ask before executing — this touches
> the orchestrator (production path) and RunPod (paid GPU).

## Current latency profile (real data, n=5 each, synthetic inputs)

| Stage | Median | p95 | Where the time goes |
|---|---|---|---|
| 1. URL analyze (yt-dlp --dump-json) | 1.9s | 2.2s | Network to YouTube for metadata |
| 2. Audio energy (librosa RMS) | n/a | n/a | Needs a real WAV; will profile on Hetzner |
| 3. Hook detection (energy peaks → candidates) | <0.1s | <0.1s | Local CPU; not a bottleneck |
| 4. Surgical segment download (yt-dlp) | 5-30s | n/a | Network-bound; bgutil helps but IP reputation still matters |
| 5. Per-segment transcription (RunPod) | 3-15s | n/a | Network-bound; depends on #clips |
| **6. Taste selector (Claude Haiku)** | **6.4s** | **7.8s** | **Single LLM call, all candidates in one prompt** |
| 7. Face detection (YOLO) | 2-4s | n/a | Local CPU; per-clip loop |
| 8. Render (ffmpeg) | 1-3s | n/a | Per-clip, sequential |
| 9. Captions (ffmpeg + srt) | 0.5-1s | n/a | Per-clip |
| **End-to-end (estimated)** | **~25-60s** | n/a | Sequential, no parallelization |

## Top 5 latency wins, ranked by impact vs risk

### 1. **Parallelize stage 7-9 across clips** (HIGH IMPACT, LOW RISK)
The 3 final stages (face detection, render, captions) run sequentially
per clip. For a 10-clip output, that's 10x the per-clip cost.

**Fix:** `asyncio.gather()` all clips through stages 7-9 concurrently.
- **Impact:** 10-clip output goes from ~40s to ~8s in the final stages
- **Risk:** Low. ffmpeg + YOLO are both thread-safe, and we already have
  the per-clip boundaries well-isolated.
- **Cost:** None.

### 2. **Stream the Claude Haiku response** (MEDIUM IMPACT, LOW RISK)
Currently `llm_callable(prompt)` blocks until the full response arrives.
Haiku tokens stream at ~80 t/s; for a 400-token response that's ~5s.
If we start rendering stage 7+ for clip #1 as soon as Haiku finishes
token #50 of clip #2, we overlap latency.

**Fix:** Switch to `anthropic.messages.stream()`. Parse token-by-token
into a queue; orchestrator pulls from queue as clips become ready.

**Impact:** ~30-50% wall-clock reduction for clips 2-10 in batch.
**Risk:** Low. Streaming is well-supported; just need to keep parser
state across tokens.
**Cost:** None.

### 3. **Connection pool + warmup to Claude API** (LOW IMPACT, LOW RISK)
Each Claude call does a TLS handshake. With a persistent httpx
client and HTTP/2, the first-byte latency drops ~200ms.

**Fix:** Singleton `httpx.AsyncClient` in the Anthropic provider,
keep-alive + HTTP/2.

**Impact:** ~200-500ms per call.
**Risk:** Very low.
**Cost:** None.

### 4. **RunPod worker pool: scale 1 → 3** (MEDIUM IMPACT, MEDIUM RISK)
Each stage 5 transcription call currently hits 1 RunPod worker. If
we fan out 3 parallel workers (one per segment), a 10-clip output
finishes in 1/3 the wall-clock time. The workers themselves are
already parallelizable (insanely-fast-whisper with batch_size=8).

**Fix:** RunPod endpoint config: change `workers_min=1, workers_max=1`
to `workers_min=2, workers_max=4`. The autoscaler will pull 2-4
workers as needed.

**Impact:** ~3x speedup on transcription. ~3-5s shaved per pipeline run.
**Risk:** Medium. Higher idle cost (always 2 workers running, even at
zero traffic). Need to know RunPod billing math before scaling.
**Cost:** 2-4x the per-hour RunPod cost. Currently ~$0.50/hr
per worker, so 4 workers idle = $2/hr always. Worth it at 50+ users/day,
NOT worth it at <5.

### 5. **Pipeline: parallelize stage 1 (URL analyze) with stage 2 prep** (LOW IMPACT, LOW RISK)
URL analyze takes 1.9s; the rest of the pipeline can't start until
it's done. We can start the audio download (stage 4 prep) in parallel
with stage 1, since the URL analyze result is only needed to confirm
the source type.

**Fix:** Refactor orchestrator to start stage 4's download in parallel
with stage 1's analyze.

**Impact:** 1-2s shaved per pipeline run.
**Risk:** Low. The download URL is known at task start.

## What I'm NOT recommending (for now)

- **Multi-worker uvicorn:** `MAX_CONCURRENT_TASKS=1` is hard-coded. Going
  to 2-3 workers would 2-3x throughput at the cost of 2-3x memory. Worth
  doing after we know the per-task memory profile from the Hetzner
  deploy. Not before.
- **Switching Haiku → Sonnet for taste selector:** Son quality is higher
  but ~10x cost. Save for the "premium tier" feature if/when that exists.
- **Caching taste selections across videos:** Already done via
  `taste_store.py` for repeat creators. Not relevant for first-time
  videos.

## What I need from you (Deepraj) before executing

1. **Green-light wins 1-3** (parallelize clips + stream Claude + connection
   pool)? All are code changes to the orchestrator, no infra cost.
   Net: ~30-50% wall-clock reduction per pipeline run, free.

2. **Green-light win 4** (RunPod workers 1 → 2-4)? Requires you to know
   the RunPod billing math. If you don't already pay for always-on
   workers, this is +$1-2/hr idle cost. Worth it if you're at
   >50 pipeline runs/day, not before.

3. **Profile-after-deploy timing?** I want real audio energy + render
   numbers from the Hetzner deploy before committing to the parallel
   stages 7-9. Estimated 2-3 days of real traffic needed for a useful
   profile. Until then, item 1's 10x→1x speedup is theoretical.

**My recommendation:** ship wins 1-3 now (low-risk, free, real wins),
hold win 4 until you have RunPod data. Profile items 2, 3, 5 only
matter if items 1-3 are in.
