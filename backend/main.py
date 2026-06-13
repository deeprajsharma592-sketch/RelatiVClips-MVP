"""
RelatiV Backend - Main Entry Point
Supports dual pipelines: Local Video and YouTube Surgical Funnel
"""
import asyncio
import sys
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

# Ensure project root is on path so `from backend.X import Y` works
sys.path.insert(0, str(Path(__file__).parent.parent))

from .models import ContactMessage, StatusResponse, TaskQueueInfo, TranscriptResponse
from .pipeline.transcript_fetcher import fetch_transcript
from .routers import local_router, youtube_router, intake_router, auth_router, dashboard_router, email_auth_router, billing_router
from .utils.config import OUTPUTS_DIR, TEMP_DIR
from .utils.task_store import set_event_loop, task_store

# Upload directory — sibling to TEMP_DIR, holds raw uploads before pipeline run
UPLOADS_DIR = TEMP_DIR / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Lazy imports: heavy modules (DB driver, scheduler). A missing dep should
    # log and degrade gracefully, not kill the app at module load.
    from .database.session import close_db, init_db
    from .pipeline.cleanup import start_cleanup_scheduler, stop_cleanup_scheduler

    try:
        await init_db()
        print("[DB] Database tables initialized")
        # Store event loop for sync-to-async DB bridge from worker threads
        set_event_loop(asyncio.get_event_loop())
    except Exception as e:
        print(f"[DB] Database unavailable, running in memory-only mode: {e}")

    start_cleanup_scheduler()
    yield
    stop_cleanup_scheduler()
    set_event_loop(None)
    try:
        await close_db()
    except Exception:
        pass


app = FastAPI(
    title="RelatiV API",
    description="Privacy-first video clipping SaaS for RTX 5050",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS — tightened from wildcard. Origins come from env (CORS_ORIGINS)
# with safe defaults for dev. In production, set to your real domains.
# Format: comma-separated list, e.g. "https://relativ.app,https://www.relativ.app"
import os
_default_cors = ",".join([
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    # Pre-launch defaults (Hetzner IP + common Vercel previews)
    "http://91.98.144.72:3000",
    "https://relativ.app",
    "https://www.relativ.app",
])
_cors_origins = [
    o.strip() for o in os.getenv("CORS_ORIGINS", _default_cors).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    # Don't allow credentials across origins unless explicitly listed above
    allow_origin_regex=r"^https?://localhost:\d+$|^https?://.*\.vercel\.app$",
)

# Include routers
app.include_router(local_router.router)
app.include_router(youtube_router.router)
app.include_router(intake_router.router)
app.include_router(auth_router.router)
app.include_router(dashboard_router.router)
app.include_router(email_auth_router.router)
app.include_router(billing_router.router)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "2.0.0"}


@app.post("/contact")
async def contact(msg: ContactMessage):
    print(f"[Contact] From: {msg.email} | Subject: {msg.subject} | Message: {msg.message[:100]}")
    return {"status": "sent"}


@app.get("/transcript", response_model=TranscriptResponse)
async def get_transcript(url: str):
    task_id = f"api_{uuid.uuid4().hex[:8]}"
    result = fetch_transcript(url, task_id, log=lambda m: None)

    if not result or not result.get("segments"):
        return TranscriptResponse(segments=[], error="No transcript could be fetched")

    return TranscriptResponse(
        segments=result["segments"],
        language=result.get("language", "en"),
        source=result.get("source"),
    )


@app.get("/status/{task_id}", response_model=StatusResponse)
async def get_status(task_id: str):
    status = task_store.get_task_status(task_id)
    if not status:
        raise HTTPException(status_code=404, detail="Task not found")
    return StatusResponse(**status)


@app.get("/logs/{task_id}")
async def get_logs(task_id: str):
    # Lazy import: these are router-internal dicts, avoid loading at startup
    from .routers.local_router import progress_logs as local_logs
    from .routers.youtube_router import progress_logs as youtube_logs

    combined = local_logs.get(task_id, []) + youtube_logs.get(task_id, [])
    return {"logs": combined, "count": len(combined)}


@app.get("/tasks", response_model=TaskQueueInfo)
async def get_task_queue():
    return TaskQueueInfo(**task_store.get_queue_info())


@app.get("/download/{clip_id}")
async def download_clip(clip_id: str):
    for file_path in OUTPUTS_DIR.glob(f"{clip_id}.*"):
        return FileResponse(
            path=file_path,
            filename=file_path.name,
            media_type="video/mp4",
        )
    raise HTTPException(status_code=404, detail="Clip not found")


@app.get("/vram")
async def get_vram_status():
    # Lazy import: VRAM probe requires CUDA libs; not needed at startup
    from .utils.vram_manager import get_vram_usage
    return get_vram_usage()


# ─────────────────────────────────────────────────────────────────────────────
# File upload (powers /process/local — frontend drops a file, gets a path)
# ─────────────────────────────────────────────────────────────────────────────

ALLOWED_VIDEO_EXTS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v", ".flv", ".wmv"}
MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024  # 2GB hard cap


@app.post("/upload")
async def upload_video(
    file: UploadFile = File(...),
    task_id: Optional[str] = None,
):
    """Accept a multipart video upload, save to UPLOADS_DIR, return the saved path.

    The frontend can then POST {file_path: "..."} to /process/local to run the
    9-stage pipeline. (Two-step by design — keeps the upload separate from
    pipeline kickoff so the UI can show upload progress independently.)
    """
    if hasattr(file, "filename"):
        filename = file.filename or "video.mp4"
        ext = Path(filename).suffix.lower()
        if ext not in ALLOWED_VIDEO_EXTS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported video format: {ext}. Allowed: {sorted(ALLOWED_VIDEO_EXTS)}",
            )
        save_id = task_id or f"upload_{uuid.uuid4().hex[:8]}"
        save_path = UPLOADS_DIR / f"{save_id}{ext}"
        bytes_written = 0
        with open(save_path, "wb") as out:
            while chunk := await file.read(1024 * 1024):  # 1MB chunks
                bytes_written += len(chunk)
                if bytes_written > MAX_UPLOAD_BYTES:
                    out.close()
                    save_path.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large (max {MAX_UPLOAD_BYTES // (1024 * 1024)} MB)",
                    )
                out.write(chunk)
    else:
        # Raw bytes fallback (clients that POST raw body without multipart)
        ext = ".mp4"
        save_id = task_id or f"upload_{uuid.uuid4().hex[:8]}"
        save_path = UPLOADS_DIR / f"{save_id}{ext}"
        data = await file.read() if hasattr(file, "read") else file
        save_path.write_bytes(data)

    return {
        "file_path": str(save_path),
        "task_id": save_id,
        "size_mb": round(save_path.stat().st_size / (1024 * 1024), 2),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=9000)
