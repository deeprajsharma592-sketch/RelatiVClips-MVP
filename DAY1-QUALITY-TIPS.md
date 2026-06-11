# RelatiV — Clip Quality & Resource Tips (Day 1)

> Living document. Edit as you learn what works on real content.
> Architecture reference: `backend/pipeline/` + `backend/utils/config.py`.

The pipeline is 6 stages: **download → audio peaks → transcribe → AI select → face detect → render**.
Each stage has levers. Below is what each lever costs, and what it buys you.

---

## Stage 1 — Download (`ingestion.py`, `transcript_fetcher.py`)

| Lever | Current | Why it matters | Cost |
|---|---|---|---|
| `YTDLP_FORMAT` | `best[height>=720]/best` | Forces ≥720p source → better face crops, less upscale blur | None |
| `SURGICAL_DOWNLOAD_SECONDS` | `90` | You only need a 90s window around each candidate peak — saves bandwidth | None for short clips; HUGE for long videos |
| `SURGICAL_TOP_N_CANDIDATES` | `5` | Only download audio for the top 5 energy peaks | Cuts Whisper work by 5-10× |
| `SURGICAL_BUFFER_SECONDS` | `10` | Pad each clip download with 10s head/tail for safe seek | Negligible |
| `COOKIES_PATH` | unset | YouTube bot-detection bypass; required for >50% of videos | One-time `yt-dlp` export |

**Tip:** the YouTube router already does surgical download per peak. The local router doesn't. If you find local uploads are 5GB+, the same `SURGICAL_*` pattern applies.

---

## Stage 2 — Audio peaks (`audio_analysis.py`)

| Lever | Current | Tradeoff |
|---|---|---|
| `TARGET_SAMPLE_RATE` | `16000` | Whisper's native rate; no resample cost |
| `PEAK_THRESHOLD_MULTIPLIER` | `1.5` | **Lower = more candidates, noisier. Higher = fewer, cleaner.** For speech-heavy podcasts 1.3-1.4 picks up "quiet emphasis"; for music videos stay at 1.5+ |
| `hop_length` (hardcoded `512`) | 512 | ~32ms frames. Smaller = finer peaks but 4× the memory. RTX 5050 can handle 256 without breaking a sweat |
| Window for peak grouping (not yet implemented) | — | If you have 50 peaks in 5 minutes, your clips will be 50 tiny slices. Recommend: 8s minimum gap between peaks |

**Tip:** add a "peak density" metric to the response so you can see if a video is "dense" (many candidates → lower threshold) or "sparse" (few → already good).

---

## Stage 3 — Transcription (`transcription.py`)

This is the **biggest resource sink** — ~40% of pipeline weight. Whisper is the GPU hot spot.

| Lever | Current | Quality delta | Resource cost |
|---|---|---|---|
| `WHISPER_MODEL` | `base` | `small` = ~+30% WER improvement, 2× VRAM. `medium` = best, 5× VRAM. `large-v3` = overkill for short-form | RTX 5050 has 8GB; `medium` int8 fits, `large-v3` does not |
| `WHISPER_COMPUTE_TYPE` | `int8` | `float16` on CUDA is **2-3× faster** than int8 with **no quality loss** (CTranslate2 quantizes back). Use `int8` only for CPU | This is the single biggest perf win available — `int8` on GPU is a CPU-style quantization for an already-fast model |
| `beam_size` | `5` | `3` is 1.5× faster, ~1% WER cost. `1` (greedy) is 3× faster, 3-5% WER cost. For clip selection, greedy is fine | Memory mostly the same |
| `word_timestamps` | `True` | Required for hook-level caption alignment. Disable if you only need segment-level | Saves a pass over the model |
| `vad_filter` | `True` | **Huge win** — skips silence entirely. Without it, Whisper hallucinates on quiet sections. Keep on | Faster + more accurate |
| `vad_parameters.min_silence_duration_ms` | `500` | Lower = more aggressive silence splitting (shorter segments, more speaker turns). 300ms is good for podcasts | Negligible |

**Recommendation:** change `WHISPER_COMPUTE_TYPE` to `float16` when `cuda_available`, fall back to `int8` for CPU. Currently the code path is `device="cuda", compute_type=int8` which is the worst of both worlds.

---

## Stage 4 — AI clip selection (`clip_selector.py`, `claude_client.py`, `vision_clip_selector.py`)

| Lever | Current | Tradeoff |
|---|---|---|
| Claude enabled | needs `ANTHROPIC_API_KEY` | Best narrative picks. Energy peaks = "loud moments"; Claude = "moments that make sense" |
| `NUM_CLIPS_LOCAL` | `3` | Hard floor. `MIN_CLIPS = 3` guarantees you never ship an empty list |
| `CLIP_DURATION_MIN/MAX` | `10/20` | Sweet spot for Shorts/TikTok. Below 10s = no room for a hook. Above 25s = drops in retention |
| `validate_clips` interval dedup | `0.1s` | Prevents two clips within 100ms of each other. Reasonable |
| Energy-peak fallback | Yes | When Claude is unavailable, falls back to top-N energy peaks. Result: clips are "exciting" but not always "meaningful" |

**Tip:** the "hook calibration" feature is the missing piece. A 0-3s "hook score" per candidate (computed from word timestamps, emphasis, surprise words) would let you pick clips by *hook strength* not just *loudness*. This is what `select_clips_with_claude` should be doing once the API key is wired.

---

## Stage 5 — Face detection (`face_detection.py`)

| Lever | Current | Issue |
|---|---|---|
| YOLO model | `yolov10n-face.pt` (falls back to `yolov10n.pt`) | **`yolov10n-face.pt` is not in `backend/models/`** — code falls back to general `yolov10n.pt` which detects everything, not just faces. This makes face-tracked crops noisier than they should be |
| `min_confidence` | `0.3` | Higher = fewer false faces, but may miss a tilted head. 0.4 is a good default for cleaner output |
| Detection frequency | not yet batched | Currently detects per-frame. For a 30s clip at 30fps that's 900 detections. **`get_batch_face_data` exists but isn't the default path** — switching to one detection per 0.5s (60 detections per clip) is 15× faster with negligible tracking quality loss |
| `CROP_WIDTH × CROP_HEIGHT` | `608 × 1080` | True 9:16. Slightly low width — 720p is the platform norm for Shorts. Going to `720×1280` doubles pixels → ~2× encode time |

**Biggest win:** download the proper `yolov10n-face.pt` model and use the batched detector.

---

## Stage 6 — Rendering (`renderer.py`)

| Lever | Current | Tradeoff |
|---|---|---|
| `FFMPEG_PRESET` | `p5` | `p4` = ~30% slower encode, ~10% smaller file. `p3` = ~2× slower, ~25% smaller. For a production pipeline, `p4` is the sweet spot |
| `FFMPEG_CQ` | `28` | **Lower = better quality, larger file.** 28 is YouTube's default (visually lossless for most content). 24 = 2× file size for marginal visual gain. 32 = 1/2 file size, visible blockiness on motion |
| `FFMPEG_AUDIO_BITRATE` | `128k` | Right for AAC stereo. 96k is enough for speech. 192k is wasted on shorts |
| Vertical/landscape handling | Both | For vertical source, the code keeps as-is + scales. For landscape, center-crops with face tracking. This is correct |
| Subtitle embedding | `generate_ass_subtitle` | ASS = styled subtitles. Baked-in subtitles can't be edited by the user — consider burning them in only when the user requests |

**Resource math (RTX 5050, 8GB VRAM, p5/CQ28):**
- Encode 30s of 1080p H.264: ~3-5s encode, ~150-300MB file
- Bump to p4/CQ24: ~6-10s encode, ~200-400MB file
- Bump to 720×1280: ~2-3s encode, ~100-200MB file (faster!)

**Sweet spot for short-form:** `p4`, `CQ 26`, `720×1280`, 128k audio. ~50% quality lift, file size still well under 300MB.

---

## Cross-cutting

| Lever | Current | Note |
|---|---|---|
| `MAX_CONCURRENT_TASKS` | `1` | Correct for 8GB VRAM with `medium` Whisper. If you stick with `base` you can run 2 |
| `MAX_VRAM_GB - VRAM_BUFFER_GB` | `8 - 5 = 3GB` | Very tight. Most of the buffer is for Whisper's KV cache. With `base` int8 you can drop buffer to 3GB and gain a concurrent slot |
| `FILE_RETENTION_HOURS` | `24` | 24h to download, then auto-cleanup. Reasonable for personal use; consider 6h for shared deployments |
| `MAX_DISK_USAGE_MB` | `150` | Hard cap on temp dir. With surgical download, you'll never hit this. Without, you'll thrash |

---

## What I'd attack first (if I were you)

1. **Fix `WHISPER_COMPUTE_TYPE` → `float16` on CUDA.** Single line in `transcription.py`. 2-3× Whisper speedup, no quality cost.
2. **Add `yolov10n-face.pt` to `backend/models/`.** Then change `face_detection.py` to use the batched path by default. Better face crops, 15× faster detection.
3. **Once Claude is wired:** add a "hook score" computed from word-timestamp features (first word emphasis, question intonation, surprise lexicon). Use it as a tie-breaker in `_fallback_selection` so non-Claude runs are smarter too.
4. **Bump render preset to `p4` + `CQ 26`.** Visible quality win, encode still under 10s for 30s clips.
5. **Add a "peak density" metric** so you can see when the threshold is wrong without watching 50 candidates.
