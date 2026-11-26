"""Founder-only platform overview endpoints."""
from __future__ import annotations

from datetime import datetime, timedelta
import hashlib
import hmac
import os
import secrets
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..auth_utils import (
    create_access_token,
    create_admin_2fa_token,
    get_admin_2fa_cookie,
    hash_ip,
    set_admin_2fa_cookie,
    set_session_cookie,
    verify_admin_2fa_token,
    verify_password,
)
from ..database.models import (
    AdminPasskeyModel,
    AdminTwoFactorChallengeModel,
    AuditLogModel,
    CampaignClipModel,
    CampaignModel,
    ClipModel,
    SessionModel,
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


# ─────────────────────────────────────────────────────────────────────────────
# Admin Passkeys (WebAuthn / Touch ID) — Passwordless & Email-free Login
# ─────────────────────────────────────────────────────────────────────────────

def _allowed_rp_ids(request: Request) -> list[str]:
    host = (request.headers.get("x-forwarded-host") or request.headers.get("host") or "").split(":", 1)[0].strip().lower()
    base = ["relativclips.com", "www.relativclips.com", "localhost", "127.0.0.1"]
    if host and host not in base:
        base.insert(0, host)
    return base


class PasskeyRegisterOptionsRequest(BaseModel):
    email: Optional[str] = None
    password: Optional[str] = None
    label: Optional[str] = None


class PasskeyRegisterVerifyRequest(BaseModel):
    challenge_id: str
    credential_id: str
    public_key_spki: str
    client_data_json: str
    authenticator_data: str
    label: Optional[str] = None


class PasskeyLoginVerifyRequest(BaseModel):
    challenge_id: str
    credential_id: str
    client_data_json: str
    authenticator_data: str
    signature: str


@router.get("/passkey/status")
async def admin_passkey_status(session: AsyncSession = Depends(get_session)) -> dict:
    """Return whether at least one admin passkey is registered."""
    count = await _count(session, AdminPasskeyModel)
    return {"configured": count > 0, "count": count}


@router.post("/passkey/register/options")
async def admin_passkey_register_options(
    request: Request,
    body: Optional[PasskeyRegisterOptionsRequest] = None,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Issue a WebAuthn creation challenge to bind a Mac Touch ID / hardware passkey."""
    from ..utils.webauthn import b64url_encode

    existing_count = await _count(session, AdminPasskeyModel)
    user: Optional[UserModel] = None

    # Allow already-authenticated admin (with valid 2FA/passkey cookie) OR first-time setup via credentials
    try:
        current = await get_current_user(request, session=session)
        _require_admin_identity(current)
        if existing_count == 0 or verify_admin_2fa_token(get_admin_2fa_cookie(request), user_id=current.id, email=current.email):
            user = current
    except HTTPException:
        user = None

    if user is None:
        if existing_count > 0:
            raise HTTPException(status_code=403, detail="Sign in with your existing passkey to register another one.")
        if not body or not body.email or not body.password:
            raise HTTPException(status_code=401, detail="Enter your @relativclips.com credentials once to bind your passkey.")
        candidate = (
            await session.execute(select(UserModel).where(UserModel.email == body.email.strip().lower()))
        ).scalar_one_or_none()
        if not candidate or not await verify_password(body.password, candidate.hashed_password):
            raise HTTPException(status_code=401, detail="Invalid email or password.")
        _require_admin_identity(candidate)
        user = candidate

    challenge_bytes = secrets.token_bytes(32)
    challenge_b64 = b64url_encode(challenge_bytes)
    challenge_id = secrets.token_urlsafe(24)
    now = datetime.utcnow()

    session.add(
        AdminTwoFactorChallengeModel(
            id=challenge_id,
            user_id=user.id,
            email=user.email.lower(),
            code_hash=hashlib.sha256(challenge_b64.encode("utf-8")).hexdigest(),
            attempts=0,
            expires_at=now + timedelta(minutes=10),
            created_at=now,
        )
    )
    await session.commit()

    rp_ids = _allowed_rp_ids(request)
    rp_id = "relativclips.com" if any("relativclips.com" in h for h in rp_ids) else rp_ids[0]
    return {
        "challenge_id": challenge_id,
        "challenge": challenge_b64,
        "rp": {"id": rp_id, "name": "RelatiV Control Room"},
        "user": {
            "id": b64url_encode(user.id.encode("utf-8")),
            "name": user.email,
            "displayName": user.name or user.email,
        },
        "pubKeyCredParams": [{"type": "public-key", "alg": -7}],
        "authenticatorSelection": {
            "authenticatorAttachment": "platform",
            "userVerification": "required",
            "residentKey": "preferred",
        },
        "timeout": 60000,
    }


@router.post("/passkey/register/verify")
async def admin_passkey_register_verify(
    body: PasskeyRegisterVerifyRequest,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Verify and store a newly created WebAuthn passkey, then sign the admin in."""
    from ..utils.webauthn import b64url_decode, b64url_encode, parse_authenticator_data, parse_spki_p256_point, verify_client_data

    now = datetime.utcnow()
    challenge = (
        await session.execute(
            select(AdminTwoFactorChallengeModel).where(AdminTwoFactorChallengeModel.id == body.challenge_id)
        )
    ).scalar_one_or_none()
    if not challenge or challenge.consumed_at is not None or challenge.expires_at < now:
        raise HTTPException(status_code=400, detail="Passkey setup challenge expired. Try again.")

    user = (await session.execute(select(UserModel).where(UserModel.id == challenge.user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Admin user not found.")
    _require_admin_identity(user)

    # Reconstruct expected challenge check via clientDataJSON
    try:
        client_raw = b64url_decode(body.client_data_json)
        import json as _json
        client_obj = _json.loads(client_raw.decode("utf-8"))
        challenge_str = str(client_obj.get("challenge") or "")
        if not hmac.compare_digest(
            hashlib.sha256(challenge_str.encode("utf-8")).hexdigest(),
            challenge.code_hash,
        ):
            raise ValueError("Challenge mismatch")
        _, rp_id = verify_client_data(
            body.client_data_json,
            expected_type="webauthn.create",
            expected_challenge=challenge_str,
            allowed_rp_ids=_allowed_rp_ids(request),
        )
        _, sign_count = parse_authenticator_data(body.authenticator_data, rp_id)
        spki_bytes = b64url_decode(body.public_key_spki)
        parse_spki_p256_point(spki_bytes)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid passkey registration: {exc}") from exc

    challenge.consumed_at = now
    session.add(
        AdminPasskeyModel(
            id=secrets.token_urlsafe(16),
            user_id=user.id,
            email=user.email.lower(),
            credential_id=body.credential_id,
            public_key_spki=b64url_encode(spki_bytes),
            sign_count=sign_count,
            label=(body.label or "Mac Touch ID")[:120],
            created_at=now,
            last_used_at=now,
        )
    )

    # Issue both session cookie and admin 2FA cookie so the user enters immediately
    session_ttl_days = 1
    token, jti, expires = create_access_token(
        user_id=user.id, role=user.role, email=user.email, ttl_days=session_ttl_days
    )
    session.add(
        SessionModel(
            id=secrets.token_urlsafe(32),
            user_id=user.id,
            jwt_jti=jti,
            user_agent=request.headers.get("user-agent", "")[:500],
            ip_hash=hash_ip(request.client.host if request.client else "unknown"),
            created_at=now,
            expires_at=expires,
        )
    )
    user.last_login_at = now
    await session.commit()

    set_session_cookie(response, token, ttl_days=session_ttl_days)
    set_admin_2fa_cookie(response, create_admin_2fa_token(user_id=user.id, email=user.email))
    await record_audit_event(
        session,
        action="admin.passkey_registered",
        actor_user_id=user.id,
        actor_email=user.email,
        resource_type="admin_passkey",
        status="success",
        ip_address=request.client.host if request.client else None,
    )
    return {"ok": True}


@router.post("/passkey/login/options")
async def admin_passkey_login_options(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Issue a passwordless WebAuthn assertion challenge for registered admin passkeys."""
    from ..utils.webauthn import b64url_encode

    creds = (await session.execute(select(AdminPasskeyModel))).scalars().all()
    if not creds:
        raise HTTPException(status_code=404, detail="No admin passkey registered yet.")

    challenge_b64 = b64url_encode(secrets.token_bytes(32))
    challenge_id = secrets.token_urlsafe(24)
    now = datetime.utcnow()
    session.add(
        AdminTwoFactorChallengeModel(
            id=challenge_id,
            user_id="passkey_login",
            email="passkey@relativclips.com",
            code_hash=hashlib.sha256(challenge_b64.encode("utf-8")).hexdigest(),
            attempts=0,
            expires_at=now + timedelta(minutes=5),
            created_at=now,
        )
    )
    await session.commit()

    rp_ids = _allowed_rp_ids(request)
    rp_id = "relativclips.com" if any("relativclips.com" in h for h in rp_ids) else rp_ids[0]
    return {
        "challenge_id": challenge_id,
        "challenge": challenge_b64,
        "rpId": rp_id,
        "allowCredentials": [{"type": "public-key", "id": c.credential_id} for c in creds],
        "userVerification": "required",
        "timeout": 60000,
    }


@router.post("/passkey/login/verify")
async def admin_passkey_login_verify(
    body: PasskeyLoginVerifyRequest,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Verify WebAuthn passkey signature and sign the admin straight into the Control Room."""
    from ..utils.webauthn import b64url_decode, parse_authenticator_data, verify_client_data, verify_p256_der_signature

    now = datetime.utcnow()
    challenge = (
        await session.execute(
            select(AdminTwoFactorChallengeModel).where(AdminTwoFactorChallengeModel.id == body.challenge_id)
        )
    ).scalar_one_or_none()
    if not challenge or challenge.consumed_at is not None or challenge.expires_at < now:
        raise HTTPException(status_code=400, detail="Passkey challenge expired. Try again.")

    passkey = (
        await session.execute(
            select(AdminPasskeyModel).where(AdminPasskeyModel.credential_id == body.credential_id)
        )
    ).scalar_one_or_none()
    if not passkey:
        raise HTTPException(status_code=401, detail="Unrecognized passkey.")

    try:
        import json as _json
        client_raw = b64url_decode(body.client_data_json)
        client_obj = _json.loads(client_raw.decode("utf-8"))
        challenge_str = str(client_obj.get("challenge") or "")
        if not hmac.compare_digest(
            hashlib.sha256(challenge_str.encode("utf-8")).hexdigest(),
            challenge.code_hash,
        ):
            raise ValueError("Challenge mismatch")
        client_bytes, rp_id = verify_client_data(
            body.client_data_json,
            expected_type="webauthn.get",
            expected_challenge=challenge_str,
            allowed_rp_ids=_allowed_rp_ids(request),
        )
        auth_bytes, sign_count = parse_authenticator_data(body.authenticator_data, rp_id)
        signed_payload = auth_bytes + hashlib.sha256(client_bytes).digest()
        sig_ok = verify_p256_der_signature(
            b64url_decode(passkey.public_key_spki),
            signed_payload,
            b64url_decode(body.signature),
        )
        if not sig_ok:
            raise ValueError("Invalid ECDSA signature")
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Passkey verification failed: {exc}") from exc

    user = (await session.execute(select(UserModel).where(UserModel.id == passkey.user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="Admin account not found.")
    _require_admin_identity(user)

    challenge.consumed_at = now
    passkey.sign_count = max(passkey.sign_count, sign_count)
    passkey.last_used_at = now

    session_ttl_days = 1
    token, jti, expires = create_access_token(
        user_id=user.id, role=user.role, email=user.email, ttl_days=session_ttl_days
    )
    session.add(
        SessionModel(
            id=secrets.token_urlsafe(32),
            user_id=user.id,
            jwt_jti=jti,
            user_agent=request.headers.get("user-agent", "")[:500],
            ip_hash=hash_ip(request.client.host if request.client else "unknown"),
            created_at=now,
            expires_at=expires,
        )
    )
    user.last_login_at = now
    await session.commit()

    set_session_cookie(response, token, ttl_days=session_ttl_days)
    set_admin_2fa_cookie(response, create_admin_2fa_token(user_id=user.id, email=user.email))
    await record_audit_event(
        session,
        action="admin.passkey_login",
        actor_user_id=user.id,
        actor_email=user.email,
        resource_type="admin_passkey",
        resource_id=passkey.id,
        status="success",
        ip_address=request.client.host if request.client else None,
    )
    return {"ok": True, "email": user.email}
