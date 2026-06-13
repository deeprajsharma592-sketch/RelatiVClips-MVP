"""
Marketplace clips — submit, approve, reject, view verification.

POST  /api/v1/claims/{claim_id}/clips        — submit a clip (clipper, must own claim)
GET   /api/v1/clips/{clip_id}                — clip detail
POST  /api/v1/clips/{clip_id}/approve        — approve (brand owner)
POST  /api/v1/clips/{clip_id}/reject         — reject with reason (brand owner)
GET   /api/v1/me/clips                       — my clips (clipper)
GET   /api/v1/campaigns/{id}/clips           — campaign's clips (brand owner)
GET   /api/v1/clips/pending-review           — queue across all my campaigns (brand)

Lifecycle:
    submitted → approved → verified → paid
              ↘ rejected
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..database.models import (
    CampaignModel,
    CampaignClaimModel,
    CampaignClipModel,
    UserModel,
    UserRole,
    CampaignStatus,
    CampaignClipStatus,
    ClaimStatus,
)
from ..database.session import get_session
from .auth_router import get_current_user

log = logging.getLogger("relativ.clips")
router = APIRouter(prefix="/api/v1", tags=["clips"])


# ─── Pydantic ──────────────────────────────────────────────────────────────


class ClipSubmit(BaseModel):
    title: str = Field(..., min_length=3, max_length=300)
    hook: str = Field(..., min_length=3, max_length=500)
    caption: str = Field(..., min_length=3, max_length=4000)
    platform: str = Field(..., pattern="^(tiktok|instagram|youtube_shorts|twitter|x)$")
    posted_url: str = Field(..., min_length=8, max_length=500)
    duration_s: int = Field(..., ge=5, le=180)
    thumbnail_url: Optional[str] = Field(None, max_length=500)


class ClipReject(BaseModel):
    reason: str = Field(..., min_length=3, max_length=1000)


# ─── Serializers ───────────────────────────────────────────────────────────


def _serialize(
    clip: CampaignClipModel,
    *,
    claim: Optional[CampaignClaimModel] = None,
    campaign: Optional[CampaignModel] = None,
    clipper: Optional[UserModel] = None,
) -> dict:
    return {
        "id": clip.id,
        "campaign_id": clip.campaign_id,
        "claim_id": clip.claim_id,
        "clipper_user_id": clip.clipper_user_id,
        "title": clip.title,
        "hook": clip.hook,
        "caption": clip.caption,
        "platform": clip.platform,
        "posted_url": clip.posted_url,
        "duration_s": clip.duration_s,
        "thumbnail_url": clip.thumbnail_url,
        "status": clip.status,
        "views": clip.views,
        "earnings_cents": clip.earnings_cents,
        "submitted_at": clip.submitted_at.isoformat() if clip.submitted_at else None,
        "approved_at": clip.approved_at.isoformat() if clip.approved_at else None,
        "rejected_at": clip.rejected_at.isoformat() if clip.rejected_at else None,
        "verified_at": clip.verified_at.isoformat() if clip.verified_at else None,
        "paid_at": clip.paid_at.isoformat() if clip.paid_at else None,
        "brand_notes": clip.brand_notes,
        "claim": {
            "id": claim.id,
            "status": claim.status,
        } if claim else None,
        "campaign": {
            "id": campaign.id,
            "name": campaign.name,
            "cpm_cents": campaign.cpm_cents,
        } if campaign else None,
        "clipper": {
            "id": clipper.id,
            "name": clipper.name,
            "email": clipper.email,
        } if clipper else None,
    }


# ─── Submit ────────────────────────────────────────────────────────────────


@router.post("/claims/{claim_id}/clips", status_code=201)
async def submit_clip(
    claim_id: str,
    body: ClipSubmit,
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if user.role != UserRole.CLIPPER.value:
        raise HTTPException(403, "Only clippers can submit clips")

    claim = (await session.execute(
        select(CampaignClaimModel).where(CampaignClaimModel.id == claim_id)
    )).scalar_one_or_none()
    if not claim:
        raise HTTPException(404, "Claim not found")
    if claim.clipper_user_id != user.id:
        raise HTTPException(403, "Not your claim")
    if claim.status != ClaimStatus.CLAIMED.value:
        raise HTTPException(400, f"Claim is {claim.status} — already submitted or expired")

    c = (await session.execute(
        select(CampaignModel).where(CampaignModel.id == claim.campaign_id)
    )).scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Underlying campaign missing")
    if c.status not in (CampaignStatus.LIVE.value, CampaignStatus.PAUSED.value):
        raise HTTPException(400, f"Campaign is {c.status}")

    clip = CampaignClipModel(
        id=str(uuid.uuid4()),
        campaign_id=claim.campaign_id,
        claim_id=claim.id,
        clipper_user_id=user.id,
        title=body.title,
        hook=body.hook,
        caption=body.caption,
        platform=body.platform,
        posted_url=body.posted_url,
        duration_s=body.duration_s,
        thumbnail_url=body.thumbnail_url,
        status=CampaignClipStatus.SUBMITTED.value,
        views=0,
        earnings_cents=0,
        submitted_at=datetime.utcnow(),
    )
    claim.status = ClaimStatus.SUBMITTED.value
    claim.submitted_at = datetime.utcnow()
    session.add(clip)
    await session.commit()
    await session.refresh(clip)
    log.info("clip_submitted id=%s claim=%s clipper=%s campaign=%s",
             clip.id, claim_id, user.email, c.id)
    return _serialize(clip, claim=claim, campaign=c)


# ─── Pending review (brand queue across all campaigns) ────────────────────
# NOTE: must come BEFORE /clips/{clip_id} or FastAPI will match "pending-review" as a clip_id


@router.get("/clips/pending-review")
async def pending_review(
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if user.role != UserRole.BRAND.value:
        raise HTTPException(403, "Brands only")

    rows = (await session.execute(
        select(CampaignClipModel, CampaignModel, UserModel)
        .join(CampaignModel, CampaignClipModel.campaign_id == CampaignModel.id)
        .join(UserModel, CampaignClipModel.clipper_user_id == UserModel.id)
        .where(
            CampaignModel.brand_user_id == user.id,
            CampaignClipModel.status == CampaignClipStatus.SUBMITTED.value,
        )
        .order_by(CampaignClipModel.submitted_at.asc())
    )).all()
    return {
        "items": [_serialize(clip, campaign=c, clipper=u) for clip, c, u in rows],
        "total": len(rows),
    }


# ─── Get one ──────────────────────────────────────────────────────────────


@router.get("/clips/{clip_id}")
async def get_clip(
    clip_id: str,
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    row = (await session.execute(
        select(CampaignClipModel, CampaignClaimModel, CampaignModel, UserModel)
        .join(CampaignClaimModel, CampaignClipModel.claim_id == CampaignClaimModel.id)
        .join(CampaignModel, CampaignClipModel.campaign_id == CampaignModel.id)
        .join(UserModel, CampaignClipModel.clipper_user_id == UserModel.id)
        .where(CampaignClipModel.id == clip_id)
    )).first()
    if not row:
        raise HTTPException(404, "Clip not found")
    clip, claim, campaign, clipper = row

    # Authz: brand owner, the clipper themselves, or admin
    if user.role == UserRole.BRAND.value and campaign.brand_user_id != user.id:
        raise HTTPException(403, "Not your campaign")
    if user.role == UserRole.CLIPPER.value and clipper.id != user.id:
        raise HTTPException(403, "Not your clip")

    return _serialize(clip, claim=claim, campaign=campaign, clipper=clipper)


# ─── Approve / Reject (brand owner) ───────────────────────────────────────


@router.post("/clips/{clip_id}/approve")
async def approve_clip(
    clip_id: str,
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if user.role != UserRole.BRAND.value:
        raise HTTPException(403, "Only brands can approve")

    row = (await session.execute(
        select(CampaignClipModel, CampaignModel)
        .join(CampaignModel, CampaignClipModel.campaign_id == CampaignModel.id)
        .where(CampaignClipModel.id == clip_id)
    )).first()
    if not row:
        raise HTTPException(404, "Clip not found")
    clip, campaign = row
    if campaign.brand_user_id != user.id:
        raise HTTPException(403, "Not your campaign")
    if clip.status != CampaignClipStatus.SUBMITTED.value:
        raise HTTPException(400, f"Clip is {clip.status}")

    clip.status = CampaignClipStatus.APPROVED.value
    clip.approved_at = datetime.utcnow()
    await session.commit()
    log.info("clip_approved id=%s brand=%s", clip.id, user.email)
    return _serialize(clip, campaign=campaign)


@router.post("/clips/{clip_id}/reject")
async def reject_clip(
    clip_id: str,
    body: ClipReject,
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if user.role != UserRole.BRAND.value:
        raise HTTPException(403, "Only brands can reject")

    row = (await session.execute(
        select(CampaignClipModel, CampaignModel)
        .join(CampaignModel, CampaignClipModel.campaign_id == CampaignModel.id)
        .where(CampaignClipModel.id == clip_id)
    )).first()
    if not row:
        raise HTTPException(404, "Clip not found")
    clip, campaign = row
    if campaign.brand_user_id != user.id:
        raise HTTPException(403, "Not your campaign")
    if clip.status != CampaignClipStatus.SUBMITTED.value:
        raise HTTPException(400, f"Clip is {clip.status}")

    clip.status = CampaignClipStatus.REJECTED.value
    clip.rejected_at = datetime.utcnow()
    clip.brand_notes = body.reason
    # Return the slot to the brand's pool: decrement slots_filled
    if campaign.slots_filled > 0:
        campaign.slots_filled -= 1
    await session.commit()
    log.info("clip_rejected id=%s brand=%s reason=%s", clip.id, user.email, body.reason[:50])
    return _serialize(clip, campaign=campaign)


# ─── My clips (clipper) ────────────────────────────────────────────────────


@router.get("/me/clips")
async def my_clips(
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if user.role != UserRole.CLIPPER.value:
        raise HTTPException(403, "Clippers only")

    rows = (await session.execute(
        select(CampaignClipModel, CampaignModel)
        .join(CampaignModel, CampaignClipModel.campaign_id == CampaignModel.id)
        .where(CampaignClipModel.clipper_user_id == user.id)
        .order_by(CampaignClipModel.submitted_at.desc())
    )).all()
    return {
        "items": [_serialize(c, campaign=cmp) for c, cmp in rows],
        "total": len(rows),
    }


# ─── Campaign clips (brand view) ──────────────────────────────────────────


@router.get("/campaigns/{campaign_id}/clips")
async def list_campaign_clips(
    campaign_id: str,
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    c = (await session.execute(
        select(CampaignModel).where(CampaignModel.id == campaign_id)
    )).scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Campaign not found")
    if c.brand_user_id != user.id:
        raise HTTPException(403, "Not your campaign")

    rows = (await session.execute(
        select(CampaignClipModel, UserModel)
        .join(UserModel, CampaignClipModel.clipper_user_id == UserModel.id)
        .where(CampaignClipModel.campaign_id == campaign_id)
        .order_by(CampaignClipModel.submitted_at.desc())
    )).all()
    return {
        "items": [_serialize(clip, campaign=c, clipper=u) for clip, u in rows],
        "total": len(rows),
    }


# (pending_review moved earlier — must come before /clips/{clip_id})

