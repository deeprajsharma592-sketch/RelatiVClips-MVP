
# Use Python 3.12-slim — best longevity for a 2-3 year production deploy:
# - EOL Oct 2028 (vs Oct 2027 for 3.11) → 1 extra year of security patches
# - +5% CPython speed (PEP 657 better error messages too)
# - All media-stack wheels exist (faster-whisper, ultralytics, librosa,
#   opencv-python-headless, asyncpg, sqlalchemy)
# - numpy<2.0.0 in requirements.txt works on both 3.11 and 3.12, so local
#   venv (3.11) and Docker (3.12) stay in sync on the same numpy version.
# 3.14 is too new — many wheels missing. 3.13 has free-threaded mode but
# some libs lag; not worth the risk for a 2-3 day ship.
FROM python:3.12-slim

# Production hardening
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    # /app is the WORKDIR; backend/ is the package root inside it.
    # Setting PYTHONPATH lets `uvicorn backend.main:app` resolve the
    # `backend` package correctly when files live at /app/backend/*.
    PYTHONPATH=/app

# Establish our working directory inside the container
WORKDIR /app

# System deps for audio/video processing + the C extensions some pip
# packages need to build (e.g. asyncpg, psycopg2-binary, librosa, ctranslate2).
# nodejs is the JS runtime yt-dlp needs to solve YouTube's 2025+ JS
# challenges (otherwise "Sign in to confirm" even with a valid PO token).
# NOTE: yt-dlp 2026+ ships an "EJS" external-JS system that only
# supports Deno by default. Node 20 is detected as "unsupported" — so
# we install Deno as the primary JS runtime and keep nodejs as a
# fallback for non-yt-dlp tooling.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    ffmpeg \
    curl \
    nodejs \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Deno — yt-dlp 2025+ EJS primary runtime. Installed to /usr/local/bin
# so it's in PATH for the non-root `relativ` user.
RUN curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh \
    && chmod 755 /usr/local/bin/deno \
    && deno --version

# Create a non-root user for runtime. The image is built as root (needed
# for apt-get + pip install), then we drop to `relativ` for the app.
RUN groupadd --system --gid 1001 relativ \
    && useradd --system --uid 1001 --gid relativ --create-home --shell /bin/bash relativ

# Copy deps first for better layer caching (rebuilds only when requirements.txt changes)
COPY requirements.txt .

# Install Python dependencies as root, then drop privileges for runtime.
# Use PyTorch's CPU index URL so the Hetzner VPS deploy doesn't pull in
# the full CUDA toolkit (~2GB extra). The local dev machine installs the
# GPU torch separately when CUDA is available — Docker just needs CPU.
RUN pip install --no-cache-dir \
        --extra-index-url https://download.pytorch.org/whl/cpu \
        -r requirements.txt \
        chromadb>=0.5.0 \
        sentence-transformers>=3.0.0 \
    && chown -R relativ:relativ /app

# Pre-create runtime directories the pipeline writes to (uploads, temp clips,
# rendered outputs). Without this, they get created as root on first run
# and the relativ user gets "Permission denied" when yt-dlp/ffmpeg try to
# write to them. See ticket: pipeline E2E failed with Errno 13 in /app/temp.
RUN mkdir -p /app/temp/uploads /app/temp/creator_history /app/outputs \
    && chown -R relativ:relativ /app/temp /app/outputs

# Copy application code into /app/backend/ so `from .X import Y` in
# main.py resolves as `backend.X` (loaded as the `backend.main` module).
# PYTHONPATH=/app (set below) makes the `backend` package importable.
COPY --chown=relativ:relativ . ./backend/

# YouTube anti-bot infrastructure: bgutil-ytdlp-pot-provider
# The pip plugin (auto-discovered by yt-dlp) calls a local HTTP server
# on :4416 for per-video PO tokens, bypassing YouTube's 2025+ bot
# checks. We start the server as a sidecar via docker-compose.
# See https://github.com/Brainicism/bgutil-ytdlp-pot-provider
RUN pip install --no-cache-dir bgutil-ytdlp-pot-provider

# Expose FastAPI's internal port
EXPOSE 9000

# Health check for orchestrators (Fly, Render, K8s all use this)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl --fail --silent http://127.0.0.1:9000/health || exit 1

# Switch to non-root user before launching
USER relativ

# Single-worker uvicorn is fine for MVP (1 task at a time, MAX_CONCURRENT_TASKS=1).
# For multi-worker, swap to: gunicorn -k uvicorn.workers.UvicornWorker -w 2 backend.main:app
#
# IMPORTANT: must be `backend.main:app`, not `main:app`. main.py uses
# `from .X import Y` relative imports which only resolve when loaded as
# the `backend.main` package member. The PYTHONPATH=/app above makes
# `backend` importable.
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "9000"]
