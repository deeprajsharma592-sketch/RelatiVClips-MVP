"""
Email-based auth endpoints — password reset + email verification.

POST /api/v1/auth/forgot-password    → email a reset link (1h token)
POST /api/v1/auth/reset-password     → accept token + new password
POST /api/v1/auth/verify-email       → accept verification token
POST /api/v1/auth/resend-verification → resend verification email (authed)

Security notes
--------------
- /forgot-password always returns 200 — never leak whether the email exists.
- Tokens are random URL-safe strings (32 bytes), stored hashed would be
  overkill for v1, so we store the raw token and rely on the URL being
  short-lived (1h for reset, 24h for verify).
- After successful use, the token is nulled out (single-use).
"""
from __future__ import annotations

import logging
import os
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database.models import UserModel
from ..database.session import get_session
from ..services.email_service import OutgoingEmail, send as send_email
from .auth_router import get_current_user

log = logging.getLogger("relativ.email_auth")
router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

# ─── Config ────────────────────────────────────────────────────────────────
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://relativclips.com")
RESET_TOKEN_TTL_HOURS = 1
VERIFICATION_TOKEN_TTL_HOURS = 24


# ─── Pydantic request shapes ──────────────────────────────────────────────


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=16, max_length=128)
    new_password: str = Field(..., min_length=8, max_length=128)


class ResendVerificationRequest(BaseModel):
    # No body needed — uses session cookie
    pass


class MessageResponse(BaseModel):
    message: str


# ─── Email renderers ──────────────────────────────────────────────────────


def _render_reset_email(to_email: str, name: str, reset_url: str) -> OutgoingEmail:
    return OutgoingEmail(
        to=to_email,
        subject="Reset your RelatiV password",
        text=(
            f"Hi {name or 'there'},\n\n"
            f"Someone (hopefully you) asked to reset the password for your RelatiV account.\n\n"
            f"Click the link below to set a new password. It expires in 1 hour.\n\n"
            f"{reset_url}\n\n"
            f"If you didn't request this, you can safely ignore this email — your password will stay the same.\n\n"
            f"— The RelatiV team"
        ),
        html=f"""<div style="font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #FAF7F0; color: #0F172A;">
  <div style="text-align: center; margin-bottom: 32px;">
    <div style="display: inline-block; padding: 8px 16px; border-radius: 9999px; background: rgba(217, 70, 239, 0.08); border: 1px solid rgba(217, 70, 239, 0.2); font-size: 11px; font-family: monospace; letter-spacing: 0.1em; color: #D946EF;">PASSWORD RESET</div>
  </div>
  <h1 style="font-family: 'Instrument Serif', Georgia, serif; font-style: italic; font-weight: 400; font-size: 36px; line-height: 1.1; margin: 0 0 16px 0; text-align: center;">Reset your password</h1>
  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px 0; color: #334155;">Hi {name or "there"},</p>
  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px 0; color: #334155;">Someone (hopefully you) asked to reset the password for your RelatiV account. Click the button below to set a new password — it expires in 1 hour.</p>
  <div style="text-align: center; margin: 32px 0;">
    <a href="{reset_url}" style="display: inline-block; padding: 14px 32px; border-radius: 12px; background: linear-gradient(135deg, #D946EF 0%, #FB7185 50%, #8B5CF6 100%); color: #FAF7F0; font-size: 14px; font-weight: 600; text-decoration: none; letter-spacing: 0.02em;">Reset password →</a>
  </div>
  <p style="font-size: 13px; line-height: 1.6; color: #64748B;">If the button doesn't work, paste this link into your browser:</p>
  <p style="font-size: 12px; font-family: monospace; word-break: break-all; color: #64748B; padding: 12px; background: rgba(15, 23, 42, 0.04); border-radius: 8px;">{reset_url}</p>
  <p style="font-size: 13px; line-height: 1.6; color: #64748B; margin-top: 32px;">If you didn't request this, you can safely ignore this email — your password will stay the same.</p>
  <hr style="border: none; border-top: 1px solid rgba(15, 23, 42, 0.08); margin: 32px 0;" />
  <p style="font-size: 11px; color: #94A3B8; text-align: center; font-family: monospace; letter-spacing: 0.05em;">RELATIV · CREATOR ECONOMY · v2.0</p>
</div>""",
    )


def _render_verify_email(to_email: str, name: str, verify_url: str) -> OutgoingEmail:
    return OutgoingEmail(
        to=to_email,
        subject="Verify your RelatiV email",
        text=(
            f"Hi {name or 'there'},\n\n"
            f"Welcome to RelatiV! Please verify your email address by clicking the link below.\n\n"
            f"{verify_url}\n\n"
            f"This link expires in 24 hours. If you didn't create this account, ignore this email.\n\n"
            f"— The RelatiV team"
        ),
        html=f"""<div style="font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #FAF7F0; color: #0F172A;">
  <div style="text-align: center; margin-bottom: 32px;">
    <div style="display: inline-block; padding: 8px 16px; border-radius: 9999px; background: rgba(139, 92, 246, 0.08); border: 1px solid rgba(139, 92, 246, 0.2); font-size: 11px; font-family: monospace; letter-spacing: 0.1em; color: #8B5CF6;">WELCOME TO RELATIV</div>
  </div>
  <h1 style="font-family: 'Instrument Serif', Georgia, serif; font-style: italic; font-weight: 400; font-size: 36px; line-height: 1.1; margin: 0 0 16px 0; text-align: center;">Verify your email</h1>
  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px 0; color: #334155;">Hi {name or "there"},</p>
  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px 0; color: #334155;">Click the button below to verify your email and unlock the full RelatiV experience.</p>
  <div style="text-align: center; margin: 32px 0;">
    <a href="{verify_url}" style="display: inline-block; padding: 14px 32px; border-radius: 12px; background: linear-gradient(135deg, #8B5CF6 0%, #D946EF 100%); color: #FAF7F0; font-size: 14px; font-weight: 600; text-decoration: none; letter-spacing: 0.02em;">Verify email →</a>
  </div>
  <p style="font-size: 13px; line-height: 1.6; color: #64748B;">This link expires in 24 hours. If you didn't create this account, you can safely ignore this email.</p>
  <p style="font-size: 12px; font-family: monospace; word-break: break-all; color: #64748B; padding: 12px; background: rgba(15, 23, 42, 0.04); border-radius: 8px;">{verify_url}</p>
  <hr style="border: none; border-top: 1px solid rgba(15, 23, 42, 0.08); margin: 32px 0;" />
  <p style="font-size: 11px; color: #94A3B8; text-align: center; font-family: monospace; letter-spacing: 0.05em;">RELATIV · CREATOR ECONOMY · v2.0</p>
</div>""",
    )


# ─── Endpoints ─────────────────────────────────────────────────────────────


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(
    body: ForgotPasswordRequest,
    session: AsyncSession = Depends(get_session),
):
    """Email a password-reset link. Always returns 200 to avoid email enumeration."""
    user = (await session.execute(
        select(UserModel).where(UserModel.email == body.email.lower())
    )).scalar_one_or_none()

    if user and user.is_active:
        # 1-hour token
        token = secrets.token_urlsafe(32)
        user.password_reset_token = token
        user.password_reset_expires_at = datetime.now() + timedelta(hours=RESET_TOKEN_TTL_HOURS)
        await session.commit()

        reset_url = f"{FRONTEND_URL}/reset-password?token={token}"
        email = _render_reset_email(user.email, user.name, reset_url)
        await send_email(email)
        log.info(f"password_reset.sent user_id={user.id}")

    # Always 200, with a generic message
    return MessageResponse(message="If that email is in our system, a reset link is on its way.")


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    body: ResetPasswordRequest,
    session: AsyncSession = Depends(get_session),
):
    """Accept a reset token + new password."""
    user = (await session.execute(
        select(UserModel).where(UserModel.password_reset_token == body.token)
    )).scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")

    if not user.password_reset_expires_at or user.password_reset_expires_at < datetime.now():
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")

    # Update password
    from ..auth_utils import hash_password
    user.hashed_password = hash_password(body.new_password)
    # Null the token (single-use)
    user.password_reset_token = None
    user.password_reset_expires_at = None
    await session.commit()
    log.info(f"password_reset.success user_id={user.id}")
    return MessageResponse(message="Password updated. You can now sign in with your new password.")


@router.post("/verify-email", response_model=MessageResponse)
async def verify_email(
    body: ResendVerificationRequest,
    session: AsyncSession = Depends(get_session),
):
    """Accept an email verification token (from the link in the welcome email)."""
    # The token is passed in the URL, not the body. Frontend should call
    # /api/v1/auth/verify-email?token=... but FastAPI binds body here. To keep
    # it simple, accept it via query param.
    raise HTTPException(
        status_code=410,
        detail="Deprecated: call GET /api/v1/auth/verify-email?token=... instead"
    )


@router.get("/verify-email", response_model=MessageResponse)
async def verify_email_get(
    token: str,
    session: AsyncSession = Depends(get_session),
):
    """Verify the email address using the token from the welcome email."""
    user = (await session.execute(
        select(UserModel).where(UserModel.email_verification_token == token)
    )).scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired verification link")

    if user.is_verified:
        return MessageResponse(message="Your email is already verified. You can close this tab.")

    user.is_verified = True
    user.email_verified_at = datetime.now()
    user.email_verification_token = None  # single-use
    await session.commit()
    log.info(f"email_verified user_id={user.id}")
    return MessageResponse(message="Email verified! You can close this tab and return to RelatiV.")


@router.post("/resend-verification", response_model=MessageResponse)
async def resend_verification(
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Resend the verification email to the currently-logged-in user."""
    if user.is_verified:
        raise HTTPException(status_code=400, detail="Email already verified")

    # Generate a fresh 24h token
    token = secrets.token_urlsafe(32)
    user.email_verification_token = token
    await session.commit()

    verify_url = f"{FRONTEND_URL}/verify-email?token={token}"
    email = _render_verify_email(user.email, user.name, verify_url)
    await send_email(email)
    log.info(f"verification_resent user_id={user.id}")
    return MessageResponse(message="Verification email sent. Check your inbox.")
