from __future__ import annotations

import asyncio
import subprocess
import uuid
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..captioning.ass_builder import build_ass
from ..captioning.registry import FONT_DIR
from ..database.models import ClipModel, TaskModel, UserModel
from ..database.session import get_session
from ..services.credits import reserve_for_job, settle_job
from ..utils.admin_access import is_admin_email
from ..utils.config import FFMPEG_PATH, OUTPUTS_DIR, TEMP_DIR
from .auth_router import get_current_user

router = APIRouter(prefix="/api/v1/clips", tags=["clip-editor"])


class WordEdit(BaseModel):
    w: str = Field(min_length=1, max_length=80)
    start: float = Field(ge=0)
    end: float = Field(gt=0)
    emph: int = Field(default=0, ge=0, le=2)
    deleted: bool = False


class CaptionStylePayload(BaseModel):
    preset: Literal["karaoke", "hormozi", "beast", "minimal", "neon"] = "karaoke"
    font: Literal["Montserrat", "Anton", "Inter", "Poppins", "Komika"] = "Montserrat"
    font_size: int = Field(default=42, ge=24, le=64)
    primary_color: str = Field(default="#FFFFFF", pattern=r"^#[0-9A-Fa-f]{6}$")
    highlight_color: str = Field(default="#FACC15", pattern=r"^#[0-9A-Fa-f]{6}$")
    stroke_color: str = Field(default="#000000", pattern=r"^#[0-9A-Fa-f]{6}$")
    stroke_width: int = Field(default=3, ge=0, le=8)
    position: Literal["top", "center", "bottom"] = "bottom"
    uppercase: bool = True
    max_words_per_screen: int = Field(default=3, ge=1, le=3)


class ClipRemakeRequest(BaseModel):
    start: float = Field(ge=0)
    end: float = Field(gt=0)
    caption_style: CaptionStylePayload
    words: list[WordEdit] = Field(default_factory=list, max_length=5000)
    layout: Literal["auto_face", "split_stack", "blur_fit"] = "auto_face"

    @model_validator(mode="after")
    def validate_range(self):
        if self.end <= self.start + 0.5:
            raise ValueError("The edited clip must be at least 0.5 seconds long")
        return self


FONT_MAP = {
    "Montserrat": ("Montserrat ExtraBold", "Montserrat-ExtraBold.ttf"),
    "Anton": ("Anton", "Anton-Regular.ttf"),
    "Inter": ("Inter ExtraBold", "Inter-ExtraBold.ttf"),
    "Poppins": ("Poppins ExtraBold", "Poppins-ExtraBold.ttf"),
    # Komika is a browser preview fallback; Poppins is the licensed render fallback.
    "Komika": ("Poppins ExtraBold", "Poppins-ExtraBold.ttf"),
}

PRESET_MAP = {"karaoke": "impact", "hormozi": "impact", "beast": "impact", "minimal": "stack", "neon": "impact"}
POSITION_Y = {"top": 0.20, "center": 0.50, "bottom": 0.76}


def _merge_spans(spans: list[tuple[float, float]]) -> list[tuple[float, float]]:
    merged: list[list[float]] = []
    for start, end in sorted(spans):
        if not merged or start > merged[-1][1] + 0.04:
            merged.append([start, end])
        else:
            merged[-1][1] = max(merged[-1][1], end)
    return [(start, end) for start, end in merged]


def _edit_timeline(payload: ClipRemakeRequest) -> tuple[list[tuple[float, float]], list[dict], float]:
    deleted = _merge_spans([
        (max(payload.start, word.start), min(payload.end, word.end))
        for word in payload.words if word.deleted and word.end > payload.start and word.start < payload.end
    ])
    kept: list[tuple[float, float]] = []
    cursor = payload.start
    for start, end in deleted:
        if start > cursor + 0.02:
            kept.append((cursor, start))
        cursor = max(cursor, end)
    if cursor < payload.end - 0.02:
        kept.append((cursor, payload.end))
    if not kept:
        raise HTTPException(status_code=422, detail="The edit removes the entire clip")

    def removed_before(value: float) -> float:
        return sum(max(0.0, min(value, end) - start) for start, end in deleted if value > start)

    words = []
    for word in payload.words:
        if word.deleted or word.end <= payload.start or word.start >= payload.end:
            continue
        start = max(payload.start, word.start) - payload.start - removed_before(max(payload.start, word.start))
        end = min(payload.end, word.end) - payload.start - removed_before(min(payload.end, word.end))
        if end > start + 0.02:
            words.append({"w": word.w, "start": max(0, start), "end": end, "emph": word.emph})
    duration = sum(end - start for start, end in kept)
    return kept, words, duration


def _run(command: list[str], *, timeout: int = 600) -> None:
    result = subprocess.run(command, capture_output=True, text=True, timeout=timeout)
    if result.returncode != 0:
        detail = (result.stderr or "FFmpeg failed")[-1400:]
        raise RuntimeError(detail)


def _make_rough_cut(source: Path, kept: list[tuple[float, float]], destination: Path) -> Path:
    if len(kept) == 1:
        start, end = kept[0]
        _run([
            FFMPEG_PATH, "-y", "-hide_banner", "-loglevel", "error", "-ss", f"{start:.4f}", "-i", str(source),
            "-t", f"{end - start:.4f}", "-c:v", "libx264", "-preset", "veryfast", "-crf", "17",
            "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(destination),
        ])
        return destination
    filters, video_inputs, audio_inputs = [], [], []
    for index, (start, end) in enumerate(kept):
        filters.extend([
            f"[0:v]trim=start={start:.4f}:end={end:.4f},setpts=PTS-STARTPTS[v{index}]",
            f"[0:a]atrim=start={start:.4f}:end={end:.4f},asetpts=PTS-STARTPTS[a{index}]",
        ])
        video_inputs.append(f"[v{index}]")
        audio_inputs.append(f"[a{index}]")
    filters.append(f"{''.join(v + a for v, a in zip(video_inputs, audio_inputs))}concat=n={len(kept)}:v=1:a=1[v][a]")
    _run([
        FFMPEG_PATH, "-y", "-hide_banner", "-loglevel", "error", "-i", str(source), "-filter_complex", ";".join(filters),
        "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "17",
        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(destination),
    ])
    return destination


def _render(source: Path, destination: Path, ass_path: Path, layout: str) -> None:
    ass = str(ass_path).replace("\\", "/").replace(":", r"\:").replace("'", r"\'")
    fonts = str(FONT_DIR).replace("\\", "/").replace(":", r"\:").replace("'", r"\'")
    subtitle = f"ass='{ass}':fontsdir='{fonts}'"
    if layout == "blur_fit":
        graph = (
            "[0:v]split=2[bg][fg];"
            "[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=30[base];"
            "[fg]scale=1080:1920:force_original_aspect_ratio=decrease[front];"
            f"[base][front]overlay=(W-w)/2:(H-h)/2,{subtitle}[v]"
        )
    elif layout == "split_stack":
        graph = (
            "[0:v]split=2[top][bottom];"
            "[top]scale=1080:960:force_original_aspect_ratio=increase,crop=1080:960[t];"
            "[bottom]scale=1080:960:force_original_aspect_ratio=increase,crop=1080:960[b];"
            f"[t][b]vstack=inputs=2,{subtitle}[v]"
        )
    else:
        graph = f"[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,{subtitle}[v]"
    _run([
        FFMPEG_PATH, "-y", "-hide_banner", "-loglevel", "error", "-i", str(source), "-filter_complex", graph,
        "-map", "[v]", "-map", "0:a?", "-c:v", "libx264", "-preset", "fast", "-crf", "17",
        "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(destination),
    ])


async def _owned_clip(session: AsyncSession, clip_id: str, user: UserModel) -> ClipModel:
    row = (await session.execute(
        select(ClipModel, TaskModel).join(TaskModel, ClipModel.task_id == TaskModel.task_id).where(ClipModel.clip_id == clip_id)
    )).first()
    if not row:
        raise HTTPException(status_code=404, detail="Clip not found")
    clip, task = row
    if task.user_id and task.user_id != user.id and not user.is_admin and not is_admin_email(user.email):
        raise HTTPException(status_code=403, detail="You do not own this clip")
    if not clip.file_path or not Path(clip.file_path).is_file():
        raise HTTPException(status_code=404, detail="The clip media has expired or is unavailable")
    return clip


@router.post("/{clip_id}/remake")
async def remake_clip(
    clip_id: str,
    payload: ClipRemakeRequest,
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    clip = await _owned_clip(session, clip_id, user)
    if payload.end > clip.duration_s + 0.25:
        raise HTTPException(status_code=422, detail=f"Trim end exceeds the {clip.duration_s:.2f}s source clip")

    render_id = str(uuid.uuid4())
    reservation = await reserve_for_job(session, user_id=user.id, task_id=render_id, clip_count=1, is_remake=True)
    work = TEMP_DIR / "editor" / render_id
    work.mkdir(parents=True, exist_ok=True)
    rough = work / "rough-cut.mp4"
    ass_path = work / "captions.ass"
    output = OUTPUTS_DIR / f"edit_{clip_id}_{render_id[:8]}.mp4"
    thumb = OUTPUTS_DIR / f"{clip_id}_thumb.jpg"

    try:
        kept, words, edited_duration = _edit_timeline(payload)
        font_family, font_file = FONT_MAP[payload.caption_style.font]
        style = {
            "preset": PRESET_MAP[payload.caption_style.preset],
            "overrides": {
                "case": "upper" if payload.caption_style.uppercase else "as_is",
                "outline_px": payload.caption_style.stroke_width,
                "colors": {
                    "primary": payload.caption_style.primary_color,
                    "accent": payload.caption_style.highlight_color,
                    "accent2": payload.caption_style.highlight_color,
                    "outline": payload.caption_style.stroke_color,
                },
                "position": {"y_percent": POSITION_Y[payload.caption_style.position]},
                "sizes": {"normal": int(payload.caption_style.font_size * 2.15)},
                "font": {"family": font_family, "file": font_file},
                "max_words_per_group": payload.caption_style.max_words_per_screen,
                "position_mode": payload.caption_style.position,
            },
        }
        built = build_ass({"start": 0, "end": edited_duration, "words": words, "style": style}, ass_path, style)
        await asyncio.to_thread(_make_rough_cut, Path(clip.file_path), kept, rough)
        await asyncio.to_thread(_render, rough, output, ass_path, payload.layout)
        await asyncio.to_thread(_run, [FFMPEG_PATH, "-y", "-hide_banner", "-loglevel", "error", "-ss", "0.2", "-i", str(output), "-frames:v", "1", "-q:v", "2", str(thumb)], timeout=45)

        old_start = clip.start
        clip.start = old_start + payload.start
        clip.end = clip.start + edited_duration
        clip.duration_s = edited_duration
        clip.file_path = str(output)
        clip.file_size_mb = round(output.stat().st_size / (1024 * 1024), 2)
        clip.caption_words = words
        clip.caption_style = built.get("style")
        clip.caption_layout = built.get("layout")
        await session.commit()
        balance = await settle_job(session, reservation, output_clips=1)
    except Exception as error:
        await settle_job(session, reservation, output_clips=0, failed=True)
        if isinstance(error, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=f"HD remake failed: {error}") from error

    version = render_id[:8]
    return {
        "status": "complete",
        "render_id": render_id,
        "download_url": f"/download/{clip.clip_id}?v={version}",
        "thumbnail_url": f"/thumbnail/{clip.clip_id}?v={version}",
        "credits_remaining": balance,
        "clip": {
            "clip_id": clip.clip_id, "task_id": clip.task_id, "start": clip.start, "end": clip.end,
            "duration_s": clip.duration_s, "caption": clip.caption, "viral_title": clip.viral_title,
            "hashtags": clip.hashtags, "file_size_mb": clip.file_size_mb,
            "download_url": f"/download/{clip.clip_id}?v={version}",
            "thumbnail_url": f"/thumbnail/{clip.clip_id}?v={version}",
            "caption_words": words, "caption_style": clip.caption_style, "caption_layout": clip.caption_layout,
        },
    }
