# RelatiV

Quantum-precision AI video clipping engine. Privacy-first, locally processed extraction for short-form content.

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
