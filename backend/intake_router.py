"""
Intake router — backs the new UI forms:
  POST /api/v1/clippers/apply   → save a clipper application
  POST /api/v1/brands/contact   → save a brand campaign contact
  POST /api/v1/campaigns/quote  → server-authoritative CPM quote
  GET  /api/v1/intake/counts    → debug helper (admin)

Storage: in-memory via backend/store/intake.py. Swap to Postgres on
Day 3 once the DB is online.
"""

import time
from collections import defaultdict
from threading import Lock

from fastapi import APIRouter, HTTPException, Request

from ..models import (
    BrandContact,
    CampaignQuoteRequest,
    CampaignQuoteResponse,
    ClipperApplication,
)
from ..store import intake


router = APIRouter(prefix="/api/v1", tags=["intake"])


# ─────────────────────────────────────────────────────────────────────────────
# Rate limiting — per-IP, per-endpoint, sliding window
# ─────────────────────────────────────────────────────────────────────────────
# Cap inbound submissions to keep spam/abuse cheap to block before
# it reaches the in-memory store. Limits are intentionally generous for
# v1 launch; tighten in v1.1 once we see real traffic patterns.
RATE_LIMITS: dict[str, tuple[int, int]] = {
    # (max_requests, window_seconds)
    "/clippers/apply": (10, 60),    # 10 per minute per IP
    "/brands/contact": (10, 60),    # 10 per minute per IP
    "/campaigns/quote": (60, 60),   # 60 per minute per IP (calculator is a UI call)
}
_rate_log: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
_rate_lock = Lock()


def _check_rate_limit(ip: str, endpoint: str) -> None:
    """Sliding-window rate limiter. Raises 429 if over the cap."""
    cap, window = RATE_LIMITS.get(endpoint, (30, 60))
    now = time.monotonic()
    cutoff = now - window
    with _rate_lock:
        hits = _rate_log[endpoint][ip]
        # Drop expired hits
        _rate_log[endpoint][ip] = [t for t in hits if t > cutoff]
        if len(_rate_log[endpoint][ip]) >= cap:
            retry_after = int(hits[0] + window - now) + 1
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit: {cap} per {window}s. Retry in {retry_after}s.",
                headers={"Retry-After": str(retry_after)},
            )
        _rate_log[endpoint][ip].append(now)


def _client_ip(request: Request) -> str:
    """Best-effort client IP. X-Forwarded-For is set by Caddy when
    proxying, fall back to direct client."""
    return (
        request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or (request.client.host if request.client else "unknown")
    )


@router.post("/clippers/apply", response_model=ClipperApplication)
async def apply_clipper(app: ClipperApplication, request: Request) -> ClipperApplication:
    """
    Receive a clipper application. Stores in the in-memory intake
    store and logs to stdout (which the deploy target's log pipeline
    forwards to email/Slack via Vector/Logtail).
    """
    ip = _client_ip(request)
    _check_rate_limit(ip, "/clippers/apply")
    saved = intake.save_clipper_application(app)
    return saved


@router.post("/brands/contact", response_model=BrandContact)
async def brand_contact(contact: BrandContact, request: Request) -> BrandContact:
    """Receive a brand campaign inquiry. Persists + logs."""
    ip = _client_ip(request)
    _check_rate_limit(ip, "/brands/contact")
    saved = intake.save_brand_contact(contact)
    return saved


@router.post("/campaigns/quote", response_model=CampaignQuoteResponse)
async def campaign_quote(req: CampaignQuoteRequest, request: Request) -> CampaignQuoteResponse:
    """
    Server-side mirror of the CPM calculator on /brands. Returns the
    same shape the frontend computes, but server-authoritative so the
    quote can be persisted and audited.

    Math:
      gross_views = (budget / cpm) * 1000
      net_views   = gross_views * (1 - margin)
      clips       = max(1, round(net / 50_000))
      clippers    = ceil(clips / 8)
    """
    ip = _client_ip(request)
    _check_rate_limit(ip, "/campaigns/quote")
    return intake.compute_quote(req)


@router.get("/intake/counts")
async def intake_counts() -> dict:
    """
    Debug helper: how many clipper apps / brand contacts / quotes have
    come in. Used by ops dashboards. Not auth-gated yet — add an admin
    token before exposing publicly.
    """
    return intake.intake_counts()
