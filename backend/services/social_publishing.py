"""
Social Publishing & Analytics Service
Integrates with YouTube Data API v3, YouTube Analytics API v2, and Instagram Graph API
for account verification, real analytics retrieval, and video publishing/scheduling.
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import quote

import httpx

logger = logging.getLogger(__name__)

YOUTUBE_DATA_BASE = "https://www.googleapis.com/youtube/v3"
YOUTUBE_UPLOAD_BASE = "https://www.googleapis.com/upload/youtube/v3"
YOUTUBE_ANALYTICS_BASE = "https://youtubeanalytics.googleapis.com/v2"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
META_GRAPH_BASE = "https://graph.facebook.com/v20.0"


def utc_now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def format_compact_count(value: Any, suffix: str = "") -> str:
    try:
        n = int(value)
    except (TypeError, ValueError):
        return f"0{suffix}"
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f}M{suffix}"
    if n >= 1_000:
        return f"{n / 1_000:.1f}K{suffix}"
    return f"{n}{suffix}"


def _google_oauth_creds() -> tuple[str, str]:
    return (
        os.getenv("GOOGLE_CLIENT_ID", "").strip(),
        os.getenv("GOOGLE_CLIENT_SECRET", "").strip(),
    )


def _meta_oauth_creds() -> tuple[str, str]:
    return (
        os.getenv("META_APP_ID", os.getenv("INSTAGRAM_APP_ID", "")).strip(),
        os.getenv("META_APP_SECRET", os.getenv("INSTAGRAM_APP_SECRET", "")).strip(),
    )


async def refresh_youtube_token(account: Any) -> Optional[str]:
    """Refresh YouTube OAuth access token if expired and refresh_token is available."""
    if not getattr(account, "access_token", None):
        return None
    expires_at = getattr(account, "expires_at", None)
    if expires_at and expires_at > utc_now_naive() + timedelta(minutes=2):
        return account.access_token

    refresh_tok = getattr(account, "refresh_token", None)
    client_id, client_secret = _google_oauth_creds()
    if not refresh_tok or not client_id or not client_secret:
        return account.access_token

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "refresh_token": refresh_tok,
                    "grant_type": "refresh_token",
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                account.access_token = data["access_token"]
                expires_in = int(data.get("expires_in", 3600))
                account.expires_at = utc_now_naive() + timedelta(seconds=expires_in)
                return account.access_token
    except Exception as exc:
        logger.warning(f"[Socials] YouTube token refresh failed: {exc}")
    return account.access_token


async def fetch_youtube_channel_info(
    *,
    api_key: Optional[str] = None,
    access_token: Optional[str] = None,
    channel_identifier: Optional[str] = None,
) -> Dict[str, Any]:
    """Verify and fetch real YouTube channel metadata via YouTube Data API v3."""
    async def _query_channels(use_oauth: bool) -> httpx.Response:
        params: Dict[str, str] = {"part": "snippet,statistics,contentDetails"}
        headers: Dict[str, str] = {}
        if use_oauth and access_token:
            headers["Authorization"] = f"Bearer {access_token}"
            if channel_identifier and channel_identifier.startswith("UC"):
                params["id"] = channel_identifier
            elif channel_identifier and channel_identifier.startswith("@"):
                params["forHandle"] = channel_identifier
            else:
                params["mine"] = "true"
        elif api_key:
            params["key"] = api_key
            ident = (channel_identifier or "").strip()
            if not ident:
                raise ValueError("Channel ID (UC...) or @handle is required when connecting with an API key.")
            if ident.startswith("UC") and len(ident) >= 20:
                params["id"] = ident
            else:
                params["forHandle"] = ident if ident.startswith("@") else f"@{ident}"
        else:
            raise ValueError("Provide either a YouTube API key + Channel ID or an OAuth access token.")

        async with httpx.AsyncClient(timeout=15.0) as client:
            return await client.get(f"{YOUTUBE_DATA_BASE}/channels", params=params, headers=headers)

    # If both access_token and api_key are provided, try access_token first.
    # If access_token fails with 403 (e.g. insufficient scopes because token has youtube.upload
    # but not youtube.readonly), gracefully fall back to api_key for channel metadata.
    if access_token and api_key and channel_identifier:
        resp = await _query_channels(use_oauth=True)
        if resp.status_code == 403 and "insufficient" in resp.text.lower():
            fallback_resp = await _query_channels(use_oauth=False)
            if fallback_resp.status_code == 200:
                resp = fallback_resp
    elif access_token:
        resp = await _query_channels(use_oauth=True)
    elif api_key:
        resp = await _query_channels(use_oauth=False)
    else:
        raise ValueError("Provide either a YouTube API key + Channel ID or an OAuth access token.")

    if resp.status_code != 200:
        # If /channels returned 403 (insufficient scopes), check if access_token has youtube.upload scope
        # via Google's tokeninfo. If valid, accept the connection for direct Shorts publishing!
        if resp.status_code == 403 and access_token:
            try:
                async with httpx.AsyncClient(timeout=10.0) as check_client:
                    t_resp = await check_client.get(
                        "https://oauth2.googleapis.com/tokeninfo",
                        params={"access_token": access_token},
                    )
                    if t_resp.status_code == 200:
                        t_data = t_resp.json()
                        scope_str = t_data.get("scope", "")
                        if "youtube" in scope_str:
                            cid = (channel_identifier or "").strip() or "me"
                            handle = cid if cid.startswith("@") else (f"@{cid}" if cid else "@youtube")
                            return {
                                "platform_account_id": cid,
                                "account_name": f"YouTube Channel ({handle})",
                                "account_handle": handle,
                                "avatar_url": None,
                                "followers_text": "Direct Upload Ready",
                                "subscriber_count": 0,
                                "view_count": 0,
                                "video_count": 0,
                                "uploads_playlist_id": None,
                            }
            except Exception:
                pass

        err_msg = _extract_google_error(resp)
        raise ValueError(f"YouTube API error ({resp.status_code}): {err_msg}")
    items = resp.json().get("items") or []
    if not items:
        raise ValueError("No YouTube channel found for the provided credentials / Channel ID.")

    ch = items[0]
    snippet = ch.get("snippet") or {}
    stats = ch.get("statistics") or {}
    content = ch.get("contentDetails") or {}
    thumbs = snippet.get("thumbnails") or {}
    avatar = (thumbs.get("medium") or thumbs.get("default") or {}).get("url")
    custom_url = snippet.get("customUrl") or ""
    handle = custom_url if custom_url.startswith("@") else (f"@{custom_url}" if custom_url else ch["id"])
    subs = int(stats.get("subscriberCount") or 0)
    return {
        "platform_account_id": ch["id"],
        "account_name": snippet.get("title") or "YouTube Channel",
        "account_handle": handle,
        "avatar_url": avatar,
        "followers_text": format_compact_count(subs, " subscribers"),
        "subscriber_count": subs,
        "view_count": int(stats.get("viewCount") or 0),
        "video_count": int(stats.get("videoCount") or 0),
        "uploads_playlist_id": (content.get("relatedPlaylists") or {}).get("uploads"),
    }


async def fetch_youtube_analytics(account: Any, days: int = 7) -> Dict[str, Any]:
    """Fetch real YouTube Analytics API v2 + YouTube Data API v3 metrics."""
    token = await refresh_youtube_token(account) if account.access_token else None
    api_key = account.api_key
    channel_id = account.platform_account_id
    meta = dict(account.extra_metadata or {})
    uploads_playlist_id = meta.get("uploads_playlist_id")

    # Refresh channel statistics & find uploads playlist if missing
    channel_info: Dict[str, Any] = {}
    try:
        channel_info = await fetch_youtube_channel_info(
            api_key=api_key,
            access_token=token,
            channel_identifier=channel_id or account.account_handle,
        )
        uploads_playlist_id = uploads_playlist_id or channel_info.get("uploads_playlist_id")
    except Exception as exc:
        logger.warning(f"[Analytics] Channel refresh failed: {exc}")

    headers: Dict[str, str] = {}
    auth_params: Dict[str, str] = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    elif api_key:
        auth_params["key"] = api_key

    # 1. Recent videos from uploads playlist (Data API v3)
    videos: List[Dict[str, Any]] = []
    if uploads_playlist_id and (token or api_key):
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                pl_resp = await client.get(
                    f"{YOUTUBE_DATA_BASE}/playlistItems",
                    params={
                        **auth_params,
                        "part": "contentDetails,snippet",
                        "playlistId": uploads_playlist_id,
                        "maxResults": "15",
                    },
                    headers=headers,
                )
                if pl_resp.status_code == 200:
                    pl_items = pl_resp.json().get("items") or []
                    video_ids = [
                        it["contentDetails"]["videoId"]
                        for it in pl_items
                        if it.get("contentDetails", {}).get("videoId")
                    ]
                    if video_ids:
                        v_resp = await client.get(
                            f"{YOUTUBE_DATA_BASE}/videos",
                            params={
                                **auth_params,
                                "part": "snippet,statistics,contentDetails",
                                "id": ",".join(video_ids),
                            },
                            headers=headers,
                        )
                        if v_resp.status_code == 200:
                            for v in v_resp.json().get("items") or []:
                                sn = v.get("snippet") or {}
                                st = v.get("statistics") or {}
                                thumbs = sn.get("thumbnails") or {}
                                thumb = (thumbs.get("medium") or thumbs.get("default") or {}).get("url")
                                videos.append({
                                    "id": v["id"],
                                    "platform": "youtube",
                                    "title": sn.get("title") or "Untitled",
                                    "published_at": sn.get("publishedAt"),
                                    "thumbnail_url": thumb,
                                    "views": int(st.get("viewCount") or 0),
                                    "likes": int(st.get("likeCount") or 0),
                                    "comments": int(st.get("commentCount") or 0),
                                    "url": f"https://www.youtube.com/watch?v={v['id']}",
                                })
        except Exception as exc:
            logger.warning(f"[Analytics] YouTube videos fetch failed: {exc}")

    # 2. YouTube Analytics API v2 (OAuth only — gives daily views, watch time, retention)
    daily: List[Dict[str, Any]] = []
    analytics_summary: Dict[str, Any] = {}
    api_mode = "data_v3"
    analytics_note: Optional[str] = None

    if token:
        end_date = datetime.now(timezone.utc).date()
        start_date = end_date - timedelta(days=max(1, days))
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                rep_resp = await client.get(
                    f"{YOUTUBE_ANALYTICS_BASE}/reports",
                    params={
                        "ids": "channel==MINE",
                        "startDate": start_date.isoformat(),
                        "endDate": end_date.isoformat(),
                        "metrics": "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,comments",
                        "dimensions": "day",
                        "sort": "day",
                    },
                    headers=headers,
                )
                if rep_resp.status_code == 200:
                    data = rep_resp.json()
                    rows = data.get("rows") or []
                    total_views = 0
                    total_watch_mins = 0.0
                    retention_sum = 0.0
                    total_likes = 0
                    total_comments = 0
                    for r in rows:
                        # [day, views, estimatedMinutesWatched, avgViewDur, avgViewPct, likes, comments]
                        v_cnt = int(r[1] or 0)
                        w_mins = float(r[2] or 0.0)
                        ret_pct = float(r[4] or 0.0)
                        lk = int(r[5] or 0)
                        cm = int(r[6] or 0)
                        daily.append({
                            "date": r[0],
                            "views": v_cnt,
                            "watch_time_minutes": round(w_mins, 1),
                            "retention_pct": round(ret_pct, 1),
                        })
                        total_views += v_cnt
                        total_watch_mins += w_mins
                        retention_sum += ret_pct
                        total_likes += lk
                        total_comments += cm
                    api_mode = "analytics_v2"
                    analytics_summary = {
                        "views": total_views,
                        "watch_time_minutes": round(total_watch_mins, 1),
                        "avg_retention_pct": round(retention_sum / len(rows), 1) if rows else 0.0,
                        "likes": total_likes,
                        "comments": total_comments,
                    }
                else:
                    analytics_note = (
                        "Channel metrics loaded via YouTube Data API v3. "
                        "Connect Google OAuth with yt-analytics.readonly scope for daily watch-time & retention."
                    )
        except Exception as exc:
            logger.warning(f"[Analytics] YouTube Analytics v2 error: {exc}")
    else:
        analytics_note = (
            "Live channel & video metrics loaded via YouTube Data API v3 key. "
            "Watch time & audience retention require OAuth yt-analytics.readonly."
        )

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    recent_videos = []
    for v in videos:
        pub = v.get("published_at")
        if pub:
            try:
                dt = datetime.fromisoformat(pub.replace("Z", "+00:00"))
                if dt >= cutoff:
                    recent_videos.append(v)
            except Exception:
                pass
    target_videos = recent_videos or videos

    sum_views = analytics_summary.get("views") if api_mode == "analytics_v2" else sum(v["views"] for v in target_videos)
    sum_likes = analytics_summary.get("likes") if api_mode == "analytics_v2" else sum(v["likes"] for v in target_videos)
    sum_comments = analytics_summary.get("comments") if api_mode == "analytics_v2" else sum(v["comments"] for v in target_videos)

    return {
        "platform": "youtube",
        "account_name": channel_info.get("account_name") or account.account_name,
        "account_handle": channel_info.get("account_handle") or account.account_handle,
        "api_mode": api_mode,
        "note": analytics_note,
        "summary": {
            "views": sum_views,
            "channel_total_views": channel_info.get("view_count", 0),
            "subscribers": channel_info.get("subscriber_count", 0),
            "published_count": channel_info.get("video_count", len(videos)),
            "watch_time_minutes": analytics_summary.get("watch_time_minutes"),
            "avg_retention_pct": analytics_summary.get("avg_retention_pct"),
            "likes": sum_likes,
            "comments": sum_comments,
        },
        "daily": daily,
        "videos": videos[:12],
    }


async def fetch_instagram_account_info(
    *,
    access_token: str,
    ig_user_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Verify and fetch Instagram Business/Creator profile via Meta Graph API."""
    if not access_token:
        raise ValueError("Instagram Graph API access token is required.")

    async with httpx.AsyncClient(timeout=15.0) as client:
        resolved_id = (ig_user_id or "").strip()
        if not resolved_id:
            # Try discovering linked IG business account via /me/accounts
            pages_resp = await client.get(
                f"{META_GRAPH_BASE}/me/accounts",
                params={"fields": "instagram_business_account,name", "access_token": access_token},
            )
            if pages_resp.status_code == 200:
                for page in pages_resp.json().get("data") or []:
                    ig = page.get("instagram_business_account")
                    if ig and ig.get("id"):
                        resolved_id = ig["id"]
                        break

        if not resolved_id:
            # Fallback to /me on Instagram Graph / User token
            me_resp = await client.get(
                f"{META_GRAPH_BASE}/me",
                params={"fields": "id,username,name,profile_picture_url,followers_count,media_count", "access_token": access_token},
            )
            if me_resp.status_code != 200:
                err_msg = _extract_meta_error(me_resp)
                raise ValueError(f"Instagram API error ({me_resp.status_code}): {err_msg}")
            data = me_resp.json()
            username = data.get("username") or data.get("name") or data["id"]
            followers = int(data.get("followers_count") or 0)
            return {
                "platform_account_id": data["id"],
                "account_name": data.get("name") or username,
                "account_handle": f"@{username.lstrip('@')}",
                "avatar_url": data.get("profile_picture_url"),
                "followers_text": format_compact_count(followers, " followers") if followers else "Connected",
                "followers_count": followers,
                "media_count": int(data.get("media_count") or 0),
            }

        prof_resp = await client.get(
            f"{META_GRAPH_BASE}/{resolved_id}",
            params={"fields": "id,username,name,profile_picture_url,followers_count,media_count", "access_token": access_token},
        )
        if prof_resp.status_code != 200:
            err_msg = _extract_meta_error(prof_resp)
            raise ValueError(f"Instagram API error ({prof_resp.status_code}): {err_msg}")
        data = prof_resp.json()
        username = data.get("username") or data.get("name") or data["id"]
        followers = int(data.get("followers_count") or 0)
        return {
            "platform_account_id": data["id"],
            "account_name": data.get("name") or username,
            "account_handle": f"@{username.lstrip('@')}",
            "avatar_url": data.get("profile_picture_url"),
            "followers_text": format_compact_count(followers, " followers") if followers else "Connected",
            "followers_count": followers,
            "media_count": int(data.get("media_count") or 0),
        }


async def fetch_instagram_analytics(account: Any, days: int = 7) -> Dict[str, Any]:
    """Fetch real Instagram media & insights via Meta Graph API."""
    if not account.access_token or not account.platform_account_id:
        return {"platform": "instagram", "summary": {}, "videos": [], "daily": []}

    ig_id = account.platform_account_id
    token = account.access_token
    videos: List[Dict[str, Any]] = []
    total_likes = 0
    total_comments = 0
    total_views = 0

    async with httpx.AsyncClient(timeout=15.0) as client:
        m_resp = await client.get(
            f"{META_GRAPH_BASE}/{ig_id}/media",
            params={
                "fields": "id,caption,media_type,thumbnail_url,media_url,permalink,timestamp,like_count,comments_count",
                "limit": "15",
                "access_token": token,
            },
        )
        if m_resp.status_code == 200:
            for item in m_resp.json().get("data") or []:
                lk = int(item.get("like_count") or 0)
                cm = int(item.get("comments_count") or 0)
                total_likes += lk
                total_comments += cm
                videos.append({
                    "id": item["id"],
                    "platform": "instagram",
                    "title": (item.get("caption") or "Instagram Reel")[:72],
                    "published_at": item.get("timestamp"),
                    "thumbnail_url": item.get("thumbnail_url"),
                    "views": 0,
                    "likes": lk,
                    "comments": cm,
                    "url": item.get("permalink"),
                })

        # Account-level reach/impressions insights
        daily: List[Dict[str, Any]] = []
        since = int((datetime.now(timezone.utc) - timedelta(days=min(days, 30))).timestamp())
        until = int(datetime.now(timezone.utc).timestamp())
        ins_resp = await client.get(
            f"{META_GRAPH_BASE}/{ig_id}/insights",
            params={
                "metric": "reach",
                "period": "day",
                "since": str(since),
                "until": str(until),
                "access_token": token,
            },
        )
        if ins_resp.status_code == 200:
            for m in ins_resp.json().get("data") or []:
                for val in m.get("values") or []:
                    v = int(val.get("value") or 0)
                    total_views += v
                    daily.append({
                        "date": (val.get("end_time") or "")[:10],
                        "views": v,
                    })

    return {
        "platform": "instagram",
        "account_name": account.account_name,
        "account_handle": account.account_handle,
        "api_mode": "graph_api",
        "summary": {
            "views": total_views,
            "likes": total_likes,
            "comments": total_comments,
            "published_count": len(videos),
        },
        "daily": daily,
        "videos": videos[:12],
    }


async def publish_to_youtube(
    account: Any,
    video_source: str,
    title: str,
    description: str,
) -> Dict[str, Any]:
    """Upload a vertical Short to YouTube using YouTube Data API v3 resumable upload."""
    token = await refresh_youtube_token(account)
    if not token:
        raise ValueError("YouTube OAuth access token is required to publish videos (API keys are read-only).")

    video_bytes = await _load_video_bytes(video_source)
    short_title = (title or "RelatiV Short").strip()[:100]
    if "#shorts" not in short_title.lower() and "#shorts" not in (description or "").lower():
        description = f"{description}\n\n#Shorts".strip()

    metadata = {
        "snippet": {
            "title": short_title,
            "description": (description or "")[:5000],
            "categoryId": "22",
        },
        "status": {
            "privacyStatus": "public",
            "selfDeclaredMadeForKids": False,
        },
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        init_resp = await client.post(
            f"{YOUTUBE_UPLOAD_BASE}/videos",
            params={"uploadType": "resumable", "part": "snippet,status"},
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json; charset=UTF-8",
                "X-Upload-Content-Length": str(len(video_bytes)),
                "X-Upload-Content-Type": "video/mp4",
            },
            json=metadata,
        )
        if init_resp.status_code not in (200, 201):
            raise ValueError(f"YouTube upload init failed: {_extract_google_error(init_resp)}")
        upload_url = init_resp.headers.get("Location")
        if not upload_url:
            raise ValueError("YouTube did not return a resumable upload Location header.")

        up_resp = await client.put(
            upload_url,
            headers={"Content-Type": "video/mp4", "Content-Length": str(len(video_bytes))},
            content=video_bytes,
        )
        if up_resp.status_code not in (200, 201):
            raise ValueError(f"YouTube video upload failed: {_extract_google_error(up_resp)}")
        video_id = up_resp.json().get("id")
        return {
            "status": "published",
            "post_id": video_id,
            "post_url": f"https://youtube.com/shorts/{video_id}",
        }


async def publish_to_instagram(
    account: Any,
    video_url: str,
    caption: str,
) -> Dict[str, Any]:
    """Publish an Instagram Reel via Meta Graph API (requires a public HTTPS video_url)."""
    if not account.access_token or not account.platform_account_id:
        raise ValueError("Instagram access token and Business/Creator Account ID are required to publish.")
    if not video_url or not video_url.startswith(("http://", "https://")):
        raise ValueError("Instagram Graph API requires a publicly reachable HTTPS video URL to publish Reels.")

    ig_id = account.platform_account_id
    token = account.access_token

    async with httpx.AsyncClient(timeout=60.0) as client:
        container_resp = await client.post(
            f"{META_GRAPH_BASE}/{ig_id}/media",
            params={
                "media_type": "REELS",
                "video_url": video_url,
                "caption": (caption or "")[:2200],
                "share_to_feed": "true",
                "access_token": token,
            },
        )
        if container_resp.status_code != 200:
            raise ValueError(f"Instagram media container failed: {_extract_meta_error(container_resp)}")
        creation_id = container_resp.json().get("id")

        # Poll container processing status
        for _ in range(20):
            await asyncio.sleep(3)
            st_resp = await client.get(
                f"{META_GRAPH_BASE}/{creation_id}",
                params={"fields": "status_code", "access_token": token},
            )
            if st_resp.status_code == 200:
                code = st_resp.json().get("status_code")
                if code == "FINISHED":
                    break
                if code == "ERROR":
                    raise ValueError("Instagram rejected or failed to process the video container.")

        pub_resp = await client.post(
            f"{META_GRAPH_BASE}/{ig_id}/media_publish",
            params={"creation_id": creation_id, "access_token": token},
        )
        if pub_resp.status_code != 200:
            raise ValueError(f"Instagram publish failed: {_extract_meta_error(pub_resp)}")
        media_id = pub_resp.json().get("id")
        return {
            "status": "published",
            "post_id": media_id,
            "post_url": f"https://www.instagram.com/reel/{media_id}/",
        }


async def execute_scheduled_post(session: Any, post: Any, accounts_by_platform: Dict[str, Any]) -> Dict[str, Any]:
    """Dispatch a scheduled post to its target connected platforms."""
    full_caption = post.caption or ""
    if post.hashtags:
        full_caption = f"{full_caption}\n\n{post.hashtags}".strip()

    results: Dict[str, Any] = {}
    any_success = False
    errors: List[str] = []

    for platform in (post.platforms or []):
        acc = accounts_by_platform.get(platform)
        if not acc:
            results[platform] = {"status": "failed", "error": f"No connected {platform} account"}
            errors.append(f"{platform}: account not connected")
            continue
        try:
            if platform == "youtube":
                res = await publish_to_youtube(acc, post.video_url or "", post.title, full_caption)
                results["youtube"] = res
                any_success = True
            elif platform == "instagram":
                res = await publish_to_instagram(acc, post.video_url or "", full_caption)
                results["instagram"] = res
                any_success = True
            else:
                results[platform] = {"status": "failed", "error": f"Direct API publishing for {platform} not configured"}
                errors.append(f"{platform}: unsupported")
        except Exception as exc:
            results[platform] = {"status": "failed", "error": str(exc)}
            errors.append(f"{platform}: {exc}")

    post.publish_results = results
    post.error_message = "; ".join(errors) if errors else None
    if any_success and not errors:
        post.status = "published"
        post.published_at = utc_now_naive()
    elif any_success:
        post.status = "published"
        post.published_at = utc_now_naive()
    else:
        post.status = "failed"
    post.updated_at = utc_now_naive()
    await session.commit()
    return results


async def _load_video_bytes(video_source: str) -> bytes:
    if not video_source:
        raise ValueError("A video URL or clip file is required to publish.")
    local_path = Path(video_source)
    if local_path.exists() and local_path.is_file():
        return local_path.read_bytes()
    if video_source.startswith(("http://", "https://")):
        async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
            resp = await client.get(video_source)
            if resp.status_code != 200:
                raise ValueError(f"Could not download clip video from URL (HTTP {resp.status_code}).")
            return resp.content
    raise ValueError("Video source is neither an existing local file nor a valid HTTP(S) URL.")


def _extract_google_error(resp: httpx.Response) -> str:
    try:
        data = resp.json()
        return data.get("error", {}).get("message") or resp.text[:200]
    except Exception:
        return resp.text[:200]


def _extract_meta_error(resp: httpx.Response) -> str:
    try:
        data = resp.json()
        return data.get("error", {}).get("message") or resp.text[:200]
    except Exception:
        return resp.text[:200]


def build_google_oauth_url(state: str, redirect_uri: str) -> str:
    client_id, _ = _google_oauth_creds()
    if not client_id:
        raise ValueError("GOOGLE_CLIENT_ID is not configured on the server.")
    scopes = " ".join([
        "https://www.googleapis.com/auth/youtube.upload",
        "https://www.googleapis.com/auth/youtube.readonly",
        "https://www.googleapis.com/auth/yt-analytics.readonly",
    ])
    return (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={quote(client_id)}"
        f"&redirect_uri={quote(redirect_uri)}"
        "&response_type=code"
        f"&scope={quote(scopes)}"
        "&access_type=offline"
        "&prompt=consent"
        f"&state={quote(state)}"
    )


def build_meta_oauth_url(state: str, redirect_uri: str) -> str:
    app_id, _ = _meta_oauth_creds()
    if not app_id:
        raise ValueError("META_APP_ID is not configured on the server.")
    scopes = "instagram_basic,instagram_content_publish,instagram_manage_insights,pages_show_list"
    return (
        "https://www.facebook.com/v20.0/dialog/oauth"
        f"?client_id={quote(app_id)}"
        f"&redirect_uri={quote(redirect_uri)}"
        f"&scope={quote(scopes)}"
        "&response_type=code"
        f"&state={quote(state)}"
    )
