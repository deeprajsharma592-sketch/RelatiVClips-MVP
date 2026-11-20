"""
RelatiVClips Caching Service

Coordinates canonical URL resolution, Supabase/PostgreSQL video cache queries,
hit counter updates, financial savings calculations, and disk media validation.
"""

import logging
import re
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional, Tuple, Dict, Any, List

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from .models import VideoCacheModel
from ..utils.config import OUTPUTS_DIR, FILE_RETENTION_HOURS

log = logging.getLogger("relativ.caching.service")

# Regex to extract 11-char video ID from all YouTube formats
_YOUTUBE_ID_REGEX = re.compile(
    r'(?:v=|\/shorts\/|\/embed\/|youtu\.be\/|\/v\/)([A-Za-z0-9_-]{11})',
    re.IGNORECASE
)


def canonicalize_youtube_url(url: str) -> Tuple[str, Optional[str]]:
    """
    Normalizes any YouTube link variation into an 11-character video ID
    and a canonical URL.
    
    Examples:
      - https://youtu.be/dQw4w9WgXcQ?si=xyz -> (https://www.youtube.com/watch?v=dQw4w9WgXcQ, dQw4w9WgXcQ)
      - https://www.youtube.com/shorts/dQw4w9WgXcQ -> (https://www.youtube.com/watch?v=dQw4w9WgXcQ, dQw4w9WgXcQ)
      - https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s -> (https://www.youtube.com/watch?v=dQw4w9WgXcQ, dQw4w9WgXcQ)
    """
    clean_url = (url or "").strip()
    match = _YOUTUBE_ID_REGEX.search(clean_url)
    if match:
        video_id = match.group(1)
        canonical_url = f"https://www.youtube.com/watch?v={video_id}"
        return canonical_url, video_id
    
    # Non-standard or fallback
    return clean_url, None


def check_rendered_files_exist(clips: List[Dict[str, Any]]) -> bool:
    """
    Verifies that the rendered .mp4 files referenced in clip records
    actually exist on disk and are not 0-byte corrupt files.
    """
    if not clips:
        return False
        
    for c in clips:
        # Check if duration matches standard short-form (> 20s)
        start = float(c.get("start", 0))
        end = float(c.get("end", 0))
        if (end - start) < 15.0:
            return False
            
        fp = c.get("file_path")
        dl = c.get("download_url", "")
        fname = dl.split("/")[-1] if dl else ""
        
        candidates = [
            Path(fp) if fp else None,
            OUTPUTS_DIR / fname if fname else None,
            OUTPUTS_DIR / f"{fname}.mp4" if fname else None,
        ]
        
        file_valid = any(
            p and p.exists() and p.is_file() and p.stat().st_size > 1024
            for p in candidates
        )
        if not file_valid:
            return False
            
    return True


async def get_cached_video(
    session: Optional[AsyncSession],
    url: str,
    verify_media: bool = True,
) -> Optional[Dict[str, Any]]:
    """
    Queries the database cache for a previously processed YouTube video.
    If found and valid:
      - Increments hit count
      - Tracks cumulative USD savings
      - Updates last_accessed_at timestamp
      - Returns cached clips and intelligence payload in ~0.05s
    """
    canonical_url, video_id = canonicalize_youtube_url(url)
    if not video_id:
        return None

    # 1. Try Supabase / PostgreSQL cache if session is active
    if session is not None:
        try:
            stmt = select(VideoCacheModel).where(VideoCacheModel.video_id == video_id)
            result = await session.execute(stmt)
            entry = result.scalar_one_or_none()

            if entry and entry.selected_clips:
                clips = entry.selected_clips
                
                # Check rendered video media on disk
                has_media = True
                if verify_media:
                    has_media = check_rendered_files_exist(clips)
                    if not has_media:
                        entry.media_expired = True
                        await session.commit()
                        log.info(f"[DB_CACHE] Video {video_id} clips expired from disk, needs re-render")
                        return None

                # Compute cache age
                now = datetime.now(timezone.utc)
                created_at = entry.created_at
                if created_at.tzinfo is None:
                    created_at = created_at.replace(tzinfo=timezone.utc)
                age_hours = (now - created_at).total_seconds() / 3600.0

                # Record hit metrics in database
                entry.hit_count += 1
                savings = float(entry.llm_cost_usd or 0.0)
                entry.total_savings_usd += savings
                entry.last_accessed_at = now
                await session.commit()

                log.info(
                    f"[DB_CACHE] HIT video={video_id} hits={entry.hit_count} "
                    f"saved=${savings:.4f} age={age_hours:.1f}h"
                )

                # Format response payload matching pipeline output
                return {
                    "task_id": None,
                    "video_id": video_id,
                    "canonical_url": canonical_url,
                    "title": entry.title,
                    "channel": entry.channel,
                    "clips": clips,
                    "transcript_data": entry.transcript_data,
                    "audio_analysis": entry.audio_analysis_data,
                    "candidate_moments": entry.candidate_moments,
                    "llm_cost_usd": 0.0,
                    "cost_per_clip_usd": 0.0,
                    "llm_provider": "database_cache",
                    "llm_model": entry.llm_model,
                    "archetype": entry.archetype,
                    "_cache_hit": True,
                    "_cache_age_hours": round(age_hours, 1),
                    "_cache_savings_usd": savings,
                    "_cache_hits_total": entry.hit_count,
                    "_lifetime_savings_usd": round(entry.total_savings_usd, 4),
                }

        except Exception as e:
            log.warning(f"[DB_CACHE] Supabase query failed, falling back: {e}")

    # 2. Secondary fallback: check local file cache if DB unavailable
    try:
        from ..pipeline.cache import get_cached_result
        local_hit = get_cached_result(url, verify_files=verify_media)
        if local_hit and local_hit.get("clips"):
            local_hit["_cache_source"] = "local_file"
            return local_hit
    except Exception as e:
        log.debug(f"[DB_CACHE] Local file fallback check error: {e}")

    return None


async def save_cached_video(
    session: Optional[AsyncSession],
    url: str,
    pipeline_result: Dict[str, Any],
    media_ttl_days: int = 7,
) -> bool:
    """
    Saves or updates a video's full intelligence and clips in Supabase / PostgreSQL.
    """
    canonical_url, video_id = canonicalize_youtube_url(url)
    if not video_id:
        return False

    clips = pipeline_result.get("clips", [])
    if not clips:
        return False

    saved_db = False

    if session is not None:
        try:
            stmt = select(VideoCacheModel).where(VideoCacheModel.video_id == video_id)
            result = await session.execute(stmt)
            entry = result.scalar_one_or_none()

            now = datetime.now(timezone.utc)
            expires_at = now + timedelta(days=media_ttl_days)

            llm_cost = float(pipeline_result.get("llm_cost_usd", 0.0) or 0.0)
            llm_model = pipeline_result.get("llm_model") or pipeline_result.get("model")
            llm_prov = pipeline_result.get("llm_provider") or "llm"
            archetype = pipeline_result.get("archetype")

            # Clean clips structure (strip internal unpicklable objects)
            clean_clips = []
            for c in clips:
                clean_c = {k: v for k, v in c.items() if not k.startswith("_")}
                clean_clips.append(clean_c)

            if entry:
                entry.canonical_url = canonical_url
                entry.title = pipeline_result.get("title") or entry.title
                entry.channel = pipeline_result.get("channel") or entry.channel
                entry.duration_s = float(pipeline_result.get("duration", entry.duration_s) or 0.0)
                entry.thumbnail_url = pipeline_result.get("thumbnail_url") or entry.thumbnail_url
                entry.transcript_data = pipeline_result.get("transcript_data") or pipeline_result.get("transcript")
                entry.audio_analysis_data = pipeline_result.get("audio_analysis") or pipeline_result.get("audio_moments")
                entry.candidate_moments = pipeline_result.get("candidate_moments")
                entry.selected_clips = clean_clips
                entry.rendered_clips_data = clean_clips
                entry.media_expired = False
                entry.media_expires_at = expires_at
                entry.llm_cost_usd = llm_cost
                entry.llm_provider = llm_prov
                entry.llm_model = llm_model
                entry.archetype = archetype
                entry.last_accessed_at = now
            else:
                entry = VideoCacheModel(
                    video_id=video_id,
                    canonical_url=canonical_url,
                    title=pipeline_result.get("title", ""),
                    channel=pipeline_result.get("channel", ""),
                    duration_s=float(pipeline_result.get("duration", 0.0) or 0.0),
                    thumbnail_url=pipeline_result.get("thumbnail_url"),
                    transcript_data=pipeline_result.get("transcript_data") or pipeline_result.get("transcript"),
                    audio_analysis_data=pipeline_result.get("audio_analysis") or pipeline_result.get("audio_moments"),
                    candidate_moments=pipeline_result.get("candidate_moments"),
                    selected_clips=clean_clips,
                    rendered_clips_data=clean_clips,
                    media_expired=False,
                    hit_count=0,
                    total_savings_usd=0.0,
                    llm_cost_usd=llm_cost,
                    llm_provider=llm_prov,
                    llm_model=llm_model,
                    archetype=archetype,
                    created_at=now,
                    last_accessed_at=now,
                    media_expires_at=expires_at,
                )
                session.add(entry)

            await session.commit()
            saved_db = True
            log.info(f"[DB_CACHE] Saved video {video_id} to Supabase PostgreSQL ({len(clean_clips)} clips)")
        except Exception as e:
            log.error(f"[DB_CACHE] Failed to save video {video_id} to database: {e}")

    # Also save to secondary file cache
    try:
        from ..pipeline.cache import save_result_cache
        save_result_cache(url, pipeline_result)
    except Exception as e:
        log.debug(f"[DB_CACHE] Failed to save secondary file cache: {e}")

    return saved_db
