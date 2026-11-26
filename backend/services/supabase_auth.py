"""Small server-side bridge to Supabase Auth's verified-user endpoint.

The browser owns Supabase sessions. FastAPI accepts only the bearer token
forwarded by the same-origin Next.js proxy and asks Supabase Auth to validate
it before resolving the app's SQLAlchemy profile.
"""
from __future__ import annotations

import os

import httpx
from fastapi import HTTPException


SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_PUBLISHABLE_KEY = (
    os.getenv("SUPABASE_PUBLISHABLE_KEY")
    or os.getenv("SUPABASE_ANON_KEY")
    or ""
).strip()


def is_supabase_auth_configured() -> bool:
    return bool(SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY)


async def get_verified_supabase_user(access_token: str) -> dict:
    if not is_supabase_auth_configured():
        raise HTTPException(status_code=503, detail="Supabase Auth is not configured on the backend")

    try:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers={
                    "apikey": SUPABASE_PUBLISHABLE_KEY,
                    "Authorization": f"Bearer {access_token}",
                },
            )
    except httpx.HTTPError:
        raise HTTPException(status_code=503, detail="Supabase Auth could not be reached")

    if response.status_code in (401, 403):
        raise HTTPException(status_code=401, detail="Your session is invalid or expired")
    if response.status_code >= 500:
        raise HTTPException(status_code=503, detail="Supabase Auth is temporarily unavailable")
    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Your session could not be verified")

    user = response.json()
    if not isinstance(user, dict) or not user.get("id") or not user.get("email"):
        raise HTTPException(status_code=401, detail="Supabase returned an incomplete user identity")
    return user


async def verify_supabase_password(email: str, password: str) -> dict:
    """Verify email + password directly against Supabase Auth and return the user dict."""
    if not is_supabase_auth_configured():
        raise HTTPException(status_code=503, detail="Supabase Auth is not configured on the backend")

    try:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.post(
                f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
                headers={
                    "apikey": SUPABASE_PUBLISHABLE_KEY,
                    "Content-Type": "application/json",
                },
                json={"email": email.strip().lower(), "password": password},
            )
    except httpx.HTTPError:
        raise HTTPException(status_code=503, detail="Supabase Auth could not be reached")

    if response.status_code in (400, 401, 403):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    if response.status_code >= 500:
        raise HTTPException(status_code=503, detail="Supabase Auth is temporarily unavailable")
    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Could not verify credentials with Supabase Auth")

    payload = response.json()
    user = payload.get("user") if isinstance(payload, dict) else None
    if not isinstance(user, dict) or not user.get("id") or not user.get("email"):
        raise HTTPException(status_code=401, detail="Supabase returned an incomplete user identity")
    return user
