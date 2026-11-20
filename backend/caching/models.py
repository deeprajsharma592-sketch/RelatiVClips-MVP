"""
RelatiVClips Database Caching Models (Supabase / PostgreSQL)

Stores canonical video intelligence (word-level transcripts, acoustic peaks,
LLM viral hook selections) and rendered clip pointers so repeat submissions
of identical YouTube URLs return in ~0.05s with $0.00 compute/LLM cost.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from sqlalchemy import String, Float, Integer, DateTime, JSON, Text, Boolean, Index
from sqlalchemy.orm import Mapped, mapped_column

from ..database.base import Base


class VideoCacheModel(Base):
    """
    Persistent video intelligence & clip cache.
    Keyed by canonical 11-char YouTube video ID so all URL variants
    (shorts, youtu.be, embed, query params) share the same record.
    """
    __tablename__ = "video_cache"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    video_id: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    canonical_url: Mapped[str] = mapped_column(String(500), index=True, nullable=False)

    # Video Metadata
    title: Mapped[str] = mapped_column(String(300), default="")
    channel: Mapped[str] = mapped_column(String(200), default="")
    duration_s: Mapped[float] = mapped_column(Float, default=0.0)
    thumbnail_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Intelligence Layers (stored in JSON/JSONB with native Postgres TOAST compression)
    transcript_data: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    audio_analysis_data: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    candidate_moments: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSON, nullable=True)
    selected_clips: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSON, nullable=True)

    # Rendered Media References
    rendered_clips_data: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSON, nullable=True)
    media_expired: Mapped[bool] = mapped_column(Boolean, default=False)

    # Operational & Financial Metrics
    hit_count: Mapped[int] = mapped_column(Integer, default=0)
    total_savings_usd: Mapped[float] = mapped_column(Float, default=0.0)
    llm_cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    llm_provider: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    llm_model: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    archetype: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Lifecycle Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    last_accessed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    media_expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    def to_dict(self) -> Dict[str, Any]:
        """Convert model to dictionary for API responses."""
        return {
            "id": self.id,
            "video_id": self.video_id,
            "canonical_url": self.canonical_url,
            "title": self.title,
            "channel": self.channel,
            "duration_s": self.duration_s or 0.0,
            "thumbnail_url": self.thumbnail_url,
            "clips": self.selected_clips or [],
            "rendered_clips": self.rendered_clips_data or [],
            "media_expired": self.media_expired or False,
            "hit_count": self.hit_count or 0,
            "total_savings_usd": round(float(self.total_savings_usd or 0.0), 4),
            "llm_cost_usd": float(self.llm_cost_usd or 0.0),
            "llm_provider": self.llm_provider,
            "llm_model": self.llm_model,
            "archetype": self.archetype,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_accessed_at": self.last_accessed_at.isoformat() if self.last_accessed_at else None,
            "media_expires_at": self.media_expires_at.isoformat() if self.media_expires_at else None,
        }
