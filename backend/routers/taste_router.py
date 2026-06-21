"""
Taste preferences router — Phase 1 taste onboarding.

POST /api/v1/taste/preferences   → save creator taste preferences
GET  /api/v1/taste/preferences   → get creator taste preferences
GET  /api/v1/taste/profile       → get full taste profile for ICL prompt
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database.models import CreatorProfileModel, UserModel
from ..routers.auth_router import get_current_user
from ..database.session import get_session

router = APIRouter(prefix="/api/v1/taste", tags=["taste"])


# ── Request / Response Schemas ────────────────────────────────────────────────

class TastePreferencesIn(BaseModel):
    """The 5 onboarding questions + extras."""
    target_platform: Optional[str] = Field(
        default=None,
        description="tiktok | instagram | youtube_shorts | twitter | all"
    )
    audience_age: Optional[str] = Field(
        default=None,
        description="13-17 | 18-24 | 25-34 | 35-44 | 45+ | all"
    )
    audience_location: Optional[str] = Field(
        default=None,
        description="Comma-separated: India, US, UK, etc."
    )
    clip_style: Optional[str] = Field(
        default=None,
        description="hype | educational | storytelling | music_only | raw | all"
    )
    hook_style: Optional[str] = Field(
        default=None,
        description="question | statement | music_drop | face_forward | text_overlay | all"
    )
    preferred_duration_s: int = Field(default=30, ge=10, le=120)
    avoid_topics: Optional[str] = Field(
        default=None,
        description="Comma-separated topics to avoid in clips"
    )
    niche: Optional[str] = Field(
        default=None,
        description="rap | tech | gaming | finance | fitness | comedy | news | vlog | other"
    )
    best_clip_url: Optional[str] = Field(
        default=None,
        description="URL to creator's best existing clip (optional — we'll analyze it)"
    )


class TastePreferencesOut(BaseModel):
    target_platform: Optional[str]
    audience_age: Optional[str]
    audience_location: Optional[str]
    clip_style: Optional[str]
    hook_style: Optional[str]
    preferred_duration_s: int
    avoid_topics: Optional[str]
    niche: Optional[str]
    best_clip_url: Optional[str]
    taste_onboarded: bool
    taste_updated_at: Optional[str]


class ICLProfileOut(BaseModel):
    """The compact profile passed to the ICL prompt builder."""
    niche: str
    clip_style: str
    hook_style: str
    preferred_duration_s: int
    audience_age: str
    audience_location: list[str]
    avoid_topics: list[str]
    target_platform: str
    onboarded: bool


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/preferences", response_model=TastePreferencesOut)
async def save_taste_preferences(
    prefs: TastePreferencesIn,
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Save or update the creator's taste preferences."""
    if user.role != "creator":
        raise HTTPException(status_code=403, detail="Creator accounts only")

    # Get or create creator profile
    result = await session.execute(
        select(CreatorProfileModel).where(CreatorProfileModel.user_id == user.id)
    )
    profile = result.scalar_one_or_none()

    if not profile:
        raise HTTPException(status_code=404, detail="Creator profile not found")

    # Apply preferences
    if prefs.target_platform is not None:
        profile.target_platform = prefs.target_platform
    if prefs.audience_age is not None:
        profile.audience_age = prefs.audience_age
    if prefs.audience_location is not None:
        profile.audience_location = prefs.audience_location
    if prefs.clip_style is not None:
        profile.clip_style = prefs.clip_style
    if prefs.hook_style is not None:
        profile.hook_style = prefs.hook_style
    if prefs.preferred_duration_s is not None:
        profile.preferred_duration_s = prefs.preferred_duration_s
    if prefs.avoid_topics is not None:
        profile.avoid_topics = prefs.avoid_topics
    if prefs.niche is not None:
        profile.niche = prefs.niche

    profile.taste_onboarded = True
    profile.taste_updated_at = datetime.utcnow()

    await session.commit()

    return {
        "target_platform": profile.target_platform,
        "audience_age": profile.audience_age,
        "audience_location": profile.audience_location,
        "clip_style": profile.clip_style,
        "hook_style": profile.hook_style,
        "preferred_duration_s": profile.preferred_duration_s,
        "avoid_topics": profile.avoid_topics,
        "niche": profile.niche,
        "best_clip_url": prefs.best_clip_url,
        "taste_onboarded": profile.taste_onboarded,
        "taste_updated_at": (
            profile.taste_updated_at.isoformat()
            if profile.taste_updated_at else None
        ),
    }


@router.get("/preferences", response_model=TastePreferencesOut)
async def get_taste_preferences(
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get the creator's current taste preferences."""
    if user.role != "creator":
        raise HTTPException(status_code=403, detail="Creator accounts only")

    result = await session.execute(
        select(CreatorProfileModel).where(CreatorProfileModel.user_id == user.id)
    )
    profile = result.scalar_one_or_none()

    if not profile:
        raise HTTPException(status_code=404, detail="Creator profile not found")

    return {
        "target_platform": profile.target_platform,
        "audience_age": profile.audience_age,
        "audience_location": profile.audience_location,
        "clip_style": profile.clip_style,
        "hook_style": profile.hook_style,
        "preferred_duration_s": profile.preferred_duration_s,
        "avoid_topics": profile.avoid_topics,
        "niche": profile.niche,
        "best_clip_url": None,
        "taste_onboarded": profile.taste_onboarded,
        "taste_updated_at": (
            profile.taste_updated_at.isoformat()
            if profile.taste_updated_at else None
        ),
    }


@router.get("/profile", response_model=ICLProfileOut)
async def get_icl_profile(
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get the compact ICL-ready taste profile for the LLM prompt builder."""
    if user.role != "creator":
        raise HTTPException(status_code=403, detail="Creator accounts only")

    result = await session.execute(
        select(CreatorProfileModel).where(CreatorProfileModel.user_id == user.id)
    )
    profile = result.scalar_one_or_none()

    if not profile:
        raise HTTPException(status_code=404, detail="Creator profile not found")

    # Parse comma-separated fields
    locations = []
    if profile.audience_location:
        locations = [loc.strip() for loc in profile.audience_location.split(",") if loc.strip()]

    avoids = []
    if profile.avoid_topics:
        avoids = [t.strip() for t in profile.avoid_topics.split(",") if t.strip()]

    return {
        "niche": profile.niche or "general",
        "clip_style": profile.clip_style or "all",
        "hook_style": profile.hook_style or "all",
        "preferred_duration_s": profile.preferred_duration_s or 30,
        "audience_age": profile.audience_age or "all",
        "audience_location": locations,
        "avoid_topics": avoids,
        "target_platform": profile.target_platform or "all",
        "onboarded": profile.taste_onboarded,
    }
