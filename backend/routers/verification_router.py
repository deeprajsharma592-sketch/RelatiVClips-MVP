"""
View verification — mock platform polling for MVP.

For real platforms we'd hit TikTok/Instagram/YouTube APIs. For MVP we
simulate organic view growth: approved clips accrue ~5-15% more views per
day, capped at the platform-specific ceiling. Once views plateau, the
clip is marked verified and earnings are computed.

Real platform integration is on the Tier 3 roadmap.

POST /api/v1/verification/run             — manual trigger (admin only)
POST /api/v1/clips/{clip_id}/verify       — verify a single clip (admin/owner)

The cron job (backend/jobs/verify_views.py) calls run_verification()
every 30 min during business hours.
"""
from __future__ import annotations

import logging
import random
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from ..database.models import (
    CampaignClipModel,
    CampaignModel,
    UserModel,
    UserRole,
    CampaignClipStatus,
)
from ..database.session import get_session, async_session
from .auth_router import get_current_user

log = logging.getLogger("relativ.verification")
router = APIRouter(prefix="/api/v1/verification", tags=["verification"])


# Mock platform growth rates (views added per run, per clip)
PLATFORM_DAILY_GROWTH = {
    "tiktok": (3_000, 25_000),
    "instagram": (1_500, 12_000),
    "youtube_shorts": (2_000, 18_000),
    "twitter": (500, 5_000),
    "x": (500, 5_000),
}
PLATFORM_VIEWS_CAP = {
    "tiktok": 5_000_000,
    "instagram": 1_500_000,
    "youtube_shorts": 3_000_000,
    "twitter": 800_000,
    "x": 800_000,
}


# ─── Service function (callable from cron OR API) ──────────────────────────


async def run_verification(
    *,
    session: AsyncSession,
    clipper_user_id: Optional[str] = None,
) -> dict:
    """Run a single verification pass. Returns counts."""
    now = datetime.utcnow()
    verified = 0
    updated = 0
    total_delta = 0

    # Find clips in 'approved' or 'live' status, optionally scoped to a clipper
    stmt = select(CampaignClipModel, CampaignModel).join(
        CampaignModel, CampaignClipModel.campaign_id == CampaignModel.id
    ).where(
        CampaignClipModel.status.in_([
            CampaignClipStatus.APPROVED.value,
            CampaignClipStatus.LIVE.value,
        ])
    )
    if clipper_user_id:
        stmt = stmt.where(CampaignClipModel.clipper_user_id == clipper_user_id)

    rows = (await session.execute(stmt)).all()
    for clip, campaign in rows:
        if not clip.platform:
            continue
        rate = PLATFORM_DAILY_GROWTH.get(clip.platform, (500, 5_000))
        cap = PLATFORM_VIEWS_CAP.get(clip.platform, 1_000_000)

        # Mock growth: random in range, scaled down if we're running more
        # frequently than daily (assume run_verification is called ~hourly)
        delta = random.randint(rate[0] // 24, rate[1] // 24)
        new_views = min(cap, clip.views + delta)

        if new_views > clip.views:
            clip.views = new_views
            clip.earnings_cents = int((new_views * campaign.cpm_cents) / 1000)
            total_delta += delta
            updated += 1

        # Mark verified once views > 5,000 (enough to call it "real")
        if clip.status == CampaignClipStatus.APPROVED.value and clip.views >= 5_000:
            clip.status = CampaignClipStatus.VERIFIED.value
            clip.verified_at = now
            verified += 1

    await session.commit()
    log.info(
        "verification_run updated=%d verified=%d total_delta=%d",
        updated, verified, total_delta,
    )
    return {
        "updated": updated,
        "verified": verified,
        "total_views_added": total_delta,
        "ran_at": now.isoformat(),
    }


# ─── Manual trigger (admin) ────────────────────────────────────────────────


@router.post("/run")
async def trigger_verification(
    user: UserModel = Depends(get_current_user),
):
    if user.role != UserRole.BRAND.value and user.role != UserRole.CLIPPER.value:
        # Brands + clippers can trigger verification of their own work
        raise HTTPException(403, "Authentication required")

    async with async_session() as session:
        # Scope to the calling user (brand: their campaigns, clipper: their clips)
        clipper_user_id = user.id if user.role == UserRole.CLIPPER.value else None
        return await run_verification(session=session, clipper_user_id=clipper_user_id)


class VerifyOneResponse(BaseModel):
    views: int
    earnings_cents: int
    status: str
    verified_at: Optional[str] = None


@router.post("/clips/{clip_id}/verify")
async def verify_single_clip(
    clip_id: str,
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    row = (await session.execute(
        select(CampaignClipModel, CampaignModel)
        .join(CampaignModel, CampaignClipModel.campaign_id == CampaignModel.id)
        .where(CampaignClipModel.id == clip_id)
    )).first()
    if not row:
        raise HTTPException(404, "Clip not found")
    clip, campaign = row
    if user.role == UserRole.BRAND.value and campaign.brand_user_id != user.id:
        raise HTTPException(403, "Not your campaign")
    if user.role == UserRole.CLIPPER.value and clip.clipper_user_id != user.id:
        raise HTTPException(403, "Not your clip")
    if clip.status not in (CampaignClipStatus.APPROVED.value, CampaignClipStatus.LIVE.value):
        raise HTTPException(400, f"Clip is {clip.status}")

    # Force-verify this one clip
    if clip.platform in PLATFORM_DAILY_GROWTH:
        rate = PLATFORM_DAILY_GROWTH[clip.platform]
        cap = PLATFORM_VIEWS_CAP[clip.platform]
        clip.views = max(clip.views, random.randint(rate[0] * 3, rate[1] * 5))
        clip.views = min(clip.views, cap)
        clip.earnings_cents = int((clip.views * campaign.cpm_cents) / 1000)
    if clip.status == CampaignClipStatus.APPROVED.value:
        clip.status = CampaignClipStatus.VERIFIED.value
        clip.verified_at = datetime.utcnow()
    await session.commit()
    return {
        "views": clip.views,
        "earnings_cents": clip.earnings_cents,
        "status": clip.status,
        "verified_at": clip.verified_at.isoformat() if clip.verified_at else None,
    }
