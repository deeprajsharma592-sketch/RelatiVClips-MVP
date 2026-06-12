"""
Auth utilities — password hashing + JWT issue/verify.

Design notes
------------
- Passwords: bcrypt with cost 12. Async wrapper around passlib's
  CryptContext. Bcrypt is the right choice for v1: well-audited, slow
  enough to make brute force painful, no extra deps.
- JWTs: HS256 with a 32-byte secret from env (JWT_SECRET). 7-day
  lifetime. Claims: sub=user_id, role, email, jti (matches a sessions
  row), iat, exp. The jti lets us revoke individual sessions.
- We do NOT use refresh tokens in v1 — re-login every 7 days. Add
  refresh tokens in v1.1 once we know what devices are common.

Env vars expected
-----------------
- JWT_SECRET    : 32+ byte random string. Generate with: python -c "import secrets; print(secrets.token_urlsafe(48))"
- JWT_TTL_DAYS  : optional, default 7
- COOKIE_SECURE : optional, default true in prod, false in dev
"""

from __future__ import annotations

import hashlib
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import HTTPException, Request, Response, status

# ─── Config ────────────────────────────────────────────────────────────────
JWT_SECRET = os.getenv("JWT_SECRET", "")
JWT_ALGORITHM = "HS256"
JWT_TTL_DAYS = int(os.getenv("JWT_TTL_DAYS", "7"))
COOKIE_NAME = "relativ_session"
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "true").lower() != "false"  # default true


def ensure_secret() -> str:
    """Boot-time check. Refuses to start without a JWT secret in prod."""
    if not JWT_SECRET:
        # In dev, generate an ephemeral one so the app boots.
        # In prod (env sets COOKIE_SECURE=true), this is a hard fail.
        if COOKIE_SECURE:
            raise RuntimeError(
                "JWT_SECRET env var is required when COOKIE_SECURE=true. "
                "Generate with: python -c \"import secrets; print(secrets.token_urlsafe(48))\""
            )
        # ephemeral dev secret — print a loud warning
        import warnings
        warnings.warn("JWT_SECRET not set — using ephemeral dev secret. DO NOT USE IN PROD.")
        return secrets.token_urlsafe(48)
    if len(JWT_SECRET) < 32:
        raise RuntimeError(f"JWT_SECRET must be at least 32 bytes, got {len(JWT_SECRET)}")
    return JWT_SECRET


# ─── Password hashing ──────────────────────────────────────────────────────


def hash_password(plain: str) -> str:
    """Bcrypt-hash a plaintext password. Returns the encoded hash."""
    if not plain or len(plain) < 8:
        raise ValueError("Password must be at least 8 characters")
    # bcrypt has a 72-byte input cap; truncate gracefully
    pw_bytes = plain.encode("utf-8")[:72]
    return bcrypt.hashpw(pw_bytes, bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Constant-time bcrypt comparison. Returns False on any error."""
    if not plain or not hashed:
        return False
    try:
        pw_bytes = plain.encode("utf-8")[:72]
        return bcrypt.checkpw(pw_bytes, hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


# ─── JWT ───────────────────────────────────────────────────────────────────


def create_access_token(
    *,
    user_id: str,
    role: str,
    email: str,
    jti: Optional[str] = None,
) -> tuple[str, str, datetime]:
    """Issue a new JWT. Returns (token, jti, expires_at)."""
    secret = ensure_secret()
    jti = jti or secrets.token_urlsafe(24)
    # Use offset-naive UTC — DB columns are TIMESTAMP WITHOUT TIME ZONE
    now = datetime.utcnow()
    exp = now + timedelta(days=JWT_TTL_DAYS)
    payload = {
        "sub": user_id,
        "role": role,
        "email": email,
        "jti": jti,
        "iat": int(now.replace(tzinfo=timezone.utc).timestamp()),
        "exp": int(exp.replace(tzinfo=timezone.utc).timestamp()),
    }
    token = jwt.encode(payload, secret, algorithm=JWT_ALGORITHM)
    return token, jti, exp


def decode_access_token(token: str) -> dict:
    """Verify and decode a JWT. Raises 401 on any failure."""
    secret = ensure_secret()
    try:
        return jwt.decode(token, secret, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {e}")


# ─── Cookie helpers ────────────────────────────────────────────────────────


def set_session_cookie(response: Response, token: str, ttl_days: Optional[int] = None) -> None:
    """Attach the JWT to a SameSite=Lax, HttpOnly cookie."""
    ttl = ttl_days or JWT_TTL_DAYS
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=ttl * 24 * 3600,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/")


def get_session_cookie(request: Request) -> Optional[str]:
    return request.cookies.get(COOKIE_NAME)


# ─── IP hashing (privacy) ──────────────────────────────────────────────────


def hash_ip(ip: str, salt: Optional[str] = None) -> str:
    """SHA-256 of IP + salt. We don't store raw IPs anywhere."""
    salt = salt or os.getenv("IP_SALT", "relativ-default-salt")
    return hashlib.sha256(f"{salt}:{ip}".encode("utf-8")).hexdigest()[:32]
