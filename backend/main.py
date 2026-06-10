"""
RelatiV Backend - Main Entry Point
Supports dual pipelines: Local Video and YouTube Surgical Funnel
"""
import sys
import os
from pathlib import Path
from contextlib import asynccontextmanager

sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from .models import StatusResponse, TaskQueueInfo, ContactMessage
from .utils.task_store import task_store, set_event_loop
from .utils.config import OUTPUTS_DIR

# Import routers
from .routers import local_router, youtube_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio
    from .pipeline.cleanup import start_cleanup_scheduler

    # Initialize database tables (non-fatal if DB unavailable)
    from .database.session import init_db, close_db
    try:
        await init_db()
        print("[DB] Database tables initialized")
        # Store event loop for sync-to-async DB bridge
        set_event_loop(asyncio.get_event_loop())
    except Exception as e:
        print(f"[DB] Database unavailable, running in memory-only mode: {e}")

    start_cleanup_scheduler()
    yield
    from .pipeline.cleanup import stop_cleanup_scheduler
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
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(local_router.router)
app.include_router(youtube_router.router)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "2.0.0"}


@app.post("/contact")
async def contact(msg: ContactMessage):
    print(f"[Contact] From: {msg.email} | Subject: {msg.subject} | Message: {msg.message[:100]}")
    return {"status": "sent"}


@app.get("/status/{task_id}", response_model=StatusResponse)
async def get_status(task_id: str):
    status = task_store.get_task_status(task_id)
    if not status:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Task not found")
    return StatusResponse(**status)


@app.get("/logs/{task_id}")
async def get_logs(task_id: str):
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
            media_type="video/mp4"
        )
    
    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail="Clip not found")


@app.get("/vram")
async def get_vram_status():
    from .utils.vram_manager import get_vram_usage
    return get_vram_usage()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=9000)
