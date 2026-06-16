from pydantic import BaseModel, HttpUrl, Field
from typing import List, Optional
from enum import Enum
from datetime import datetime


class AudioPeak(BaseModel):
    timestamp: float
    energy_score: float
    relative_to_mean: Optional[float] = None


class AudioAnalysisResult(BaseModel):
    peaks: List[AudioPeak] = []
    _video_duration: float = 0


class WordTimestamp(BaseModel):
    word: str
    start: float
    end: float
    probability: float = 0.0


class TranscriptSegment(BaseModel):
    start: float
    end: float
    text: str
    words: List[WordTimestamp] = []


class TranscriptResult(BaseModel):
    segments: List[TranscriptSegment] = []
    language: str = "en"
    source: str = ""
    duration_s: float = 0


class ClipCandidate(BaseModel):
    start: float
    end: float
    caption: str = ""
    viral_title: str = ""
    hashtags: str = ""
    story_score: int = 50
    reason: str = ""


class HookSelectionResult(BaseModel):
    clips: List[ClipCandidate] = []


class FacePosition(BaseModel):
    x_offset: int = 0
    face_detected: bool = False
    face_confidence: float = 0.0


class FaceDetectionResult(BaseModel):
    clips: List[FacePosition] = []


class RenderResult(BaseModel):
    clip_id: str
    file_path: str
    file_size_mb: float = 0
    duration_s: float = 0
    created_at: str = ""


class TaskStatus(str, Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETE = "complete"
    FAILED = "failed"


class ClipMetadata(BaseModel):
    clip_id: str
    start: float
    end: float
    duration_s: float
    caption: str
    viral_title: str
    hashtags: str
    file_path: str
    file_size_mb: float
    created_at: str


class ProcessRequest(BaseModel):
    url: Optional[str] = Field(None, description="YouTube video URL to process")
    file_path: Optional[str] = Field(None, description="Local video file path to process")


class ProcessResponse(BaseModel):
    task_id: str
    status: TaskStatus
    position: Optional[int] = None


class StatusResponse(BaseModel):
    task_id: str
    status: TaskStatus
    current_step: Optional[str] = None
    progress: Optional[int] = None
    step_number: Optional[int] = None
    total_steps: Optional[int] = None
    step_name: Optional[str] = None
    time_elapsed_seconds: Optional[int] = None
    time_estimate_seconds: Optional[int] = None
    # The pipeline can produce two clip shapes depending on whether the
    # renderer succeeded. Use a permissive type so /status never 500s —
    # we already log the full clip dict in /logs if details are needed.
    clips: Optional[List[dict]] = None
    error: Optional[str] = None
    # NEW 2026-06-16: cost + cache + per-stage timing for richer UI
    llm_cost_usd: Optional[float] = None
    cost_per_clip_usd: Optional[float] = None
    llm_provider: Optional[str] = None
    clips_verified: Optional[int] = None
    clips_unverified: Optional[int] = None
    clips_requested: Optional[int] = None
    honest_result: Optional[bool] = None
    honest_message: Optional[str] = None
    cache_hit: Optional[bool] = None
    cache_age_hours: Optional[float] = None
    cache_savings_usd: Optional[float] = None
    # Per-stage timing breakdown [{step, duration_s, started_at}, ...]
    step_times: Optional[List[dict]] = None
    started_at: Optional[str] = None


class ContactMessage(BaseModel):
    email: str
    subject: str
    message: str


class TaskQueueInfo(BaseModel):
    active: int
    queued: int
    completed: int
    failed: int
    max_concurrent: int


class TranscriptSegmentSimple(BaseModel):
    start: float
    end: float
    text: str


class TranscriptResponse(BaseModel):
    segments: List[TranscriptSegmentSimple]
    language: str = "en"
    source: Optional[str] = None
    error: Optional[str] = None


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
# Clipper-economy + brand-campaign intake models (Day 3 backend wiring)
# These back the new /clippers/apply, /brands, and CPM-calculator forms.
# Storage is in-memory via backend/store/intake.py until Postgres is online.
# ─────────────────────────────────────────────────────────────────────────────

class ClipperApplication(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    email: str = Field(..., min_length=3, max_length=200)
    handle: str = Field(..., min_length=1, max_length=80, description="TikTok/IG/YT handle")
    specialty: str = Field(..., min_length=1, max_length=80)
    platforms: List[str] = Field(default_factory=list)
    weekly_volume: Optional[int] = Field(None, ge=0, le=500)
    portfolio_urls: List[str] = Field(default_factory=list, max_length=10)
    submitted_at: Optional[str] = None
    id: Optional[str] = None


class BrandContact(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    email: str = Field(..., min_length=3, max_length=200)
    company: Optional[str] = Field(None, max_length=200)
    video_url: str = Field(..., min_length=4, max_length=500)
    budget_usd: int = Field(..., ge=1000, le=10_000_000)
    notes: Optional[str] = Field(None, max_length=1000)
    submitted_at: Optional[str] = None
    id: Optional[str] = None


class CampaignQuoteRequest(BaseModel):
    budget_usd: int = Field(..., ge=1000, le=10_000_000)
    # Optional context the user might include; doesn't change the math
    video_url: Optional[str] = Field(None, max_length=500)
    target_platforms: Optional[List[str]] = None


class CampaignQuoteResponse(BaseModel):
    """The CPM calculator's POST output. Same shape the GET displays
    statically on /brands, but server-authoritative so the quote
    can be persisted alongside the contact form."""
    budget_usd: int
    cpm_usd: float
    platform_margin: float
    estimated_views: int
    estimated_clips: int
    clippers_assigned: int
    platform_split: List[dict]  # [{name, share, impressions, clips}]
    turnaround_hours: int
    quote_id: str
    expires_at: str