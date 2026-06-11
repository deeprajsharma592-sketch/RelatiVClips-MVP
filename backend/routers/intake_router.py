"""
Intake router — backs the new UI forms:
  POST /api/v1/clippers/apply   → save a clipper application
  POST /api/v1/brands/contact   → save a brand campaign contact
  POST /api/v1/campaigns/quote  → server-authoritative CPM quote
  GET  /api/v1/intake/counts    → debug helper (admin)

Storage: in-memory via backend/store/intake.py. Swap to Postgres on
Day 3 once the DB is online.
"""

from fastapi import APIRouter, HTTPException

from ..models import (
    BrandContact,
    CampaignQuoteRequest,
    CampaignQuoteResponse,
    ClipperApplication,
)
from ..store import intake


router = APIRouter(prefix="/api/v1", tags=["intake"])


@router.post("/clippers/apply", response_model=ClipperApplication)
async def apply_clipper(app: ClipperApplication) -> ClipperApplication:
    """
    Receive a clipper application. Stores in the in-memory intake
    store and logs to stdout (which the deploy target's log pipeline
    forwards to email/Slack via Vector/Logtail).
    """
    saved = intake.save_clipper_application(app)
    return saved


@router.post("/brands/contact", response_model=BrandContact)
async def brand_contact(contact: BrandContact) -> BrandContact:
    """Receive a brand campaign inquiry. Persists + logs."""
    saved = intake.save_brand_contact(contact)
    return saved


@router.post("/campaigns/quote", response_model=CampaignQuoteResponse)
async def campaign_quote(req: CampaignQuoteRequest) -> CampaignQuoteResponse:
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
    return intake.compute_quote(req)


@router.get("/intake/counts")
async def intake_counts() -> dict:
    """
    Debug helper: how many clipper apps / brand contacts / quotes have
    come in. Used by ops dashboards. Not auth-gated yet — add an admin
    token before exposing publicly.
    """
    return intake.intake_counts()
