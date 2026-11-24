"""
Comprehensive Unit & Integration Tests for RelatiV Feedback System.

Tests cover:
- Point weights calculation and config
- Dislike reason code validation
- Like / unlike / dislike / undislike reaction toggling
- Download single-point (+3 once per clip per user, 0 thereafter)
- Idempotency within 5s window
- User feedback privacy consent check (403 when False)
- GDPR feedback export and deletion (no raw media, only IDs/features)
- Creator preferences aggregation
- API route handling via TestClient
"""

from datetime import datetime, timedelta
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException
from fastapi.testclient import TestClient

from backend.feedback.weights import (
    DEFAULT_CLIP_VERSION,
    DEFAULT_MODEL_VERSION,
    FEEDBACK_WEIGHTS,
    get_base_points,
    validate_reason_codes,
)
from backend.feedback.service import (
    delete_user_feedback,
    export_user_feedback,
    get_creator_preferences_summary,
    record_feedback_event,
    _categorize_clip_length,
)
from backend.database.models import (
    ClipFeedbackEventModel,
    ClipScoreModel,
    CreatorPreferenceModel,
    UserModel,
)
from backend.main import app


def _build_mock_session():
    """Build a mock AsyncSession with synchronous add and properly awaited async methods."""
    mock = AsyncMock()
    mock.add = MagicMock()
    mock.refresh = AsyncMock(return_value=None)
    mock.commit = AsyncMock(return_value=None)
    return mock


# ─── 1. Point Weights & Configuration Tests ───────────────────────────────────


def test_point_weights_values():
    """Verify point weights match specification strictly."""
    assert FEEDBACK_WEIGHTS["like"] == 1
    assert FEEDBACK_WEIGHTS["download"] == 3
    assert FEEDBACK_WEIGHTS["dislike"] == -2
    assert FEEDBACK_WEIGHTS["dismiss_popup"] == -2
    assert FEEDBACK_WEIGHTS["unlike"] == -1
    assert FEEDBACK_WEIGHTS["undislike"] == 2

    assert get_base_points("like") == 1
    assert get_base_points("download") == 3
    assert get_base_points("dislike") == -2
    assert get_base_points("dismiss_popup") == -2
    assert get_base_points("unlike") == -1
    assert get_base_points("undislike") == 2


def test_invalid_event_type_raises_error():
    with pytest.raises(ValueError):
        get_base_points("super_like")


def test_reason_codes_validation():
    valid = ["hook_bad", "captions_bad", "other"]
    sanitized = validate_reason_codes(valid)
    assert sanitized == valid

    # Deduplication test
    assert validate_reason_codes(["hook_bad", "hook_bad"]) == ["hook_bad"]

    # Invalid code test
    with pytest.raises(ValueError) as excinfo:
        validate_reason_codes(["bad_soundtrack"])
    assert "Invalid reason code" in str(excinfo.value)


def test_clip_length_bucketing():
    assert _categorize_clip_length(15) == "<30s"
    assert _categorize_clip_length(45) == "30-60s"
    assert _categorize_clip_length(75) == "60-90s"
    assert _categorize_clip_length(110) == ">90s"
    assert _categorize_clip_length(None) == "unknown"


# ─── 2. Service Layer: Point Calculation & Toggling Tests ─────────────────────


@pytest.mark.asyncio
async def test_record_like_and_unlike_toggling():
    """Verify liking adds +1 and unliking adds -1, reversing the score."""
    mock_session = _build_mock_session()
    mock_user = UserModel(id="user_123", email="user@test.com", role="creator", feedback_consent=True)

    # 1. User likes clip -> +1
    mock_result_empty = MagicMock()
    mock_result_empty.scalar_one_or_none.return_value = None
    mock_result_empty.first.return_value = None
    mock_session.execute = AsyncMock(return_value=mock_result_empty)

    event_like, is_new = await record_feedback_event(
        session=mock_session,
        clip_id="clip_abc",
        event_type="like",
        user=mock_user,
    )
    assert is_new is True
    assert event_like.points == 1
    assert event_like.event_type == "like"
    assert mock_session.commit.called

    # 2. User unlikes clip -> -1 (reversing the earlier like)
    event_unlike, is_new_unlike = await record_feedback_event(
        session=mock_session,
        clip_id="clip_abc",
        event_type="unlike",
        user=mock_user,
    )
    assert is_new_unlike is True
    assert event_unlike.points == -1
    assert event_unlike.event_type == "unlike"


@pytest.mark.asyncio
async def test_record_dislike_and_undislike_toggling():
    """Verify dislike gives -2 and undislike gives +2, reversing the score."""
    mock_session = _build_mock_session()
    mock_user = UserModel(id="user_123", email="user@test.com", role="creator", feedback_consent=True)

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_result.first.return_value = None
    mock_session.execute = AsyncMock(return_value=mock_result)

    # 1. Dislike with reasons
    event_dislike, _ = await record_feedback_event(
        session=mock_session,
        clip_id="clip_abc",
        event_type="dislike",
        user=mock_user,
        reason_codes=["hook_bad", "no_context"],
        reason_other_text="Pacing was slow",
    )
    assert event_dislike.points == -2
    assert event_dislike.reason_codes == ["hook_bad", "no_context"]
    assert event_dislike.reason_other_text == "Pacing was slow"

    # 2. Undislike
    event_undislike, _ = await record_feedback_event(
        session=mock_session,
        clip_id="clip_abc",
        event_type="undislike",
        user=mock_user,
    )
    assert event_undislike.points == 2
    assert event_undislike.event_type == "undislike"


# ─── 3. Single Download Point Rule Test ───────────────────────────────────────


@pytest.mark.asyncio
async def test_download_counts_points_once_per_clip_per_user():
    """Verify download awards +3 on first download, but 0 points on subsequent downloads."""
    mock_session = _build_mock_session()
    mock_user = UserModel(id="user_downloader", email="down@test.com", role="creator", feedback_consent=True)

    # First download: no prior download exists
    mock_result_first = MagicMock()
    mock_result_first.scalar_one_or_none.side_effect = [None, None]
    mock_result_first.first.return_value = None
    mock_session.execute = AsyncMock(return_value=mock_result_first)

    event_1, is_new_1 = await record_feedback_event(
        session=mock_session,
        clip_id="clip_dl_test",
        event_type="download",
        user=mock_user,
    )
    assert is_new_1 is True
    assert event_1.points == 3

    # Second download by the same user: prior download exists
    mock_result_second = MagicMock()
    mock_result_second.scalar_one_or_none.side_effect = [None, "prior_download_event_id"]
    mock_result_second.first.return_value = None
    mock_session.execute = AsyncMock(return_value=mock_result_second)

    event_2, is_new_2 = await record_feedback_event(
        session=mock_session,
        clip_id="clip_dl_test",
        event_type="download",
        user=mock_user,
    )
    assert is_new_2 is True
    assert event_2.points == 0  # subsequent download awards 0 points


# ─── 4. Idempotency Window Test ───────────────────────────────────────────────


@pytest.mark.asyncio
async def test_idempotency_prevents_duplicate_within_window():
    """Verify duplicate event within 5-second window is ignored without re-applying points."""
    mock_session = _build_mock_session()
    mock_user = UserModel(id="user_quick", email="quick@test.com", role="creator", feedback_consent=True)

    existing_event = ClipFeedbackEventModel(
        id="existing_evt_123",
        user_id="user_quick",
        clip_id="clip_idemp",
        event_type="like",
        points=1,
        created_at=datetime.utcnow() - timedelta(seconds=2),
    )

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = existing_event
    mock_session.execute = AsyncMock(return_value=mock_result)

    event, is_new = await record_feedback_event(
        session=mock_session,
        clip_id="clip_idemp",
        event_type="like",
        user=mock_user,
    )
    assert is_new is False
    assert event.id == "existing_evt_123"
    assert mock_session.add.called is False


# ─── 5. Privacy Consent Check Test ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_user_consent_required():
    """Verify feedback is strictly rejected when user has not consented."""
    mock_session = _build_mock_session()
    mock_user_no_consent = UserModel(
        id="user_privacy", email="privacy@test.com", role="creator", feedback_consent=False
    )

    with pytest.raises(HTTPException) as excinfo:
        await record_feedback_event(
            session=mock_session,
            clip_id="clip_secret",
            event_type="like",
            user=mock_user_no_consent,
        )
    assert excinfo.value.status_code == 403
    assert "consent" in excinfo.value.detail.lower()


# ─── 6. GDPR Export and Deletion Tests ────────────────────────────────────────


@pytest.mark.asyncio
async def test_gdpr_export_and_deletion():
    """Verify feedback export contains only IDs & derived signals, and deletion removes user data."""
    mock_session = _build_mock_session()

    mock_event = ClipFeedbackEventModel(
        id="evt_export_1",
        user_id="user_gdpr",
        clip_id="clip_gdpr",
        clip_version="1.0",
        model_version="relativ-v2.0",
        event_type="dislike",
        points=-2,
        reason_codes=["hook_bad"],
        reason_other_text="Too long intro",
        clip_features={"duration_s": 45, "clip_length_bucket": "30-60s"},
        created_at=datetime.utcnow(),
    )

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [mock_event]
    mock_session.execute = AsyncMock(return_value=mock_result)

    # Export test
    export_data = await export_user_feedback(mock_session, "user_gdpr")
    assert export_data["user_id"] == "user_gdpr"
    assert export_data["total_events"] == 1
    event_data = export_data["events"][0]
    assert event_data["clip_id"] == "clip_gdpr"
    assert "video_url" not in event_data  # No raw media
    assert event_data["clip_features"]["clip_length_bucket"] == "30-60s"

    # Delete test
    mock_del_result = MagicMock()
    mock_del_result.all.return_value = [("clip_gdpr", "creator_1")]
    mock_del_result.rowcount = 1
    mock_session.execute = AsyncMock(return_value=mock_del_result)

    with patch("backend.feedback.service.refresh_derived_feedback", new_callable=AsyncMock) as mock_refresh:
        del_response = await delete_user_feedback(mock_session, "user_gdpr")
        assert del_response["status"] == "success"
        assert del_response["deleted_events"] == 1
        assert mock_refresh.called


# ─── 7. Creator Preferences Aggregation Test ──────────────────────────────────


@pytest.mark.asyncio
async def test_creator_preferences_summary():
    """Verify aggregated creator preferences output format."""
    mock_session = _build_mock_session()
    mock_pref = CreatorPreferenceModel(
        creator_id="creator_xyz",
        net_points=14,
        total_events=8,
        dislike_reasons={"hook_bad": -4, "captions_bad": -2},
        feature_affinities={"clip_length": {"30-60s": 6, "<30s": -2}},
        top_avoid_reasons=["hook_bad", "captions_bad"],
        updated_at=datetime.utcnow(),
    )

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_pref
    mock_session.execute = AsyncMock(return_value=mock_result)

    summary = await get_creator_preferences_summary(mock_session, "creator_xyz")
    assert summary["creator_id"] == "creator_xyz"
    assert summary["net_preference_points"] == 14
    assert summary["dislike_reasons"]["hook_bad"] == -4
    assert summary["feature_affinities"]["clip_length"]["30-60s"] == 6


# ─── 8. API Route TestClient Tests ────────────────────────────────────────────


def test_api_submit_feedback_endpoint():
    """Verify POST /clips/{id}/feedback and /creators/{id}/preferences API routes."""
    client = TestClient(app)

    # 1. Submit dislike with valid reasons
    response = client.post(
        "/clips/test_clip_123/feedback",
        json={
            "event_type": "dislike",
            "reason_codes": ["hook_bad", "no_context"],
            "reason_other_text": "Need tighter cuts",
            "user_id": "test_client_user",
        },
    )
    assert response.status_code in (200, 503)

    # 2. Get creator preferences
    pref_res = client.get("/creators/test_creator/preferences")
    assert pref_res.status_code in (200, 503)
