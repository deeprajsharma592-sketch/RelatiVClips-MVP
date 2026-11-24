# RelatiV

AI video clipping engine. With media Intelligence and interms help you make your content viral. It learns your taste with time and gets better at clipping for you.

## Architecture

```
RelatiV/
├── backend/          # FastAPI server (port 9000)
│   ├── database/     # PostgreSQL models, session, repositories
│   ├── pipeline/     # Audio analysis, transcription, clip selection, rendering
│   ├── routers/      # local_router.py, youtube_router.py
│   └── utils/        # Config, task store, VRAM manager, cleanup
├── frontend-next/    # Next.js 16 / React 19 UI
│   └── src/
│       ├── app/      # Pages (Home, About, Services, Plans, Contact)
│       └── components/ # InputDropzone, ProcessingPipeline, OutputCanvas, etc.
└── docker-compose.yml # Caddy + Backend + PostgreSQL
```

## Quick Start

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 9000

# Frontend
cd frontend-next
npm install
npm run dev
```

### Docker

```bash
docker compose up --build
```

## Features

- **YouTube Processing** — Download, analyze, and clip YouTube videos via URL
- **Engagement Heatmap Signal Layer** — Multi-modal fusion of YouTube replay markers, Twitch clip density, chat burst metrics, audio energy (Librosa RMS + spectral flux), and transcript cadence to prioritize high-attention moments in long videos (>20 min) while filtering LLM context window to ≤35% of the video.
- **Narrative-Aware Variable-Length Clipping** — Replaces fixed-duration chunking with complete story arcs (Hook → Setup → Payoff). Valid clips range naturally from 12s to 120s based solely on the narrative unit boundaries, with zero mid-sentence cuts and 150–300ms audio breath padding.
- **Pre-Render Verification & Closing CTA** — Fast LLM verification check pass catches dangling references or missing payoffs, with smooth audio fade-out and optional closing call-to-action cards.
- **Local Processing** — 6-stage async pipeline (load → audio analysis → transcription → clip selection → face detection → render)
- **Privacy First** — All processing runs locally; no data leaves your machine
- **Clip Selection** — AI-powered via audio energy peaks, transcript analysis, and optional vision model (Ollama/Gemma)
- **Task Queue** — Automatic queue with PostgreSQL persistence and graceful in-memory fallback

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:9000` | Backend API base URL |
| `ANTHROPIC_API_KEY` | — | Claude API key for clip selection |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server for vision analysis |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `VISION_ENABLED` | `false` | Enable vision-based clip analysis |

## Tech Stack

- **Frontend:** Next.js 16, React 19, Tailwind 4, Framer Motion 12
- **Backend:** Python 3.12, FastAPI, SQLAlchemy 2.0 (async), PostgreSQL
- **AI/ML:** Librosa, faster-whisper, Ultralytics YOLOv10, Claude API
- **Infra:** Docker Compose, Caddy reverse proxy

---

## Feedback & Preference Points System

RelatiV incorporates a creator preference learning system that records user reactions to generated clips into structured "preference points". These preference points feed downstream ranking models and personalized clip selection per creator.

### Point Weights (`backend/feedback/weights.py`)

All point values are computed strictly on the server:

| Event Type | Points Delta | Behavior |
|---|---|---|
| `like` | **+1** | Positive preference signal |
| `unlike` | **-1** | Reverses previous like |
| `download` | **+3** | Strongest positive signal. **Counts once per clip per user**; subsequent downloads log events with 0 points |
| `dislike` | **-2** | Negative preference signal |
| `dismiss_popup` | **-2** | Dismissing the 5s reasons popup without choosing reasons still counts as a dislike |
| `undislike` | **+2** | Reverses previous dislike |

### Dislike Flow & Frontend Popup

- When a user clicks **Dislike**, an optimistic UI update reflects the dislike immediately, and a non-blocking 5-second popup appears anchored directly near the clip.
- Multi-select reason chips:
  - `hook_bad`: "Hook is not good"
  - `face_track_bad`: "Face not tracked well"
  - `no_context`: "Wrong moment / no context"
  - `captions_bad`: "Captions are off"
  - `length_bad`: "Too long / too short"
  - `other`: "Other" (reveals a ≤280 character text box and pauses the countdown while typing)
- Tapping **Submit** saves on tap without extra confirmation. If the 5s timer expires without reasons, it auto-dismisses and saves as a dislike with no reason. The popup never blocks the user from continuing to interact with the studio.

### How to Add a New Reason Code

1. Open `backend/feedback/weights.py`.
2. Add your new code to `DISLIKE_REASONS`:
   ```python
   DISLIKE_REASONS = {
       "hook_bad": "Hook is not good",
       ...
       "audio_sync_bad": "Audio is out of sync",  # <-- your new reason code
   }
   ```
3. Open `frontend-next/src/components/DislikeFeedbackPopup.tsx`.
4. Add the chip to `REASON_OPTIONS`:
   ```typescript
   { id: "audio_sync_bad", label: "Audio is out of sync" },
   ```
5. Done! The backend automatically validates against `VALID_REASON_CODES` and aggregates points per reason code in `creator_preferences`.

### Privacy & GDPR

- **Consent check:** Feedback is only stored for users who have `feedback_consent = true` (checked before saving). If disabled, `403 Forbidden` is returned.
- **No raw media:** `clip_feedback_events` and derived tables store only IDs, scores, and derived features — never raw audio or video.
- **Data Export:** `GET /api/v1/users/me/feedback/export` exports all feedback signals for the user.
- **Data Deletion:** `DELETE /api/v1/users/me/feedback` erases user feedback rows and recalculates derived scores.

---

## Accessing PostgreSQL From Your Mac

You can connect directly to PostgreSQL from your Mac using any SQL client (such as **TablePlus**, **DBeaver**, **Postico**, or terminal `psql`).

### Option A: Local Docker PostgreSQL (Port 5432)

In `docker-compose.yml`, port `5432:5432` is mapped to your Mac host:

- **Host:** `localhost` or `127.0.0.1`
- **Port:** `5432`
- **User:** `relativ_admin`
- **Password:** `relativ_secure_pass`
- **Database:** `relativ_db`
- **Connection URL:**
  ```bash
  postgresql://relativ_admin:relativ_secure_pass@localhost:5432/relativ_db
  ```
- **Terminal CLI Command:**
  ```bash
  psql "postgresql://relativ_admin:relativ_secure_pass@localhost:5432/relativ_db"
  ```

### Option B: Supabase Hosted PostgreSQL

If connecting to your remote Supabase instance:
- Connection string is located in your `.env` as `DATABASE_URL` (format: `postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres?sslmode=require`).
- Paste this URI directly into TablePlus / DBeaver using "Import from URL".

