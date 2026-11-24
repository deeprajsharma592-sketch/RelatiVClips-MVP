"""
Feedback & Preference Learning Router for RelatiV.

Endpoints:
- POST /clips/{clip_id}/feedback             -> submit reaction/dislike feedback
- POST /api/v1/clips/{clip_id}/feedback      -> alias
- GET  /creators/{creator_id}/preferences    -> aggregated creator preference points
- GET  /api/v1/creators/{creator_id}/preferences -> alias
- GET  /api/v1/users/{user_id}/feedback/export -> GDPR user feedback export
- DELETE /api/v1/users/{user_id}/feedback    -> GDPR user feedback deletion
- POST /api/v1/users/me/feedback-consent     -> toggle data/feedback consent
"""

from collections import defaultdict
from datetime import datetime, timedelta
import logging
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth_utils import hash_ip
from ..database.models import UserModel
from ..database.session import get_session
from ..feedback.service import (
    delete_user_feedback,
    export_user_feedback,
    get_creator_preferences_summary,
    record_feedback_event,
    refresh_derived_feedback,
)
from ..feedback.weights import DEFAULT_CLIP_VERSION, DEFAULT_MODEL_VERSION, VALID_REASON_CODES
from .auth_router import get_current_user

logger = logging.getLogger("relativ.feedback")

router = APIRouter(tags=["feedback"])

# Simple in-memory sliding window rate limiter: key -> list of event timestamps
_feedback_rate_limits: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT_MAX_EVENTS = 60
RATE_LIMIT_WINDOW_SECONDS = 60


def _check_rate_limit(client_key: str):
    now = datetime.utcnow().timestamp()
    history = _feedback_rate_limits[client_key]
    # Prune old timestamps
    cutoff = now - RATE_LIMIT_WINDOW_SECONDS
    _feedback_rate_limits[client_key] = [t for t in history if t > cutoff]
    if len(_feedback_rate_limits[client_key]) >= RATE_LIMIT_MAX_EVENTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Feedback rate limit exceeded. Please wait a moment before sending more feedback.",
        )
    _feedback_rate_limits[client_key].append(now)


async def get_optional_current_user(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> Optional[UserModel]:
    """Extract authenticated user if available, otherwise return None without raising 401."""
    try:
        return await get_current_user(request, session)
    except HTTPException:
        return None


# ─── Request / Response Schemas ──────────────────────────────────────────────


class FeedbackSubmissionIn(BaseModel):
    event_type: str = Field(
        ...,
        description="Event type: like | unlike | dislike | undislike | download | dismiss_popup",
    )
    reason_codes: Optional[List[str]] = Field(
        default=None,
        description=f"Optional multi-select dislike reason codes: {VALID_REASON_CODES}",
    )
    reason_other_text: Optional[str] = Field(
        default=None,
        max_length=280,
        description="Optional custom text when 'other' is selected (max 280 chars)",
    )
    clip_version: Optional[str] = Field(
        default=DEFAULT_CLIP_VERSION,
        description="Version string of the clip cut / narrative layout",
    )
    model_version: Optional[str] = Field(
        default=DEFAULT_MODEL_VERSION,
        description="Version string of AI pipeline / moment detection model",
    )
    user_id: Optional[str] = Field(
        default=None,
        description="Optional explicit user/creator ID if submitting via server-to-server API",
    )


class FeedbackResponse(BaseModel):
    status: str
    event_id: str
    clip_id: str
    event_type: str
    points: int
    is_duplicate: bool = False
    created_at: str


class FeedbackConsentIn(BaseModel):
    consent: bool = Field(..., description="Whether user consents to feedback/preference data storage")


# ─── Feedback Submission Endpoints ───────────────────────────────────────────


@router.post("/clips/{clip_id}/feedback", response_model=FeedbackResponse)
@router.post("/api/v1/clips/{clip_id}/feedback", response_model=FeedbackResponse)
async def submit_clip_feedback(
    clip_id: str,
    payload: FeedbackSubmissionIn,
    request: Request,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
    user: Optional[UserModel] = Depends(get_optional_current_user),
):
    """Record user feedback (like, dislike, download, etc.) on a clip.
    
    Points are computed server-side from weights. Idempotent within 5s deduplication window.
    Derived tables (`clip_scores`, `creator_preferences`) are refreshed asynchronously.
    """
    client_ip = request.client.host if request.client else "unknown"
    client_key = user.id if user else (payload.user_id or hash_ip(client_ip))

    # Rate limiting
    _check_rate_limit(client_key)

    event, is_new = await record_feedback_event(
        session=session,
        clip_id=clip_id,
        event_type=payload.event_type,
        user=user,
        user_id=payload.user_id or (user.id if user else None),
        reason_codes=payload.reason_codes,
        reason_other_text=payload.reason_other_text,
        clip_version=payload.clip_version,
        model_version=payload.model_version,
    )

    # Trigger asynchronous background refresh of derived scores
    if is_new:
        background_tasks.add_task(refresh_derived_feedback, clip_id, event.creator_id)

    return FeedbackResponse(
        status="success" if is_new else "idempotent_duplicate",
        event_id=event.id,
        clip_id=event.clip_id,
        event_type=event.event_type,
        points=event.points,
        is_duplicate=(not is_new),
        created_at=event.created_at.isoformat() if event.created_at else datetime.utcnow().isoformat(),
    )


# ─── Creator Preferences Endpoint ────────────────────────────────────────────


@router.get("/creators/{creator_id}/preferences")
@router.get("/api/v1/creators/{creator_id}/preferences")
async def get_creator_preferences(
    creator_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Retrieve aggregated preference points and feature affinities for downstream clip ranking."""
    return await get_creator_preferences_summary(session, creator_id)


# ─── Privacy & Consent Endpoints (GDPR) ───────────────────────────────────────


@router.post("/api/v1/users/me/feedback-consent")
@router.post("/users/me/feedback-consent")
async def update_feedback_consent(
    payload: FeedbackConsentIn,
    request: Request,
    session: AsyncSession = Depends(get_session),
    user: UserModel = Depends(get_current_user),
):
    """Update user consent for feedback collection and personalization."""
    user.feedback_consent = payload.consent
    await session.commit()
    return {
        "status": "success",
        "user_id": user.id,
        "feedback_consent": user.feedback_consent,
    }


@router.get("/api/v1/users/me/feedback/export")
@router.get("/users/me/feedback/export")
async def export_current_user_feedback(
    session: AsyncSession = Depends(get_session),
    user: UserModel = Depends(get_current_user),
):
    """Export current user's feedback events (GDPR Data Portability)."""
    return await export_user_feedback(session, user.id)


@router.get("/api/v1/users/{user_id}/feedback/export")
@router.get("/users/{user_id}/feedback/export")
async def export_user_feedback_by_id(
    user_id: str,
    session: AsyncSession = Depends(get_session),
    user: Optional[UserModel] = Depends(get_optional_current_user),
):
    """Export feedback events for a given user (Admin or user themself)."""
    if user and user.id != user_id and not getattr(user, "is_admin", False):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized")
    return await export_user_feedback(session, user_id)


@router.delete("/api/v1/users/me/feedback")
@router.delete("/users/me/feedback")
async def delete_current_user_feedback(
    session: AsyncSession = Depends(get_session),
    user: UserModel = Depends(get_current_user),
):
    """Permanently delete user's feedback events and recalculate derived scores (GDPR Right to Erasure)."""
    return await delete_user_feedback(session, user.id)


@router.delete("/api/v1/users/{user_id}/feedback")
@router.delete("/users/{user_id}/feedback")
async def delete_user_feedback_by_id(
    user_id: str,
    session: AsyncSession = Depends(get_session),
    user: Optional[UserModel] = Depends(get_optional_current_user),
):
    """Permanently delete feedback events for a user (Admin or user themself)."""
    if user and user.id != user_id and not getattr(user, "is_admin", False):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized")
    return await delete_user_feedback(session, user_id)
