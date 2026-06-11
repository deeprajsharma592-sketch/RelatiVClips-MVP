# RelatiV production image. The real Dockerfile lives at backend/Dockerfile.
# This top-level stub is just a convenience for users running `docker build`
# from the repo root (it forwards the context to the backend image).
#
# Build from the repo root:
#   docker build -f backend/Dockerfile -t relativ-backend .
#
# Or use docker-compose (recommended for local dev):
#   docker compose up --build
FROM python:3.12-slim
