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
    clips: Optional[List[ClipMetadata]] = None
    error: Optional[str] = None


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


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None