"""
Marketplace campaigns — CRUD + lifecycle management.

GET    /api/v1/campaigns                — list (filtered: mine=true|false, status, q)
POST   /api/v1/campaigns                — create (brand only)
GET    /api/v1/campaigns/{id}           — detail with claims + clip stats
PATCH  /api/v1/campaigns/{id}           — update (brand owner only)
POST   /api/v1/campaigns/{id}/pause     — pause (brand owner)
POST   /api/v1/campaigns/{id}/resume    — resume (brand owner)
POST   /api/v1/campaigns/{id}/complete  — mark complete (brand owner)
DELETE /api/v1/campaigns/{id}           — soft delete (status=cancelled, brand owner)

Authorization rules
-------------------
- Brands can read + write their own campaigns, read live ones.
- Clippers can read live campaigns with open slots.
- Creators + admins can read all.
- Only the brand that owns a campaign can mutate it.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, func, case, or_
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

log = logging.getLogger("relativ.campaigns")
router = APIRouter(prefix="/api/v1/campaigns", tags=["campaigns"])


# ─── Pydantic request shapes ──────────────────────────────────────────────


class CampaignCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=200)
    brief: str = Field(..., min_length=10, max_length=4000)
    vertical: Optional[str] = Field(None, max_length=80)
    source_handle: Optional[str] = Field(None, max_length=200)
    cpm_cents: int = Field(..., ge=100, le=100_000)  # $1.00 - $1,000
    budget_cents: int = Field(..., ge=1_000, le=100_000_000_00)  # $10 min, big cap
    slots_total: int = Field(..., ge=1, le=1000)
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None


class CampaignUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=3, max_length=200)
    brief: Optional[str] = Field(None, min_length=10, max_length=4000)
    vertical: Optional[str] = Field(None, max_length=80)
    source_handle: Optional[str] = Field(None, max_length=200)
    cpm_cents: Optional[int] = Field(None, ge=100, le=100_000)
    budget_cents: Optional[int] = Field(None, ge=1_000, le=100_000_000_00)
    slots_total: Optional[int] = Field(None, ge=1, le=1000)
    ends_at: Optional[datetime] = None


# ─── Serializers ───────────────────────────────────────────────────────────


def _serialize(c: CampaignModel, *, claim_count: int = 0, clip_count: int = 0) -> dict:
    return {
        "id": c.id,
        "brand_user_id": c.brand_user_id,
        "name": c.name,
        "brief": c.brief,
        "vertical": c.vertical,
        "source_handle": c.source_handle,
        "cpm_cents": c.cpm_cents,
        "budget_cents": c.budget_cents,
        "spent_cents": c.spent_cents,
        "slots_total": c.slots_total,
        "slots_filled": c.slots_filled,
        "slots_remaining": max(0, c.slots_total - c.slots_filled),
        "status": c.status,
        "starts_at": c.starts_at.isoformat() if c.starts_at else None,
        "ends_at": c.ends_at.isoformat() if c.ends_at else None,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
        "claim_count": claim_count,
        "clip_count": clip_count,
    }


async def _claim_count(session: AsyncSession, campaign_id: str) -> int:
    return (await session.execute(
        select(func.count(CampaignClaimModel.id))
        .where(CampaignClaimModel.campaign_id == campaign_id)
        .where(CampaignClaimModel.status != ClaimStatus.EXPIRED.value)
    )).scalar_one()


async def _clip_count(session: AsyncSession, campaign_id: str) -> int:
    return (await session.execute(
        select(func.count(CampaignClipModel.id))
        .where(CampaignClipModel.campaign_id == campaign_id)
    )).scalar_one()


# ─── List ──────────────────────────────────────────────────────────────────


@router.get("")
async def list_campaigns(
    *,
    mine: bool = Query(False, description="Limit to campaigns I own (brands)"),
    status_filter: Optional[str] = Query(None, alias="status", description="draft|live|paused|completed|cancelled"),
    q: Optional[str] = Query(None, description="Search by name or brief"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    stmt = select(CampaignModel)

    # Role-based visibility
    if user.role == UserRole.CLIPPER.value:
        # Clippers see live campaigns with open slots
        stmt = stmt.where(CampaignModel.status == CampaignStatus.LIVE.value)
        stmt = stmt.where(CampaignModel.slots_filled < CampaignModel.slots_total)
    elif mine or user.role == UserRole.BRAND.value:
        # Brands see their own by default
        stmt = stmt.where(CampaignModel.brand_user_id == user.id)
    # else: creator/admin — see all

    if status_filter:
        stmt = stmt.where(CampaignModel.status == status_filter)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(
            CampaignModel.name.ilike(like),
            CampaignModel.brief.ilike(like),
        ))

    stmt = stmt.order_by(CampaignModel.created_at.desc()).offset(offset).limit(limit)
    rows = (await session.execute(stmt)).scalars().all()

    # Count claims + clips per campaign in one round-trip
    ids = [r.id for r in rows]
    claim_counts = {}
    clip_counts = {}
    if ids:
        cc = (await session.execute(
            select(CampaignClaimModel.campaign_id, func.count(CampaignClaimModel.id))
            .where(CampaignClaimModel.campaign_id.in_(ids))
            .where(CampaignClaimModel.status != ClaimStatus.EXPIRED.value)
            .group_by(CampaignClaimModel.campaign_id)
        )).all()
        claim_counts = {r[0]: r[1] for r in cc}

        clc = (await session.execute(
            select(CampaignClipModel.campaign_id, func.count(CampaignClipModel.id))
            .where(CampaignClipModel.campaign_id.in_(ids))
            .group_by(CampaignClipModel.campaign_id)
        )).all()
        clip_counts = {r[0]: r[1] for r in clc}

    return {
        "items": [_serialize(c, claim_count=claim_counts.get(c.id, 0), clip_count=clip_counts.get(c.id, 0)) for c in rows],
        "total": len(rows),
        "limit": limit,
        "offset": offset,
    }


# ─── Get one ──────────────────────────────────────────────────────────────


@router.get("/{campaign_id}")
async def get_campaign(
    campaign_id: str,
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    c = (await session.execute(
        select(CampaignModel).where(CampaignModel.id == campaign_id)
    )).scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Campaign not found")

    # Authorization: brand owner can always see; clippers can see live+open;
    # others can see non-cancelled.
    if user.role == UserRole.CLIPPER.value:
        if c.status != CampaignStatus.LIVE.value:
            raise HTTPException(403, "Campaign not visible")
    elif user.role == UserRole.BRAND.value and c.brand_user_id != user.id:
        if c.status == CampaignStatus.CANCELLED.value:
            raise HTTPException(404, "Campaign not found")

    cc = await _claim_count(session, c.id)
    clc = await _clip_count(session, c.id)
    return _serialize(c, claim_count=cc, clip_count=clc)


# ─── Create ───────────────────────────────────────────────────────────────


@router.post("", status_code=201)
async def create_campaign(
    body: CampaignCreate,
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if user.role != UserRole.BRAND.value:
        raise HTTPException(403, "Only brands can create campaigns")

    c = CampaignModel(
        id=str(uuid.uuid4()),
        brand_user_id=user.id,
        name=body.name,
        brief=body.brief,
        vertical=body.vertical,
        source_handle=body.source_handle,
        cpm_cents=body.cpm_cents,
        budget_cents=body.budget_cents,
        spent_cents=0,
        slots_total=body.slots_total,
        slots_filled=0,
        status=CampaignStatus.LIVE.value,
        starts_at=body.starts_at or datetime.utcnow(),
        ends_at=body.ends_at,
    )
    session.add(c)
    await session.commit()
    await session.refresh(c)

    log.info("campaign_created id=%s brand=%s cpm=%d budget=%d slots=%d",
             c.id, user.email, c.cpm_cents, c.budget_cents, c.slots_total)
    return _serialize(c)


# ─── Update ───────────────────────────────────────────────────────────────


@router.patch("/{campaign_id}")
async def update_campaign(
    campaign_id: str,
    body: CampaignUpdate,
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
    if c.status in (CampaignStatus.COMPLETED.value, CampaignStatus.CANCELLED.value):
        raise HTTPException(400, f"Cannot edit a {c.status} campaign")

    # Apply non-None fields
    payload = body.model_dump(exclude_unset=True)
    for k, v in payload.items():
        setattr(c, k, v)
    c.updated_at = datetime.utcnow()

    await session.commit()
    await session.refresh(c)
    log.info("campaign_updated id=%s fields=%s", c.id, list(payload.keys()))
    return _serialize(c)


# ─── Lifecycle endpoints ──────────────────────────────────────────────────


@router.post("/{campaign_id}/pause")
async def pause_campaign(
    campaign_id: str,
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    return await _set_status(campaign_id, user, session, CampaignStatus.PAUSED.value, "paused")


@router.post("/{campaign_id}/resume")
async def resume_campaign(
    campaign_id: str,
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    return await _set_status(campaign_id, user, session, CampaignStatus.LIVE.value, "resumed")


@router.post("/{campaign_id}/complete")
async def complete_campaign(
    campaign_id: str,
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    return await _set_status(campaign_id, user, session, CampaignStatus.COMPLETED.value, "completed")


@router.delete("/{campaign_id}")
async def cancel_campaign(
    campaign_id: str,
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Soft-delete: mark as cancelled, do not remove. Refund unspent budget
    is out of scope for v1; finance team handles that."""
    return await _set_status(campaign_id, user, session, CampaignStatus.CANCELLED.value, "cancelled")


async def _set_status(
    campaign_id: str,
    user: UserModel,
    session: AsyncSession,
    new_status: str,
    action: str,
):
    c = (await session.execute(
        select(CampaignModel).where(CampaignModel.id == campaign_id)
    )).scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Campaign not found")
    if c.brand_user_id != user.id:
        raise HTTPException(403, "Not the campaign owner")
    old = c.status
    c.status = new_status
    c.updated_at = datetime.utcnow()
    await session.commit()
    log.info("campaign_%s id=%s %s→%s", action, c.id, old, new_status)
    return _serialize(c)
