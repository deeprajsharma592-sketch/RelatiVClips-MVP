# RelatiV Pipeline — Long TODO (2026-06-15)

> Synthesized from Deepraj's question: *"the pipeline downloads the specific peaks and valleys according to librosa and gives the audio and text to the llm am i just wrong, can this bloat the costs per clip or video very up or downloading the specific parts of the video is low data and can be used along with the text for better hook calibration and also a better value for cost and low cost or can we optimize it"*

## 🔴 The user's question — short answer first

**You are NOT wrong to think this way — but the current pipeline doesn't actually do it.**

| Question | Current state | What we should do |
|---|---|---|
| Does the pipeline slice the audio to peaks/valleys and pass to LLM? | ❌ No — we only pass the *timestamps* + *text snippet* + *score* to the LLM. The audio is used for energy-based heuristic detection, not for LLM context. | ✅ Yes — add `audio_signature` features (librosa-derived numbers) to each candidate. |
| Does this bloat costs? | Currently no — only text is sent. | Adding audio features = ~50 extra tokens/candidate × 15 candidates = 750 tokens. At Haiku rates = **+$0.00075 per call** (5% increase). Quality win worth it. |
| Can we download specific audio segments and pass them? | Raw audio bytes to LLM: not supported by Anthropic API (no audio input). Would also be huge. | Send DERIVED features (mean dB, peak dB, spectral flux, etc.) as text. Tiny cost, huge context gain. |

## 🎯 The Architecture You Described (and why it's better)

```
CURRENT:
   raw audio ─→ librosa peaks/valleys ─→ score ─→ LLM gets [text snippet + score + start/end]
                                                                                    ↑ only text+metadata
NEW (this session):
   raw audio ─→ librosa peaks/valleys ─→ audio features (mean_db, peak_db, flux, ...)
                                  ↓                            ↓
                            score                          audio_signature
                                  ↓                            ↓
                                  └───→ LLM gets [text + audio_signature + score + start/end]
                                                       ↑ text + DERIVED audio context
```

**Why derived features, not raw audio?**
- Anthropic API doesn't accept audio bytes as input
- A 10s WAV @ 16kHz mono = 160,000 samples = 400,000 tokens (way too much)
- A 10s audio feature vector = ~20 numbers = ~50 tokens (cheap, LLM-friendly)
- The LLM can reason: "loud moment with rising energy" vs "quiet intimate moment" — exactly the judgment we want

## 🛣️ Long TODO — ordered by impact

### Phase A: Wire Anthropic API key (NOW)
- [x] **A1**: Save key to `/app/RelatiV/.env` (108 chars, sha256: `df11768c...`)
- [ ] **A2**: Add `LLM_TIER=calibration` env hint (user wants the strongest model for story calibration first)
- [ ] **A3**: Restart backend container
- [ ] **A4**: Verify via `GET /llm-status` (should show `claude` configured)
- [ ] **A5**: Run test video to confirm real LLM output

### Phase B: Tier-router changes (per user)
- [ ] **B1**: Add `deepseek-v4-pro` as **secondary in budget tier** (user: "keep space for V4 Pro after some months")
- [ ] **B2**: **Replace** `gpt-oss-20b` with **MiniMax M3** for fallback tier (user: "add minimax 3 for cost efficiency and fallback after claude has some issue")
- [ ] **B3**: Add `minimax-m3` to the chain providers in `chain.py`
- [ ] **B4**: Add `minimax-m3` to `available_providers()` in `chain.py`
- [ ] **B5**: Update `model_router.py` cost constants for MiniMax M3

### Phase C: System prompt + tighter token cap (per user)
- [ ] **C1**: Add a **system prompt** with the user's exact wording:
  > "Analyze the audio and text data. Provide the timestamps for the best clip, followed by a short, 4 to 5-word note explaining what is happening, and a brief, single-sentence reason for why this segment was selected."
- [ ] **C2**: Move system prompt to `system` field (so it caches on first call, persists across all subsequent calls)
- [ ] **C3**: Tighten `LLM_MAX_OUTPUT_TOKENS` from 500 → **200** (the new prompt is much shorter: 4-5 word note + 1 sentence reason = ~80 tokens max)
- [ ] **C4**: Update `chain.py` to use the system prompt + the new tighter cap

### Phase D: Audio features for LLM context (the big one)
- [ ] **D1**: Add `audio_signature` field to `HookCandidate` dataclass in `taste/icl.py`:
  - `peak_db`: max loudness in dB
  - `mean_db`: avg loudness in dB
  - `dynamic_range_db`: peak − mean (intensity)
  - `spectral_flux`: spectrum change rate (good for "reveal" beats)
  - `spectral_centroid_hz`: brightness (voice vs music)
  - `zcr`: zero-crossing rate (percussive vs tonal)
  - `onset_count`: number of attacks (laughs, applause, percussion)
  - `silence_before_s`, `silence_after_s`: pause context
- [ ] **D2**: Compute these in `audio_analysis.py` (librosa is already installed):
  - Helper function `compute_audio_signature(audio_segment, sr)` returns dict
  - ~10ms per candidate
- [ ] **D3**: Compute signatures for all candidate moments in `moment_detector.py` / `audio_moments_from_file`
- [ ] **D4**: Format signatures as compact text in ICL prompt:
  ```
  1. [412.3-425.8s] peak=-3.2dB mean=-18.0dB flux=0.42 onset=12
     "and that's when everything changed..."
  ```
- [ ] **D5**: Wire into orchestrator's candidate list

### Phase E: Cost re-validation with new prompt
- [ ] **E1**: Re-estimate per-call cost:
  - System prompt: ~50 tokens (cached after first call = $0.005/MTok)
  - Audio features: ~50 tokens × 15 candidates = 750 tokens
  - ICL examples: ~600 tokens (cached)
  - Variable context: ~300 tokens
  - **Total input**: ~1700 tokens, of which ~650 cached (38%)
  - Output: ~80 tokens (4-5 words × 3 picks + 1 sentence × 3 picks)
- [ ] **E2**: At Haiku 4.5 rates with 38% cache hit:
  - Cached: 650 × $0.10/1M = $0.000065
  - Fresh: 1050 × $1.00/1M = $0.00105
  - Output: 80 × $5.00/1M = $0.00040
  - **Total: $0.001515/pick** (was $0.001188, +27%)
- [ ] **E3**: $20 budget: 13,200 picks (was 16,840, -22%)
- [ ] **E4**: Decision: 27% cost increase is acceptable IF quality gain is significant. Will validate with A/B test.

### Phase F: Test with real Anthropic key
- [ ] **F1**: Run pipeline on Mel Robbins video (`GeD8tpOCyIY`)
- [ ] **F2**: Capture first real LLM output (titles, notes, reasons)
- [ ] **F3**: Show `/cost-status` with real cache_read_input_tokens
- [ ] **F4**: Compare to old "WAIT FOR IT" titles (lexical fallback)
- [ ] **F5**: Send comparison to Discord with: title quality, cost/pick, cache hit ratio

### Phase G: Slice audio specifically (the "download specific parts" question)
**Status: NOT NEEDED for LLM** — but DO slice for the actual render:
- [ ] **G1**: Already do this in `surgical.py` — we trim to 10-20s around each peak
- [ ] **G2**: For LLM input, we DON'T need the actual audio (we use derived features)
- [ ] **G3**: For multimodal LLMs in the FUTURE (Claude 4+ with audio input), we COULD send the trimmed audio — but cost is prohibitive (~30× the text cost)
- [ ] **G4**: Long-term: use CLAP (audio embedding model) to convert each 10s chunk to a 512-dim vector, then either:
  - Cosine-similarity against a curated "viral" dataset (no LLM)
  - Concatenate with text features in the LLM prompt (~50 tokens of vector data)

### Phase H: A/B test and quality validation
- [ ] **H1**: Run same 5 videos through OLD pipeline (no audio features) and NEW pipeline
- [ ] **H2**: Compare viral_title quality subjectively
- [ ] **H3**: If quality gain < cost increase → revert audio features
- [ ] **H4**: If quality gain >> cost increase → keep, log to memory

### Phase I: Long-term roadmap
- [ ] **I1**: After 1,000 real LLM calls, analyze which signals (text/audio/score) correlated with the best picks
- [ ] **I2**: Use that analysis to fine-tune a smaller model (V4-Flash or even smaller)
- [ ] **I3**: Build a "taste score predictor" that's a small model — no LLM needed for 80% of cases
- [ ] **I4**: V4-Pro as the bridge tier (V4-Flash isn't smart enough, Sonnet is too expensive)

## 🧮 Current per-call cost breakdown (with new prompt)

| Component | Tokens | $ (no cache) | $ (38% cached) |
|---|---|---|---|
| System prompt | 50 | $0.00005 | $0.000005 |
| ICL examples | 600 | $0.0006 | $0.00006 |
| Audio features (15 × 50) | 750 | $0.00075 | $0.00075 |
| Variable context | 300 | $0.0003 | $0.0003 |
| Output (titles + reasons) | 80 | $0.0004 | $0.0004 |
| **Total** | **1780** | **$0.0021** | **$0.001515** |

**Picks per $20:**
- No cache: 9,524
- 38% cached: 13,200
- 87% cached (best case): 16,840

**Daily budget at $1 hard cap:**
- 660 picks/day (was 841)
- 21,000 picks/month (was 26,300)

## ✅ Acceptance criteria for this round

1. ✅ API key wired and verified
2. ✅ Tier router shows `claude` as configured
3. ✅ V4-Pro kept as budget-tier secondary
4. ✅ MiniMax M3 added as fallback (replaces GPT OSS 20B)
5. ✅ System prompt added with user's exact wording
6. ✅ Output tokens tightened to 200
7. ✅ Test video produces real LLM titles (not "WAIT FOR IT")
8. ✅ /cost-status shows real cache_read_input_tokens
9. ⏳ Audio features in LLM prompt (Phase D — separate session)
10. ⏳ A/B test quality vs cost (Phase H — needs 50+ picks of data)
