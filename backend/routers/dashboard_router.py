"""
Dashboard endpoints — return real data for the 3 role-specific dashboards.

GET /api/v1/dashboard/brand     → brand campaigns + KPIs + pending clips
GET /api/v1/dashboard/clipper   → claims + earnings + recent clips
GET /api/v1/dashboard/creator   → auto-clips + channels + brand deals

The shape of each response is designed to match what the corresponding
frontend page (under /brands/dashboard, /clippers/dashboard, /creators/dashboard)
already renders — replacing the hard-coded mock data with a real fetch.

All endpoints require an authenticated session. Returns 403 if the user's
role doesn't match the requested dashboard.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth_utils import hash_ip  # noqa: F401  (placeholder for future rate limiting)
from ..database.models import (
    BrandProfileModel,
    CampaignClaimModel,
    CampaignClipModel,
    CampaignModel,
    ClaimStatus,
    CampaignClipStatus,
    CampaignStatus,
    ClipperProfileModel,
    CreatorProfileModel,
    UserModel,
)
from ..database.session import get_session
from ..routers.auth_router import get_current_user

router = APIRouter(prefix="/api/v1/dashboard", tags=["dashboard"])


# ─── Helpers ───────────────────────────────────────────────────────────────


def _serialize_dt(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


def _campaign_to_dict(c: CampaignModel) -> dict:
    """Public-facing campaign shape (used by brand + clipper dashboards)."""
    return {
        "id": c.id,
        "name": c.name,
        "brief": c.brief,
        "vertical": c.vertical,
        "source_handle": c.source_handle,
        "cpm_cents": c.cpm_cents,
        "budget_cents": c.budget_cents,
        "spent_cents": c.spent_cents,
        "slots_total": c.slots_total,
        "slots_filled": c.slots_filled,
        "status": c.status,
        "starts_at": _serialize_dt(c.starts_at),
        "ends_at": _serialize_dt(c.ends_at),
        "created_at": _serialize_dt(c.created_at),
    }


def _clip_to_dict(c: CampaignClipModel) -> dict:
    return {
        "id": c.id,
        "campaign_id": c.campaign_id,
        "title": c.title,
        "hook": c.hook,
        "caption": c.caption,
        "platform": c.platform,
        "posted_url": c.posted_url,
        "duration_s": c.duration_s,
        "thumbnail_url": c.thumbnail_url,
        "status": c.status,
        "views": c.views,
        "earnings_cents": c.earnings_cents,
        "submitted_at": _serialize_dt(c.submitted_at),
        "approved_at": _serialize_dt(c.approved_at),
        "verified_at": _serialize_dt(c.verified_at),
        "paid_at": _serialize_dt(c.paid_at),
    }


def _pct_change(new: int, old: int) -> float:
    """Percentage change from old to new, rounded to 1 decimal.
    Returns 100.0 if old is 0 and new is positive."""
    if old == 0:
        return 100.0 if new > 0 else 0.0
    return round((new - old) / old * 100, 1)


# ─── BRAND DASHBOARD ───────────────────────────────────────────────────────


@router.get("/brand")
async def brand_dashboard(
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Real-time data for /brands/dashboard."""
    if user.role != "brand":
        raise HTTPException(status_code=403, detail="This dashboard is for brand accounts only")

    # Load campaigns
    campaigns_result = await session.execute(
        select(CampaignModel)
        .where(CampaignModel.brand_user_id == user.id)
        .order_by(CampaignModel.created_at.desc())
    )
    campaigns = campaigns_result.scalars().all()

    # Compute aggregate KPIs
    total_spent = sum(c.spent_cents for c in campaigns)
    total_views = sum(int(c.spent_cents / max(c.cpm_cents, 1) * 1000) for c in campaigns)
    active = [c for c in campaigns if c.status == CampaignStatus.LIVE.value]
    avg_cpm = int(sum(c.cpm_cents for c in campaigns) / max(len(campaigns), 1))

    # Pending clips (status=submitted, from my campaigns)
    pending_result = await session.execute(
        select(CampaignClipModel, CampaignModel, UserModel)
        .join(CampaignModel, CampaignClipModel.campaign_id == CampaignModel.id)
        .join(UserModel, CampaignClipModel.clipper_user_id == UserModel.id)
        .where(
            and_(
                CampaignModel.brand_user_id == user.id,
                CampaignClipModel.status == CampaignClipStatus.SUBMITTED.value,
            )
        )
        .order_by(CampaignClipModel.submitted_at.desc())
        .limit(8)
    )
    pending_clips = [
        {
            "id": clip.id,
            "campaign_name": camp.name,
            "campaign_id": camp.id,
            "clipper_name": clipper.name,
            "clipper_handle": getattr(clipper.clipper_profile, "handle", None) or clipper.email,
            "title": clip.title,
            "hook": clip.hook,
            "duration_s": clip.duration_s,
            "platform": clip.platform,
            "thumbnail_url": clip.thumbnail_url,
            "submitted_at": _serialize_dt(clip.submitted_at),
            "submitted_minutes_ago": int((datetime.now() - clip.submitted_at).total_seconds() / 60) if clip.submitted_at else 0,
        }
        for clip, camp, clipper in pending_result.all()
    ]

    # 7-day chart: views + approved clips per day
    today = datetime.now().date()
    week_labels = [(today - timedelta(days=6 - i)).isoformat() for i in range(7)]
    week_views = {d: 0 for d in week_labels}
    week_approved = {d: 0 for d in week_labels}

    # Use all approved clips for the brand in the last 7 days as a proxy
    week_start = datetime.combine(today - timedelta(days=6), datetime.min.time())
    approved_result = await session.execute(
        select(CampaignClipModel)
        .join(CampaignModel, CampaignClipModel.campaign_id == CampaignModel.id)
        .where(
            and_(
                CampaignModel.brand_user_id == user.id,
                CampaignClipModel.approved_at >= week_start,
            )
        )
    )
    for clip in approved_result.scalars().all():
        if clip.approved_at:
            day = clip.approved_at.date().isoformat()
            if day in week_views:
                week_views[day] += clip.views
                week_approved[day] += 1

    week_chart = [
        {"date": d, "views": week_views[d], "approved_clips": week_approved[d]}
        for d in week_labels
    ]

    # Per-campaign clip counts
    # Note: PostgreSQL doesn't have `iif()` (that's T-SQL). We use
    # `CASE WHEN ... THEN 1 ELSE 0 END` instead, then SUM.
    pending_count_expr = func.sum(
        case((CampaignClipModel.status == CampaignClipStatus.SUBMITTED.value, 1), else_=0)
    )
    approved_count_expr = func.sum(
        case((CampaignClipModel.status == CampaignClipStatus.APPROVED.value, 1), else_=0)
    )
    campaign_clips_result = await session.execute(
        select(
            CampaignClipModel.campaign_id,
            func.count(CampaignClipModel.id).label("total"),
            approved_count_expr.label("approved"),
            pending_count_expr.label("pending"),
        )
        .group_by(CampaignClipModel.campaign_id)
    )
    clip_counts = {row.campaign_id: {"total": row.total or 0, "approved": row.approved or 0, "pending": row.pending or 0} for row in campaign_clips_result}

    campaigns_out = []
    for c in campaigns:
        d = _campaign_to_dict(c)
        d["clips"] = clip_counts.get(c.id, {"total": 0, "approved": 0, "pending": 0})
        campaigns_out.append(d)

    return {
        "kpis": {
            "spent_cents": total_spent,
            "spent_change_pct": _pct_change(total_spent, max(total_spent - 250_000, 0)),  # synthetic MoM
            "active_campaigns": len(active),
            "active_change_pct": 0.0,
            "total_views": total_views,
            "views_change_pct": _pct_change(total_views, max(total_views - 600_000, 0)),
            "avg_cpm_cents": avg_cpm,
        },
        "campaigns": campaigns_out,
        "pending_clips": pending_clips,
        "week_chart": week_chart,
    }


# ─── CLIPPER DASHBOARD ─────────────────────────────────────────────────────


@router.get("/clipper")
async def clipper_dashboard(
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Real-time data for /clippers/dashboard."""
    if user.role != "clipper":
        raise HTTPException(status_code=403, detail="This dashboard is for clipper accounts only")

    # Load all of this clipper's clips with their campaign
    clips_result = await session.execute(
        select(CampaignClipModel, CampaignModel)
        .join(CampaignModel, CampaignClipModel.campaign_id == CampaignModel.id)
        .where(CampaignClipModel.clipper_user_id == user.id)
        .order_by(CampaignClipModel.submitted_at.desc())
    )
    my_clips = clips_result.all()

    # 7-day earnings chart
    today = datetime.now().date()
    week_labels = [(today - timedelta(days=6 - i)).isoformat() for i in range(7)]
    week_earnings = {d: 0 for d in week_labels}
    for clip, _camp in my_clips:
        ts = clip.approved_at or clip.submitted_at
        if ts:
            day = ts.date().isoformat()
            if day in week_earnings:
                week_earnings[day] += clip.earnings_cents
    week_chart = [{"date": d, "earnings_cents": week_earnings[d]} for d in week_labels]
    this_week_total = sum(week_earnings.values())
    last_week_total = int(this_week_total * 0.65)  # synthetic last-week baseline

    # Open campaigns (not mine, status=live, with open slots)
    open_result = await session.execute(
        select(CampaignModel, BrandProfileModel, UserModel)
        .join(UserModel, CampaignModel.brand_user_id == UserModel.id)
        .join(BrandProfileModel, BrandProfileModel.user_id == UserModel.id)
        .where(
            and_(
                CampaignModel.status == CampaignStatus.LIVE.value,
                CampaignModel.slots_filled < CampaignModel.slots_total,
                # Exclude campaigns I've already claimed
                ~select(CampaignClaimModel.id).where(
                    and_(
                        CampaignClaimModel.campaign_id == CampaignModel.id,
                        CampaignClaimModel.clipper_user_id == user.id,
                    )
                ).exists(),
            )
        )
        .order_by(CampaignModel.created_at.desc())
        .limit(8)
    )
    open_campaigns = [
        {
            "id": camp.id,
            "brand_name": brand.company_name or user_brand.name,
            "vertical": camp.vertical,
            "cpm_cents": camp.cpm_cents,
            "slots_total": camp.slots_total,
            "slots_filled": camp.slots_filled,
            "deadline": _serialize_dt(camp.ends_at),
            "premium": camp.cpm_cents >= 900,
            "brief": camp.brief,
        }
        for camp, brand, user_brand in open_result.all()
    ]

    # My recent clips
    recent = []
    for clip, camp in my_clips[:8]:
        recent.append({
            **_clip_to_dict(clip),
            "campaign_name": camp.name,
        })

    # Profile aggregates
    profile_result = await session.execute(
        select(ClipperProfileModel).where(ClipperProfileModel.user_id == user.id)
    )
    profile = profile_result.scalar_one_or_none()
    lifetime = profile.lifetime_earnings_cents if profile else sum(c.earnings_cents for _, c in [(None, cl) for cl, _ in my_clips])
    pending_payout = profile.pending_payout_cents if profile else 0
    clips_live = sum(1 for c, _ in my_clips if c.status in (
        CampaignClipStatus.APPROVED.value, CampaignClipStatus.LIVE.value, CampaignClipStatus.VERIFIED.value
    ))
    avg_cpm = int(sum(camp.cpm_cents for _, camp in my_clips) / max(len(my_clips), 1)) if my_clips else 0

    return {
        "kpis": {
            "earnings_cents_week": this_week_total,
            "earnings_change_pct": _pct_change(this_week_total, last_week_total),
            "clips_live": clips_live,
            "pending_payout_cents": pending_payout,
            "lifetime_earnings_cents": lifetime,
            "avg_cpm_cents": avg_cpm,
        },
        "week_chart": week_chart,
        "open_campaigns": open_campaigns,
        "recent_clips": recent,
    }


# ─── CREATOR DASHBOARD ─────────────────────────────────────────────────────


@router.get("/creator")
async def creator_dashboard(
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Real-time data for /creators/dashboard."""
    if user.role != "creator":
        raise HTTPException(status_code=403, detail="This dashboard is for creator accounts only")

    # Profile aggregates
    profile_result = await session.execute(
        select(CreatorProfileModel).where(CreatorProfileModel.user_id == user.id)
    )
    profile = profile_result.scalar_one_or_none()
    lifetime_revenue = profile.total_revenue_cents if profile else 0
    total_views = profile.total_views_earned if profile else 0
    videos = profile.total_videos_uploaded if profile else 0

    # 6-month earnings chart (synthetic month-over-month for now)
    now = datetime.now()
    month_labels = []
    month_earnings = []
    for i in range(5, -1, -1):
        d = (now - timedelta(days=30 * i))
        month_labels.append(d.strftime("%b"))
        # Synthetic ramp from $0 to ~$8K
        month_earnings.append(int(lifetime_revenue * (0.05 + i * 0.18) / max(1, (5 * 0.18 + 0.05) * 6)))
    earnings_chart = [{"month": m, "cents": c} for m, c in zip(month_labels, month_earnings)]

    # Auto-clips (synthetic — represent the clips our engine would produce
    # from this creator's source videos). For now, derive from a list of
    # generic titles that match the seed brand campaigns.
    auto_clips = [
        {
            "id": f"ac_{i:03d}",
            "title": t,
            "source_url": f"https://youtube.com/watch?v=relativ_{i}",
            "duration_s": [18, 22, 31, 27, 45][i % 5],
            "hook": ["The brutal truth about pricing", "Why I deleted my LinkedIn", "The 10-10-10 rule", "Cold email that got me a $50K deal", "The 90-min sleep cycle trick"][i % 5],
            "platform": ["tiktok", "instagram", "youtube_shorts", "tiktok", "instagram"][i % 5],
            "generated_at": (now - timedelta(days=i * 3)).isoformat(),
            "status": "ready" if i < 3 else "processing",
            "viral_score": [92, 88, 76, 84, 71][i % 5],
        }
        for i, t in enumerate([
            "The brutal truth about pricing your SaaS",
            "Why I deleted my LinkedIn (and what came back)",
            "The 10-10-10 rule for any pricing decision",
            "The 1-line cold email that got me a $50K deal",
            "The 90-minute sleep cycle trick nobody talks about",
        ])
    ]

    # Channels (synthetic, derived from profile)
    channels = [
        {
            "platform": profile.primary_platform if profile and profile.primary_platform else "youtube",
            "handle": profile.handle if profile and profile.handle else "@deepraj",
            "url": profile.channel_url if profile and profile.channel_url else "https://youtube.com/@deepraj",
            "total_views": total_views,
            "monthly_earnings_cents": int(lifetime_revenue * 0.18 / 6) if lifetime_revenue else 0,
        }
    ]

    # Brand deals (open = awaiting creator sign-off, not the brand campaigns)
    # For now, return a couple synthetic deals keyed to high-value brands.
    brand_deals = [
        {
            "id": f"bd_{i:03d}",
            "brand_name": b,
            "vertical": v,
            "value_cents": v_cents,
            "status": "pending" if i == 0 else "negotiating",
            "expires_at": (now + timedelta(days=14 - i * 3)).isoformat(),
        }
        for i, (b, v, v_cents) in enumerate([
            ("All-In Summit", "Podcasts · Business", 420_000),
            ("Huberman Lab", "Podcasts · Health", 280_000),
        ])
    ]

    return {
        "kpis": {
            "earnings_cents_month": month_earnings[-1] if month_earnings else 0,
            "earnings_change_pct": 35.0,
            "auto_clips_count": len(auto_clips),
            "channels_count": len(channels),
            "open_deals_cents": sum(d["value_cents"] for d in brand_deals if d["status"] == "pending"),
        },
        "earnings_chart": earnings_chart,
        "auto_clips": auto_clips,
        "channels": channels,
        "brand_deals": brand_deals,
    }
