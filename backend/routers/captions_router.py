from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ..captioning.ass_builder import build_ass
from ..captioning.registry import FONT_DIR, get_registry, validate_fonts
from ..database.models import UserModel
from ..database.repository import ClipRepository
from ..database.session import get_session
from ..utils.config import FFMPEG_PATH, TEMP_DIR
from .auth_router import get_current_user

router = APIRouter(prefix="/api/v1", tags=["captions"])


class CaptionEdit(BaseModel):
    time: float = Field(0, ge=0)
    style: dict = Field(default_factory=lambda: {"preset": "impact", "overrides": {}})
    words: list[dict] | None = None


@router.get("/caption-styles")
async def caption_styles():
    registry = get_registry()
    return {**registry, "available_fonts": registry["fonts"], "missing_fonts": validate_fonts(strict=False)}


async def _clip_or_404(clip_id: str, session: AsyncSession):
    clip = await ClipRepository.get_by_clip_id(session, clip_id)
    if not clip or not clip.file_path or not Path(clip.file_path).is_file():
        raise HTTPException(status_code=404, detail="Clip media is unavailable")
    return clip


@router.get("/clips/{clip_id}/caption-layout")
async def caption_layout(
    clip_id: str,
    _: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    clip = await _clip_or_404(clip_id, session)
    return {"clip_id": clip_id, "layout": clip.caption_layout or [], "subject_track": clip.subject_track or []}


@router.post("/clips/{clip_id}/captions/preview-frame")
async def caption_preview(
    clip_id: str,
    edit: CaptionEdit,
    _: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    clip = await _clip_or_404(clip_id, session)
    words = edit.words or clip.caption_words or []
    if not words:
        raise HTTPException(status_code=422, detail="No word timestamps are stored for this clip")
    work = TEMP_DIR / "caption_previews" / clip_id
    work.mkdir(parents=True, exist_ok=True)
    ass_path, jpeg_path = work / "preview.ass", work / "preview.jpg"
    payload = {"start": 0, "end": clip.duration_s, "words": words, "style": edit.style, "subject_track": clip.subject_track or []}
    built = build_ass(payload, ass_path, edit.style)
    clip.caption_words, clip.caption_style, clip.caption_layout = words, built["style"], built["layout"]
    await session.commit()
    command = [FFMPEG_PATH, "-y", "-ss", str(edit.time), "-i", clip.file_path, "-vf", f"ass='{ass_path}':fontsdir='{FONT_DIR}'", "-frames:v", "1", "-q:v", "2", str(jpeg_path)]
    run = subprocess.run(command, capture_output=True, text=True, timeout=30)
    if run.returncode != 0 or not jpeg_path.is_file():
        raise HTTPException(status_code=500, detail="Exact caption preview failed")
    return FileResponse(jpeg_path, media_type="image/jpeg", headers={"Cache-Control": "no-store"})


@router.post("/clips/{clip_id}/render")
async def save_caption_edit(
    clip_id: str,
    edit: CaptionEdit,
    _: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    clip = await _clip_or_404(clip_id, session)
    payload = {"start": 0, "end": clip.duration_s, "words": edit.words or clip.caption_words or [], "style": edit.style, "subject_track": clip.subject_track or []}
    built = build_ass(payload, TEMP_DIR / "caption_edits" / f"{clip_id}.ass", edit.style)
    clip.caption_words, clip.caption_style, clip.caption_layout = built["words"], built["style"], built["layout"]
    await session.commit()
    return {"ok": True, "clip_id": clip_id, "style": built["style"], "layout": built["layout"], "message": "Caption edit saved for the next render"}
