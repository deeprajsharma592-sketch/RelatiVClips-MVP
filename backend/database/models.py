import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, DateTime, JSON, Text, Enum as SAEnum, ForeignKey
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from typing import Optional, List
import enum


class Base(DeclarativeBase):
    pass


class TaskStatus(str, enum.Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETE = "complete"
    FAILED = "failed"


class TaskModel(Base):
    __tablename__ = "tasks"

    task_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    url: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default=TaskStatus.QUEUED)
    position: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    current_step: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    step_number: Mapped[int] = mapped_column(Integer, default=0)
    step_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    step_times: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)

    clips = relationship("ClipModel", back_populates="task", cascade="all, delete-orphan")


class ClipModel(Base):
    __tablename__ = "clips"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    clip_id: Mapped[str] = mapped_column(String(36), unique=True, nullable=False)
    task_id: Mapped[str] = mapped_column(String(36), ForeignKey("tasks.task_id"), nullable=False)
    start: Mapped[float] = mapped_column(Float, nullable=False)
    end: Mapped[float] = mapped_column(Float, nullable=False)
    duration_s: Mapped[float] = mapped_column(Float, nullable=False)
    caption: Mapped[str] = mapped_column(Text, default="")
    viral_title: Mapped[str] = mapped_column(String(200), default="")
    hashtags: Mapped[str] = mapped_column(String(500), default="")
    file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    file_size_mb: Mapped[float] = mapped_column(Float, default=0)
    story_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    task = relationship("TaskModel", back_populates="clips")
