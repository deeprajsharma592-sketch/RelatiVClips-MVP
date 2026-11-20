"""
RelatiVClips Storage & Lifecycle Manager

Calculates real-time database and disk storage footprint,
tracks cumulative dollar savings, and prunes expired media files
while keeping transcripts and LLM intelligence preserved.
"""

import logging
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Dict, Any, Optional

from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from .models import VideoCacheModel
from ..utils.config import OUTPUTS_DIR, CACHE_DIR

log = logging.getLogger("relativ.caching.storage")


def get_directory_size_mb(directory: Path) -> float:
    """Calculates total disk usage of a directory in Megabytes."""
    if not directory.exists():
        return 0.0
    total_bytes = 0
    try:
        for entry in directory.rglob("*"):
            if entry.is_file():
                try:
                    total_bytes += entry.stat().st_size
                except OSError:
                    pass
    except Exception as e:
        log.warning(f"Error calculating size for {directory}: {e}")
    return round(total_bytes / (1024.0 * 1024.0), 2)


async def get_storage_footprint(session: Optional[AsyncSession]) -> Dict[str, Any]:
    """
    Returns full diagnostics on storage consumption across:
      1. PostgreSQL Database (row counts, estimated TOAST bytes, savings)
      2. Local Media Disk (rendered clips, surgical segments)
    """
    db_videos_count = 0
    total_hits = 0
    total_savings_usd = 0.0
    db_estimated_mb = 0.0

    if session is not None:
        try:
            stmt = select(
                func.count(VideoCacheModel.id),
                func.coalesce(func.sum(VideoCacheModel.hit_count), 0),
                func.coalesce(func.sum(VideoCacheModel.total_savings_usd), 0.0),
            )
            result = await session.execute(stmt)
            count, hits, savings = result.one()
            db_videos_count = count or 0
            total_hits = int(hits or 0)
            total_savings_usd = round(float(savings or 0.0), 4)

            # Average compressed TOAST footprint is ~65 KB per video
            db_estimated_mb = round((db_videos_count * 65.0) / 1024.0, 2)
        except Exception as e:
            log.warning(f"Failed to query database storage metrics: {e}")

    # Measure disk usage
    outputs_mb = get_directory_size_mb(OUTPUTS_DIR)
    cache_dir_mb = get_directory_size_mb(CACHE_DIR)

    return {
        "database": {
            "cached_videos_count": db_videos_count,
            "estimated_storage_mb": db_estimated_mb,
            "total_cache_hits": total_hits,
            "total_savings_usd": total_savings_usd,
            "supabase_free_tier_capacity_pct": round((db_estimated_mb / 500.0) * 100.0, 2),
            "videos_until_supabase_500mb_limit": max(0, int((500.0 * 1024.0) / 65.0) - db_videos_count),
        },
        "disk": {
            "rendered_clips_mb": outputs_mb,
            "segments_cache_mb": cache_dir_mb,
            "total_media_mb": round(outputs_mb + cache_dir_mb, 2),
        },
        "status": "healthy",
    }


async def prune_expired_media(
    session: Optional[AsyncSession],
    retention_days: int = 7,
) -> Dict[str, Any]:
    """
    Prunes expired rendered MP4 video files to free local disk space.
    Transcripts, acoustic peaks, and viral hook data remain intact in the database.
    """
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=retention_days)
    
    files_deleted = 0
    bytes_freed = 0
    records_updated = 0

    if session is not None:
        try:
            # Find candidate records where media has expired or exceeded retention
            stmt = select(VideoCacheModel).where(
                (VideoCacheModel.media_expires_at < now) |
                (VideoCacheModel.created_at < cutoff),
                VideoCacheModel.media_expired == False,
            )
            result = await session.execute(stmt)
            candidates = result.scalars().all()

            for entry in candidates:
                clips = entry.selected_clips or []
                for clip in clips:
                    fp = clip.get("file_path")
                    dl = clip.get("download_url", "")
                    fname = dl.split("/")[-1] if dl else ""
                    
                    for candidate_path in [
                        Path(fp) if fp else None,
                        OUTPUTS_DIR / fname if fname else None,
                        OUTPUTS_DIR / f"{fname}.mp4" if fname else None,
                    ]:
                        if candidate_path and candidate_path.exists() and candidate_path.is_file():
                            try:
                                sz = candidate_path.stat().st_size
                                candidate_path.unlink()
                                files_deleted += 1
                                bytes_freed += sz
                            except OSError as err:
                                log.warning(f"Could not delete expired clip {candidate_path}: {err}")

                entry.media_expired = True
                records_updated += 1

            await session.commit()
            log.info(
                f"[PRUNE] Cleaned {files_deleted} expired media files, "
                f"freed {bytes_freed / (1024*1024):.1f} MB, updated {records_updated} DB records"
            )
        except Exception as e:
            log.error(f"[PRUNE] Pruning routine encountered error: {e}")

    return {
        "files_deleted": files_deleted,
        "mb_freed": round(bytes_freed / (1024.0 * 1024.0), 2),
        "db_records_updated": records_updated,
        "pruned_at": now.isoformat(),
    }
