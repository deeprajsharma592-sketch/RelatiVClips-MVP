"""
Social Accounts, Calendar Scheduling & Analytics Router
Handles YouTube & Instagram API connections, OAuth callbacks, calendar post
scheduling/publishing, and real YouTube/Instagram analytics retrieval.
"""
from __future__ import annotations

import hmac
import hashlib
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database.models import ScheduledPostModel, SocialAccountModel, UserModel
from ..database.session import get_session
from ..services.social_publishing import (
    GOOGLE_TOKEN_URL,
    META_GRAPH_BASE,
    _google_oauth_creds,
    _meta_oauth_creds,
    build_google_oauth_url,
    build_meta_oauth_url,
    execute_scheduled_post,
    fetch_instagram_account_info,
    fetch_instagram_analytics,
    fetch_youtube_analytics,
    fetch_youtube_channel_info,
    utc_now_naive,
)
from .auth_router import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/socials", tags=["socials"])

_OAUTH_SECRET = os.getenv("JWT_SECRET", os.getenv("SECRET_KEY", "relativ-oauth-state-secret"))


def _sign_state(user_id: str, platform: str) -> str:
    payload = f"{user_id}:{platform}"
    sig = hmac.new(_OAUTH_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()[:24]
    return f"{payload}:{sig}"


def _verify_state(state: str) -> tuple[str, str]:
    parts = (state or "").split(":")
    if len(parts) != 3:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")
    user_id, platform, sig = parts
    expected = hmac.new(_OAUTH_SECRET.encode(), f"{user_id}:{platform}".encode(), hashlib.sha256).hexdigest()[:24]
    if not hmac.compare_digest(sig, expected):
        raise HTTPException(status_code=400, detail="Invalid OAuth state signature")
    return user_id, platform


def _serialize_account(acc: SocialAccountModel) -> Dict[str, Any]:
    return {
        "id": acc.id,
        "platform": acc.platform,
        "platform_account_id": acc.platform_account_id,
        "name": acc.account_name or acc.account_handle,
        "handle": acc.account_handle,
        "followers": acc.followers_text or "Connected",
        "avatar_url": acc.avatar_url,
        "status": "connected",
        "auto_publish": acc.auto_publish,
        "has_oauth": bool(acc.access_token),
        "has_api_key": bool(acc.api_key),
        "can_publish": bool(acc.access_token),
        "connected_at": acc.created_at.isoformat() if acc.created_at else None,
    }


def _serialize_post(post: ScheduledPostModel) -> Dict[str, Any]:
    return {
        "id": post.id,
        "clip_id": post.clip_id,
        "video_url": post.video_url,
        "title": post.title,
        "caption": post.caption,
        "hashtags": post.hashtags,
        "platforms": post.platforms or [],
        "scheduled_at": post.scheduled_at.replace(tzinfo=timezone.utc).isoformat() if post.scheduled_at else None,
        "timezone_name": post.timezone_name,
        "status": post.status,
        "publish_results": post.publish_results or {},
        "error_message": post.error_message,
        "published_at": post.published_at.replace(tzinfo=timezone.utc).isoformat() if post.published_at else None,
        "created_at": post.created_at.replace(tzinfo=timezone.utc).isoformat() if post.created_at else None,
    }


class ConnectAccountRequest(BaseModel):
    platform: str
    channel_id: Optional[str] = None  # YouTube Channel ID (UC...) or @handle, or IG Business ID
    api_key: Optional[str] = None
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    auto_publish: bool = True


class UpdateAccountRequest(BaseModel):
    auto_publish: Optional[bool] = None
    api_key: Optional[str] = None
    access_token: Optional[str] = None


class YouTubeAnalyticsConfigRequest(BaseModel):
    api_key: Optional[str] = None
    channel_id: Optional[str] = None
    access_token: Optional[str] = None


class SchedulePostRequest(BaseModel):
    clip_id: Optional[str] = None
    video_url: Optional[str] = None
    title: str = Field(..., min_length=1, max_length=200)
    caption: str = ""
    hashtags: Optional[str] = None
    platforms: List[str] = Field(default_factory=list)
    scheduled_at: Optional[str] = None  # ISO 8601 timestamp
    timezone_name: Optional[str] = None
    publish_now: bool = False


class UpdateScheduledPostRequest(BaseModel):
    title: Optional[str] = None
    caption: Optional[str] = None
    hashtags: Optional[str] = None
    platforms: Optional[List[str]] = None
    scheduled_at: Optional[str] = None
    status: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
# Social Accounts & OAuth
# ─────────────────────────────────────────────────────────────────────────────


@router.get("/accounts")
async def get_connected_accounts(
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Dict[str, Any]:
    rows = (
        await session.execute(
            select(SocialAccountModel)
            .where(SocialAccountModel.user_id == user.id)
            .order_by(SocialAccountModel.created_at.desc())
        )
    ).scalars().all()

    google_id, google_sec = _google_oauth_creds()
    meta_id, meta_sec = _meta_oauth_creds()

    return {
        "success": True,
        "accounts": [_serialize_account(r) for r in rows],
        "total_connected": len(rows),
        "oauth_available": {
            "youtube": bool(google_id and google_sec),
            "instagram": bool(meta_id and meta_sec),
        },
    }


@router.get("/oauth/{platform}/start")
async def start_oauth(
    platform: str,
    request: Request,
    user: UserModel = Depends(get_current_user),
) -> Dict[str, Any]:
    plat = platform.lower().strip()
    base_url = os.getenv("PUBLIC_API_URL") or str(request.base_url).rstrip("/")
    redirect_uri = f"{base_url}/api/v1/socials/oauth/{plat}/callback"
    state = _sign_state(user.id, plat)

    try:
        if plat == "youtube":
            url = build_google_oauth_url(state, redirect_uri)
        elif plat == "instagram":
            url = build_meta_oauth_url(state, redirect_uri)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported OAuth platform: {plat}")
    except ValueError as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc

    return {"auth_url": url}


@router.get("/oauth/{platform}/callback")
async def oauth_callback(
    platform: str,
    request: Request,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    session: AsyncSession = Depends(get_session),
):
    frontend_url = os.getenv("FRONTEND_URL", "https://relativclips.com").rstrip("/")
    if error:
        return RedirectResponse(f"{frontend_url}/dashboard?tab=socials&oauth_error={error}")
    if not code or not state:
        return RedirectResponse(f"{frontend_url}/dashboard?tab=socials&oauth_error=missing_code")

    user_id, state_platform = _verify_state(state)
    plat = platform.lower().strip()
    if plat != state_platform:
        return RedirectResponse(f"{frontend_url}/dashboard?tab=socials&oauth_error=state_mismatch")

    base_url = os.getenv("PUBLIC_API_URL") or str(request.base_url).rstrip("/")
    redirect_uri = f"{base_url}/api/v1/socials/oauth/{plat}/callback"

    try:
        if plat == "youtube":
            client_id, client_secret = _google_oauth_creds()
            async with httpx.AsyncClient(timeout=20.0) as client:
                tok_resp = await client.post(
                    GOOGLE_TOKEN_URL,
                    data={
                        "code": code,
                        "client_id": client_id,
                        "client_secret": client_secret,
                        "redirect_uri": redirect_uri,
                        "grant_type": "authorization_code",
                    },
                )
                if tok_resp.status_code != 200:
                    return RedirectResponse(f"{frontend_url}/dashboard?tab=socials&oauth_error=token_exchange_failed")
                tok = tok_resp.json()
            access_token = tok["access_token"]
            refresh_token = tok.get("refresh_token")
            expires_in = int(tok.get("expires_in", 3600))
            info = await fetch_youtube_channel_info(access_token=access_token)
            await _upsert_social_account(
                session=session,
                user_id=user_id,
                platform="youtube",
                info=info,
                access_token=access_token,
                refresh_token=refresh_token,
                expires_at=utc_now_naive() + timedelta(seconds=expires_in),
            )
        elif plat == "instagram":
            app_id, app_secret = _meta_oauth_creds()
            async with httpx.AsyncClient(timeout=20.0) as client:
                tok_resp = await client.get(
                    f"{META_GRAPH_BASE}/oauth/access_token",
                    params={
                        "client_id": app_id,
                        "client_secret": app_secret,
                        "redirect_uri": redirect_uri,
                        "code": code,
                    },
                )
                if tok_resp.status_code != 200:
                    return RedirectResponse(f"{frontend_url}/dashboard?tab=socials&oauth_error=token_exchange_failed")
                tok = tok_resp.json()
            access_token = tok["access_token"]
            info = await fetch_instagram_account_info(access_token=access_token)
            await _upsert_social_account(
                session=session,
                user_id=user_id,
                platform="instagram",
                info=info,
                access_token=access_token,
            )
    except Exception as exc:
        logger.exception(f"[OAuth] Callback failed for {plat}: {exc}")
        return RedirectResponse(f"{frontend_url}/dashboard?tab=socials&oauth_error=connect_failed")

    return RedirectResponse(f"{frontend_url}/dashboard?tab=socials&connected={plat}")


@router.post("/accounts/connect")
async def connect_account(
    req: ConnectAccountRequest,
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Dict[str, Any]:
    plat = req.platform.lower().strip()
    if plat not in {"youtube", "instagram"}:
        raise HTTPException(status_code=400, detail="Only YouTube and Instagram connections are supported.")

    try:
        if plat == "youtube":
            info = await fetch_youtube_channel_info(
                api_key=(req.api_key or "").strip() or None,
                access_token=(req.access_token or "").strip() or None,
                channel_identifier=(req.channel_id or "").strip() or None,
            )
        else:
            info = await fetch_instagram_account_info(
                access_token=(req.access_token or "").strip(),
                ig_user_id=(req.channel_id or "").strip() or None,
            )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    acc = await _upsert_social_account(
        session=session,
        user_id=user.id,
        platform=plat,
        info=info,
        api_key=(req.api_key or "").strip() or None,
        access_token=(req.access_token or "").strip() or None,
        refresh_token=(req.refresh_token or "").strip() or None,
        auto_publish=req.auto_publish,
    )
    return {
        "success": True,
        "message": f"Connected {plat.title()} ({acc.account_handle})",
        "account": _serialize_account(acc),
    }


@router.patch("/accounts/{account_id}")
async def update_account(
    account_id: str,
    req: UpdateAccountRequest,
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Dict[str, Any]:
    acc = (
        await session.execute(
            select(SocialAccountModel).where(
                SocialAccountModel.id == account_id,
                SocialAccountModel.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")

    if req.auto_publish is not None:
        acc.auto_publish = req.auto_publish
    if req.api_key is not None:
        acc.api_key = req.api_key.strip() or None
    if req.access_token is not None:
        acc.access_token = req.access_token.strip() or None
    acc.updated_at = utc_now_naive()
    await session.commit()
    await session.refresh(acc)
    return {"success": True, "account": _serialize_account(acc)}


@router.post("/accounts/{account_id}/refresh")
async def refresh_account(
    account_id: str,
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Dict[str, Any]:
    acc = (
        await session.execute(
            select(SocialAccountModel).where(
                SocialAccountModel.id == account_id,
                SocialAccountModel.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")

    try:
        if acc.platform == "youtube":
            info = await fetch_youtube_channel_info(
                api_key=acc.api_key,
                access_token=acc.access_token,
                channel_identifier=acc.platform_account_id or acc.account_handle,
            )
        elif acc.platform == "instagram":
            info = await fetch_instagram_account_info(
                access_token=acc.access_token or "",
                ig_user_id=acc.platform_account_id,
            )
        else:
            return {"success": True, "account": _serialize_account(acc)}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    acc.account_name = info.get("account_name") or acc.account_name
    acc.account_handle = info.get("account_handle") or acc.account_handle
    acc.avatar_url = info.get("avatar_url") or acc.avatar_url
    acc.followers_text = info.get("followers_text") or acc.followers_text
    acc.platform_account_id = info.get("platform_account_id") or acc.platform_account_id
    acc.extra_metadata = {**(acc.extra_metadata or {}), **{k: v for k, v in info.items() if k != "avatar_url"}}
    acc.updated_at = utc_now_naive()
    await session.commit()
    await session.refresh(acc)
    return {"success": True, "account": _serialize_account(acc)}


@router.delete("/accounts/{account_id}")
async def disconnect_account(
    account_id: str,
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Dict[str, Any]:
    acc = (
        await session.execute(
            select(SocialAccountModel).where(
                SocialAccountModel.id == account_id,
                SocialAccountModel.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")
    await session.delete(acc)
    await session.commit()
    return {"success": True, "message": "Account disconnected"}


# ─────────────────────────────────────────────────────────────────────────────
# Calendar Scheduling & Publishing
# ─────────────────────────────────────────────────────────────────────────────


@router.get("/schedule")
async def list_scheduled_posts(
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Dict[str, Any]:
    rows = (
        await session.execute(
            select(ScheduledPostModel)
            .where(ScheduledPostModel.user_id == user.id)
            .order_by(ScheduledPostModel.scheduled_at.asc())
        )
    ).scalars().all()
    return {
        "success": True,
        "posts": [_serialize_post(r) for r in rows],
    }


@router.post("/schedule")
async def create_scheduled_post(
    req: SchedulePostRequest,
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Dict[str, Any]:
    platforms = [p.lower().strip() for p in req.platforms if p.lower().strip() in {"youtube", "instagram"}]
    if not platforms:
        raise HTTPException(status_code=400, detail="Select at least one target platform (YouTube or Instagram).")

    connected = (
        await session.execute(
            select(SocialAccountModel).where(
                SocialAccountModel.user_id == user.id,
                SocialAccountModel.platform.in_(platforms),
            )
        )
    ).scalars().all()
    accounts_by_platform = {a.platform: a for a in connected}

    missing = [p for p in platforms if p not in accounts_by_platform]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Connect your {', '.join(m.title() for m in missing)} account before scheduling.",
        )

    no_oauth = [p for p in platforms if not accounts_by_platform[p].access_token]
    if req.publish_now and no_oauth:
        raise HTTPException(
            status_code=400,
            detail=f"{', '.join(p.title() for p in no_oauth)} requires an OAuth access token to publish videos.",
        )

    if req.scheduled_at:
        try:
            dt = datetime.fromisoformat(req.scheduled_at.replace("Z", "+00:00"))
            scheduled_naive = dt.astimezone(timezone.utc).replace(tzinfo=None)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid scheduled_at ISO timestamp") from exc
    else:
        scheduled_naive = utc_now_naive()

    post = ScheduledPostModel(
        user_id=user.id,
        clip_id=req.clip_id,
        video_url=req.video_url,
        title=req.title.strip(),
        caption=req.caption.strip(),
        hashtags=(req.hashtags or "").strip() or None,
        platforms=platforms,
        scheduled_at=scheduled_naive,
        timezone_name=req.timezone_name,
        status="publishing" if req.publish_now else "scheduled",
    )
    session.add(post)
    await session.commit()
    await session.refresh(post)

    if req.publish_now:
        await execute_scheduled_post(session, post, accounts_by_platform)
        await session.refresh(post)

    return {
        "success": True,
        "post": _serialize_post(post),
    }


@router.patch("/schedule/{post_id}")
async def update_scheduled_post(
    post_id: str,
    req: UpdateScheduledPostRequest,
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Dict[str, Any]:
    post = (
        await session.execute(
            select(ScheduledPostModel).where(
                ScheduledPostModel.id == post_id,
                ScheduledPostModel.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Scheduled post not found")

    if req.title is not None:
        post.title = req.title.strip()
    if req.caption is not None:
        post.caption = req.caption.strip()
    if req.hashtags is not None:
        post.hashtags = req.hashtags.strip() or None
    if req.platforms is not None:
        post.platforms = [p.lower().strip() for p in req.platforms if p.lower().strip() in {"youtube", "instagram"}]
    if req.scheduled_at is not None:
        try:
            dt = datetime.fromisoformat(req.scheduled_at.replace("Z", "+00:00"))
            post.scheduled_at = dt.astimezone(timezone.utc).replace(tzinfo=None)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid scheduled_at timestamp") from exc
    if req.status is not None and req.status in {"scheduled", "cancelled"}:
        post.status = req.status
    post.updated_at = utc_now_naive()
    await session.commit()
    await session.refresh(post)
    return {"success": True, "post": _serialize_post(post)}


@router.post("/schedule/{post_id}/publish")
async def publish_scheduled_post_now(
    post_id: str,
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Dict[str, Any]:
    post = (
        await session.execute(
            select(ScheduledPostModel).where(
                ScheduledPostModel.id == post_id,
                ScheduledPostModel.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Scheduled post not found")

    connected = (
        await session.execute(
            select(SocialAccountModel).where(
                SocialAccountModel.user_id == user.id,
                SocialAccountModel.platform.in_(post.platforms or []),
            )
        )
    ).scalars().all()
    accounts_by_platform = {a.platform: a for a in connected}

    post.status = "publishing"
    await session.commit()
    await execute_scheduled_post(session, post, accounts_by_platform)
    await session.refresh(post)
    return {"success": True, "post": _serialize_post(post)}


@router.delete("/schedule/{post_id}")
async def delete_scheduled_post(
    post_id: str,
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Dict[str, Any]:
    post = (
        await session.execute(
            select(ScheduledPostModel).where(
                ScheduledPostModel.id == post_id,
                ScheduledPostModel.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Scheduled post not found")
    await session.delete(post)
    await session.commit()
    return {"success": True, "message": "Scheduled post removed"}


# ─────────────────────────────────────────────────────────────────────────────
# Real YouTube & Instagram Analytics
# ─────────────────────────────────────────────────────────────────────────────


@router.post("/youtube-analytics/config")
async def configure_youtube_analytics(
    req: YouTubeAnalyticsConfigRequest,
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Dict[str, Any]:
    """Allow users to directly enter their YouTube Data/Analytics API key + Channel ID or OAuth token."""
    api_key = (req.api_key or "").strip() or None
    channel_id = (req.channel_id or "").strip() or None
    access_token = (req.access_token or "").strip() or None

    if not api_key and not access_token:
        raise HTTPException(status_code=400, detail="Enter your YouTube API key (with Channel ID/@handle) or OAuth token.")

    try:
        info = await fetch_youtube_channel_info(
            api_key=api_key,
            access_token=access_token,
            channel_identifier=channel_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    acc = await _upsert_social_account(
        session=session,
        user_id=user.id,
        platform="youtube",
        info=info,
        api_key=api_key,
        access_token=access_token,
    )
    return {
        "success": True,
        "account": _serialize_account(acc),
    }


@router.get("/analytics")
async def get_analytics(
    days: int = Query(default=7, ge=1, le=90),
    platform: str = Query(default="all"),
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Dict[str, Any]:
    accounts = (
        await session.execute(
            select(SocialAccountModel).where(SocialAccountModel.user_id == user.id)
        )
    ).scalars().all()

    if not accounts:
        return {
            "connected": False,
            "accounts": [],
            "summary": None,
            "daily": [],
            "videos": [],
            "notes": [],
        }

    target_plat = platform.lower().strip()
    filtered = [
        a for a in accounts
        if target_plat == "all" or a.platform == target_plat
    ]

    total_views = 0
    total_likes = 0
    total_comments = 0
    total_published = 0
    total_subscribers = 0
    watch_time_minutes: Optional[float] = None
    retention_values: List[float] = []
    all_videos: List[Dict[str, Any]] = []
    daily_map: Dict[str, Dict[str, Any]] = {}
    notes: List[str] = []

    for acc in filtered:
        if acc.platform == "youtube":
            yt_data = await fetch_youtube_analytics(acc, days=days)
            s = yt_data.get("summary") or {}
            total_views += int(s.get("views") or 0)
            total_likes += int(s.get("likes") or 0)
            total_comments += int(s.get("comments") or 0)
            total_published += int(s.get("published_count") or 0)
            total_subscribers += int(s.get("subscribers") or 0)
            if s.get("watch_time_minutes") is not None:
                watch_time_minutes = round((watch_time_minutes or 0.0) + float(s["watch_time_minutes"]), 1)
            if s.get("avg_retention_pct") is not None:
                retention_values.append(float(s["avg_retention_pct"]))
            if yt_data.get("note"):
                notes.append(yt_data["note"])
            all_videos.extend(yt_data.get("videos") or [])
            for d in yt_data.get("daily") or []:
                dt = d["date"]
                cur = daily_map.setdefault(dt, {"date": dt, "views": 0, "watch_time_minutes": 0.0})
                cur["views"] += int(d.get("views") or 0)
                cur["watch_time_minutes"] += float(d.get("watch_time_minutes") or 0.0)
        elif acc.platform == "instagram":
            ig_data = await fetch_instagram_analytics(acc, days=days)
            s = ig_data.get("summary") or {}
            total_views += int(s.get("views") or 0)
            total_likes += int(s.get("likes") or 0)
            total_comments += int(s.get("comments") or 0)
            total_published += int(s.get("published_count") or 0)
            all_videos.extend(ig_data.get("videos") or [])
            for d in ig_data.get("daily") or []:
                dt = d["date"]
                cur = daily_map.setdefault(dt, {"date": dt, "views": 0, "watch_time_minutes": 0.0})
                cur["views"] += int(d.get("views") or 0)

    all_videos.sort(key=lambda v: v.get("views") or 0, reverse=True)
    daily_series = sorted(daily_map.values(), key=lambda x: x["date"])

    return {
        "connected": True,
        "accounts": [_serialize_account(a) for a in accounts],
        "summary": {
            "views": total_views,
            "watch_time_minutes": watch_time_minutes,
            "avg_retention_pct": round(sum(retention_values) / len(retention_values), 1) if retention_values else None,
            "published_count": total_published,
            "subscribers": total_subscribers,
            "likes": total_likes,
            "comments": total_comments,
        },
        "daily": daily_series,
        "videos": all_videos[:20],
        "notes": notes,
    }


async def _upsert_social_account(
    *,
    session: AsyncSession,
    user_id: str,
    platform: str,
    info: Dict[str, Any],
    api_key: Optional[str] = None,
    access_token: Optional[str] = None,
    refresh_token: Optional[str] = None,
    expires_at: Optional[datetime] = None,
    auto_publish: bool = True,
) -> SocialAccountModel:
    existing = (
        await session.execute(
            select(SocialAccountModel).where(
                SocialAccountModel.user_id == user_id,
                SocialAccountModel.platform == platform,
            )
        )
    ).scalar_one_or_none()

    meta = {k: v for k, v in info.items() if k != "avatar_url"}
    if existing:
        existing.platform_account_id = info.get("platform_account_id") or existing.platform_account_id
        existing.account_name = info.get("account_name") or existing.account_name
        existing.account_handle = info.get("account_handle") or existing.account_handle
        existing.avatar_url = info.get("avatar_url") or existing.avatar_url
        existing.followers_text = info.get("followers_text") or existing.followers_text
        if api_key is not None:
            existing.api_key = api_key
        if access_token is not None:
            existing.access_token = access_token
        if refresh_token is not None:
            existing.refresh_token = refresh_token
        if expires_at is not None:
            existing.expires_at = expires_at
        existing.extra_metadata = {**(existing.extra_metadata or {}), **meta}
        existing.updated_at = utc_now_naive()
        await session.commit()
        await session.refresh(existing)
        return existing

    acc = SocialAccountModel(
        user_id=user_id,
        platform=platform,
        platform_account_id=info.get("platform_account_id"),
        account_name=info.get("account_name"),
        account_handle=info.get("account_handle") or platform,
        avatar_url=info.get("avatar_url"),
        followers_text=info.get("followers_text"),
        api_key=api_key,
        access_token=access_token,
        refresh_token=refresh_token,
        expires_at=expires_at,
        auto_publish=auto_publish,
        extra_metadata=meta,
    )
    session.add(acc)
    await session.commit()
    await session.refresh(acc)
    return acc
