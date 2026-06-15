import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent.parent
OUTPUTS_DIR = BASE_DIR / "outputs"
TEMP_DIR = BASE_DIR / "temp"

OUTPUTS_DIR.mkdir(exist_ok=True)
TEMP_DIR.mkdir(exist_ok=True)

MAX_VRAM_GB = 8
VRAM_BUFFER_GB = 5
VRAM_MODEL_LIMIT_GB = MAX_VRAM_GB - VRAM_BUFFER_GB

MAX_CONCURRENT_TASKS = 1

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
# Default to Haiku 4.5 — fastest, cheapest, good enough for structured hook selection.
# Override with CLAUDE_MODEL=claude-3-5-sonnet-20241022 etc. in .env if you want quality.
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-haiku-4-5-20251001")

# --- DeepSeek API (cheaper alternative to Claude, ~30x cheaper) ---
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")  # also "deepseek-reasoner"
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")

# --- LLM Provider selection ---
# LLM_PROVIDER = "claude"   → force Claude (elite tier, $$$)
# LLM_PROVIDER = "deepseek" → force DeepSeek (budget tier, ~30x cheaper)
# LLM_PROVIDER = "both"     → try Claude first, fall back to DeepSeek on failure
# LLM_PROVIDER = "auto"     → highest-priority available (claude > deepseek > minimax)
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "auto").lower().strip()
# Legacy alias; "LLM_PROVIDER_PRIORITY" still works for back-compat.
LLM_PROVIDER_PRIORITY = [
    p.strip() for p in os.getenv("LLM_PROVIDER_PRIORITY", "groq,claude,deepseek,minimax").split(",")
    if p.strip()
]

# --- Circuit breaker for LLM calls ---
# After this many consecutive failures, an LLM provider is marked "open" and
# skipped for CIRCUIT_BREAKER_RESET_S seconds.
LLM_CIRCUIT_BREAKER_THRESHOLD = int(os.getenv("LLM_CIRCUIT_BREAKER_THRESHOLD", "3"))
LLM_CIRCUIT_BREAKER_RESET_S = int(os.getenv("LLM_CIRCUIT_BREAKER_RESET_S", "60"))

# --- RunPod Serverless (cloud Whisper) ---
# Provide EITHER the full endpoint URL OR the bare endpoint ID. The provider
# auto-extracts the ID from the URL if you give that. (URL is the format you
# get from the RunPod console's "Test" tab; ID is the `abc123def` in the path.)
RUNPOD_API_KEY = os.getenv("RUNPOD_API_KEY", "")
_RUNPOD_URL = os.getenv("RUNPOD_ENDPOINT_URL", "")
_RUNPOD_ID_RAW = os.getenv("RUNPOD_WHISPER_ENDPOINT_ID", "")
if _RUNPOD_ID_RAW:
    RUNPOD_WHISPER_ENDPOINT_ID = _RUNPOD_ID_RAW.strip()
elif _RUNPOD_URL:
    # Parse https://api.runpod.ai/v2/<ID>/run  → <ID>
    _parts = _RUNPOD_URL.rstrip("/").split("/")
    RUNPOD_WHISPER_ENDPOINT_ID = _parts[-2] if len(_parts) >= 2 and _parts[-1] == "run" else ""
else:
    RUNPOD_WHISPER_ENDPOINT_ID = ""
RUNPOD_WHISPER_MODEL = os.getenv("RUNPOD_WHISPER_MODEL", "turbo")

# Transcription provider mode: "auto" | "local" | "runpod"
#   auto = use RunPod if key+id are set, else local faster-whisper
TRANSCRIPTION_PROVIDER = os.getenv("TRANSCRIPTION_PROVIDER", "auto").lower().strip()

WHISPER_MODEL = "base"
WHISPER_COMPUTE_TYPE = "int8"  # CPU-friendly int8 quantization

TARGET_SAMPLE_RATE = 16000
CLIP_DURATION_MIN = 10
CLIP_DURATION_MAX = 20
NUM_CLIPS_LOCAL = 3
NUM_CLIPS_YOUTUBE = 3

# Never allow empty clip lists - this is a production rule
MIN_CLIPS = 3

PEAK_THRESHOLD_MULTIPLIER = 1.5
# A "valley" = RMS below mean × this factor. Lower = stricter (only dead silences).
# 0.5 = "this moment is at least half as quiet as the average frame."
VALLEY_THRESHOLD_MULTIPLIER = 0.5
# Minimum duration (seconds) of a low-energy region to count as a valley
VALLEY_MIN_DURATION_S = 1.0
# Padding around a valley to form a clip window (so the valley has context)
VALLEY_CONTEXT_PADDING_S = 4.0

# ─── STEEP EVENT DETECTION (NEW) ─────────────────────────────────────────
# A "steep" event is a sudden TRANSITION in energy, not a sustained region.
# It catches "wait for it" beats:
#   [loud] "I lost everything..." [DROP] [quiet] "...then made 10 Cr" [JUMP] [loud]
#
# These are different from peaks/valleys (which are sustained regions):
#   peak    = 1.5× mean energy for >1s
#   valley  = <0.5× mean energy for >1s
#   steep   = 0.3× mean energy DROP or RISE in <1s
#
# Lower values = more sensitive (catches smaller transitions). Default 0.3
# works well for podcast content; lower to 0.2 for music, raise to 0.5 for
# monotone content.
STEEP_MIN_RELATIVE_DROP = float(os.getenv("STEEP_MIN_RELATIVE_DROP", "0.3"))
STEEP_MIN_RELATIVE_RISE = float(os.getenv("STEEP_MIN_RELATIVE_RISE", "0.3"))

CROP_WIDTH = 608
CROP_HEIGHT = 1080

FFMPEG_PRESET = "p5"
FFMPEG_CQ = 28
FFMPEG_AUDIO_BITRATE = "128k"

# BUGFIX 2026-06-15: 24h was too short — users come back to "download my
# clips" pages and find them gone. 7d is the sweet spot for a free tier
# (≈30MB × 20 runs/day × 7d = 4.2GB max). For paid tier or beyond 7d,
# use S3/Backblaze B2 cold storage (see docs/caching-strategy.md).
FILE_RETENTION_HOURS = 24 * 7  # 7 days
CLEANUP_INTERVAL_HOURS = 6    # 4×/day check is enough (was hourly = CPU waste)

YTDLP_FORMAT = "best[height>=720]/best"

# ─── YouTube anti-bot infrastructure (bgutil PO-token provider) ───
# Static client emulation no longer bypasses YouTube's bot checks (as of 2025+).
# The bgutil container runs a local PO-token provider on :4416; yt-dlp's
# `bgutil-ytdlp-pot-provider` plugin (pip-installed) calls it per video to
# generate a fresh token that YouTube treats as a real web/mobile-web client.
# See https://github.com/Brainicism/bgutil-ytdlp-pot-provider
BGUTIL_POT_BASE_URL = os.getenv("BGUTIL_POT_BASE_URL", "http://127.0.0.1:4416")
# Optional SOCKS5 proxy for cloud-IP reputation workarounds. Empty by default
# (no proxy). Set to e.g. "socks5://user:pass@home-ip:1080" at deploy time.
YT_PROXY = os.getenv("YT_PROXY", "")

FFMPEG_PATH = os.getenv("FFMPEG_PATH", "ffmpeg")
FFPROBE_PATH = os.getenv("FFPROBE_PATH", "ffprobe")
# Pin to venv-installed yt-dlp (2026+ has --js-runtimes, --remote-components
# needed for YouTube's 2025+ challenge solver). System /usr/bin/yt-dlp is
# typically the old 2024 version from apt and breaks.
import shutil as _shutil
_DEFAULT_YTDLP = _shutil.which("yt-dlp") or "yt-dlp"
_VENV_YTDLP = "/app/RelatiV/backend/.venv/bin/yt-dlp"
if __import__("os").path.exists(_VENV_YTDLP):
    _DEFAULT_YTDLP = _VENV_YTDLP
YTDLP_PATH = os.getenv("YTDLP_PATH", _DEFAULT_YTDLP)

SURGICAL_DOWNLOAD_SECONDS = 90
SPIKE_ANALYSIS_SECONDS = 30
SURGICAL_TOP_N_CANDIDATES = 5
MAX_DISK_USAGE_MB = 150
AUDIO_ONLY_BITRATE = "128k"
MAX_SURGICAL_SEGMENTS = 3
# Number of concurrent yt-dlp workers for parallel segment download.
# 3 = 3 segments in parallel = ~3× speedup on the audio phase.
# Bounded by proxy pool size + outgoing socket count on the host.
PARALLEL_SURGICAL_WORKERS = int(os.getenv("PARALLEL_SURGICAL_WORKERS", "3"))
AUDIO_FALLBACK_LIMIT_MB = 50
SURGICAL_BUFFER_SECONDS = 10

COOKIES_PATH = BASE_DIR / "cookies.txt"

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
VISION_ENABLED = os.getenv("VISION_ENABLED", "false").lower() == "true"

# --- Pipeline version switch ---
# 1 = legacy 6-stage pipeline (audio → transcribe → select → face → render)
# 2 = new 9-stage pipeline (analyze → energy → hooks → surgical → transcribe → taste → face → render → captions)
# Default: 2. The new pipeline is the strategic direction; old stays as fallback.
PIPELINE_VERSION = int(os.getenv("PIPELINE_VERSION", "2"))
if PIPELINE_VERSION not in (1, 2):
    raise ValueError(f"PIPELINE_VERSION must be 1 or 2, got {PIPELINE_VERSION}")

NUM_SNAPSHOTS_PER_CLIP = 3
SNAPSHOT_JPEG_QUALITY = 90
SNAPSHOT_OUTPUT_SIZE = (720, 1280)

# --- Proxy pool (rotating residential) ---
# YT_PROXY_POOL="http://u:p@h:p,http://u:p@h:p,..." rotates per yt-dlp call
# Falls back to single YT_PROXY (legacy) for back-compat.
import random as _random
_PROXY_POOL_RAW = os.getenv("YT_PROXY_POOL", "").strip()
if _PROXY_POOL_RAW:
    _PROXY_POOL = [p.strip() for p in _PROXY_POOL_RAW.split(",") if p.strip()]
else:
    _PROXY_POOL = [YT_PROXY] if YT_PROXY else []


def get_proxy():
    """Pick a random proxy from the pool. Returns None if pool is empty."""
    if not _PROXY_POOL:
        return None
    return _random.choice(_PROXY_POOL)
