"""
Feedback Service Layer for RelatiV.

Handles:
- Event creation with server-side point calculation
- Privacy consent enforcement
- Idempotency deduplication
- Single-download point counting rule
- Optimistic toggle handling (like, unlike, dislike, undislike, dismiss_popup)
- Asynchronous derived table refreshes (`clip_scores`, `creator_preferences`)
- GDPR user feedback export and deletion
"""

import asyncio
from datetime import datetime, timedelta
import logging
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException
from sqlalchemy import delete, func, select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from .weights import (
    DEFAULT_CLIP_VERSION,
    DEFAULT_MODEL_VERSION,
    FEEDBACK_WEIGHTS,
    get_base_points,
    validate_reason_codes,
)
from ..database.models import (
    ClipFeedbackEventModel,
    ClipModel,
    ClipScoreModel,
    CreatorPreferenceModel,
    TaskModel,
    UserModel,
)
from ..database.session import async_session

logger = logging.getLogger("relativ.feedback")

# Deduplication window for idempotency (in seconds)
IDEMPOTENCY_WINDOW_SECONDS = 5


def _categorize_clip_length(duration_s: Optional[float]) -> str:
    """Bucket duration into human/model readable duration segments."""
    if duration_s is None or duration_s <= 0:
        return "unknown"
    if duration_s < 30:
        return "<30s"
    if duration_s <= 60:
        return "30-60s"
    if duration_s <= 90:
        return "60-90s"
    return ">90s"


async def get_clip_metadata(
    session: AsyncSession, clip_id: str
) -> Tuple[Optional[str], Dict[str, Any]]:
    """Retrieve creator_id and derived feature metadata for a clip.
    
    No raw video/audio is retrieved — only derived metadata (duration, score, topic).
    """
    query = (
        select(ClipModel, TaskModel.user_id)
        .outerjoin(TaskModel, ClipModel.task_id == TaskModel.task_id)
        .where(ClipModel.clip_id == clip_id)
    )
    result = await session.execute(query)
    row = result.first()
    if not row:
        return None, {}

    clip, task_user_id = row
    features: Dict[str, Any] = {
        "duration_s": clip.duration_s,
        "clip_length_bucket": _categorize_clip_length(clip.duration_s),
        "story_score": clip.story_score,
        "has_caption_words": bool(clip.caption_words),
        "has_subject_track": bool(clip.subject_track),
        "hashtags": clip.hashtags if clip.hashtags else "",
    }
    return task_user_id, features


async def record_feedback_event(
    session: AsyncSession,
    clip_id: str,
    event_type: str,
    user: Optional[UserModel] = None,
    user_id: Optional[str] = None,
    creator_id: Optional[str] = None,
    reason_codes: Optional[List[str]] = None,
    reason_other_text: Optional[str] = None,
    clip_version: Optional[str] = None,
    model_version: Optional[str] = None,
) -> Tuple[ClipFeedbackEventModel, bool]:
    """Record an append-only feedback event and compute its points server-side.
    
    Returns (event, is_new). If an identical event arrived within IDEMPOTENCY_WINDOW_SECONDS,
    is_new is False and the existing event is returned without applying points again.
    """
    effective_user_id = user.id if user else user_id

    # 1. Privacy Consent Check
    if user is not None:
        if not getattr(user, "feedback_consent", True):
            raise HTTPException(
                status_code=403,
                detail="User has not accepted data/feedback consent. Feedback not recorded.",
            )
    elif effective_user_id:
        user_row = (await session.execute(
            select(UserModel).where(UserModel.id == effective_user_id)
        )).scalar_one_or_none()
        if user_row and not getattr(user_row, "feedback_consent", True):
            raise HTTPException(
                status_code=403,
                detail="User has not accepted data/feedback consent. Feedback not recorded.",
            )

    # 2. Validate event type & reason codes
    clean_event_type = event_type.strip().lower()
    if clean_event_type not in FEEDBACK_WEIGHTS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid event_type '{clean_event_type}'. Valid types: {list(FEEDBACK_WEIGHTS.keys())}",
        )

    clean_reason_codes: Optional[List[str]] = None
    if reason_codes:
        try:
            clean_reason_codes = validate_reason_codes(reason_codes)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    if clean_event_type in ("like", "unlike", "download") and clean_reason_codes:
        # Reason codes are only valid for dislikes and dismissals
        clean_reason_codes = None

    clean_other_text: Optional[str] = None
    if reason_other_text:
        clean_other_text = reason_other_text.strip()[:280]

    # 3. Idempotency Check: Ignore exact duplicate events within window
    now = datetime.utcnow()
    window_start = now - timedelta(seconds=IDEMPOTENCY_WINDOW_SECONDS)

    if effective_user_id:
        existing_event = (await session.execute(
            select(ClipFeedbackEventModel)
            .where(
                ClipFeedbackEventModel.user_id == effective_user_id,
                ClipFeedbackEventModel.clip_id == clip_id,
                ClipFeedbackEventModel.event_type == clean_event_type,
                ClipFeedbackEventModel.created_at >= window_start,
            )
            .order_by(desc(ClipFeedbackEventModel.created_at))
            .limit(1)
        )).scalar_one_or_none()

        if existing_event:
            logger.info(
                f"[Feedback] Idempotent duplicate ignored: user={effective_user_id} clip={clip_id} type={clean_event_type}"
            )
            return existing_event, False

    # 4. Fetch clip creator and derived features if creator_id not passed
    resolved_creator_id = creator_id
    features: Dict[str, Any] = {}
    if not resolved_creator_id:
        resolved_creator_id, features = await get_clip_metadata(session, clip_id)

    # 5. Server-side points calculation
    base_points = get_base_points(clean_event_type)
    effective_points = base_points

    if clean_event_type == "download":
        # Rule: download (+3) is strongest signal, but counts ONCE per clip per user.
        # Check if user previously downloaded this clip.
        if effective_user_id:
            prior_download = (await session.execute(
                select(ClipFeedbackEventModel.id)
                .where(
                    ClipFeedbackEventModel.user_id == effective_user_id,
                    ClipFeedbackEventModel.clip_id == clip_id,
                    ClipFeedbackEventModel.event_type == "download",
                )
                .limit(1)
            )).scalar_one_or_none()
            if prior_download is not None:
                # User already received download points for this clip
                effective_points = 0

    # 6. Create append-only event
    event = ClipFeedbackEventModel(
        user_id=effective_user_id,
        creator_id=resolved_creator_id,
        clip_id=clip_id,
        clip_version=clip_version or DEFAULT_CLIP_VERSION,
        model_version=model_version or DEFAULT_MODEL_VERSION,
        event_type=clean_event_type,
        points=effective_points,
        reason_codes=clean_reason_codes,
        reason_other_text=clean_other_text,
        clip_features=features if features else None,
        created_at=now,
    )
    session.add(event)
    await session.commit()
    await session.refresh(event)

    return event, True


async def refresh_derived_feedback(clip_id: str, creator_id: Optional[str] = None):
    """Asynchronously refresh `clip_scores` and `creator_preferences`.
    
    Runs outside the request critical path.
    """
    try:
        async with async_session() as session:
            # 1. Compute net score and counts for this clip
            events_query = (
                select(ClipFeedbackEventModel)
                .where(ClipFeedbackEventModel.clip_id == clip_id)
                .order_by(ClipFeedbackEventModel.created_at.asc())
            )
            events = (await session.execute(events_query)).scalars().all()

            if not events:
                return

            net_score = sum(e.points for e in events)
            total_events = len(events)
            resolved_creator_id = creator_id or events[-1].creator_id

            # Determine latest reaction state per user
            user_latest_reactions: Dict[str, str] = {}
            unique_downloaders = set()

            for e in events:
                if e.user_id:
                    if e.event_type in ("like", "unlike", "dislike", "undislike", "dismiss_popup"):
                        user_latest_reactions[e.user_id] = e.event_type
                    if e.event_type == "download":
                        unique_downloaders.add(e.user_id)

            active_likes = sum(1 for state in user_latest_reactions.values() if state == "like")
            active_dislikes = sum(
                1 for state in user_latest_reactions.values() if state in ("dislike", "dismiss_popup")
            )
            downloads_count = len(unique_downloaders)

            # Upsert into clip_scores
            score_row = (await session.execute(
                select(ClipScoreModel).where(ClipScoreModel.clip_id == clip_id)
            )).scalar_one_or_none()

            now = datetime.utcnow()
            if score_row:
                score_row.net_score = net_score
                score_row.likes_count = active_likes
                score_row.dislikes_count = active_dislikes
                score_row.downloads_count = downloads_count
                score_row.total_events = total_events
                score_row.last_feedback_at = events[-1].created_at
                score_row.updated_at = now
            else:
                score_row = ClipScoreModel(
                    clip_id=clip_id,
                    creator_id=resolved_creator_id,
                    net_score=net_score,
                    likes_count=active_likes,
                    dislikes_count=active_dislikes,
                    downloads_count=downloads_count,
                    total_events=total_events,
                    last_feedback_at=events[-1].created_at,
                    updated_at=now,
                )
                session.add(score_row)

            # 2. Refresh creator_preferences if creator_id is available
            if resolved_creator_id:
                creator_events_query = (
                    select(ClipFeedbackEventModel)
                    .where(ClipFeedbackEventModel.creator_id == resolved_creator_id)
                )
                creator_events = (await session.execute(creator_events_query)).scalars().all()

                creator_net_points = sum(e.points for e in creator_events)
                creator_total_events = len(creator_events)

                # Aggregate by reason codes
                reason_points: Dict[str, int] = {}
                for e in creator_events:
                    if e.reason_codes:
                        for code in e.reason_codes:
                            reason_points[code] = reason_points.get(code, 0) + e.points

                # Aggregate by clip features
                length_points: Dict[str, int] = {}
                for e in creator_events:
                    if e.clip_features:
                        bucket = e.clip_features.get("clip_length_bucket", "unknown")
                        length_points[bucket] = length_points.get(bucket, 0) + e.points

                # Identify top avoid reasons (lowest points)
                sorted_avoid = sorted(reason_points.items(), key=lambda kv: kv[1])
                top_avoid = [k for k, _ in sorted_avoid if k]

                pref_row = (await session.execute(
                    select(CreatorPreferenceModel).where(CreatorPreferenceModel.creator_id == resolved_creator_id)
                )).scalar_one_or_none()

                feature_affinities = {
                    "clip_length": length_points,
                }

                if pref_row:
                    pref_row.net_points = creator_net_points
                    pref_row.total_events = creator_total_events
                    pref_row.dislike_reasons = reason_points
                    pref_row.feature_affinities = feature_affinities
                    pref_row.top_avoid_reasons = top_avoid
                    pref_row.updated_at = now
                else:
                    pref_row = CreatorPreferenceModel(
                        creator_id=resolved_creator_id,
                        net_points=creator_net_points,
                        total_events=creator_total_events,
                        dislike_reasons=reason_points,
                        feature_affinities=feature_affinities,
                        top_avoid_reasons=top_avoid,
                        updated_at=now,
                    )
                    session.add(pref_row)

            await session.commit()
    except Exception as e:
        logger.error(f"[Feedback] Async refresh failed for clip {clip_id}: {e}", exc_info=True)


async def get_creator_preferences_summary(
    session: AsyncSession, creator_id: str
) -> Dict[str, Any]:
    """Fetch structured preferences for downstream clip ranking."""
    pref = (await session.execute(
        select(CreatorPreferenceModel).where(CreatorPreferenceModel.creator_id == creator_id)
    )).scalar_one_or_none()

    if not pref:
        return {
            "creator_id": creator_id,
            "total_feedback_events": 0,
            "net_preference_points": 0,
            "dislike_reasons": {},
            "feature_affinities": {},
            "top_avoid_reasons": [],
            "updated_at": None,
        }

    return {
        "creator_id": pref.creator_id,
        "total_feedback_events": pref.total_events,
        "net_preference_points": pref.net_points,
        "dislike_reasons": pref.dislike_reasons or {},
        "feature_affinities": pref.feature_affinities or {},
        "top_avoid_reasons": pref.top_avoid_reasons or [],
        "updated_at": pref.updated_at.isoformat() if pref.updated_at else None,
    }


async def export_user_feedback(
    session: AsyncSession, user_id: str
) -> Dict[str, Any]:
    """GDPR export: return user's feedback events (IDs & derived signals only)."""
    query = (
        select(ClipFeedbackEventModel)
        .where(ClipFeedbackEventModel.user_id == user_id)
        .order_by(ClipFeedbackEventModel.created_at.asc())
    )
    events = (await session.execute(query)).scalars().all()

    return {
        "user_id": user_id,
        "total_events": len(events),
        "exported_at": datetime.utcnow().isoformat(),
        "events": [
            {
                "id": e.id,
                "clip_id": e.clip_id,
                "clip_version": e.clip_version,
                "model_version": e.model_version,
                "event_type": e.event_type,
                "points": e.points,
                "reason_codes": e.reason_codes,
                "reason_other_text": e.reason_other_text,
                "clip_features": e.clip_features,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in events
        ],
    }


async def delete_user_feedback(
    session: AsyncSession, user_id: str
) -> Dict[str, Any]:
    """GDPR delete: wipe user's feedback events and recompute derived scores."""
    # Find affected clips
    query = (
        select(ClipFeedbackEventModel.clip_id, ClipFeedbackEventModel.creator_id)
        .where(ClipFeedbackEventModel.user_id == user_id)
        .distinct()
    )
    rows = (await session.execute(query)).all()

    # Delete records
    delete_stmt = delete(ClipFeedbackEventModel).where(ClipFeedbackEventModel.user_id == user_id)
    result = await session.execute(delete_stmt)
    deleted_count = result.rowcount
    await session.commit()

    # Recompute derived tables for affected clips
    for clip_id, creator_id in rows:
        await refresh_derived_feedback(clip_id, creator_id)

    return {
        "user_id": user_id,
        "deleted_events": deleted_count,
        "status": "success",
        "deleted_at": datetime.utcnow().isoformat(),
    }
