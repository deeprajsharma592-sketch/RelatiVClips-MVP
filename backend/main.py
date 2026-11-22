"""
RelatiV Backend - Main Entry Point
Supports dual pipelines: Local Video and YouTube Surgical Funnel
"""
import sys
# Shim for Python 3.12 where setuptools/pkg_resources might be missing
try:
    import pkg_resources
except ImportError:
    import types
    from pathlib import Path
    def _res_filename(pkg, resource):
        pkg_str = str(pkg)
        mod = sys.modules.get(pkg_str)
        if mod and hasattr(mod, "__file__") and mod.__file__:
            return str(Path(mod.__file__).parent / resource)
        try:
            import importlib
            m = importlib.import_module(pkg_str)
            if hasattr(m, "__file__") and m.__file__:
                return str(Path(m.__file__).parent / resource)
        except Exception:
            pass
        return resource

    pr = types.ModuleType("pkg_resources")
    pr.get_distribution = lambda dist: type("Dist", (), {"version": "0.0.0"})()
    pr.resource_filename = _res_filename
    pr.iter_entry_points = lambda *a, **k: []
    pr.Requirement = type("Requirement", (), {"parse": lambda s: s})
    pr.DistributionNotFound = type("DistributionNotFound", (Exception,), {})
    sys.modules["pkg_resources"] = pr

import asyncio
import re
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

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
    razorpay_router,
    campaigns_router,
    claims_router,
    clips_router,
    verification_router,
    taste_router,
    admin_router,
    socials_router,
    credits_router,
    captions_router,
)
from .caching import cache_router
from .utils.config import OUTPUTS_DIR, TEMP_DIR, FILE_RETENTION_HOURS
from .utils.task_store import set_event_loop, task_store
from .services.supabase_auth import is_supabase_auth_configured

# Upload directory — sibling to TEMP_DIR, holds raw uploads before pipeline run
UPLOADS_DIR = TEMP_DIR / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Lazy imports: heavy modules (DB driver, scheduler). A missing dep should
    # log and degrade gracefully, not kill the app at module load.
    from .database.session import close_db, init_db
    from .pipeline.cleanup import start_cleanup_scheduler, stop_cleanup_scheduler
    from .captioning.registry import validate_fonts

    validate_fonts(strict=True)
    print("[Captions] Static caption font registry validated")

    try:
        await init_db()
        print("[DB] Database tables initialized")
        # Store event loop for sync-to-async DB bridge from worker threads
        set_event_loop(asyncio.get_event_loop())
    except Exception as e:
        print(f"[DB] Database unavailable, running in memory-only mode: {e}")

    start_cleanup_scheduler()

    if sys.platform == "win32":
        try:
            import ctypes
            # Prevent Windows from sleeping or suspending network/CPU while backend runs
            ctypes.windll.kernel32.SetThreadExecutionState(0x80000001 | 0x00000040)
            print("[Power] Windows sleep prevention activated (SetThreadExecutionState)")
        except Exception as e:
            print(f"[Power] Sleep prevention error: {e}")

    yield

    if sys.platform == "win32":
        try:
            import ctypes
            ctypes.windll.kernel32.SetThreadExecutionState(0x80000000)
        except Exception:
            pass

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
    "http://studio.localhost:3000",
    "http://dash.localhost:3000",
    "https://relativclips.com",
    "https://www.relativclips.com",
    "https://studio.relativclips.com",
    "https://dash.relativclips.com",
    "https://app.relativclips.com",
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
# Include /api/v1 aliases for frontend compatibility
app.include_router(local_router.router, prefix="/api/v1")
app.include_router(youtube_router.router, prefix="/api/v1")
app.include_router(intake_router.router)
app.include_router(auth_router.router)
app.include_router(dashboard_router.router)
if not is_supabase_auth_configured():
    # Keep legacy email-token auth available only during local migration.
    # Configured Supabase deployments must use Supabase Auth flows.
    app.include_router(email_auth_router.router)
app.include_router(billing_router.router)
app.include_router(razorpay_router.router)
app.include_router(campaigns_router.router)
app.include_router(claims_router.router)
app.include_router(clips_router.router)
app.include_router(verification_router.router)
app.include_router(taste_router.router)
app.include_router(admin_router.router)
app.include_router(socials_router.router)
app.include_router(credits_router.router)
app.include_router(captions_router.router)
app.include_router(cache_router)
app.include_router(cache_router, prefix="/api/v1")


# ─── App identity ───────────────────────────────────────────────────────────
# RelatiV is in public beta. Single source of truth for the version + status
# so the frontend, JSON-LD, /health, and /version endpoints all stay in sync.
APP_NAME = "RelatiV"
APP_VERSION = "2.0.0"
APP_STAGE = "beta"   # beta | rc | stable
APP_BUILT_AT = "2026-06-15"


# Download the residential download server script (for user's Windows laptop)
@app.get("/ytdlp-server.py", include_in_schema=False)
async def download_ytdlp_server():
    """Download the yt-dlp residential server script."""
    from pathlib import Path
    script_path = Path("/app/backend/ytdlp-server-windows.py")
    return FileResponse(script_path, filename="ytdlp-server.py", media_type="text/plain")


# Serve finished clip files for download
@app.get("/clips/{filename}", include_in_schema=False)
async def download_clip(filename: str):
    """Download a finished clip MP4 file."""
    from pathlib import Path
    import os
    # Security: only allow files in the outputs directory
    outputs_dir = Path("/app/outputs")
    # Remove path traversal attempts
    safe_name = os.path.basename(filename)
    file_path = outputs_dir / safe_name
    if not file_path.exists():
        raise HTTPException(404, "Clip not found")
    return FileResponse(file_path, filename=safe_name, media_type="video/mp4")


@app.get("/")
async def root():
    return {
        "status": "online",
        "name": APP_NAME,
        "version": APP_VERSION,
        "stage": APP_STAGE,
        "dashboard": "https://relativclips.com/dashboard",
        "health": "/health",
        "smoke_test": "/smoke-test-llm",
        "cost_status": "/cost-status",
        "clips": "/clips",
    }


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


@app.get("/anthropic-models")
async def list_anthropic_models():
    """Probe Anthropic API to discover all active model IDs available to this key."""
    import httpx
    from .utils.config import ANTHROPIC_API_KEY
    if not ANTHROPIC_API_KEY:
        return {"error": "ANTHROPIC_API_KEY not configured"}
    try:
        async with httpx.AsyncClient(timeout=10.0, trust_env=False) as client:
            r = await client.get(
                "https://api.anthropic.com/v1/models",
                headers={
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                },
            )
            if r.status_code == 200:
                data = r.json()
                models = [m.get("id") for m in data.get("data", [])]
                return {"status": "ok", "models": models, "raw": data}
            return {"status": "error", "code": r.status_code, "detail": r.text}
    except Exception as e:
        return {"status": "error", "error": str(e)}


@app.get("/smoke-test-llm")
async def smoke_test_llm():
    """Live smoke test of the Claude / LLM pipeline.
    Sends a test hook-selection prompt to verify the API key, model, and track spend.
    """
    from .llm.chain import call_with_fallback, breaker_status
    from .llm import cost_control
    
    test_prompt = (
        "You are evaluating a YouTube clip moment for virality.\n"
        "Moment text: 'Wait until you see how this engine behaves at 9000 RPM.'\n"
        "Return a JSON array with one object containing keys: 'viral_title', 'caption', 'hashtags', 'confidence'."
    )
    try:
        response_text, provider = await asyncio.to_thread(call_with_fallback, test_prompt)
        status = cost_control.cost_status()
        return {
            "success": bool(response_text),
            "provider_used": provider,
            "response": response_text,
            "cost_status": status,
            "breakers": breaker_status(),
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "breakers": breaker_status(),
        }


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
        # Filter out session cookies (e=0) so we don't report "1970 expiry"
        # as a giant negative number. BUGFIX 2026-06-16.
        round((min(e for _, e in yt if e) - now) / 86400) if any(e for _, e in yt) else None
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


@app.post("/admin/git-pull")
async def admin_git_pull():
    """Trigger git pull origin main on the host machine to update code."""
    import subprocess
    cmd = ["git", "pull", "origin", "main"]
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    return {
        "ok": res.returncode == 0,
        "stdout": res.stdout,
        "stderr": res.stderr,
        "returncode": res.returncode
    }


@app.get("/debug/test-captions")
async def debug_test_captions(task_id: str = "0ebe5d51-cad2-4ea9-9fe9-97f5874a7204", clip_index: int = 1):
    from .utils.config import TEMP_DIR
    from .pipeline.captions import generate_viral_ass_subtitles
    # find the clip video file
    vid_files = list(TEMP_DIR.glob(f"*{task_id}*vidseg*.mp4"))
    if not vid_files:
        return {"error": "No vidseg found", "all_vids": [f.name for f in TEMP_DIR.glob("*.mp4")][:10]}
    target_vid = str(vid_files[0])
    test_clip = {
        "start": 0.78,
        "end": 65.3,
        "video_source_start": 0.0,
        "video_source_end": 75.3,
        "video_path": target_vid,
    }
    sub_file = TEMP_DIR / "debug_test_captions.ass"
    try:
        res = generate_viral_ass_subtitles(test_clip, sub_file)
        if sub_file.exists():
            with open(sub_file, "r", encoding="utf-8") as f:
                lines = [l.strip() for l in f if l.startswith("Dialogue:")]
            return {"ok": True, "count": len(lines), "sample": lines[:10]}
        return {"ok": False, "res": res}
    except Exception as e:
        import traceback
        return {"error": str(e), "trace": traceback.format_exc()}


@app.get("/debug/check-setup")
async def debug_check_setup():
    import shutil, os
    from .utils.config import COOKIES_PATH, YTDLP_PATH, FFMPEG_PATH
    cookie_names = []
    if COOKIES_PATH.exists():
        try:
            with open(COOKIES_PATH, "r", encoding="utf-8", errors="ignore") as f:
                for line in f:
                    parts = line.strip().split("\t")
                    if len(parts) >= 6 and not line.startswith("#"):
                        cookie_names.append(parts[5])
        except Exception as e:
            cookie_names.append(f"error: {e}")
    bgutil_exists = os.path.exists(r"C:\Users\Deepraj sharma\bgutil-ytdlp-pot-provider")
    return {
        "cookies_path": str(COOKIES_PATH),
        "cookies_exists": COOKIES_PATH.exists(),
        "cookies_size": COOKIES_PATH.stat().st_size if COOKIES_PATH.exists() else 0,
        "cookie_names": cookie_names,
        "bgutil_folder_exists": bgutil_exists,
        "ytdlp_path": str(YTDLP_PATH),
        "ffmpeg_path": str(FFMPEG_PATH),
        "node_installed": bool(shutil.which("node")),
        "deno_installed": bool(shutil.which("deno")),
        "docker_installed": bool(shutil.which("docker")),
    }


@app.get("/debug/ytagent-status")
async def debug_ytagent_status():
    """Report the safe ytagent adapter configuration without exposing secrets."""
    from .utils.ytagent_downloader import status

    return status()


@app.get("/debug/test-framing")
async def debug_test_framing():
    results = {}
    import importlib
    for mod in ["cv2", "mediapipe", "scenedetect", "torch", "yaml", "scipy"]:
        try:
            m = importlib.import_module(mod)
            results[mod] = {"ok": True, "version": getattr(m, "__version__", "unknown")}
        except Exception as e:
            results[mod] = {"ok": False, "error": str(e)}

    from pathlib import Path
    repo_root = Path(__file__).resolve().parent.parent
    model_path = repo_root / "framing" / "models" / "face_detection_yunet_2023mar.onnx"
    results["yunet_model"] = {
        "path": str(model_path),
        "exists": model_path.exists(),
        "size": model_path.stat().st_size if model_path.exists() else 0,
    }

    try:
        from framing.config import get_binary_paths
        results["binary_paths"] = get_binary_paths()
    except Exception as e:
        results["binary_paths"] = {"error": str(e)}

    try:
        from framing.run import run_pipeline
        results["framing_import"] = {"ok": True}
    except Exception as e:
        import traceback
        results["framing_import"] = {"ok": False, "error": str(e), "trace": traceback.format_exc()}

    try:
        import cv2
        detector = cv2.FaceDetectorYN.create(str(model_path), "", (320, 320))
        results["yunet_create"] = {"ok": True}
    except Exception as e:
        results["yunet_create"] = {"ok": False, "error": str(e)}

    # Check a sample video if present in TEMP_DIR
    from .utils.config import TEMP_DIR
    sample_vids = list(TEMP_DIR.glob("*vidseg*.mp4")) or list(TEMP_DIR.glob("*.mp4"))
    if sample_vids:
        test_in = sample_vids[0]
        results["test_vid_found"] = str(test_in.name)
        test_out = TEMP_DIR / "debug_framing_test_out.mp4"
        test_workdir = TEMP_DIR / "debug_framing_workdir"
        try:
            from framing.run import run_pipeline
            # run framing on test_in
            plan_res = run_pipeline(
                clip_path=str(test_in),
                output_path=str(test_out),
                workdir=test_workdir,
            )
            results["framing_execution"] = {
                "ok": True,
                "out_exists": test_out.exists(),
                "out_size": test_out.stat().st_size if test_out.exists() else 0,
                "layout_states": list(set(f.get("state") for f in plan_res.get("frames", []))) if isinstance(plan_res, dict) else [],
            }
        except Exception as e:
            import traceback
            results["framing_execution"] = {"ok": False, "error": str(e), "trace": traceback.format_exc()}
    else:
        results["test_vid_found"] = None

    return results


@app.get("/debug/read-captions")
async def debug_read_captions(task_id: str = "0ebe5d51-cad2-4ea9-9fe9-97f5874a7204", index: int = 1, from_start: bool = True):
    from .utils.config import TEMP_DIR
    sub_file = TEMP_DIR / f"{task_id}_{index}_captions.ass"
    if not sub_file.exists():
        ass_files = [f.name for f in TEMP_DIR.glob("*captions.ass")]
        return {"error": "File not found", "found_files": ass_files[:10]}
    with open(sub_file, "r", encoding="utf-8", errors="ignore") as f:
        all_lines = [l.strip() for l in f.readlines()]
        # find where [Events] starts
        ev_idx = 0
        for i, l in enumerate(all_lines):
            if l.startswith("[Events]"):
                ev_idx = i + 2
                break
        events = all_lines[ev_idx:]
        return {
            "total_dialogues": len(events),
            "first_10": events[:10],
            "last_10": events[-10:],
        }
async def debug_formats(url: str):
    import subprocess
    from .utils.config import YTDLP_PATH, get_cookie_args
    cmd = [YTDLP_PATH, "-F", url] + get_cookie_args()
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    return {"stdout": res.stdout, "stderr": res.stderr}


@app.get("/debug/ytdlp-version")
async def debug_ytdlp_version():
    import subprocess
    from .utils.config import YTDLP_PATH
    res = subprocess.run([YTDLP_PATH, "--version"], capture_output=True, text=True, timeout=10)
    return {"version": res.stdout.strip(), "stderr": res.stderr}


@app.post("/admin/upgrade-ytdlp")
async def admin_upgrade_ytdlp():
    import subprocess, sys
    # Upgrade active venv
    res1 = subprocess.run([sys.executable, "-m", "pip", "install", "--upgrade", "yt-dlp"], capture_output=True, text=True, timeout=180)
    # Also upgrade global if exists
    global_py = r"C:\Users\Deepraj sharma\AppData\Local\Programs\Python\Python312\python.exe"
    import os
    if os.path.exists(global_py):
        subprocess.run([global_py, "-m", "pip", "install", "--upgrade", "yt-dlp"], capture_output=True, text=True, timeout=180)
    from .utils.config import YTDLP_PATH
    res_ver = subprocess.run([YTDLP_PATH, "--version"], capture_output=True, text=True, timeout=10)
    return {
        "ok": res1.returncode == 0,
        "ytdlp_path": YTDLP_PATH,
        "new_version": res_ver.stdout.strip(),
        "stdout": res1.stdout,
        "stderr": res1.stderr,
    }


@app.post("/admin/install-deps")
async def admin_install_deps(packages: Optional[str] = "scenedetect[opencv]"):
    import subprocess, sys
    pkgs = [p.strip() for p in (packages or "").split(",") if p.strip()]
    if not pkgs:
        pkgs = ["scenedetect[opencv]"]
    cmd = [sys.executable, "-m", "pip", "install"] + pkgs
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    return {
        "ok": res.returncode == 0,
        "cmd": cmd,
        "stdout": res.stdout,
        "stderr": res.stderr,
    }


@app.get("/debug/test-clip")
async def debug_test_clip(url: str, client: str = "web_embedded", use_cookies: bool = True, use_sections: bool = True):
    import subprocess
    from .utils.config import YTDLP_PATH, FFMPEG_PATH, TEMP_DIR, COOKIES_PATH
    out = str(TEMP_DIR / "debug_clip.%(ext)s")
    cmd = [
        YTDLP_PATH,
        "-f", "137+140/136+140/bv*[height>=720]+ba/best",
        "--js-runtimes", "node",
        "-o", out,
        "--verbose",
        "--force-overwrites",
    ]
    if use_sections:
        cmd.extend(["--download-sections", "*00:00:10-00:00:20"])
    else:
        cmd.extend(["--max-filesize", "15M"])
    if use_cookies and COOKIES_PATH.exists():
        cmd.extend(["--cookies", str(COOKIES_PATH)])
    if client:
        cmd.extend(["--extractor-args", f"youtube:player_client={client}"])
    if FFMPEG_PATH:
        cmd.extend(["--ffmpeg-location", str(FFMPEG_PATH)])
    cmd.extend(["--", url])
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    return {"returncode": res.returncode, "stdout": res.stdout, "stderr": res.stderr}


SAFE_CLIP_ID_REGEX = re.compile(r'^[A-Za-z0-9_-]+$')


@app.get("/status/{task_id}", response_model=StatusResponse)
@app.get("/api/v1/status/{task_id}", response_model=StatusResponse)
async def get_status(task_id: str):
    status = task_store.get_task_status(task_id)
    if not status:
        raise HTTPException(status_code=404, detail="Task not found")

    # Sanitize clips: strip raw host filesystem paths from public response
    sanitized = dict(status)
    if "clips" in sanitized and isinstance(sanitized["clips"], list):
        clean_clips = []
        for c in sanitized["clips"]:
            c_dict = dict(c)
            c_dict.pop("file_path", None)
            c_dict.pop("video_path", None)
            c_dict.pop("audio_path", None)
            if "clip_id" in c_dict and not c_dict.get("download_url"):
                c_dict["download_url"] = f"/download/{c_dict['clip_id']}"
            clean_clips.append(c_dict)
        sanitized["clips"] = clean_clips

    return StatusResponse(**sanitized)


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


@app.get("/api/v1/tasks/recent")
async def get_recent_tasks():
    from .routers.youtube_router import progress_logs as youtube_logs
    res = []
    for tid, t in list(task_store._tasks.items())[-10:]:
        res.append({
            "task_id": tid,
            "status": t.get("status"),
            "progress": t.get("progress"),
            "current_step": t.get("current_step"),
            "step_name": t.get("step_name"),
            "error": t.get("error"),
            "created_at": str(t.get("created_at")),
            "logs": youtube_logs.get(tid, [])[-15:],
        })
    return res


def stream_video_file(
    path: Path,
    request: Request,
    download: bool = False,
    media_type: str = "video/mp4"
):
    """
    Stream video file supporting:
    - HTTP Range requests (206 Partial Content) for smooth browser seeking
    - HEAD requests (200 with headers) for player pre-flight checks
    - Inline disposition for in-browser <video> tag playback
    - Attachment disposition when explicitly downloading (?download=1)
    """
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Clip not found")

    file_size = path.stat().st_size
    filename = path.name

    disposition = "attachment" if download else "inline"
    content_disposition = f'{disposition}; filename="{filename}"'

    base_headers = {
        "Accept-Ranges": "bytes",
        "Content-Disposition": content_disposition,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Expose-Headers": "Content-Range, Accept-Ranges, Content-Length, Content-Disposition",
    }

    # Handle HEAD preflight from browsers
    if request.method == "HEAD":
        headers = {
            **base_headers,
            "Content-Type": media_type,
            "Content-Length": str(file_size),
        }
        return Response(status_code=200, headers=headers)

    range_header = request.headers.get("Range") or request.headers.get("range")
    if range_header and range_header.startswith("bytes="):
        try:
            range_val = range_header[len("bytes="):].strip()
            parts = range_val.split("-")
            start = int(parts[0]) if parts[0] else 0
            end = int(parts[1]) if len(parts) > 1 and parts[1] else file_size - 1

            if start >= file_size or end >= file_size or start > end:
                return Response(
                    status_code=416,
                    headers={
                        "Content-Range": f"bytes */{file_size}",
                        **base_headers
                    }
                )

            chunk_size = (end - start) + 1

            def iter_file_chunk():
                with open(path, "rb") as f:
                    f.seek(start)
                    remaining = chunk_size
                    while remaining > 0:
                        read_len = min(remaining, 64 * 1024)
                        chunk = f.read(read_len)
                        if not chunk:
                            break
                        remaining -= len(chunk)
                        yield chunk

            headers = {
                **base_headers,
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Content-Length": str(chunk_size),
                "Content-Type": media_type,
            }
            return StreamingResponse(
                iter_file_chunk(),
                status_code=206,
                headers=headers,
                media_type=media_type,
            )
        except Exception:
            pass

    def iter_full_file():
        with open(path, "rb") as f:
            while True:
                chunk = f.read(64 * 1024)
                if not chunk:
                    break
                yield chunk

    headers = {
        **base_headers,
        "Content-Length": str(file_size),
        "Content-Type": media_type,
    }
    return StreamingResponse(
        iter_full_file(),
        status_code=200,
        headers=headers,
        media_type=media_type,
    )


@app.api_route("/download/{clip_id}", methods=["GET", "HEAD"])
@app.api_route("/api/v1/download/{clip_id}", methods=["GET", "HEAD"])
async def download_clip(clip_id: str, request: Request, download: bool = False):
    if not SAFE_CLIP_ID_REGEX.match(clip_id):
        raise HTTPException(status_code=400, detail="Invalid clip identifier")

    for ext in (".mp4", ".mov", ".m4v"):
        candidate = OUTPUTS_DIR / f"{clip_id}{ext}"
        if candidate.is_file():
            return stream_video_file(candidate, request, download=download)
    raise HTTPException(status_code=404, detail="Clip not found")


@app.api_route("/thumbnail/{clip_id}", methods=["GET", "HEAD"])
@app.api_route("/api/v1/thumbnail/{clip_id}", methods=["GET", "HEAD"])
async def get_clip_thumbnail(clip_id: str, request: Request):
    """Return an extracted thumbnail screenshot for a clip."""
    if not SAFE_CLIP_ID_REGEX.match(clip_id):
        raise HTTPException(status_code=400, detail="Invalid clip identifier")

    thumb_path = OUTPUTS_DIR / f"{clip_id}_thumb.jpg"
    if thumb_path.is_file():
        if request.method == "HEAD":
            return Response(status_code=200, headers={"Content-Type": "image/jpeg", "Content-Length": str(thumb_path.stat().st_size)})
        return FileResponse(path=thumb_path, media_type="image/jpeg")

    # If thumbnail not yet extracted, extract on demand from the video file
    candidate_mp4 = OUTPUTS_DIR / f"{clip_id}.mp4"
    if candidate_mp4.is_file():
        try:
            import cv2
            cap = cv2.VideoCapture(str(candidate_mp4))
            cap.set(cv2.CAP_PROP_POS_MSEC, 1500)
            ret, frame = cap.read()
            if not ret:
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                ret, frame = cap.read()
            cap.release()
            if ret and frame is not None:
                cv2.imwrite(str(thumb_path), frame, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
                if request.method == "HEAD":
                    return Response(status_code=200, headers={"Content-Type": "image/jpeg", "Content-Length": str(thumb_path.stat().st_size)})
                return FileResponse(path=thumb_path, media_type="image/jpeg")
        except Exception:
            pass
    raise HTTPException(status_code=404, detail="Thumbnail not found")


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


@app.get("/api/v1/debug-db")
async def debug_db():
    """Diagnostic endpoint to safely inspect database connectivity."""
    import urllib.parse
    import asyncpg
    from .database.session import DATABASE_URL, _DB_AVAILABLE

    parsed = urllib.parse.urlsplit(DATABASE_URL)
    raw_pwd = parsed.password or ""
    masked = f"{raw_pwd[:2]}***{raw_pwd[-2:]} (len={len(raw_pwd)})" if len(raw_pwd) > 4 else f"*** (len={len(raw_pwd)})"

    results = {
        "db_available": _DB_AVAILABLE,
        "username": parsed.username,
        "hostname": parsed.hostname,
        "port": parsed.port,
        "database": parsed.path,
        "password_info": masked,
        "tests": [],
    }

    # Test 1: Pooler with username postgres.avyfsbbzdahfbcdhzoxv
    for p in (5432, 6543):
        try:
            conn = await asyncpg.connect(
                user=parsed.username,
                password=raw_pwd,
                database=parsed.path.lstrip("/") or "postgres",
                host=parsed.hostname,
                port=p,
                ssl="require",
                timeout=4,
            )
            results["tests"].append({"target": f"{parsed.hostname}:{p}", "user": parsed.username, "status": "SUCCESS"})
            await conn.close()
        except Exception as e:
            results["tests"].append({"target": f"{parsed.hostname}:{p}", "user": parsed.username, "status": "FAILED", "error": str(e)})

    # Test 2: Direct host db.avyfsbbzdahfbcdhzoxv.supabase.co with user 'postgres'
    try:
        conn = await asyncpg.connect(
            user="postgres",
            password=raw_pwd,
            database="postgres",
            host="db.avyfsbbzdahfbcdhzoxv.supabase.co",
            port=5432,
            ssl="require",
            timeout=4,
        )
        results["tests"].append({"target": "db.avyfsbbzdahfbcdhzoxv.supabase.co:5432", "user": "postgres", "status": "SUCCESS"})
        await conn.close()
    except Exception as e:
        results["tests"].append({"target": "db.avyfsbbzdahfbcdhzoxv.supabase.co:5432", "user": "postgres", "status": "FAILED", "error": str(e)})

    return results



if __name__ == "__main__":

    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=9000)
