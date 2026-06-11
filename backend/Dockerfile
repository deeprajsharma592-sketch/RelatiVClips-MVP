
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
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Establish our working directory inside the container
WORKDIR /app

# System deps for audio/video processing + the C extensions some pip
# packages need to build (e.g. asyncpg, psycopg2-binary, librosa, ctranslate2)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

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
    && chown -R relativ:relativ /app

# Copy application code (owned by relativ so it can read/write at runtime)
COPY --chown=relativ:relativ . .

# Expose FastAPI's internal port
EXPOSE 9000

# Health check for orchestrators (Fly, Render, K8s all use this)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl --fail --silent http://127.0.0.1:9000/health || exit 1

# Switch to non-root user before launching
USER relativ

# Single-worker uvicorn is fine for MVP (1 task at a time, MAX_CONCURRENT_TASKS=1).
# For multi-worker, swap to: gunicorn -k uvicorn.workers.UvicornWorker -w 2 main:app
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "9000"]
