"""
RelatiVClips Caching Package

Provides database caching in Supabase/PostgreSQL, media pruning,
and storage analytics for the RelatiVClips pipeline.
"""

from .models import VideoCacheModel
from .service import (
    canonicalize_youtube_url,
    get_cached_video,
    save_cached_video,
    check_rendered_files_exist,
)
from .storage_manager import (
    get_storage_footprint,
    prune_expired_media,
    get_directory_size_mb,
)
from .router import router as cache_router

__all__ = [
    "VideoCacheModel",
    "canonicalize_youtube_url",
    "get_cached_video",
    "save_cached_video",
    "check_rendered_files_exist",
    "get_storage_footprint",
    "prune_expired_media",
    "get_directory_size_mb",
    "cache_router",
]
