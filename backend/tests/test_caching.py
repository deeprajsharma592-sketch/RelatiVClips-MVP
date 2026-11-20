"""
Tests for RelatiVClips Database Caching System
(backend/caching package)
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone, timedelta
from pathlib import Path

from backend.caching import (
    canonicalize_youtube_url,
    get_cached_video,
    save_cached_video,
    check_rendered_files_exist,
    get_storage_footprint,
    prune_expired_media,
    get_directory_size_mb,
    VideoCacheModel,
)


def test_canonicalize_youtube_url_variations():
    """Verify that all YouTube URL formats resolve to the exact same 11-char video ID."""
    test_cases = [
        ("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s&feature=share", "dQw4w9WgXcQ"),
        ("http://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://youtu.be/dQw4w9WgXcQ?si=abcdef123456", "dQw4w9WgXcQ"),
        ("https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://youtube.com/shorts/dQw4w9WgXcQ?feature=share", "dQw4w9WgXcQ"),
        ("https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://m.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("  https://youtu.be/dQw4w9WgXcQ  ", "dQw4w9WgXcQ"),
    ]

    for raw_url, expected_id in test_cases:
        canonical_url, video_id = canonicalize_youtube_url(raw_url)
        assert video_id == expected_id, f"Failed for {raw_url}: got {video_id}, expected {expected_id}"
        assert canonical_url == f"https://www.youtube.com/watch?v={expected_id}"

    # Non-YouTube URL should return None for video_id
    fallback_url, fallback_id = canonicalize_youtube_url("https://vimeo.com/123456789")
    assert fallback_id is None
    assert fallback_url == "https://vimeo.com/123456789"


def test_video_cache_model_initialization():
    """Verify VideoCacheModel properties and to_dict serialization."""
    model = VideoCacheModel(
        video_id="testVideo123",
        canonical_url="https://www.youtube.com/watch?v=testVideo123",
        title="Test Podcast Episode #1",
        channel="Acme Media",
        duration_s=1200.0,
        thumbnail_url="https://img.youtube.com/vi/testVideo123/hqdefault.jpg",
        transcript_data={"words": [{"word": "hello", "start": 0.0, "end": 0.5}]},
        audio_analysis_data={"peaks": [12.4, 45.8]},
        candidate_moments=[{"start": 10.0, "end": 40.0, "score": 92}],
        selected_clips=[{
            "start": 10.0,
            "end": 40.0,
            "viral_title": "The Big Reveal",
            "caption": "Why nobody saw this coming...",
        }],
        llm_cost_usd=0.0052,
        llm_provider="claude-3-5-haiku-20241022",
        archetype="podcast",
    )

    data = model.to_dict()
    assert data["video_id"] == "testVideo123"
    assert data["title"] == "Test Podcast Episode #1"
    assert len(data["clips"]) == 1
    assert data["clips"][0]["viral_title"] == "The Big Reveal"
    assert data["llm_cost_usd"] == 0.0052
    assert data["hit_count"] == 0
    assert data["total_savings_usd"] == 0.0


def test_check_rendered_files_exist_validation(tmp_path):
    """Verify that check_rendered_files_exist catches missing vs valid files."""
    # Empty clips list
    assert check_rendered_files_exist([]) is False

    # Clips too short (< 15s)
    short_clips = [{"start": 0.0, "end": 5.0, "file_path": "dummy.mp4"}]
    assert check_rendered_files_exist(short_clips) is False

    # Valid duration but file does not exist
    non_existent = [{
        "start": 10.0,
        "end": 45.0,
        "file_path": str(tmp_path / "does_not_exist.mp4")
    }]
    assert check_rendered_files_exist(non_existent) is False

    # Valid duration and real file with content (> 1024 bytes)
    real_file = tmp_path / "valid_clip.mp4"
    real_file.write_bytes(b"0" * 2048)

    valid_clips = [{
        "start": 10.0,
        "end": 45.0,
        "file_path": str(real_file)
    }]
    assert check_rendered_files_exist(valid_clips) is True


@pytest.mark.asyncio
async def test_get_cached_video_hit_flow():
    """Verify get_cached_video increments hit_count and tracks dollar savings."""
    mock_session = AsyncMock()
    now = datetime.now(timezone.utc)

    mock_entry = VideoCacheModel(
        video_id="hitTest1234",
        canonical_url="https://www.youtube.com/watch?v=hitTest1234",
        title="Cached Podcast",
        channel="Top Creator",
        selected_clips=[{
            "start": 0.0,
            "end": 35.0,
            "viral_title": "Epic Hook",
        }],
        llm_cost_usd=0.0050,
        hit_count=3,
        total_savings_usd=0.0150,
        created_at=now - timedelta(hours=2),
        last_accessed_at=now - timedelta(hours=1),
    )

    # Setup mock query execution
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_entry
    mock_session.execute.return_value = mock_result

    # Run without requiring local disk media check
    cached = await get_cached_video(
        session=mock_session,
        url="https://youtu.be/hitTest1234",
        verify_media=False,
    )

    assert cached is not None
    assert cached["_cache_hit"] is True
    assert cached["video_id"] == "hitTest1234"
    assert cached["_cache_savings_usd"] == 0.0050
    assert cached["_cache_hits_total"] == 4  # incremented from 3
    assert cached["_lifetime_savings_usd"] == 0.0200  # 0.0150 + 0.0050
    assert mock_session.commit.called


@pytest.mark.asyncio
async def test_save_cached_video_flow():
    """Verify save_cached_video stores new video intelligence and clips."""
    mock_session = AsyncMock()
    mock_session.add = MagicMock()

    # Video does not exist initially
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_session.execute.return_value = mock_result

    pipeline_result = {
        "title": "Brand New Video",
        "channel": "Tech Insider",
        "duration": 1800.0,
        "llm_cost_usd": 0.0068,
        "llm_provider": "claude-3-5-haiku",
        "archetype": "educational",
        "clips": [{
            "start": 60.0,
            "end": 95.0,
            "file_path": "outputs/clip_1.mp4",
            "viral_title": "The Secret Formula",
        }],
    }

    saved = await save_cached_video(
        session=mock_session,
        url="https://www.youtube.com/watch?v=saveTest1234",
        pipeline_result=pipeline_result,
        media_ttl_days=7,
    )

    assert saved is True
    assert mock_session.add.called
    assert mock_session.commit.called


@pytest.mark.asyncio
async def test_storage_footprint_calculation():
    """Verify get_storage_footprint calculates database and disk metrics."""
    mock_session = AsyncMock()

    # Mock count=100, hits=250, savings=$1.25
    mock_result = MagicMock()
    mock_result.one.return_value = (100, 250, 1.25)
    mock_session.execute.return_value = mock_result

    metrics = await get_storage_footprint(mock_session)

    assert metrics["status"] == "healthy"
    db_metrics = metrics["database"]
    assert db_metrics["cached_videos_count"] == 100
    assert db_metrics["total_cache_hits"] == 250
    assert db_metrics["total_savings_usd"] == 1.25
    # 100 videos * 65 KB / 1024 = 6.35 MB
    assert db_metrics["estimated_storage_mb"] == 6.35
    assert db_metrics["supabase_free_tier_capacity_pct"] > 0


@pytest.mark.asyncio
async def test_prune_expired_media(tmp_path):
    """Verify that prune_expired_media deletes old local files and updates DB status."""
    mock_session = AsyncMock()

    # Create dummy video file to be pruned
    dummy_clip = tmp_path / "old_clip.mp4"
    dummy_clip.write_bytes(b"x" * 4096)
    assert dummy_clip.exists()

    entry = VideoCacheModel(
        video_id="pruneTest12",
        canonical_url="https://www.youtube.com/watch?v=pruneTest12",
        selected_clips=[{"file_path": str(dummy_clip)}],
        media_expired=False,
    )

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [entry]
    mock_session.execute.return_value = mock_result

    res = await prune_expired_media(mock_session, retention_days=1)

    assert res["files_deleted"] == 1
    assert res["db_records_updated"] == 1
    assert not dummy_clip.exists()
    assert entry.media_expired is True
    assert mock_session.commit.called

