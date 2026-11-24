from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from backend.routers import socials_router
from backend.services.social_publishing import format_compact_count


def test_oauth_state_roundtrip():
    state = socials_router._sign_state("user-42", "youtube")
    uid, plat = socials_router._verify_state(state)
    assert uid == "user-42"
    assert plat == "youtube"

    with pytest.raises(HTTPException):
        socials_router._verify_state(state + "tamper")


def test_format_compact_count():
    assert format_compact_count(48200, " subscribers") == "48.2K subscribers"
    assert format_compact_count(1500000, " followers") == "1.5M followers"
    assert format_compact_count(95) == "95"


def test_serialize_account_and_post():
    acc = SimpleNamespace(
        id="acc-1",
        platform="youtube",
        platform_account_id="UC123",
        account_name="Creator",
        account_handle="@creator",
        followers_text="10.0K subscribers",
        avatar_url=None,
        auto_publish=True,
        access_token=None,
        api_key="AIzaTest",
        created_at=datetime(2026, 11, 25, tzinfo=timezone.utc),
    )
    ser = socials_router._serialize_account(acc)
    assert ser["has_api_key"] is True
    assert ser["has_oauth"] is False
    assert ser["can_publish"] is False

    post = SimpleNamespace(
        id="post-1",
        clip_id="clip-1",
        video_url="https://example.com/clip.mp4",
        title="Test Short",
        caption="Hello",
        hashtags="#shorts",
        platforms=["youtube", "instagram"],
        scheduled_at=datetime(2026, 11, 26, 18, 30),
        timezone_name="UTC",
        status="scheduled",
        publish_results=None,
        error_message=None,
        published_at=None,
        created_at=datetime(2026, 11, 25, 10, 0),
    )
    ser_post = socials_router._serialize_post(post)
    assert ser_post["status"] == "scheduled"
    assert ser_post["platforms"] == ["youtube", "instagram"]
    assert ser_post["scheduled_at"].endswith("+00:00")
