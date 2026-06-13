"""
Marketplace claims — clippers reserve slots in campaigns.

POST   /api/v1/campaigns/{id}/claim         — claim a slot (clipper)
DELETE /api/v1/campaigns/{id}/claim         — release a claim (clipper)
GET    /api/v1/campaigns/{id}/claims        — list claimants (brand owner only)
GET    /api/v1/me/claims                    — my claims (clipper)

A claim reserves one slot in one campaign. The clipper can then submit
exactly one clip for that claim. After submit, brand approves or rejects.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..database.models import (
    CampaignModel,
    CampaignClaimModel,
    UserModel,
    UserRole,
    CampaignStatus,
    ClaimStatus,
)
from ..database.session import get_session
from .auth_router import get_current_user

log = logging.getLogger("relativ.claims")
router = APIRouter(prefix="/api/v1", tags=["claims"])

CLAIM_DEADLINE_DAYS = 7  # 1 week to submit a clip after claiming


def _serialize(claim: CampaignClaimModel, *, campaign: Optional[CampaignModel] = None) -> dict:
    return {
        "id": claim.id,
        "campaign_id": claim.campaign_id,
        "clipper_user_id": claim.clipper_user_id,
        "status": claim.status,
        "claimed_at": claim.claimed_at.isoformat() if claim.claimed_at else None,
        "deadline_at": claim.deadline_at.isoformat() if claim.deadline_at else None,
        "submitted_at": claim.submitted_at.isoformat() if claim.submitted_at else None,
        "campaign": {
            "id": campaign.id,
            "name": campaign.name,
            "cpm_cents": campaign.cpm_cents,
            "status": campaign.status,
            "vertical": campaign.vertical,
        } if campaign else None,
    }


# ─── Claim ─────────────────────────────────────────────────────────────────


@router.post("/campaigns/{campaign_id}/claim", status_code=201)
async def claim_slot(
    campaign_id: str,
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if user.role != UserRole.CLIPPER.value:
        raise HTTPException(403, "Only clippers can claim slots")

    c = (await session.execute(
        select(CampaignModel).where(CampaignModel.id == campaign_id)
    )).scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Campaign not found")
    if c.status != CampaignStatus.LIVE.value:
        raise HTTPException(400, f"Campaign is {c.status}, not accepting claims")
    if c.slots_filled >= c.slots_total:
        raise HTTPException(400, "All slots filled")

    # Idempotent: already claimed by this user?
    existing = (await session.execute(
        select(CampaignClaimModel).where(
            CampaignClaimModel.campaign_id == campaign_id,
            CampaignClaimModel.clipper_user_id == user.id,
            CampaignClaimModel.status.in_([ClaimStatus.CLAIMED.value, ClaimStatus.SUBMITTED.value, ClaimStatus.APPROVED.value]),
        )
    )).scalar_one_or_none()
    if existing:
        log.info("claim_idempotent claim=%s campaign=%s clipper=%s", existing.id, campaign_id, user.email)
        return _serialize(existing, campaign=c)

    claim = CampaignClaimModel(
        id=str(uuid.uuid4()),
        campaign_id=campaign_id,
        clipper_user_id=user.id,
        status=ClaimStatus.CLAIMED.value,
        claimed_at=datetime.utcnow(),
        deadline_at=datetime.utcnow() + timedelta(days=CLAIM_DEADLINE_DAYS),
    )
    c.slots_filled += 1
    session.add(claim)
    await session.commit()
    await session.refresh(claim)
    log.info("claim_created id=%s campaign=%s clipper=%s", claim.id, campaign_id, user.email)
    return _serialize(claim, campaign=c)


# ─── Release claim ─────────────────────────────────────────────────────────


@router.delete("/campaigns/{campaign_id}/claim")
async def release_claim(
    campaign_id: str,
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if user.role != UserRole.CLIPPER.value:
        raise HTTPException(403, "Only clippers can release claims")

    claim = (await session.execute(
        select(CampaignClaimModel).where(
            CampaignClaimModel.campaign_id == campaign_id,
            CampaignClaimModel.clipper_user_id == user.id,
            CampaignClaimModel.status == ClaimStatus.CLAIMED.value,
        )
    )).scalar_one_or_none()
    if not claim:
        raise HTTPException(404, "No active claim to release")

    c = (await session.execute(
        select(CampaignModel).where(CampaignModel.id == campaign_id)
    )).scalar_one_or_none()
    if c and c.slots_filled > 0:
        c.slots_filled -= 1

    claim.status = ClaimStatus.EXPIRED.value
    await session.commit()
    log.info("claim_released id=%s campaign=%s clipper=%s", claim.id, campaign_id, user.email)
    return {"released": True, "id": claim.id}


# ─── List claimants (brand view) ───────────────────────────────────────────


@router.get("/campaigns/{campaign_id}/claims")
async def list_campaign_claims(
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
        raise HTTPException(403, "Not the campaign owner")

    rows = (await session.execute(
        select(CampaignClaimModel, UserModel)
        .join(UserModel, CampaignClaimModel.clipper_user_id == UserModel.id)
        .where(CampaignClaimModel.campaign_id == campaign_id)
        .order_by(CampaignClaimModel.claimed_at.desc())
    )).all()

    return {
        "items": [{
            **_serialize(claim, campaign=c),
            "clipper": {
                "id": u.id,
                "name": u.name,
                "email": u.email,
            },
        } for claim, u in rows],
        "total": len(rows),
    }


# ─── My claims (clipper view) ──────────────────────────────────────────────


@router.get("/me/claims")
async def my_claims(
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if user.role != UserRole.CLIPPER.value:
        raise HTTPException(403, "Clippers only")

    rows = (await session.execute(
        select(CampaignClaimModel, CampaignModel)
        .join(CampaignModel, CampaignClaimModel.campaign_id == CampaignModel.id)
        .where(CampaignClaimModel.clipper_user_id == user.id)
        .order_by(CampaignClaimModel.claimed_at.desc())
    )).all()
    return {
        "items": [_serialize(claim, campaign=c) for claim, c in rows],
        "total": len(rows),
    }
