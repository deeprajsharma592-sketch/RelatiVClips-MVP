"""
RelatiVClips Cache API Router

Exposes REST endpoints for cache analytics, URL pre-check, and media pruning.
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from ..database.session import get_session
from .service import get_cached_video, canonicalize_youtube_url
from .storage_manager import get_storage_footprint, prune_expired_media

router = APIRouter(prefix="/cache", tags=["Cache"])


@router.get("/stats")
async def cache_stats(session: AsyncSession = Depends(get_session)):
    """
    Returns real-time database and disk storage metrics, cache hits,
    and cumulative dollar savings.
    """
    return await get_storage_footprint(session)


@router.get("/check")
async def check_url_cached(
    url: str = Query(..., description="YouTube URL to check for cache status"),
    session: AsyncSession = Depends(get_session),
):
    """
    Checks if a YouTube URL is already cached in Supabase PostgreSQL.
    Allows frontend to show an instant 'Instant Clip Ready' indicator before submission.
    """
    canonical_url, video_id = canonicalize_youtube_url(url)
    if not video_id:
        raise HTTPException(status_code=400, detail="Invalid YouTube URL format")

    cached = await get_cached_video(session, url, verify_media=True)
    if cached:
        return {
            "cached": True,
            "video_id": video_id,
            "canonical_url": canonical_url,
            "title": cached.get("title", ""),
            "clip_count": len(cached.get("clips", [])),
            "hit_count": cached.get("_cache_hits_total", 0),
            "savings_usd": cached.get("_cache_savings_usd", 0.0),
            "age_hours": cached.get("_cache_age_hours", 0.0),
        }
    return {
        "cached": False,
        "video_id": video_id,
        "canonical_url": canonical_url,
    }


@router.post("/prune")
async def prune_cache_media(
    retention_days: int = Query(7, ge=1, le=90, description="Delete rendered clips older than this many days"),
    session: AsyncSession = Depends(get_session),
):
    """
    Triggers pruning of expired local media files while keeping
    transcripts and hook intelligence preserved in the database.
    """
    return await prune_expired_media(session, retention_days=retention_days)
