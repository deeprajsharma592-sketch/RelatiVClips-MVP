"""
Auth router — signup, login, logout, /me.

Endpoints
---------
  POST /api/v1/auth/signup  → create a user + role-specific profile, set cookie
  POST /api/v1/auth/login   → verify password, set cookie
  POST /api/v1/auth/logout  → revoke session, clear cookie
  GET  /api/v1/auth/me      → return the current user (200) or 401

User model
----------
  - creator: content owner (YouTuber, podcaster) — uploads source videos
  - brand:   D2C company / agency / campaign sponsor — runs campaigns
  - clipper: paying Pro/Elite subscriber — creates clips for brands

Clippers-as-applicants (free, not yet vetted) are NOT handled here. They
use the public /api/v1/clippers/apply form which the founder owns.
"""

from __future__ import annotations

import os
import secrets
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth_utils import (
    clear_session_cookie,
    create_access_token,
    decode_access_token,
    get_session_cookie,
    hash_ip,
    hash_password,
    set_session_cookie,
    verify_password,
)
from ..database.models import (
    BrandProfileModel,
    ClipperProfileModel,
    CreatorProfileModel,
    CreditTransactionModel,
    SessionModel,
    UserModel,
    UserRole,
)
from ..database.session import get_session
from ..services.anonymized_logger import hash_ip as _hash_ip_from_logger  # noqa: F401  (kept for consistency)
from ..services.supabase_auth import get_verified_supabase_user, is_supabase_auth_configured
from ..utils.admin_access import is_admin_email

import logging as _logging
log = _logging.getLogger("relativ.auth")
log.setLevel(_logging.INFO)
router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


# ─── Pydantic request/response shapes ──────────────────────────────────────


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    name: str = Field(..., min_length=1, max_length=200)
    role: str = Field(..., description="creator | brand | clipper")

    # Role-specific onboarding fields (optional at signup, can be filled later)
    company_name: Optional[str] = None  # brand
    handle: Optional[str] = None  # creator / clipper
    specialty: Optional[str] = None  # clipper
    primary_platform: Optional[str] = None  # creator
    channel_url: Optional[str] = None  # creator
    industry: Optional[str] = None  # brand
    website: Optional[str] = None  # brand

    # Free-text consent for ToS / privacy (required for GDPR reasons)
    accept_tos: bool = Field(..., description="Must be true")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    can_access_creator_workspace: bool = False
    is_verified: bool
    credit_balance: int
    plan_tier: str = "free"
    is_admin: bool = False
    created_at: str
    last_login_at: Optional[str] = None
    # Profile fields, role-dependent
    profile: dict = Field(default_factory=dict)


class AuthResponse(BaseModel):
    user: UserResponse


# ─── Helpers ───────────────────────────────────────────────────────────────


def _user_to_response(user: UserModel, profile_row) -> UserResponse:
    """Compose the public-facing user shape + role-specific profile blob."""
    profile = {}
    if profile_row is not None:
        for col in profile_row.__table__.columns:
            if col.name == "user_id":
                continue
            val = getattr(profile_row, col.name)
            if isinstance(val, datetime):
                val = val.isoformat()
            profile[col.name] = val
    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        can_access_creator_workspace=(
            user.role == UserRole.CREATOR.value or is_admin_email(user.email)
        ),
        is_verified=user.is_verified,
        credit_balance=user.credit_balance,
        plan_tier=user.plan_tier,
        is_admin=user.is_admin or is_admin_email(user.email),
        created_at=user.created_at.isoformat() if user.created_at else "",
        last_login_at=user.last_login_at.isoformat() if user.last_login_at else None,
        profile=profile,
    )


async def _get_profile_for_role(session: AsyncSession, user_id: str, role: str):
    if role == UserRole.CREATOR.value:
        return (await session.execute(
            select(CreatorProfileModel).where(CreatorProfileModel.user_id == user_id)
        )).scalar_one_or_none()
    if role == UserRole.BRAND.value:
        return (await session.execute(
            select(BrandProfileModel).where(BrandProfileModel.user_id == user_id)
        )).scalar_one_or_none()
    if role == UserRole.CLIPPER.value:
        return (await session.execute(
            select(ClipperProfileModel).where(ClipperProfileModel.user_id == user_id)
        )).scalar_one_or_none()
    return None


async def get_current_user(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> UserModel:
    """FastAPI dependency: extract the user from the session cookie. Returns
    the UserModel or raises 401. Used by protected endpoints."""
    authorization = request.headers.get("authorization", "")
    scheme, _, bearer_token = authorization.partition(" ")
    if scheme.lower() == "bearer" and bearer_token.strip():
        identity = await get_verified_supabase_user(bearer_token.strip())
        auth_user_id = str(identity["id"])
        email = str(identity["email"]).strip().lower()
        confirmed_at = identity.get("email_confirmed_at") or identity.get("confirmed_at")

        user = (await session.execute(
            select(UserModel).where(UserModel.auth_user_id == auth_user_id)
        )).scalar_one_or_none()
        if user is None:
            # Link existing legacy rows by verified email, preserving all their
            # marketplace foreign keys and profile data.
            user = (await session.execute(
                select(UserModel).where(func.lower(UserModel.email) == email)
            )).scalar_one_or_none()

        if user is None:
            user = UserModel(
                id=auth_user_id,
                auth_user_id=auth_user_id,
                email=email,
                hashed_password=None,
                role=UserRole.CREATOR.value,
                name=str((identity.get("user_metadata") or {}).get("name") or email.split("@")[0]),
                is_active=True,
                is_verified=bool(confirmed_at),
                created_at=datetime.utcnow(),
                email_verified_at=datetime.utcnow() if confirmed_at else None,
            )
            session.add(user)
            await session.flush()
            session.add(CreatorProfileModel(user_id=user.id))
            session.add(CreditTransactionModel(
                user_id=user.id,
                amount=2,
                balance_after=2,
                kind="starter_grant",
                reference_id=f"user:{user.id}:starter",
                details={"reason": "onboarding"},
            ))
        else:
            if user.auth_user_id and user.auth_user_id != auth_user_id:
                raise HTTPException(status_code=409, detail="This account is linked to a different sign-in identity")
            user.auth_user_id = auth_user_id
            user.email = email
            user.hashed_password = None
            if confirmed_at:
                user.is_verified = True
                if not user.email_verified_at:
                    user.email_verified_at = datetime.utcnow()
            if not user.name:
                user.name = str((identity.get("user_metadata") or {}).get("name") or email.split("@")[0])

        if not user.is_active:
            raise HTTPException(status_code=403, detail="This account is disabled")
        if not confirmed_at:
            await session.commit()
            raise HTTPException(status_code=403, detail="Verify your email before using RelatiV")
        user.last_login_at = datetime.utcnow()
        await session.commit()
        return user

    if is_supabase_auth_configured():
        # A stale legacy cookie must not keep authorizing protected actions
        # after this deployment has switched its identity provider.
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = get_session_cookie(request)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        claims = decode_access_token(token)
    except HTTPException:
        raise
    user_id = claims.get("sub")
    jti = claims.get("jti")
    if not user_id or not jti:
        raise HTTPException(status_code=401, detail="Invalid token claims")

    sess = (await session.execute(
        select(SessionModel).where(SessionModel.jwt_jti == jti)
    )).scalar_one_or_none()
    if not sess or sess.revoked_at is not None:
        raise HTTPException(status_code=401, detail="Session revoked")
    user = (await session.execute(
        select(UserModel).where(UserModel.id == user_id)
    )).scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User inactive")
    return user


async def get_optional_user(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> UserModel | None:
    """Optional version of get_current_user — returns None if no valid session
    cookie. Use on endpoints that work for both signed-in and anonymous users
    (e.g. the public campaign marketplace, public transcripts)."""
    try:
        return await get_current_user(request, session)
    except HTTPException:
        return None


# ─── Endpoints ─────────────────────────────────────────────────────────────


@router.post("/signup", response_model=AuthResponse, status_code=201)
async def signup(
    body: SignupRequest,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
):
    """Create a new user with role-specific profile, issue a session cookie."""
    if is_supabase_auth_configured():
        raise HTTPException(status_code=410, detail="Sign up is managed by Supabase Auth")
    if body.role not in (r.value for r in UserRole):
        raise HTTPException(status_code=400, detail=f"role must be one of: creator, brand, clipper")
    if not body.accept_tos:
        raise HTTPException(status_code=400, detail="You must accept the Terms of Service")
    if is_admin_email(body.email) and len(body.password) < 12:
        raise HTTPException(status_code=400, detail="Founder accounts require a password of at least 12 characters")

    # Reject duplicate email
    existing = (await session.execute(
        select(UserModel).where(UserModel.email == body.email.lower())
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    # Founder identities always get the creator workspace as well as the
    # separate server-authorized admin workspace.
    effective_role = UserRole.CREATOR.value if is_admin_email(body.email) else body.role

    # Create user
    user = UserModel(
        id=str(uuid.uuid4()),
        email=body.email.lower(),
        hashed_password=hash_password(body.password),
        role=effective_role,
        name=body.name,
        is_verified=False,
        created_at=datetime.utcnow(),
    )
    session.add(user)
    session.add(CreditTransactionModel(
        user_id=user.id,
        amount=2,
        balance_after=2,
        kind="starter_grant",
        reference_id=f"user:{user.id}:starter",
        details={"reason": "onboarding"},
    ))
    await session.flush()  # populate user.id

    # Create role-specific profile
    if effective_role == UserRole.CREATOR.value:
        session.add(CreatorProfileModel(
            user_id=user.id,
            handle=body.handle or None,
            primary_platform=body.primary_platform or None,
            channel_url=body.channel_url or None,
        ))
    elif effective_role == UserRole.BRAND.value:
        session.add(BrandProfileModel(
            user_id=user.id,
            company_name=body.company_name or None,
            website=body.website or None,
            industry=body.industry or None,
        ))
    elif effective_role == UserRole.CLIPPER.value:
        session.add(ClipperProfileModel(
            user_id=user.id,
            handle=body.handle or None,
            specialty=body.specialty or None,
        ))

    # Issue token + persist session
    user_agent = request.headers.get("user-agent", "")[:500]
    ip_h = hash_ip(request.client.host if request.client else "unknown")
    session_ttl_days = 1 if is_admin_email(user.email) else None
    token, jti, expires = create_access_token(
        user_id=user.id, role=user.role, email=user.email, ttl_days=session_ttl_days
    )
    session.add(SessionModel(
        id=secrets.token_urlsafe(32),
        user_id=user.id,
        jwt_jti=jti,
        user_agent=user_agent,
        ip_hash=ip_h,
        created_at=datetime.utcnow(),
        expires_at=expires,
    ))

    user.last_login_at = datetime.utcnow()

    # Auto-generate a 24h email-verification token for new signups.
    # We don't await the email send here — best-effort, fire-and-forget.
    from ..routers.email_auth_router import _render_verify_email
    from ..services.email_service import send as send_email
    user.email_verification_token = secrets.token_urlsafe(32)
    user.email_verified_at = None

    await session.commit()

    set_session_cookie(response, token, ttl_days=session_ttl_days)
    log.info("user.signup", extra={"role": effective_role, "user_id": user.id})

    # Send the welcome + verification email in the background. Failure to
    # send doesn't fail signup (the user can resend from /account).
    try:
        verify_url = f"{os.getenv('FRONTEND_URL', 'https://relativclips.com')}/verify-email?token={user.email_verification_token}"
        await send_email(_render_verify_email(user.email, user.name, verify_url))
    except Exception as e:
        log.warning(f"welcome_email.failed user_id={user.id} err={e}")

    profile = await _get_profile_for_role(session, user.id, effective_role)
    return AuthResponse(user=_user_to_response(user, profile))


@router.post("/login", response_model=AuthResponse)
async def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
):
    """Verify password, issue a new session cookie."""
    if is_supabase_auth_configured():
        raise HTTPException(status_code=410, detail="Sign in is managed by Supabase Auth")
    user = (await session.execute(
        select(UserModel).where(UserModel.email == body.email.lower())
    )).scalar_one_or_none()
    if not user or not user.is_active or not verify_password(body.password, user.hashed_password):
        # Generic error — don't leak whether email exists
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user_agent = request.headers.get("user-agent", "")[:500]
    ip_h = hash_ip(request.client.host if request.client else "unknown")
    session_ttl_days = 1 if is_admin_email(user.email) else None
    token, jti, expires = create_access_token(
        user_id=user.id, role=user.role, email=user.email, ttl_days=session_ttl_days
    )
    session.add(SessionModel(
        id=secrets.token_urlsafe(32),
        user_id=user.id,
        jwt_jti=jti,
        user_agent=user_agent,
        ip_hash=ip_h,
        created_at=datetime.utcnow(),
        expires_at=expires,
    ))
    user.last_login_at = datetime.utcnow()
    await session.commit()

    set_session_cookie(response, token, ttl_days=session_ttl_days)
    log.info("user.login", extra={"user_id": user.id, "role": user.role})

    profile = await _get_profile_for_role(session, user.id, user.role)
    return AuthResponse(user=_user_to_response(user, profile))


@router.post("/logout", status_code=204)
async def logout(
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
):
    """Revoke the current session and clear the cookie."""
    token = get_session_cookie(request)
    if not token:
        clear_session_cookie(response)
        return Response(status_code=204)
    if token:
        try:
            claims = decode_access_token(token)
            jti = claims.get("jti")
            if jti:
                sess = (await session.execute(
                    select(SessionModel).where(SessionModel.jwt_jti == jti)
                )).scalar_one_or_none()
                if sess and not sess.revoked_at:
                    sess.revoked_at = datetime.utcnow()
                    await session.commit()
                    log.info("user.logout", extra={"user_id": sess.user_id})
        except HTTPException:
            pass  # already invalid — cookie cleanup is the only goal
    clear_session_cookie(response)
    return Response(status_code=204)


@router.get("/me", response_model=AuthResponse)
async def me(
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    """Return the current user. 401 if no/invalid session."""
    authorization = request.headers.get("authorization", "")
    if not get_session_cookie(request) and not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = await get_current_user(request, session)
    profile = await _get_profile_for_role(session, user.id, user.role)
    return AuthResponse(user=_user_to_response(user, profile))


# Re-export dependency for other routers
__all__ = ["router", "get_current_user", "UserModel"]
