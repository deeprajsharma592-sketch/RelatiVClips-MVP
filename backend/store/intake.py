"""
In-memory intake store for clipper applications, brand contacts, and
CPM-quote requests. Persists across the lifetime of the backend process.
Swap to a Postgres-backed store when DB is online (Day 3 task).
"""

from __future__ import annotations

import threading
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from ..models import (
    BrandContact,
    CampaignQuoteRequest,
    CampaignQuoteResponse,
    ClipperApplication,
)


_lock = threading.Lock()

_clipper_applications: List[dict] = []
_brand_contacts: List[dict] = []
_campaign_quotes: List[dict] = []


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─── Clipper applications ─────────────────────────────────────────────────

def save_clipper_application(app: ClipperApplication) -> ClipperApplication:
    """Persist a clipper application. Returns it with id + submitted_at."""
    if not app.id:
        app.id = f"app_{uuid.uuid4().hex[:12]}"
    if not app.submitted_at:
        app.submitted_at = _now()
    with _lock:
        _clipper_applications.append(app.model_dump())
    print(f"[Intake] Clipper application {app.id} from {app.email} ({app.handle})")
    return app


def list_clipper_applications(limit: int = 100) -> List[dict]:
    with _lock:
        return list(reversed(_clipper_applications[-limit:]))


# ─── Brand contacts ───────────────────────────────────────────────────────

def save_brand_contact(contact: BrandContact) -> BrandContact:
    if not contact.id:
        contact.id = f"brand_{uuid.uuid4().hex[:12]}"
    if not contact.submitted_at:
        contact.submitted_at = _now()
    with _lock:
        _brand_contacts.append(contact.model_dump())
    print(
        f"[Intake] Brand contact {contact.id} from {contact.email} "
        f"({contact.company or 'no-company'}) — budget ${contact.budget_usd:,}"
    )
    return contact


def list_brand_contacts(limit: int = 100) -> List[dict]:
    with _lock:
        return list(reversed(_brand_contacts[-limit:]))


# ─── Campaign quotes (CPM calculator) ─────────────────────────────────────

# Same constants as the frontend CpmCalculator — server-authoritative so
# the quote can be audited and persisted.
CPM_USD = 7.0
PLATFORM_MARGIN = 0.12
CLIPS_PER_50K_VIEWS = 1
CLIPS_PER_CLIPPER_PER_WEEK = 8
TURNOVER_HOURS = 48

PLATFORM_DEFAULTS = [
    {"id": "tiktok", "name": "TikTok", "share": 0.45, "emoji": "♪"},
    {"id": "reels", "name": "Instagram Reels", "share": 0.30, "emoji": "▢"},
    {"id": "shorts", "name": "YouTube Shorts", "share": 0.25, "emoji": "▶"},
]


def compute_quote(req: CampaignQuoteRequest) -> CampaignQuoteResponse:
    """Server-side mirror of CpmCalculator. Returns a quote with id + expiry."""
    gross = (req.budget_usd / CPM_USD) * 1000
    net = gross * (1 - PLATFORM_MARGIN)
    clips = max(1, round(net / 50_000))
    clippers = max(1, -(-clips // CLIPS_PER_CLIPPER_PER_WEEK))  # ceil

    platform_split = []
    for p in PLATFORM_DEFAULTS:
        platform_split.append(
            {
                "id": p["id"],
                "name": p["name"],
                "emoji": p["emoji"],
                "share": p["share"],
                "impressions": int(net * p["share"]),
                "clips": max(1, round(clips * p["share"])),
            }
        )

    quote_id = f"q_{uuid.uuid4().hex[:10]}"
    # Quote valid for 14 days
    expires = datetime.fromtimestamp(
        datetime.now().timestamp() + 14 * 24 * 3600, tz=timezone.utc
    ).isoformat()

    quote = CampaignQuoteResponse(
        budget_usd=req.budget_usd,
        cpm_usd=CPM_USD,
        platform_margin=PLATFORM_MARGIN,
        estimated_views=int(net),
        estimated_clips=clips,
        clippers_assigned=clippers,
        platform_split=platform_split,
        turnaround_hours=TURNOVER_HOURS,
        quote_id=quote_id,
        expires_at=expires,
    )

    with _lock:
        _campaign_quotes.append(
            {
                "quote_id": quote_id,
                "budget_usd": req.budget_usd,
                "video_url": req.video_url,
                "created_at": _now(),
            }
        )

    print(
        f"[Intake] Campaign quote {quote_id} for ${req.budget_usd:,} → "
        f"{quote.estimated_views:,} views / {quote.estimated_clips} clips / {quote.clippers_assigned} clippers"
    )
    return quote


def list_campaign_quotes(limit: int = 100) -> List[dict]:
    with _lock:
        return list(reversed(_campaign_quotes[-limit:]))


# ─── Debug / health ───────────────────────────────────────────────────────

def intake_counts() -> dict:
    with _lock:
        return {
            "clipper_applications": len(_clipper_applications),
            "brand_contacts": len(_brand_contacts),
            "campaign_quotes": len(_campaign_quotes),
        }
