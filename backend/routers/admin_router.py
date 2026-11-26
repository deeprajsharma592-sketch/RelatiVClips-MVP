"""Founder-only platform overview endpoints."""
from __future__ import annotations

from datetime import datetime, timedelta
import hashlib
import hmac
import os
import secrets

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..auth_utils import (
    create_admin_2fa_token,
    get_admin_2fa_cookie,
    set_admin_2fa_cookie,
    verify_admin_2fa_token,
)
from ..database.models import (
    AdminTwoFactorChallengeModel,
    AuditLogModel,
    CampaignClipModel,
    CampaignModel,
    ClipModel,
    TaskModel,
    UserModel,
)
from ..database.session import get_session
from ..routers.auth_router import get_current_user
from ..services.email_service import OutgoingEmail, send_via_smtp, send_with_status
from ..utils.admin_access import is_admin_email, is_allowed_admin_domain
from ..utils.audit import record_audit_event
from ..utils.task_store import task_store
from ..store import intake

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


def _require_admin_identity(user: UserModel) -> None:
    if not is_allowed_admin_domain(user.email):
        raise HTTPException(status_code=403, detail="Admin access is restricted to relativclips.com accounts")
    if not user.is_admin and not is_admin_email(user.email):
        raise HTTPException(status_code=403, detail="Admin access is not enabled for this account")
    if not user.is_verified or not user.email_verified_at:
        raise HTTPException(status_code=403, detail="Verify this email before using the admin workspace")


async def require_admin(
    request: Request,
    user: UserModel = Depends(get_current_user),
) -> UserModel:
    """Require a live session, @relativclips.com identity, verified email, and 2FA."""
    _require_admin_identity(user)
    token = get_admin_2fa_cookie(request)
    if not verify_admin_2fa_token(token, user_id=user.id, email=user.email):
        raise HTTPException(status_code=403, detail="Admin 2FA verification required")
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


def _hash_2fa_code(challenge_id: str, code: str) -> str:
    return hashlib.sha256(f"{challenge_id}:{code.strip()}".encode("utf-8")).hexdigest()


@router.post("/2fa/challenge")
async def request_admin_2fa_challenge(
    request: Request,
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Send a 6-digit 2FA token to the admin's @relativclips.com email."""
    ip = request.client.host if request.client else None
    try:
        _require_admin_identity(user)
    except HTTPException as exc:
        await record_audit_event(
            session,
            action="admin.2fa_denied",
            actor_user_id=user.id,
            actor_email=user.email,
            resource_type="admin_2fa",
            status="failure",
            ip_address=ip,
            details={"reason": exc.detail},
        )
        raise

    challenge_id = secrets.token_urlsafe(24)
    code = f"{secrets.randbelow(1_000_000):06d}"
    now = datetime.utcnow()
    expires_at = now + timedelta(minutes=10)

    session.add(
        AdminTwoFactorChallengeModel(
            id=challenge_id,
            user_id=user.id,
            email=user.email.lower(),
            code_hash=_hash_2fa_code(challenge_id, code),
            attempts=0,
            expires_at=expires_at,
            created_at=now,
        )
    )
    await session.commit()

    email_msg = OutgoingEmail(
        to=user.email,
        subject="RelatiV Control Room — Your 2FA Code",
        html=(
            "<div style='font-family:sans-serif;padding:24px;background:#111318;color:#fff;border-radius:12px;'>"
            "<h2 style='color:#FFCC00;margin-top:0;'>Admin Verification Code</h2>"
            "<p>Enter this 6-digit code to finish signing in to the RelatiV Control Room:</p>"
            f"<div style='font-size:32px;font-weight:800;letter-spacing:6px;color:#FFCC00;margin:16px 0;'>{code}</div>"
            "<p style='color:#9AA2B1;font-size:12px;'>Expires in 10 minutes. If you did not request this, secure your account.</p>"
            "</div>"
        ),
        text=f"Your RelatiV Control Room 2FA code is: {code} (expires in 10 minutes).",
    )
    sent, backend_name, detail = await send_with_status(email_msg)

    await record_audit_event(
        session,
        action="admin.2fa_requested",
        actor_user_id=user.id,
        actor_email=user.email,
        resource_type="admin_2fa",
        resource_id=challenge_id,
        status="success" if sent else "failure",
        ip_address=ip,
        details={"backend": backend_name, "detail": detail},
    )
    if not sent:
        raise HTTPException(
            status_code=502,
            detail=f"Could not deliver 2FA verification email ({backend_name}): {detail}",
        )

    return {"ok": True, "challenge_id": challenge_id, "expires_in_seconds": 600}


class AdminTwoFactorVerifyRequest(BaseModel):
    challenge_id: str = Field(..., min_length=8, max_length=128)
    code: str = Field(..., min_length=6, max_length=12)


@router.post("/2fa/verify")
async def verify_admin_2fa_challenge(
    body: AdminTwoFactorVerifyRequest,
    request: Request,
    response: Response,
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Verify the emailed 6-digit 2FA token and issue the HttpOnly admin 2FA cookie."""
    _require_admin_identity(user)

    challenge = (
        await session.execute(
            select(AdminTwoFactorChallengeModel).where(
                AdminTwoFactorChallengeModel.id == body.challenge_id,
                AdminTwoFactorChallengeModel.user_id == user.id,
            )
        )
    ).scalar_one_or_none()

    ip = request.client.host if request.client else None
    now = datetime.utcnow()
    if not challenge or challenge.consumed_at is not None or challenge.expires_at < now:
        await record_audit_event(
            session,
            action="admin.2fa_failed",
            actor_user_id=user.id,
            actor_email=user.email,
            resource_type="admin_2fa",
            resource_id=body.challenge_id,
            status="failure",
            ip_address=ip,
            details={"reason": "expired_or_missing"},
        )
        raise HTTPException(status_code=401, detail="Verification code expired or invalid")

    if challenge.attempts >= 5:
        raise HTTPException(status_code=429, detail="Too many failed verification attempts. Request a new code.")

    expected = challenge.code_hash
    actual = _hash_2fa_code(challenge.id, body.code)
    if not hmac.compare_digest(expected, actual):
        challenge.attempts += 1
        await session.commit()
        await record_audit_event(
            session,
            action="admin.2fa_failed",
            actor_user_id=user.id,
            actor_email=user.email,
            resource_type="admin_2fa",
            resource_id=challenge.id,
            status="failure",
            ip_address=ip,
            details={"attempts": challenge.attempts},
        )
        raise HTTPException(status_code=401, detail="Invalid verification code")

    challenge.consumed_at = now
    await session.commit()

    token = create_admin_2fa_token(user_id=user.id, email=user.email)
    set_admin_2fa_cookie(response, token)
    await record_audit_event(
        session,
        action="admin.2fa_verified",
        actor_user_id=user.id,
        actor_email=user.email,
        resource_type="admin_2fa",
        resource_id=challenge.id,
        status="success",
        ip_address=ip,
    )
    return {"ok": True}
