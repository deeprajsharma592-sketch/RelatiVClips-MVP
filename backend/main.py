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
from .routers import (
    local_router,
    youtube_router,
    intake_router,
    auth_router,
    dashboard_router,
    email_auth_router,
    billing_router,
    campaigns_router,
    claims_router,
    clips_router,
    verification_router,
)
from .utils.config import OUTPUTS_DIR, TEMP_DIR, FILE_RETENTION_HOURS
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
app.include_router(campaigns_router.router)
app.include_router(claims_router.router)
app.include_router(clips_router.router)
app.include_router(verification_router.router)


# ─── App identity ───────────────────────────────────────────────────────────
# RelatiV is in public beta. Single source of truth for the version + status
# so the frontend, JSON-LD, /health, and /version endpoints all stay in sync.
APP_NAME = "RelatiV"
APP_VERSION = "2.0.0"
APP_STAGE = "beta"   # beta | rc | stable
APP_BUILT_AT = "2026-06-15"


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "name": APP_NAME,
        "version": APP_VERSION,
        "stage": APP_STAGE,
    }


@app.get("/version")
async def version_info():
    """Public version + lifecycle marker. Used by the frontend footer/metadata.

    Keep this in sync with APP_VERSION + APP_STAGE above and the JSON-LD
    applicationStatus in frontend-next/src/app/layout.tsx.
    """
    return {
        "name": APP_NAME,
        "version": APP_VERSION,
        "stage": APP_STAGE,
        "built_at": APP_BUILT_AT,
        "is_beta": APP_STAGE in ("beta", "rc"),
        "support_url": "https://discord.gg/relativ",
    }


@app.get("/llm-status")
async def llm_status():
    """Show LLM chain configuration and circuit breaker state. Useful for ops.

    Returns configured providers, which one would be used next, and breaker state.
    If you see 'groq' in providers_configured with breaker closed, the LLM is live.
    """
    try:
        from .llm.chain import chain_status
        return chain_status()
    except Exception as e:
        return {"error": str(e), "providers_configured": [], "circuit_breakers": {}}


@app.get("/cost-status")
async def cost_status():
    """LLM cost tracker — daily spend, budget remaining, smart-skip count.

    Use this to monitor the LLM budget in real time. Smart-skip calls are
    free (no LLM), so the daily_spend_usd will be lower than total call count.
    """
    from .llm import cost_control
    return cost_control.cost_status()


@app.get("/proxy-status")
async def proxy_status():
    """Test the YouTube proxy chain + show config. Run 3 fresh YouTube fetches
    through the rotating endpoint to confirm it's not rate-limited.
    """
    import os
    import time
    import urllib.request
    from .utils.config import get_proxy, YT_PROXY

    pool_raw = os.getenv("YT_PROXY_POOL", "").strip()
    out = {
        "yt_proxy_env": YT_PROXY or None,
        "yt_proxy_pool_env": pool_raw or None,
        "pool_size": len([p for p in pool_raw.split(",") if p.strip()]) if pool_raw else 0,
        "current_proxy_choice": get_proxy(),
        "tests": [],
    }
    # Test 3 fresh fetches to YouTube's timedtext endpoint (small, fast, no bot check)
    for i in range(3):
        proxy = get_proxy()
        if not proxy:
            out["tests"].append({"attempt": i + 1, "skipped": "no proxy configured"})
            continue
        try:
            t0 = time.monotonic()
            req = urllib.request.Request(
                "https://www.youtube.com/api/timedtext?v=dQw4w9WgXcQ&lang=en&fmt=vtt",
                headers={"User-Agent": "Mozilla/5.0"},
            )
            opener = urllib.request.build_opener(
                urllib.request.ProxyHandler({"http": proxy, "https": proxy})
            )
            opener.open(req, timeout=10).read()
            ms = int((time.monotonic() - t0) * 1000)
            out["tests"].append({"attempt": i + 1, "proxy": proxy, "ok": True, "ms": ms})
        except Exception as e:
            out["tests"].append({"attempt": i + 1, "proxy": proxy, "ok": False, "error": str(e)[:120]})
    out["healthy"] = sum(1 for t in out["tests"] if t.get("ok")) >= 1
    return out


@app.get("/cookie-status")
async def cookie_status():
    """Parse the YouTube cookies file and show expiry health.

    Returns count of cookies by domain, and which auth cookies are expiring soon.
    """
    import datetime
    import time
    from pathlib import Path

    from .utils.config import COOKIES_PATH
    p = Path(COOKIES_PATH) if COOKIES_PATH else None
    out = {
        "cookies_path": str(p) if p else None,
        "exists": p.exists() if p else False,
        "size_bytes": p.stat().st_size if p and p.exists() else 0,
        "youtube_cookies": [],
        "expiring_30d": 0,
        "expired": 0,
    }
    if not (p and p.exists()):
        return out
    now = int(time.time())
    soon = now + 30 * 24 * 3600
    domains = {}
    with open(p, encoding="utf-8", errors="replace") as f:
        for line in f:
            if line.startswith("#") or not line.strip():
                continue
            parts = line.rstrip("\n").split("\t")
            if len(parts) < 7:
                continue
            domain, _path, _secure, _expiry_kind, expiry, name, *_ = parts
            try:
                expiry_i = int(expiry)
            except ValueError:
                continue
            d = domain.lstrip(".").lower()
            domains.setdefault(d, []).append((name, expiry_i))
            if expiry_i and expiry_i < now:
                out["expired"] += 1
            elif expiry_i and expiry_i < soon:
                out["expiring_30d"] += 1
    out["domain_counts"] = {d: len(v) for d, v in sorted(domains.items(), key=lambda x: -len(x[1]))[:15]}
    yt = domains.get("youtube.com", []) + domains.get(".youtube.com", [])
    out["youtube_cookies"] = [
        {"name": n, "expires": e, "expires_in_days": round((e - now) / 86400) if e else None}
        for n, e in sorted(yt, key=lambda x: -x[1])[:25]
    ]
    out["earliest_youtube_expiry_days"] = (
        round((min(e for _, e in yt) - now) / 86400) if yt else None
    )
    return out


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


@app.get("/clips")
async def list_clips(task_prefix: Optional[str] = None, limit: int = 50):
    """
    List available clips, optionally filtered by task_id prefix.

    NEW 2026-06-15: lets users re-discover their clips instead of
    relying on the in-memory task response (which vanishes on restart).

    Examples:
      GET /clips                          → latest 50 clips
      GET /clips?task_prefix=9837a8ae     → clips for that YouTube task
      GET /clips?limit=200                → 200 most recent

    Returns:
        {clips: [{name, size_mb, age_hours, url}, ...], total_count, total_mb}
    """
    from datetime import datetime as _dt
    clips = []
    files = sorted(OUTPUTS_DIR.glob("*.mp4"), key=lambda p: p.stat().st_mtime, reverse=True)
    for fp in files:
        if task_prefix and not fp.stem.startswith(task_prefix):
            continue
        age_s = (_dt.now() - _dt.fromtimestamp(fp.stat().st_mtime)).total_seconds()
        clips.append({
            "name": fp.name,
            "size_mb": round(fp.stat().st_size / (1024 * 1024), 2),
            "age_hours": round(age_s / 3600, 1),
            "url": f"/download/{fp.stem}",
        })
        if len(clips) >= limit:
            break
    return {
        "clips": clips,
        "total_count": len(clips),
        "total_mb": round(sum(c["size_mb"] for c in clips), 2),
        "retention_hours": FILE_RETENTION_HOURS,
    }


@app.get("/vram")
async def get_vram_status():
    # Lazy import: VRAM probe requires CUDA libs; not needed at startup
    from .utils.vram_manager import get_vram_usage
    return get_vram_usage()


@app.get("/admin/cache")
async def get_cache_stats():
    """
    NEW 2026-06-15: cache stats for monitoring.

    Returns:
        {results: {count, total_mb}, segments: {count, total_mb},
         total_count, total_mb, oldest_age_hours, retention_hours}
    """
    from .pipeline.cache import get_cache_stats
    stats = get_cache_stats()
    stats["retention_hours"] = FILE_RETENTION_HOURS
    return stats


@app.post("/admin/cache/clear")
async def clear_cache(target: Optional[str] = None):
    """
    NEW 2026-06-15: manually clear cache.

    Args (query param): target = "results" | "segments" | None (both)

    Returns: {deleted_count, deleted_mb}
    """
    from .pipeline.cache import cleanup_cache_files
    if target == "results":
        from .pipeline.cache import CACHE_DIR as _CACHE_DIR
        n = 0; b = 0
        for fp in (_CACHE_DIR / "youtube_results").glob("*"):
            try:
                b += fp.stat().st_size; fp.unlink(); n += 1
            except Exception:
                pass
        return {"deleted_count": n, "deleted_mb": round(b / 1024 / 1024, 2)}
    elif target == "segments":
        from .pipeline.cache import CACHE_DIR as _CACHE_DIR
        n = 0; b = 0
        for fp in (_CACHE_DIR / "segments").glob("*"):
            try:
                b += fp.stat().st_size; fp.unlink(); n += 1
            except Exception:
                pass
        return {"deleted_count": n, "deleted_mb": round(b / 1024 / 1024, 2)}
    else:
        result = cleanup_cache_files(0)  # 0 hours = delete everything
        return {"deleted_count": result["deleted_count"], "deleted_mb": result["deleted_mb"]}


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
