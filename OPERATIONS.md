# RelatiV — Operational Quickstart (5-minute config)

> For Deepraj, opencode, or any new agent. **Read this first.**
> Goal: get a working `.env` and know which API calls cost what.

## TL;DR

```bash
# 1. Backend deps
cd /app/RelatiV
backend/.venv/bin/pip install -r backend/requirements.txt

# 2. Frontend deps
cd frontend-next && npm install && cd ..

# 3. Verify everything is green
bash scripts/quality-gate.sh
backend/.venv/bin/python -m pytest backend/tests/ -q
# → 99 passed (or 95 if no network/Claude key)

# 4. Run it
cd backend && ../backend/.venv/bin/uvicorn main:app --host 0.0.0.0 --port 9000 --reload
# In another terminal:
cd frontend-next && npm run dev
# → localhost:3000
```

## The `.env` file (the only config you need)

Location: `/app/RelatiV/.env` (chmod 600, gitignored). Here's a working template:

```ini
# ─── Claude (free tier works for testing, paid for production) ───
# Get from: https://console.anthropic.com/settings/keys
ANTHROPIC_API_KEY=*** your key
# Default: claude-haiku-4-5-20251001 (works, fast, cheap).
# Override for higher quality: claude-3-5-sonnet-20241022 (may 404 on newer accounts)
CLAUDE_MODEL=claude-haiku-4-5-20251001

# ─── RunPod Serverless (for cloud Whisper when YouTube has no captions) ───
# Get from: https://www.runpod.io/console/serverless → your endpoint → API tab
RUNPOD_API_KEY=*** your key
RUNPOD_ENDPOINT_URL=https://api.runpod.ai/v2/8mhjiplxs8vmyh/run
RUNPOD_WHISPER_MODEL=turbo

# ─── YouTube auth (required for non-captioned videos) ───
# Export from your browser: https://github.com/yt-dlp/yt-dlp/wiki/FAQ#how-do-i-pass-cookies-to-yt-dlp
# Default path: /app/RelatiV/cookies.txt (chmod 600)

# ─── Pipeline version ───
# 1 = legacy 6-stage (audio → transcribe → select → face → render)
# 2 = new 9-stage (default — strategic direction)
PIPELINE_VERSION=2

# ─── Transcription provider (auto, local, or runpod) ───
# auto = RunPod if RUNPOD_API_KEY is set, else local faster-whisper
TRANSCRIPTION_PROVIDER=auto

# ─── Optional ───
OLLAMA_BASE_URL=http://localhost:11434  # For local Ollama vision model
VISION_ENABLED=false                    # Off by default (saves VRAM)
```

## The pipeline (what runs when)

**YouTube URL** → `POST /process/youtube` → **run_youtube_orchestrator** →
1. URL analyze (yt-dlp, no download)
2. **Cost-saver: try YouTube captions first** (transcript_fetcher, $0)
3. Surgical download (only 30-90s per clip)
4. Per-segment transcription (RunPod OR local Whisper, per-segment cost)
5. **Taste/Claude** (auto-selected: Claude > Deepseek > MiniMax)
6. Face detection (YOLOv10n)
7. Render (ffmpeg, vertical 9:16)
8. Captions (ASS subtitles, embedded)

**Local file** → `POST /upload` (multipart) → save to `temp/uploads/` →
`POST /process/local` with `{file_path: "..."}` → **run_local_orchestrator**
→ same 9 stages but with full audio available for energy peaks (stage 2-3).

## What costs what (per video)

| Stage | Cost | Notes |
|---|---|---|
| URL analyze (yt-dlp) | $0 | No download, metadata only |
| YouTube captions | $0 | ~80% of YouTube has auto-captions |
| Surgical download (yt-dlp) | $0 | Bandwidth, your server cost |
| Local Whisper (faster-whisper) | $0 | Uses your GPU/CPU |
| **RunPod Whisper** | **~$0.003-0.01 per segment** | Only when no captions |
| Claude (haiku-4.5) | **~$0.0001-0.001 per call** | Per video, 1 call |
| Claude (sonnet) | ~$0.01-0.05 per call | Higher quality, more expensive |
| Face detection (YOLO) | $0 | Local GPU |
| Render (ffmpeg) | $0 | Local CPU |

**Bottom line:** ~$0.003-0.015 per video with the cost-saver, or ~$0.01-0.05 without.
$10 RunPod credits = ~1000-3000 videos.

## API surface (what the frontend hits)

```
POST /upload              multipart video upload → {file_path, task_id}
POST /process/local       {file_path: "..."}    → {task_id, status}
POST /process/youtube     {url: "..."}          → {task_id, status}
GET  /status/{task_id}                          → {status, progress, clips}
GET  /logs/{task_id}                            → {logs: [...], count: N}
GET  /download/{clip_id}                        → video file
GET  /tasks                                    → {active, queued, max_concurrent}
GET  /vram                                     → {cuda_available, allocated_mb, ...}
GET  /health                                   → {status, version}
```

## Common errors (and the fix)

| Error | Fix |
|---|---|
| "Sign in to confirm you're not a bot" | Cookies file missing or expired. Re-export. |
| "n challenge solving failed" | yt-dlp version too old. We pin to venv 2026.06.09+ |
| "model: claude-3-5-sonnet-20241022" 404 | Set `CLAUDE_MODEL=claude-haiku-4-5-20251001` in `.env` |
| "No transcription provider available" | Set `RUNPOD_API_KEY` in `.env` OR use `TRANSCRIPTION_PROVIDER=local` |
| "field required: file" on /upload | Set `Content-Type: multipart/form-data` and use `files=` in the request |

## Rollback

```bash
# Switch back to legacy 6-stage pipeline
echo "PIPELINE_VERSION=1" >> /app/RelatiV/.env
# Restart the backend. Done.
```

## Tests

```bash
# All tests (95 unit + 2 E2E + 3 Claude live)
backend/.venv/bin/python -m pytest backend/tests/ -v

# Just the fast ones (skip network + paid API)
backend/.venv/bin/python -m pytest backend/tests/ \
  --ignore=backend/tests/test_e2e_youtube.py \
  --ignore=backend/tests/test_claude_live.py

# Quality gate (CI-style)
bash scripts/quality-gate.sh
```

## Key file locations

```
backend/main.py                   # FastAPI entry, all routes
backend/routers/youtube_router.py # /process/youtube + orchestrator swap
backend/routers/local_router.py   # /process/local + orchestrator swap
backend/pipeline/orchestrator.py  # 9-stage pipeline glue
backend/pipeline/hooks.py         # Stage 3 — energy + lexical + valley
backend/pipeline/surgical.py      # Stage 4 — segment download
backend/services/transcription.py # Stage 5 — RunPod vs local Whisper
backend/taste/icl.py              # ICL prompt builder + parser
backend/taste/selector.py         # LLM response → final clips
backend/taste/providers/__init__.py  # Claude/Deepseek/MiniMax
backend/utils/config.py           # All env-flag parsing
.cookies                          # YouTube auth (chmod 600)
.env                              # All API keys (chmod 600)
```
