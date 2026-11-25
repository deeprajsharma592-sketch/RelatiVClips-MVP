"""Founder-only platform overview endpoints."""
from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database.models import (
    AuditLogModel,
    CampaignClipModel,
    CampaignModel,
    ClipModel,
    TaskModel,
    UserModel,
)
from ..database.session import get_session
from ..routers.auth_router import get_current_user
from ..services.email_service import OutgoingEmail, send_via_smtp
from ..utils.audit import record_audit_event
from ..utils.task_store import task_store
from ..utils.admin_access import ADMIN_EMAILS
from ..store import intake

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])

async def require_admin(
    user: UserModel = Depends(get_current_user),
) -> UserModel:
    """Require a live session, an allowlisted identity, and verified email."""
    if not user.is_admin and user.email.lower() not in ADMIN_EMAILS:
        raise HTTPException(status_code=403, detail="Admin access is not enabled for this account")
    if not user.is_verified or not user.email_verified_at:
        raise HTTPException(status_code=403, detail="Verify this email before using the admin workspace")
    return user


async def _count(session: AsyncSession, model, *conditions) -> int:
    query = select(func.count()).select_from(model)
    if conditions:
        query = query.where(*conditions)
    return int((await session.execute(query)).scalar_one() or 0)


@router.get("/overview")
async def admin_overview(
    _admin: UserModel = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Return durable platform aggregates and a small recent activity feed."""
    now = datetime.utcnow()
    day_ago = now - timedelta(hours=24)
    week_ago = now - timedelta(days=7)

    user_total = await _count(session, UserModel)
    user_active = await _count(session, UserModel, UserModel.is_active.is_(True))
    user_new_week = await _count(session, UserModel, UserModel.created_at >= week_ago)
    generated_total = await _count(session, ClipModel)
    generated_day = await _count(session, ClipModel, ClipModel.created_at >= day_ago)
    generated_week = await _count(session, ClipModel, ClipModel.created_at >= week_ago)
    tasks_total = await _count(session, TaskModel)
    task_failed = await _count(session, TaskModel, TaskModel.status == "failed")
    task_complete = await _count(session, TaskModel, TaskModel.status == "complete")
    campaigns_live = await _count(session, CampaignModel, CampaignModel.status == "live")
    marketplace_clips = await _count(session, CampaignClipModel)

    daily_result = await session.execute(
        select(func.date(ClipModel.created_at), func.count(ClipModel.id))
        .where(ClipModel.created_at >= week_ago)
        .group_by(func.date(ClipModel.created_at))
        .order_by(func.date(ClipModel.created_at))
    )
    daily_generated = [
        {"date": str(day), "count": int(count)} for day, count in daily_result.all()
    ]

    total_views = int((await session.execute(
        select(func.coalesce(func.sum(CampaignClipModel.views), 0))
    )).scalar_one() or 0)
    campaign_spend = int((await session.execute(
        select(func.coalesce(func.sum(CampaignModel.spent_cents), 0))
    )).scalar_one() or 0)

    recent_result = await session.execute(
        select(TaskModel).order_by(TaskModel.created_at.desc()).limit(8)
    )
    recent_tasks = [
        {
            "id": task.task_id,
            "source": "YouTube" if "youtube" in (task.url or "").lower() else "Video job",
            "status": task.status,
            "progress": task.progress,
            "created_at": task.created_at.isoformat() if task.created_at else None,
            "updated_at": task.updated_at.isoformat() if task.updated_at else None,
            "error": (task.error or "")[:180] or None,
        }
        for task in recent_result.scalars().all()
    ]

    return {
        "generated_clips": {
            "all_time": generated_total,
            "last_24h": generated_day,
            "last_7d": generated_week,
        },
        "jobs": {
            "all_time": tasks_total,
            "completed": task_complete,
            "failed": task_failed,
            "success_rate": round(task_complete / max(task_complete + task_failed, 1) * 100, 1),
            "active_now": task_store.get_queue_info()["active"],
            "queued_now": task_store.get_queue_info()["queued"],
        },
        "accounts": {
            "all_time": user_total,
            "active": user_active,
            "new_last_7d": user_new_week,
        },
        "marketplace": {
            "live_campaigns": campaigns_live,
            "submitted_clips": marketplace_clips,
            "tracked_views": total_views,
            "campaign_spend_cents": campaign_spend,
        },
        "recent_jobs": recent_tasks,
        "daily_generated": daily_generated,
        "generated_at": now.isoformat() + "Z",
        "refresh_interval_seconds": 15,
    }


def _iso(value):
    return value.isoformat() if value and hasattr(value, "isoformat") else value


@router.get("/records")
async def admin_records(
    collection: str = Query(...),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    q: str = Query("", max_length=120),
    _admin: UserModel = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Browse paginated platform records. Sensitive auth material is never selected."""
    allowed = {
        "users", "jobs", "clips", "campaigns", "submissions",
        "applications", "brand_contacts", "quotes", "system", "audit_logs",
    }
    if collection not in allowed:
        raise HTTPException(status_code=400, detail="Unknown admin collection")

    offset = (page - 1) * page_size
    needle = q.strip()
    rows: list[dict]
    total: int

    if collection == "users":
        query = select(UserModel).options(
            selectinload(UserModel.creator_profile),
            selectinload(UserModel.brand_profile),
            selectinload(UserModel.clipper_profile),
        )
        count_query = select(func.count()).select_from(UserModel)
        if needle:
            filt = or_(UserModel.email.ilike(f"%{needle}%"), UserModel.name.ilike(f"%{needle}%"), UserModel.role.ilike(f"%{needle}%"))
            query, count_query = query.where(filt), count_query.where(filt)
        total = int((await session.execute(count_query)).scalar_one() or 0)
        items = (await session.execute(query.order_by(UserModel.created_at.desc()).offset(offset).limit(page_size))).scalars().all()
        rows = []
        for u in items:
            profile_row = u.creator_profile or u.brand_profile or u.clipper_profile
            profile = {}
            if profile_row is not None:
                for column in profile_row.__table__.columns:
                    if column.name in {"user_id", "stripe_customer_id", "stripe_subscription_id", "payout_handle"}:
                        continue
                    profile[f"profile_{column.name}"] = _iso(getattr(profile_row, column.name))
            rows.append({"id": u.id, "email": u.email, "name": u.name, "role": u.role, "active": u.is_active, "verified": u.is_verified, "created_at": _iso(u.created_at), "last_login_at": _iso(u.last_login_at), **profile})
    elif collection == "jobs":
        query = select(TaskModel)
        count_query = select(func.count()).select_from(TaskModel)
        if needle:
            filt = or_(TaskModel.task_id.ilike(f"%{needle}%"), TaskModel.url.ilike(f"%{needle}%"), TaskModel.status.ilike(f"%{needle}%"), TaskModel.error.ilike(f"%{needle}%"))
            query, count_query = query.where(filt), count_query.where(filt)
        total = int((await session.execute(count_query)).scalar_one() or 0)
        items = (await session.execute(query.order_by(TaskModel.created_at.desc()).offset(offset).limit(page_size))).scalars().all()
        rows = [{"task_id": t.task_id, "source": t.url, "status": t.status, "progress": t.progress, "step": t.step_name or t.current_step, "created_at": _iso(t.created_at), "updated_at": _iso(t.updated_at), "error": t.error} for t in items]
    elif collection == "clips":
        query = select(ClipModel)
        count_query = select(func.count()).select_from(ClipModel)
        if needle:
            filt = or_(ClipModel.clip_id.ilike(f"%{needle}%"), ClipModel.task_id.ilike(f"%{needle}%"), ClipModel.viral_title.ilike(f"%{needle}%"), ClipModel.caption.ilike(f"%{needle}%"))
            query, count_query = query.where(filt), count_query.where(filt)
        total = int((await session.execute(count_query)).scalar_one() or 0)
        items = (await session.execute(query.order_by(ClipModel.created_at.desc()).offset(offset).limit(page_size))).scalars().all()
        rows = [{"clip_id": c.clip_id, "task_id": c.task_id, "title": c.viral_title, "caption": c.caption, "duration_s": c.duration_s, "file_size_mb": c.file_size_mb, "story_score": c.story_score, "created_at": _iso(c.created_at)} for c in items]
    elif collection == "campaigns":
        query = select(CampaignModel, UserModel.email, UserModel.name).join(UserModel, CampaignModel.brand_user_id == UserModel.id)
        count_query = select(func.count()).select_from(CampaignModel).join(UserModel, CampaignModel.brand_user_id == UserModel.id)
        if needle:
            filt = or_(CampaignModel.name.ilike(f"%{needle}%"), CampaignModel.status.ilike(f"%{needle}%"), CampaignModel.vertical.ilike(f"%{needle}%"), UserModel.email.ilike(f"%{needle}%"), UserModel.name.ilike(f"%{needle}%"))
            query, count_query = query.where(filt), count_query.where(filt)
        total = int((await session.execute(count_query)).scalar_one() or 0)
        items = (await session.execute(query.order_by(CampaignModel.created_at.desc()).offset(offset).limit(page_size))).all()
        rows = [{"id": c.id, "brand_user_id": c.brand_user_id, "brand_email": email, "brand_name": name, "name": c.name, "status": c.status, "budget_cents": c.budget_cents, "spent_cents": c.spent_cents, "slots_total": c.slots_total, "slots_filled": c.slots_filled, "created_at": _iso(c.created_at)} for c, email, name in items]
    elif collection == "submissions":
        query = select(CampaignClipModel, CampaignModel.name, UserModel.email).join(CampaignModel, CampaignClipModel.campaign_id == CampaignModel.id).join(UserModel, CampaignClipModel.clipper_user_id == UserModel.id)
        count_query = select(func.count()).select_from(CampaignClipModel).join(CampaignModel, CampaignClipModel.campaign_id == CampaignModel.id).join(UserModel, CampaignClipModel.clipper_user_id == UserModel.id)
        if needle:
            filt = or_(CampaignClipModel.title.ilike(f"%{needle}%"), CampaignClipModel.status.ilike(f"%{needle}%"), CampaignClipModel.platform.ilike(f"%{needle}%"), CampaignClipModel.clipper_user_id.ilike(f"%{needle}%"), CampaignModel.name.ilike(f"%{needle}%"), UserModel.email.ilike(f"%{needle}%"))
            query, count_query = query.where(filt), count_query.where(filt)
        total = int((await session.execute(count_query)).scalar_one() or 0)
        items = (await session.execute(query.order_by(CampaignClipModel.submitted_at.desc()).offset(offset).limit(page_size))).all()
        rows = [{"id": c.id, "campaign_id": c.campaign_id, "campaign_name": campaign_name, "clipper_user_id": c.clipper_user_id, "clipper_email": email, "title": c.title, "platform": c.platform, "status": c.status, "views": c.views, "earnings_cents": c.earnings_cents, "submitted_at": _iso(c.submitted_at), "verified_at": _iso(c.verified_at), "paid_at": _iso(c.paid_at)} for c, campaign_name, email in items]
    elif collection == "audit_logs":
        query = select(AuditLogModel)
        count_query = select(func.count()).select_from(AuditLogModel)
        if needle:
            filt = or_(
                AuditLogModel.action.ilike(f"%{needle}%"),
                AuditLogModel.actor_email.ilike(f"%{needle}%"),
                AuditLogModel.resource_type.ilike(f"%{needle}%"),
                AuditLogModel.resource_id.ilike(f"%{needle}%"),
                AuditLogModel.status.ilike(f"%{needle}%"),
                AuditLogModel.details.ilike(f"%{needle}%"),
            )
            query, count_query = query.where(filt), count_query.where(filt)
        total = int((await session.execute(count_query)).scalar_one() or 0)
        items = (
            await session.execute(
                query.order_by(AuditLogModel.created_at.desc()).offset(offset).limit(page_size)
            )
        ).scalars().all()
        rows = [
            {
                "id": row.id,
                "created_at": _iso(row.created_at),
                "actor_email": row.actor_email,
                "action": row.action,
                "resource_type": row.resource_type,
                "resource_id": row.resource_id,
                "status": row.status,
                "ip_address": row.ip_address,
                "details": row.details,
            }
            for row in items
        ]
    elif collection == "system":
        from ..llm import cost_control
        from ..llm.chain import chain_status
        try:
            cost = cost_control.cost_status()
        except Exception as exc:
            cost = {"error": str(exc)}
        try:
            llm = chain_status()
        except Exception as exc:
            llm = {"error": str(exc)}
        try:
            from ..utils.vram_manager import get_vram_usage
            vram = get_vram_usage()
        except Exception as exc:
            vram = {"available": False, "error": str(exc)}
        rows = [
            {"subsystem": "LLM routing", "status": llm.get("mode", "unknown"), "details": ", ".join(llm.get("providers_configured", [])) or "No providers configured"},
            {"subsystem": "LLM spend today", "status": f"${cost.get('spent_today_usd', 0):.4f}", "details": f"${cost.get('remaining_today_usd', 0):.4f} of ${cost.get('daily_budget_usd', 0):.2f} remaining · resets with backend process"},
            {"subsystem": "LLM calls", "status": str(cost.get("calls_today", 0)), "details": f"{cost.get('input_tokens_today', 0)} input / {cost.get('output_tokens_today', 0)} output tokens; {cost.get('calls_skipped_smart', 0)} smart skips"},
            {"subsystem": "Circuit breakers", "status": "; ".join(f"{name}: {'open' if item.get('open') else 'closed'}" for name, item in llm.get("circuit_breakers", {}).items()) or "No breakers" , "details": "Provider failure protection"},
            {"subsystem": "GPU / VRAM", "status": str(vram.get("status", "available" if vram.get("available", True) else "unavailable")), "details": str(vram)},
            {"subsystem": "Task worker", "status": "online", "details": f"{task_store.get_queue_info()['active']} active · {task_store.get_queue_info()['queued']} queued · {task_store.get_queue_info()['max_concurrent']} slots"},
        ]
        if needle:
            rows = [row for row in rows if needle.casefold() in str(row).casefold()]
        total = len(rows)
        rows = rows[offset:offset + page_size]
    else:
        source = {
            "applications": intake.list_clipper_applications(10000),
            "brand_contacts": intake.list_brand_contacts(10000),
            "quotes": intake.list_campaign_quotes(10000),
        }[collection]
        if needle:
            source = [row for row in source if needle.casefold() in str(row).casefold()]
        total = len(source)
        rows = source[offset:offset + page_size]

    return {"collection": collection, "records": rows, "total": total, "page": page, "page_size": page_size}


class SmtpTestRequest(BaseModel):
    to: str = Field(default="deepraj@relativclips.com", min_length=3, max_length=320)


@router.post("/smtp-test")
async def admin_smtp_test(
    request: Request,
    body: SmtpTestRequest = SmtpTestRequest(),
    admin: UserModel = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Send an explicit SMTP test email and record the attempt in audit_logs."""
    to_email = body.to.strip() or "deepraj@relativclips.com"
    now_iso = datetime.utcnow().isoformat() + "Z"
    ok, detail = await send_via_smtp(
        OutgoingEmail(
            to=to_email,
            subject="RelatiV SMTP Test",
            html=(
                "<div style='font-family:sans-serif;padding:20px;background:#111318;color:#fff;border-radius:12px;'>"
                "<h2 style='color:#FFCC00;margin-top:0;'>RelatiV SMTP Test</h2>"
                f"<p>This is a live SMTP delivery test triggered by <strong>{admin.email}</strong>.</p>"
                f"<p style='color:#9AA2B1;font-size:12px;'>Timestamp: {now_iso}</p>"
                "</div>"
            ),
            text=f"RelatiV SMTP Test triggered by {admin.email} at {now_iso}.",
        )
    )
    ip = request.client.host if request.client else None
    await record_audit_event(
        session,
        action="admin.smtp_test",
        actor_user_id=admin.id,
        actor_email=admin.email,
        resource_type="email",
        resource_id=to_email,
        status="success" if ok else "failure",
        ip_address=ip,
        details={"detail": detail},
    )
    if not ok:
        raise HTTPException(status_code=502, detail=f"SMTP test failed: {detail}")
    return {"ok": True, "to": to_email, "detail": detail}
