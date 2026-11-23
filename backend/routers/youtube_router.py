"""
YouTube Surgical Funnel Router
Handles processing of YouTube URLs through the surgical funnel pipeline.
"""
import sys
import os
import subprocess
import time
import asyncio
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel
from typing import Optional, List, Dict
from pathlib import Path

from ..models import ProcessResponse, TaskStatus
from ..utils.task_store import task_store, PIPELINE_STEPS
from ..utils.config import (
    TEMP_DIR, YTDLP_PATH, FFMPEG_PATH, FFPROBE_PATH,
    NUM_CLIPS_YOUTUBE, SURGICAL_DOWNLOAD_SECONDS,
    MAX_SURGICAL_SEGMENTS, COOKIES_PATH, MIN_CLIPS, PIPELINE_VERSION,
)
from ..pipeline.transcript_fetcher import _download_audio
from ..database.models import TaskModel, UserModel
from ..database.session import get_session
from ..database.repository import TaskRepository
from .auth_router import get_current_user
from ..services.credits import CreditReservation, reserve_for_job, settle_job
from ..services.entitlements import concurrency_limit, source_limit_seconds
from ..utils.admin_access import is_admin_email

progress_logs = {}
_active_tasks = {}
_active_user_tasks: dict[str, set[str]] = {}


def _release_active_task(task_id: str) -> None:
    _active_tasks.pop(task_id, None)
    for user_id, active_task_ids in list(_active_user_tasks.items()):
        active_task_ids.discard(task_id)
        if not active_task_ids:
            _active_user_tasks.pop(user_id, None)

VIRAL_KEYWORDS = [
    'insane', 'huge', 'wow', 'literally', 'never', 'amazing', 'incredible',
    'unbelievable', 'crazy', 'nuts', 'absolutely', 'totally', 'seriously',
    'actually', 'basically', 'honestly', 'truthfully', 'this is', 'listen',
    'watch', 'check', 'look', "here's", "here is", "let me", "going to",
    "quick story", "fun fact", "did you know", "most important", "key point",
    "main reason", "guess what", "wait for it", "hold on", "don't skip"
]

class YouTubeSurgicalFunnel:
    """YouTube Surgical Funnel Pipeline"""

    def __init__(self, url: str, task_id: str, progress_callback):
        self.url = url
        self.task_id = task_id
        self.callback = progress_callback
        self.video_id = self._extract_video_id(url)

    def _extract_video_id(self, url: str) -> str:
        if "watch?v=" in url:
            return url.split("watch?v=")[-1].split("&")[0]
        elif "youtu.be/" in url:
            return url.split("youtu.be/")[-1].split("?")[0]
        elif "shorts/" in url:
            return url.split("shorts/")[-1].split("?")[0]
        return "unknown"

    def log(self, message: str):
        print(f"[SurgicalFunnel:{self.task_id}] {message}")
        self.callback(message)

    def run(self) -> dict:
        try:
            # STAGE 1: SCOUT
            self.log("[Stage 1/6] SCOUT - Fetching transcript and audio...")
            stage1_result = self._stage_scout()
            if not stage1_result.get("success"):
                self.log(f"Stage 1 failed: {stage1_result.get('error', 'Unknown')}")
                return stage1_result

            transcript = stage1_result["transcript"]
            audio_path = stage1_result.get("audio_path")
            self.log(f"  Scout complete: {len(transcript['segments'])} segments, audio ready")

            # STAGE 2: SIGNAL
            self.log("[Stage 2/6] SIGNAL - Analyzing audio peaks and keywords...")
            signal_data = {"peaks": [], "keywords": []}
            if audio_path and os.path.exists(audio_path):
                try:
                    signal_data = self._stage_signal(audio_path, transcript)
                except Exception as e:
                    self.log(f"  Audio analysis failed ({e}), using keywords only")
            if not signal_data.get("peaks") and not signal_data.get("keywords"):
                for segment in transcript.get("segments", []):
                    text_lower = segment["text"].lower()
                    for kw in VIRAL_KEYWORDS:
                        if kw in text_lower:
                            signal_data.setdefault("keywords", []).append({
                                "timestamp": segment["start"],
                                "keyword": kw,
                                "text": segment["text"][:100]
                            })
                            break
                signal_data["keywords"] = signal_data.get("keywords", [])[:15]
            self.log(f"  Signal complete: {len(signal_data.get('peaks', []))} peaks, {len(signal_data.get('keywords', []))} keywords")

            # STAGE 3: FUNNEL - Claude decides
            self.log("[Stage 3/6] FUNNEL - AI selecting viral timestamps...")
            timestamps = []
            try:
                timestamps = self._stage_funnel(transcript, signal_data)
            except Exception as e:
                self.log(f"  Funnel error ({e}), generating evenly-spaced clips")
            if not timestamps:
                self.log("  Using evenly-spaced clips as last resort")
                vid_dur = max(seg["end"] for seg in transcript.get("segments", [{"end": 120}]))
                for i in range(MIN_CLIPS):
                    start = i * (vid_dur / MIN_CLIPS)
                    timestamps.append({
                        "start": round(start, 2),
                        "end": round(start + SURGICAL_DOWNLOAD_SECONDS, 2),
                        "reason": f"evenly-spaced clip {i+1}"
                    })
            self.log(f"  Funnel complete: {len(timestamps)} timestamps")

            if audio_path and os.path.exists(audio_path):
                try:
                    os.remove(audio_path)
                    self.log("  Audio deleted - freeing disk space for video")
                except Exception as e:
                    self.log(f"  Could not delete audio: {e}")

            # STAGE 4: STRIKE - Download segments
            self.log("[Stage 4/6] STRIKE - Downloading video segments...")
            segments = self._stage_strike(timestamps)
            if not segments:
                return {"success": False, "error": "Failed to download video segments"}
            self.log(f"  Strike complete: {len(segments)} segments downloaded")

            # STAGE 5: CV - Face detection
            self.log("[Stage 5/6] CV - Face detection and centering...")
            segments_with_faces = segments
            try:
                segments_with_faces = self._stage_cv(segments)
            except Exception as e:
                self.log(f"  Face detection failed ({e}), using center crop")
                for s in segments_with_faces:
                    s["x_offset"] = 16
                    s["face_detected"] = False
            self.log(f"  CV complete: {len(segments_with_faces)} segments")

            # STAGE 6: RENDER
            self.log("[Stage 6/6] RENDER - FFmpeg rendering...")
            clips = []
            try:
                clips = self._stage_render(segments_with_faces)
            except Exception as e:
                self.log(f"  Render error ({e})")
            self.log(f"  Render complete: {len(clips)} clips generated")

            return {"success": True, "clips": clips, "video_segments": segments}

        except Exception as e:
            import traceback
            self.log(f"ERROR: {str(e)}")
            self.log(f"Traceback: {traceback.format_exc()}")
            return {"success": False, "error": str(e)}

    def _stage_scout(self) -> dict:
        from ..pipeline.transcript_fetcher import fetch_transcript

        self.log("[Stage 1/6] SCOUT - Fetching transcript...")
        transcript = fetch_transcript(self.url, self.task_id, self.log)

        if not transcript or not transcript.get("segments"):
            return {"success": False, "error": "No transcript could be fetched"}

        self.log(f"  Scout complete: {len(transcript['segments'])} segments from {transcript.get('source', 'unknown')}")

        audio_path = None
        if transcript.get("source") != "whisper":
            self.log("  Transcript from captions — audio not needed for pipeline")
            return {"success": True, "transcript": transcript, "audio_path": None}

        # Whisper was used, so audio already exists on disk at the temp path
        audio_path = TEMP_DIR / f"{self.task_id}_audio.wav"
        if not audio_path.exists():
            audio_path = TEMP_DIR / f"{self.task_id}_audio.m4a"
        if not audio_path.exists():
            self.log("  Audio file not found on disk, re-downloading...")
            audio_path = _download_audio(self.url, self.task_id, self.log)

        return {"success": True, "transcript": transcript, "audio_path": str(audio_path) if audio_path and os.path.exists(str(audio_path)) else None}

    def _stage_signal(self, audio_path: str, transcript: dict) -> dict:
        peaks = []
        keywords = []

        for segment in transcript.get("segments", []):
            text_lower = segment["text"].lower()
            for kw in VIRAL_KEYWORDS:
                if kw in text_lower:
                    keywords.append({
                        "timestamp": segment["start"],
                        "keyword": kw,
                        "text": segment["text"][:100]
                    })
                    break

        return {"peaks": peaks, "keywords": keywords[:15]}

    def _stage_funnel(self, transcript: dict, signal_data: dict) -> list:
        from ..utils.config import ANTHROPIC_API_KEY
        from ..llm.claude_client import select_clips_with_claude, CLAUDE_AVAILABLE

        if CLAUDE_AVAILABLE:
            self.log("  Calling Claude 3.5 Sonnet for viral clip selection...")
            try:
                result = select_clips_with_claude(
                    transcript,
                    {"peaks": signal_data.get("peaks", []), "_video_duration": 0},
                    [],
                    self.task_id,
                    lambda m: self.log(f"    {m}")
                )
                clips = result.get("clips", [])
                if clips:
                    timestamps = []
                    for clip in clips[:NUM_CLIPS_YOUTUBE]:
                        start = max(0, clip.get("start", 0) - 15)
                        end = start + SURGICAL_DOWNLOAD_SECONDS
                        timestamps.append({
                            "start": round(start, 2),
                            "end": round(end, 2),
                            "reason": clip.get("reason", clip.get("caption", ""))
                        })
                    if timestamps:
                        self.log(f"  AI selected {len(timestamps)} timestamps")
                        return timestamps
            except Exception as e:
                self.log(f"  Claude error ({e}), using fallback")
        else:
            self.log("  Claude API key not configured, using energy-peak fallback")

        timestamps = []
        used_starts = []
        for peak in signal_data.get("peaks", []):
            start = max(0, peak.get("timestamp", 0) - 15)
            is_duplicate = any(abs(start - used) < SURGICAL_DOWNLOAD_SECONDS for used in used_starts)
            if is_duplicate:
                continue
            used_starts.append(start)
            timestamps.append({
                "start": round(start, 2),
                "end": round(start + SURGICAL_DOWNLOAD_SECONDS, 2),
                "reason": f"energy peak at {peak.get('timestamp', 0)}s"
            })
            if len(timestamps) >= NUM_CLIPS_YOUTUBE:
                break

        if len(timestamps) < MIN_CLIPS:
            self.log(f"  Padding clips to minimum {MIN_CLIPS}")
            for kw_data in signal_data.get("keywords", [])[:MIN_CLIPS]:
                if len(timestamps) >= MIN_CLIPS:
                    break
                start = max(0, kw_data.get("timestamp", 0) - 15)
                is_duplicate = any(abs(start - used) < SURGICAL_DOWNLOAD_SECONDS for used in used_starts)
                if is_duplicate:
                    continue
                used_starts.append(start)
                timestamps.append({
                    "start": round(start, 2),
                    "end": round(start + SURGICAL_DOWNLOAD_SECONDS, 2),
                    "reason": f"keyword '{kw_data.get('keyword', '')}' at {kw_data.get('timestamp', 0)}s"
                })
            if len(timestamps) < MIN_CLIPS:
                video_duration = 300
                if transcript and transcript.get("segments"):
                    video_duration = max(seg.get("end", 0) for seg in transcript["segments"])
                for i in range(MIN_CLIPS - len(timestamps)):
                    start = i * (video_duration / MIN_CLIPS)
                    timestamps.append({
                        "start": round(start, 2),
                        "end": round(start + SURGICAL_DOWNLOAD_SECONDS, 2),
                        "reason": f"evenly distributed clip {i+1}"
                    })

        self.log(f"  Final timestamps: {len(timestamps)} clips")
        return timestamps

    def _stage_strike(self, timestamps: list) -> list:
        segments = []
        self.downloaded_segments = []

        for i, ts in enumerate(timestamps):
            self.log(f"  Downloading segment {i+1}/{len(timestamps)}: {ts['start']}s - {ts['end']}s")

            video_path = TEMP_DIR / f"{self.task_id}_segment_{i+1}.mp4"

            out_template = str(Path(video_path).parent / f"{Path(video_path).stem}.%(ext)s")
            ytdlp_cmd = [
                YTDLP_PATH,
                "--download-sections", f"*{ts['start']}-{ts['end']}",
                "--force-keyframes-at-cuts",
                "-f", "bv*[height<=2160]+ba/bv*+ba/b[height<=2160]/best",
                "--merge-output-format", "mp4",
                "-o", out_template,
                "--no-warnings",
                "--no-check-certificates",
                self.url
            ]

            if COOKIES_PATH and COOKIES_PATH.exists():
                ytdlp_cmd.extend(["--cookies", str(COOKIES_PATH)])

            player_clients = ["web", "ios", "android"]
            success = False

            for client in player_clients:
                try:
                    test_cmd = ytdlp_cmd + ["--extractor-args", f"youtube:player_client={client}"]
                    result = subprocess.run(test_cmd, capture_output=True, text=True, timeout=180)

                    if result.returncode == 0 and video_path.exists():
                        seg_data = {
                            "path": str(video_path),
                            "start": ts["start"],
                            "end": ts["end"],
                            "reason": ts.get("reason", "")
                        }
                        segments.append(seg_data)
                        self.downloaded_segments.append(seg_data)
                        success = True
                        break
                    elif "403" in result.stderr:
                        self.log(f"  403 with {client}, trying next...")
                        continue
                except Exception as e:
                    continue

            if not success:
                self.log(f"  Warning: Segment {i+1} download failed")

        return segments

    def _stage_cv(self, segments: list) -> list:
        if not segments:
            return []

        clips = []
        for seg in segments:
            clips.append({
                "start": seg.get("start", 0),
                "end": seg.get("end", SURGICAL_DOWNLOAD_SECONDS),
                "caption": seg.get("reason", "Viral moment"),
                "viral_title": "Viral Clip",
                "hashtags": "#shorts #viral #relativ"
            })

        try:
            from ..pipeline.face_detection import get_batch_face_data

            for i, seg in enumerate(segments):
                video_path = seg["path"]
                if os.path.exists(video_path) and i < len(clips):
                    self.log(f"  Running face detection on segment {i+1}...")
                    face_data = get_batch_face_data(video_path, [clips[i]],
                        lambda m: self.log(f"    {m}"))
                    if face_data:
                        clips[i]["x_offset"] = face_data[0].get("x_offset", 16)
                        clips[i]["face_detected"] = face_data[0].get("face_detected", False)
                        clips[i]["face_tracking"] = face_data[0]
                        self.log(f"  Segment {i+1}: face detected={face_data[0].get('face_detected', False)}, x_offset={clips[i]['x_offset']}")
                    else:
                        clips[i]["x_offset"] = 16
                        clips[i]["face_detected"] = False
                        self.log(f"  Segment {i+1}: No face data, using default center x_offset=16")
        except Exception as e:
            import traceback
            self.log(f"  CV error: {e}")
            self.log(f"  CV traceback: {traceback.format_exc()}")
            for clip in clips:
                clip["x_offset"] = 16
                clip["face_detected"] = False

        return clips

    def _stage_render(self, clips: list) -> list:
        rendered_clips = []
        downloaded = self.downloaded_segments if hasattr(self, 'downloaded_segments') else []

        if not clips and downloaded:
            self.log("  WARNING: No clips from CV stage, creating default center-crop clips")
            for i, seg in enumerate(downloaded):
                clips.append({
                    "start": 0,
                    "end": SURGICAL_DOWNLOAD_SECONDS,
                    "x_offset": 16,
                    "face_detected": False,
                    "caption": "Viral moment",
                    "viral_title": "Viral Clip"
                })

        if not clips:
            self.log("  ERROR: No clips to render")
            return []

        try:
            from ..pipeline.renderer import render_all_clips

            for i, seg in enumerate(downloaded):
                if not os.path.exists(seg["path"]):
                    self.log(f"  Skipping segment {i+1}: file not found")
                    continue

                if i < len(clips):
                    clip_data = clips[i].copy()
                else:
                    clip_data = clips[-1].copy() if clips else {"start": 0, "end": SURGICAL_DOWNLOAD_SECONDS, "x_offset": 16}

                seg_start = seg.get("start", 0)
                seg_end = seg.get("end", 0)
                clip_data["start"] = max(0, clip_data.get("start", 0) - seg_start)
                clip_data["end"] = min(seg_end - seg_start, clip_data.get("end", SURGICAL_DOWNLOAD_SECONDS) - seg_start)

                if "x_offset" not in clip_data:
                    clip_data["x_offset"] = 16

                self.log(f"  Rendering clip {i+1}/{len(downloaded)}: {clip_data['start']:.1f}s-{clip_data['end']:.1f}s")

                video_id = f"surgical_{self.task_id[:8]}_{i+1}"
                task_id = f"{self.task_id}_{i+1}"

                result = render_all_clips(
                    seg["path"],
                    [clip_data],
                    video_id,
                    task_id,
                    lambda m: self.log(f"    {m}")
                )

                if result:
                    rendered_clips.extend(result)
        except Exception as e:
            self.log(f"  Render error: {e}")

        if not rendered_clips and clips:
            self.log("  ERROR: Rendering failed")

        return rendered_clips


def _step_progress_range(step_number: int) -> tuple[int, int, int, str]:
    """Return (step_number, progress_start, progress_end, step_name) for a step.
    Used to fill sub-step progress within the step's allocated range."""
    for s in PIPELINE_STEPS:
        if s["number"] == step_number:
            return s["number"], s["progress_start"], s["progress_end"], s["name"]
    return step_number, 0, 100, "Processing"


def create_progress_callback(task_id: str):
    """Build a progress callback that:
    - Sets step_number + step_name when step changes
    - Computes progress% from step_number, and refines it within the step's
      range using a sub_progress value (0-1) so "downloading segment 2/3"
      visually advances the bar instead of looping
    - Records the message as current_step
    """
    last_step = {"value": 0}
    sub_counter = {"value": 0.0, "step": 0, "denominator": 1}

    def callback(message: str, step: int = None, sub_progress: float = None, progress: int = None):
        print(f"[YouTubePipeline:{task_id[:8]}] {message}", flush=True)
        # Backward-compat: legacy callers (v1 funnel + orchestrator completion
        # notifications) pass `progress=N` as a literal 0-100 value. Map that
        # to a direct progress override so old code keeps working.
        if progress is not None and 0 <= int(progress) <= 100:
            if task_id not in progress_logs:
                progress_logs[task_id] = []
            progress_logs[task_id].append({
                "timestamp": __import__('datetime').datetime.now().isoformat(),
                "message": message,
            })
            return task_store.update_task(
                task_id, current_step=message, progress=int(progress),
            )

        if task_id not in progress_logs:
            progress_logs[task_id] = []
        progress_logs[task_id].append({
            "timestamp": __import__('datetime').datetime.now().isoformat(),
            "message": message
        })

        updates = {"current_step": message}

        # Explicit progress override via step=N where N > 100 (legacy hack)
        if isinstance(step, (int, float)) and step > 100:
            updates["progress"] = int(step)
            return task_store.update_task(task_id, **updates)

        if step is not None:
            step_num, p_start, p_end, step_name = _step_progress_range(int(step))
            updates["step_number"] = step_num
            updates["step_name"] = step_name
            if sub_progress is None:
                updates["progress"] = p_start
            last_step["value"] = int(step)

        if sub_progress is not None and 0.0 <= float(sub_progress) <= 1.0:
            step_num, p_start, p_end, _ = _step_progress_range(last_step["value"] or 1)
            fill = p_start + (p_end - p_start) * float(sub_progress)
            updates["progress"] = int(fill)

        task_store.update_task(task_id, **updates)
    return callback


async def run_youtube_orchestrator(
    task_id: str,
    url: str,
    callback,
    platform: str = "tiktok",
    caption_font: str = "studio",
    caption_style: Optional[dict] = None,
    requested_clip_count: Optional[int] = None,
    max_source_duration_s: Optional[int] = None,
    llm_provider_preference: Optional[str] = None,
):
    """New pipeline path (PIPELINE_VERSION=2) — transcript-first selection.

    Flow (the "v3" pipeline):
      1. Try YouTube captions via yt-dlp (FREE, no audio download)
      2. If captions succeed: build candidate moments from word density + pauses
      3. If captions fail: transcribe audio with Whisper and build the same
         transcript-driven candidates
      4. Run the rest of the pipeline (surgical, render) on top moments
      5. LLM (claude/deepseek) picks 2-5 with strict JSON, low token cost
      6. Apply platform-specific duration + caption style (NEW 2026-06-15)

    The LLM receives timestamped transcript text. Audio is downloaded only when
    captions are unavailable and Whisper must produce that transcript.

    `platform` is one of "tiktok" | "reels" | "shorts". Default = "tiktok".
    """
    def _bridge(stage: str, msg: str) -> None:
        try:
            step = int(stage) if str(stage).isdigit() else None
        except Exception:
            step = None
        try:
            callback(msg, step=step)
        except Exception:
            pass

    # --- STAGE 1 + 2 (combined): caption-first signal extraction ---
    # Try captions first; if they fail, Whisper supplies a transcript.
    callback("Fetching captions and source metadata...", step=1, sub_progress=0.0)

    def _detect_source_moments():
        # Import and run in a worker. yt-dlp and transcript parsing
        # are synchronous and must never block FastAPI's status/health loop.
        from ..pipeline.moment_detector import detect_moments

        return detect_moments(
            source=url,
            task_id=task_id,
            log=lambda m: callback(m, step=1, sub_progress=0.5),
        )

    moments, info = await asyncio.to_thread(_detect_source_moments)
    callback("Source analyzed", step=1, sub_progress=1.0)

    source_duration = float(info.get("duration_s") or 0)
    if max_source_duration_s and source_duration > max_source_duration_s:
        raise RuntimeError(
            f"SOURCE_TOO_LONG: this plan accepts source videos up to "
            f"{max_source_duration_s // 60} minutes; this video is {source_duration / 60:.1f} minutes."
        )

    if not moments:
        # Check if this is a cookie/auth error by looking at info
        auth_error = info.get("auth_error") or (
            "sign in" in str(info.get("error", "")).lower()
            if info.get("error") else False
        )
        if auth_error:
            callback("YouTube auth failed — cookies may be expired. Please re-export cookies from your browser and update them in the backend.", step=2, sub_progress=0.0)
            raise RuntimeError(
                "YOUTUBE_AUTH_EXPIRED: YouTube cookies appear to be expired. "
                "Please re-export cookies from your browser (EditThisCookie or browser dev tools) "
                "and save to /app/RelatiV/cookies.txt, then restart the backend."
            )
        callback("No candidate moments found — pipeline will not render", step=2, sub_progress=0.0)
        return {
            "clips": [],
            "hooks": [],
            "transcript": info.get("transcript"),
            "video_meta": info,
            "stages_run": [1, 2],
            "task_id": task_id,
        }

    from ..pipeline.clip_count import resolve_target_clip_count
    target_clip_count = resolve_target_clip_count(
        info.get("duration_s", 0),
        requested_clip_count,
    )
    callback(
        f"Selecting the best {target_clip_count} clip(s) "
        f"({'user choice' if requested_clip_count is not None else 'automatic by video length'})",
        step=2,
        sub_progress=0.9,
    )
    callback(
        f"Built {len(moments)} candidate moments from "
        f"{'captions (no audio download)' if info['source'] == 'captions' else 'Whisper transcript'}",
        step=2,
        sub_progress=1.0,
    )

    # --- STAGE 3: download the source video so we can extract audio per moment
    # (PIPELINE_STEPS slot 3 is "Transcribing audio" — collapsed with stage 1
    # since we read captions first; we still update the slot so the bar moves
    # smoothly through the 20-60% range).
    callback("Preparing source media for clip extraction...", step=3, sub_progress=0.5)

    # --- STAGE 3-5: surgical download of top moments ---
    # Intelligently filter out intro banter for long videos (>180s)
    INTRO_FILLER_PHRASES = (
        "welcome back", "welcome to", "today's episode", "today we are", "today we have",
        "sponsored by", "hit subscribe", "in this video", "leave a comment", "let's get into it",
        "before we begin", "before we start", "hey guys", "make sure to subscribe"
    )
    is_long_form = float(info.get("duration_s", 0)) > 180.0
    filtered_moments = []
    for m in moments:
        if is_long_form and m.start < 45.0:
            snippet_lower = (m.snippet or "").lower()
            if any(phrase in snippet_lower for phrase in INTRO_FILLER_PHRASES):
                continue
        filtered_moments.append(m)

    active_moments = filtered_moments if len(filtered_moments) >= 3 else moments
    top_for_surgery = active_moments[:8]
    surgical_candidates = []
    for m in top_for_surgery:
        surgical_candidates.append({
            "start": m.start,
            "end": m.end,
            "hook_score": m.score,
            "components": {"signal": m.score, "type": m.signal_type},
            "reason": m.snippet,
            "surgical_padding_s": 2.0,  # 2s extra context on each side
            "source_url": url,
        })

    # --- STAGE 6: LLM taste select (strict JSON, low token) ---
    callback("Asking LLM to pick the 2-5 most viral moments...", step=6)
    video_meta = {
        "title": info.get("transcript", {}).get("title") if info.get("transcript") else None,
        "duration_s": info.get("duration_s", 0),
        "source": info.get("source", "unknown"),
    }
    # Build the prompt. Use the new archetype-aware prompt (2026-06-15) when
    # we have enough moments to give the LLM context. Fall back to the legacy
    # moment prompt for edge cases.
    # SIMPLIFIED 2026-06-15: dropped per-platform prompt guidance. All platforms
    # (TikTok/Reels/Shorts) now share the same universal 9:16 22-30s format.
    try:
        import random
        from ..taste.icl import build_relativsauce_prompt
        orig_transcript_segs = info.get("transcript", {}).get("segments") if info.get("transcript") else None

        # 5% exploration policy
        is_experiment_run = (random.random() < 0.05)
        if is_experiment_run:
            _bridge("taste", "🎲 RelatiVSauce: 5% exploration active — testing high-variance wildcard hook")
        else:
            from ..taste.icl import RELATIVSAUCE_PROMPT_SHA256
            _bridge(
                "taste",
                "🎯 RelatiVSauce V2 loaded from backend/taste/RelatiVSauce.md "
                f"(sha256={RELATIVSAUCE_PROMPT_SHA256[:12]})",
            )

        prompt = build_relativsauce_prompt(
            transcript_segments=orig_transcript_segs or [],
            moments=moments,
            video_meta=video_meta,
            is_experiment=is_experiment_run,
            max_picks=target_clip_count,
        )
    except Exception as e:
        _bridge("taste", f"RelatiVSauce prompt fallback: {e}")
        from ..taste.icl import build_moment_prompt
        prompt = build_moment_prompt(moments, video_meta, max_picks=target_clip_count)
    # NOTE: the LLM key is INVALID in this env, so this will fail and the
    # energy/moment fallback will be used. Once the key is rotated, the
    # LLM call below activates and replaces the fallback picks.

    loop = asyncio.get_event_loop()
    final_clips = await loop.run_in_executor(
        None,
        lambda: _run_moment_pipeline(
            url=url,
            task_id=task_id,
            moments=moments,
            top_for_surgery=top_for_surgery,
            prompt=prompt,
            video_meta=video_meta,
            video_duration_s=info.get("duration_s", 0),
            callback=callback,
            info=info,
            platform=platform,
            caption_font=caption_font,
            caption_style=caption_style,
            target_clip_count=target_clip_count,
        ),
    )
    return final_clips


def _run_moment_pipeline(
    url: str,
    task_id: str,
    moments,
    top_for_surgery,
    prompt: str,
    video_meta: dict,
    video_duration_s: float,
    callback,
    info: dict,
    platform: str = "tiktok",
    caption_font: str = "studio",
    caption_style: Optional[dict] = None,
    target_clip_count: int = 2,
) -> dict:
    """Run the surgical download + LLM select + render in a thread.

    LLM key is currently INVALID (per 2026-06-14 audit), so this falls
    back to the moment-based heuristic when the LLM fails. The fallback
    picks the top-N moments by score and synthesizes viral_title/caption.
    """
    from ..pipeline import surgical as surgical_stage
    from ..pipeline import renderer as renderer_module
    from ..pipeline.platforms import (
        adjust_clip_to_format as adjust_clip_for_platform,
        style_caption, limit_hashtags,
    )
    from datetime import datetime
    from ..llm.chain import call_with_fallback
    from ..taste.icl import parse_moment_response

    # SIMPLIFIED 2026-06-15: All platforms (TikTok/Reels/Shorts) now share the
    # same universal 9:16 22-30s format. The `platform` param is kept for
    # analytics logging but doesn't change output. The functions above are
    # aliased to the universal format variants.

    INTRO_FILLER_PHRASES = (
        "welcome back", "welcome to", "today's episode", "today we are", "today we have",
        "sponsored by", "hit subscribe", "in this video", "leave a comment", "let's get into it",
        "before we begin", "before we start", "hey guys", "make sure to subscribe"
    )
    is_long_form = (video_duration_s > 180.0) if video_duration_s else (float(info.get("duration_s", 0)) > 180.0 if info else False)

    def _bridge(stage_or_msg: str, msg: str = None, step: int = None, sub_progress: float = None) -> None:
        """Bridge accepts (stage, msg) or just (msg) — the renderer uses a
        single-arg progress callback, but the orchestrator stages use
        (stage, msg). Pass through to the main callback with step/sub_progress
        so the progress bar advances within the step's range.
        """
        try:
            if msg is None:
                callback(stage_or_msg, step=step, sub_progress=sub_progress)
            else:
                callback(msg, step=step, sub_progress=sub_progress)
        except Exception:
            pass

    # Candidate selection is transcript-first. Do not download and analyze the
    # same moments as audio before the LLM: the full timestamped transcript is
    # already in the prompt and the video pass below supplies render media.
    moment_dicts = [
        {
            "start": m.start,
            "end": m.end,
            "hook_score": m.score,
            "components": {"signal": m.score, "type": m.signal_type},
            "reason": m.snippet,
        }
        for m in top_for_surgery
    ]
    segments = []
    _bridge(
        "surgical",
        "Transcript candidates ready — skipped redundant audio/librosa pass",
        step=4,
        sub_progress=0.8,
    )

    # 2. Engagement Signal Layer + Narrative Unit Segmentation + LLM Discovery
    _bridge("taste", "Analyzing engagement signals & narrative units...")
    import time
    from ..signals import (
        fetch_youtube_replay_signal,
        extract_transcript_density_signal,
        fuse_signals,
    )
    from ..segmentation import (
        build_narrative_units,
        refine_clip_candidate,
        apply_length_policy,
        dedup_and_rank_candidates,
        run_clip_check_pass,
    )
    from ..taste.icl import (
        build_relativsauce_prompt,
        parse_moment_response_with_retry,
    )
    from ..utils.config import LONG_VIDEO_THRESHOLD_S

    dur_s = float(video_duration_s or 0)
    orig_transcript = info.get("transcript") or {}
    all_orig_segs = orig_transcript.get("segments") or []

    # 2a. Fetch signals in parallel/safe execution
    sig_start_t = time.time()
    raw_signals = {
        "youtube_replay": fetch_youtube_replay_signal(url),
        "transcript_density": extract_transcript_density_signal(orig_transcript, dur_s),
    }
    fusion_res = fuse_signals(raw_signals, dur_s)
    sig_elapsed_s = time.time() - sig_start_t

    # 2b. Build narrative units
    narrative_units = build_narrative_units(orig_transcript)

    # 2c. Long video Stage A filter (peaks ±90s, <=35% of video) + compressed summary of rest
    is_long_video = (dur_s >= LONG_VIDEO_THRESHOLD_S)
    hot_regions = fusion_res.hot_regions if is_long_video else None
    compressed_summary = None
    transcript_segs_for_prompt = all_orig_segs

    if is_long_video and hot_regions and all_orig_segs:
        # Filter segments to those overlapping hot regions
        hot_segs = []
        non_hot_segs = []
        for s in all_orig_segs:
            s_start = float(s.get("start", 0))
            s_end = float(s.get("end", 0))
            in_hot = any(hr_s <= s_end and s_start <= hr_e for hr_s, hr_e, _ in hot_regions)
            if in_hot:
                hot_segs.append(s)
            else:
                non_hot_segs.append(s)

        transcript_segs_for_prompt = hot_segs if hot_segs else all_orig_segs
        pct_sent = round((len(transcript_segs_for_prompt) / max(1, len(all_orig_segs))) * 100.0, 1)

        # Build 1-line-per-30s compressed summary of non-hot sections
        summary_lines = []
        bucket_s = 30.0
        current_bucket = -1
        current_bucket_text = []

        for s in non_hot_segs:
            s_s = float(s.get("start", 0))
            b_idx = int(s_s // bucket_s)
            if b_idx != current_bucket:
                if current_bucket >= 0 and current_bucket_text:
                    m_s = int((current_bucket * bucket_s) // 60)
                    sec_s = int((current_bucket * bucket_s) % 60)
                    summary_lines.append(f"[{m_s:02d}:{sec_s:02d}] {' '.join(current_bucket_text)[:90]}…")
                current_bucket = b_idx
                current_bucket_text = [s.get("text", "").strip()]
            else:
                current_bucket_text.append(s.get("text", "").strip())

        if current_bucket >= 0 and current_bucket_text:
            m_s = int((current_bucket * bucket_s) // 60)
            sec_s = int((current_bucket * bucket_s) % 60)
            summary_lines.append(f"[{m_s:02d}:{sec_s:02d}] {' '.join(current_bucket_text)[:90]}…")

        compressed_summary = "\n".join(summary_lines[:50])

        _bridge(
            "signals",
            f"Signals: {fusion_res.signals_used or ['baseline']} ({sig_elapsed_s:.2f}s) | "
            f"{len(fusion_res.peaks)} peaks | Long video Stage A filter: {pct_sent}% transcript sent to LLM "
            f"({len(transcript_segs_for_prompt)}/{len(all_orig_segs)} segments)",
        )
    else:
        _bridge(
            "signals",
            f"Signals: {fusion_res.signals_used or ['baseline']} ({sig_elapsed_s:.2f}s) | "
            f"{len(fusion_res.peaks)} peaks | Video <20m: 100% transcript sent to LLM",
        )

    # 2d. Re-build RelatiVSauce prompt with heatmap hints & compressed summary
    prompt = build_relativsauce_prompt(
        transcript_segments=transcript_segs_for_prompt,
        moments=moments,
        video_meta=video_meta,
        hot_regions=hot_regions,
        compressed_summary=compressed_summary,
        max_picks=target_clip_count,
    )

    picks = []
    provider_used = None
    _bridge("taste", "Calling LLM with narrative micro-story prompt...", step=4, sub_progress=0.85)

    cost_before_usd = 0.0
    try:
        from ..llm.cost_control import cost_status
        cost_before_usd = float(cost_status().get("spent_today_usd", 0.0))
    except Exception:
        pass

    try:
        text, provider_used = call_with_fallback(prompt, provider_override=llm_provider_preference)
        if text:
            picks = parse_moment_response_with_retry(
                text,
                llm_callable=lambda p: call_with_fallback(p, provider_override=llm_provider_preference)[0],
                original_prompt=prompt,
                transcript_segments=transcript_segs_for_prompt,
            )
            _bridge("taste", f"LLM ({provider_used}) suggested {len(picks)} candidate story arcs",
                    step=4, sub_progress=0.92)

            # 2e. Boundary refinement + Length policy + Dedup + Check pass
            refined_cands = []
            rejection_log = []

            for p in picks:
                c_start = float(p.get("start", 0))
                idx = min(len(fusion_res.heat_scores) - 1, max(0, int(c_start // 5.0)))
                p["heat_score"] = float(fusion_res.heat_scores[idx]) if len(fusion_res.heat_scores) > 0 else 0.5

                refined, rej_reason = refine_clip_candidate(p, narrative_units)
                if not refined:
                    rejection_log.append(f"boundary ({rej_reason})")
                    continue

                with_len, len_reason = apply_length_policy(refined)
                if not with_len:
                    rejection_log.append(f"length ({len_reason})")
                    continue

                refined_cands.append(with_len)

            if rejection_log:
                _bridge("taste", f"Refinement rejected {len(rejection_log)} candidate(s): {', '.join(rejection_log[:3])}")

            # Deduplication & composite ranking (0.30 standalone + 0.25 completeness + 0.25 hook + 0.20 heat)
            ranked_cands = dedup_and_rank_candidates(refined_cands)

            # Pre-render Check Pass (fast heuristic rule validation — zero extra LLM cost)
            verified_cands = []
            for cand in ranked_cands:
                passed, checked = run_clip_check_pass(
                    cand,
                    narrative_units,
                    llm_callable=None,
                )
                if passed:
                    verified_cands.append(checked)
                else:
                    issues = checked.get("check_pass", {}).get("issues", [])
                    _bridge("taste", f"Check pass dropped candidate: issues={issues}")

            if verified_cands:
                picks = verified_cands
            elif ranked_cands:
                # If all failed check pass, keep top 1 best-effort candidate
                picks = ranked_cands[:1]
    except Exception as e:
        _bridge("taste", f"LLM failed: {e} — using moment-based fallback",
                step=4, sub_progress=0.95)

    # Compute per-run LLM cost
    cost_after_usd = cost_before_usd
    try:
        from ..llm.cost_control import cost_status
        cost_after_usd = float(cost_status().get("spent_today_usd", 0.0))
    except Exception:
        pass
    run_cost_usd = max(0.0, cost_after_usd - cost_before_usd)
    _bridge("taste", f"LLM cost this run: ${run_cost_usd:.4f} (provider: {provider_used or 'none'})",
            step=4, sub_progress=0.95)

    picks_sorted = sorted(
        picks,
        key=lambda p: float(p.get("final_score", p.get("score", p.get("confidence", 0.0)))),
        reverse=True,
    )
    moment_by_idx = {m.index: m for m in moments}

    final_clips: List[Dict] = []
    unverified_count = 0
    if picks_sorted:
        for p in picks_sorted:
            if len(final_clips) >= target_clip_count:
                break
            m = moment_by_idx.get(int(p.get("moment_index", 0)))
            conf = float(p.get("confidence", 0.0))
            if conf < 0.35 and not p.get("verified"):
                unverified_count += 1
                _bridge(
                    "filter",
                    f"  skipping low-conf pick (conf={conf:.2f}): "
                    f"{p.get('reason', '')[:50]}",
                )
                continue

            # Support direct narrative timestamps from full-transcript prompt
            if "start" in p and "end" in p and float(p["end"]) > float(p["start"]):
                clip_start = float(p["start"])
                clip_end = float(p["end"])
            elif m:
                trim_s = float(p.get("trim_start", 0))
                trim_e = float(p.get("trim_end", 0))
                clip_start = max(0, m.start + trim_s)
                clip_end = max(clip_start + 10, m.end - trim_e)
            else:
                continue

            # Prevent duplicate / overlapping clips (IoU < 0.25)
            is_overlapping = False
            for prev in final_clips:
                p_s, p_e = prev["start"], prev["end"]
                inter = max(0.0, min(clip_end, p_e) - max(clip_start, p_s))
                min_len = min(clip_end - clip_start, p_e - p_s)
                if min_len > 0 and (inter / min_len) > 0.30:
                    is_overlapping = True
                    break
            if is_overlapping:
                _bridge("filter", f"  skipping overlapping pick [{clip_start:.1f}-{clip_end:.1f}s]")
                continue

            # Find matching segment or use clip bounds
            matching_seg = max(
                (
                    s for s in segments
                    if min(clip_end, float(s.get("source_end", -1)))
                    > max(clip_start, float(s.get("source_start", -1)))
                ),
                key=lambda s: min(clip_end, float(s.get("source_end", clip_end)))
                - max(clip_start, float(s.get("source_start", clip_start))),
                default=None,
            )
            title = p.get("title") or p.get("viral_title") or (m.snippet[:40] if m else "VIRAL STORY")
            caption = p.get("retention_bridge") or p.get("caption") or ""
            clip_dur = round(clip_end - clip_start, 2)

            # Match original transcript segments inside [clip_start, clip_end]
            clip_segs = [
                s for s in all_orig_segs
                if float(s.get("end", 0)) >= clip_start and float(s.get("start", 0)) <= clip_end
            ]
            final_clips.append({
                "start": round(clip_start, 2),
                "end": round(clip_end, 2),
                "duration_s": clip_dur,
                "fits_shorts": bool(clip_dur <= 180.0),
                "fits_reels_ideal": bool(clip_dur <= 90.0),
                "source_start": matching_seg.get("source_start") if matching_seg else round(clip_start, 2),
                "source_end": matching_seg.get("source_end") if matching_seg else round(clip_end, 2),
                "audio_path": matching_seg.get("audio_path") if matching_seg else None,
                "transcript": {"segments": clip_segs} if clip_segs else None,
                "viral_title": title,
                "caption": caption,
                "hashtags": p.get("hashtags", "#shorts #viral"),
                "reason": p.get("reason", m.snippet[:60] if m else "Story-driven narrative arc"),
                "signal_type": m.signal_type if m else "narrative_arc",
                "llm_provider": provider_used or "claude",
                "confidence": round(conf, 3),
                "score": p.get("final_score", p.get("score")),
                "verified": bool(p.get("verified", True)),
                "is_experiment": bool(p.get("is_experiment", False)),
                "hook_type": p.get("hook_type", "none"),
                "broad_angle": p.get("broad_angle", "none"),
                "arc_type": p.get("arc_type", "story"),
                "hook_text": p.get("hook_text", ""),
                "payoff_text": p.get("payoff_text", ""),
                "callbacks": p.get("callbacks", []),
                "heat_score": p.get("heat_score", 0.5),
                "rubric_ver": p.get("rubric_ver", "sauce-v2"),
            })
    if picks_sorted and unverified_count:
        _bridge(
            "filter",
            f"LLM filtered out {unverified_count} low-conf pick(s); "
            f"keeping {len(final_clips)} high-conf pick(s)",
        )
    if not final_clips and picks_sorted:
        # ALL picks had confidence < 0.4 — fallback: take the top 1
        # (best-effort) so the user gets something to look at, not nothing.
        # Clearly mark it as "best effort" with confidence shown.
        p = picks_sorted[0]
        m = moment_by_idx.get(int(p.get("moment_index", 0)))
        if m:
            _bridge(
                "filter",
                f"All {len(picks_sorted)} picks had low confidence; "
                f"returning top 1 (best effort) so user sees SOMETHING",
            )
            matching_seg = max(
                (
                    s for s in segments
                    if min(m.end, float(s.get("source_end", -1)))
                    > max(m.start, float(s.get("source_start", -1)))
                ),
                key=lambda s: min(m.end, float(s.get("source_end", m.end)))
                - max(m.start, float(s.get("source_start", m.start))),
                default=None,
            )
            final_clips.append({
                "start": round(m.start, 2),
                "end": round(m.end, 2),
                "source_start": matching_seg.get("source_start") if matching_seg else m.start,
                "source_end": matching_seg.get("source_end") if matching_seg else m.end,
                "audio_path": matching_seg.get("audio_path") if matching_seg else None,
                "viral_title": p.get("viral_title", m.snippet[:40]),
                "caption": p.get("caption", ""),
                "hashtags": p.get("hashtags", "#shorts #viral"),
                "reason": p.get("reason", m.snippet[:60]),
                "signal_type": m.signal_type,
                "llm_provider": provider_used or "fallback",
                "confidence": round(float(p.get("confidence", 0.0)), 3),
                "verified": False,
                "best_effort": True,
            })
    if len(final_clips) < target_clip_count:
        # A strict check pass can leave only one excellent clip. Backfill from
        # distinct high-signal moments instead of duplicating that source range.
        # These remain explicitly unverified/best-effort in the result metadata.
        _bridge(
            "taste",
            f"Only {len(final_clips)} verified clip(s) survived — "
            f"backfilling the best distinct moments up to {target_clip_count}",
        )
        for m in moments:
            if len(final_clips) >= target_clip_count:
                break
            # Skip intro filler in fallback for long videos
            if is_long_form and m.start < 45.0:
                snippet_lower = (m.snippet or "").lower()
                if any(phrase in snippet_lower for phrase in INTRO_FILLER_PHRASES):
                    continue
            # Check overlap against already chosen fallback clips
            is_dup = False
            for prev in final_clips:
                p_s, p_e = prev["start"], prev["end"]
                inter = max(0.0, min(m.end, p_e) - max(m.start, p_s))
                union = max(m.end, p_e) - min(m.start, p_s)
                if union > 0 and (inter / union) > 0.15:
                    is_dup = True
                    break
                if abs(m.start - p_s) < 25.0:
                    is_dup = True
                    break
            if is_dup:
                continue

            matching_seg = max(
                (
                    s for s in segments
                    if min(m.end, float(s.get("source_end", -1)))
                    > max(m.start, float(s.get("source_start", -1)))
                ),
                key=lambda s: min(m.end, float(s.get("source_end", m.end)))
                - max(m.start, float(s.get("source_start", m.start))),
                default=None,
            )
            # Generate a dynamic, contextual title from the moment's snippet rather than a generic placeholder
            snippet_words = (m.snippet or "").strip().split()
            if len(snippet_words) >= 3:
                clean_snippet_title = " ".join(snippet_words[:6]).strip(".,?!-:;\"' ")
                default_title = f"{clean_snippet_title}..."
            else:
                default_title = {
                    "peak": "The Key Moment",
                    "valley": "The Turning Point",
                    "density": "Core Takeaway",
                    "silence": "Watch Carefully",
                }.get((m.signal_type or "").split("+")[-1] if m.signal_type else "", "Key Highlight")
            final_clips.append({
                "start": round(m.start, 2),
                "end": round(m.end, 2),
                "source_start": matching_seg.get("source_start") if matching_seg else m.start,
                "source_end": matching_seg.get("source_end") if matching_seg else m.end,
                "audio_path": matching_seg.get("audio_path") if matching_seg else None,
                "viral_title": default_title,
                "caption": m.snippet[:100] if m.snippet else f"{m.signal_type} at {m.start:.0f}s",
                "hashtags": "#shorts #viral",
                "reason": f"signal={m.signal_type} score={m.score:.2f}",
                "signal_type": m.signal_type,
                "llm_provider": "fallback",
                "verified": False,
                "best_effort": True,
            })

    # Final invariant: a source range is rendered at most once, even if a
    # future selector or fallback accidentally emits it more than once.
    from ..segmentation import deduplicate_preserving_order
    selected_count = len(final_clips)
    final_clips = deduplicate_preserving_order(final_clips)
    final_clips = final_clips[:target_clip_count]
    if len(final_clips) != selected_count:
        _bridge(
            "filter",
            f"Removed {selected_count - len(final_clips)} duplicate clip range(s) before render",
        )

    # 3a. Validate format bounds & natural variable durations
    try:
        adjusted = []
        for clip in final_clips:
            c_start = float(clip.get("start", 0))
            c_end = float(clip.get("end", 0))
            new_start, new_end, reason = adjust_clip_for_platform(
                c_start,
                c_end,
                video_duration=float(video_duration_s),
            )
            # Keep the LLM's calibrated start, then include three seconds of
            # natural source continuation. The optional thumbnail CTA remains
            # a separate four-second outro appended by the renderer.
            calibrated_end = new_end
            source_ceiling = float(video_duration_s) if float(video_duration_s or 0) > 0 else new_end + 3.0
            new_end = min(source_ceiling, new_end + 3.0)
            if new_end > calibrated_end:
                reason = f"{reason}; +{new_end - calibrated_end:.1f}s natural tail"
            clip["start"] = round(new_start, 2)
            clip["end"] = round(new_end, 2)
            clip["duration_s"] = round(new_end - new_start, 2)
            clip["fits_shorts"] = bool(clip["duration_s"] <= 180.0)
            clip["fits_reels_ideal"] = bool(clip["duration_s"] <= 90.0)
            clip["source_start"] = round(new_start, 2)
            clip["source_end"] = round(new_end, 2)
            all_orig_segs = info.get("transcript", {}).get("segments", []) if info.get("transcript") else []
            clip_segs = [
                seg for seg in all_orig_segs
                if float(seg.get("end", 0)) >= new_start
                and float(seg.get("start", 0)) <= new_end
            ]
            clip["transcript"] = {"segments": clip_segs} if clip_segs else None
            clip["_platform_adjustment"] = reason
            clip["caption"] = style_caption(clip.get("caption", ""))
            clip["hashtags"] = limit_hashtags(clip.get("hashtags", ""))
            adjusted.append(clip)
        final_clips = adjusted

        # Platform-bound adjustments can make previously distinct candidates
        # converge onto the same source range. Enforce uniqueness at the last
        # possible point before any downloads or renders are scheduled.
        from ..segmentation import deduplicate_preserving_order
        adjusted_count = len(final_clips)
        final_clips = deduplicate_preserving_order(final_clips)
        if len(final_clips) != adjusted_count:
            _bridge(
                "filter",
                f"Removed {adjusted_count - len(final_clips)} duplicate range(s) after format adjustment",
            )

        final_durations = [round(c["duration_s"], 1) for c in final_clips]
        _bridge("platform", f"Final clips approved for render: {len(final_clips)} | Durations: {final_durations}")
    except Exception as e:
        _bridge("platform", f"Format adjustment skipped: {e}")

    # 3b. Re-fetch VIDEO for the LLM-picked moments. The audio-only surgical
    # pass above is great for cheap LLM scoring, but the renderer needs
    # real video frames to make a watchable clip (otherwise it falls back
    # to a still+audio composition which looks like static text).
    _bridge("video_dl", f"Downloading {len(final_clips)} video segment(s) for rendering...",
            step=4, sub_progress=0.97)

    _vid_done = {"n": 0}

    def _on_vid_done(idx: int, total: int, ok: bool) -> None:
        _vid_done["n"] += 1
        # The video download happens after step 4 is done; we just push
        # the message and let the bar hover near 70% until we move to step 5.
        _bridge(
            "video_dl",
            f"Downloaded {_vid_done['n']}/{total} video segments",
            step=4,
            sub_progress=0.99,
        )

    video_candidates = [
        {
            "start": c.get("start", c.get("source_start")),
            "end": c.get("end", c.get("source_end")),
        }
        for c in final_clips
    ]

    # Check segment cache for each LLM pick. If hit, reuse; if miss, download once.
    from ..pipeline.cache import get_cached_segment
    from ..utils.config import SURGICAL_BUFFER_SECONDS as _PAD

    n_cached = 0
    n_need_download = 0
    for i, c in enumerate(final_clips):
        c_start = float(c.get("start", c.get("source_start", 0)))
        c_end = float(c.get("end", c.get("source_end", c_start + 15)))
        cached = get_cached_segment(url, c_start, c_end)
        if cached is not None:
            c["video_path"] = str(cached)
            c["video_source_start"] = max(0.0, c_start - _PAD)
            c["video_source_end"] = c_end + _PAD
            n_cached += 1
            _bridge("video_dl", f"  segment {i+1} cache hit [{c_start:.1f}-{c_end:.1f}]",
                    step=4, sub_progress=(i + 0.5) / len(final_clips))
            _on_vid_done(0, len(final_clips), True)
        else:
            c["_needs_video_download"] = True
            n_need_download += 1

    if n_cached > 0:
        _bridge("video_dl", f"Segment cache: {n_cached} hit, {n_need_download} to download",
                step=4, sub_progress=0.5)

    # All clips either have video_path now, or are about to be downloaded.
    # NEW 2026-06-16: STREAMING RENDER. Instead of downloading ALL segments
    # then rendering all, do download+face+render as a per-clip pipeline.
    # Each clip is fully independent — the slowest download no longer blocks
    # the fastest render. Expected saving: 30-90s on a 3-clip run.
    _bridge("render", f"Streaming {len(final_clips)} clip(s) — download+face+render in parallel...",
            step=6, sub_progress=0.0)
    rendered_by_rank: Dict[int, Dict] = {}

    from concurrent.futures import ThreadPoolExecutor, as_completed
    from ..utils.config import SURGICAL_BUFFER_SECONDS
    video_id = (
        info.get("transcript", {}).get("video_id")
        if info.get("transcript")
        else None
    )
    if not video_id:
        try:
            from ..pipeline.transcript_fetcher import _extract_video_id
            video_id = _extract_video_id(url)
        except Exception:
            video_id = None
    video_id = video_id or f"yt_{task_id[:12]}"

    def _process_clip(i: int, clip: dict) -> Optional[Dict]:
        """Full per-clip pipeline: download (if needed) → face → render.
        Each clip runs independently in its own thread.
        """
        try:
            # 1. If we still need to download, do it now (in parallel with others)
            if clip.get("_needs_video_download") or not clip.get("video_path"):
                cand = {"start": clip.get("start", clip.get("source_start")),
                        "end": clip.get("end", clip.get("source_end"))}
                dl_result = surgical_stage.surgical_download_video_youtube(
                    url, [cand], task_id,
                    log_fn=_bridge,
                    on_segment_done=_on_vid_done,
                )
                if dl_result and dl_result[0].get("video_path"):
                    clip["video_path"] = dl_result[0]["video_path"]
                    clip["video_source_start"] = dl_result[0].get("source_start")
                    clip["video_source_end"] = dl_result[0].get("source_end")
                    from ..pipeline.cache import save_segment_cache
                    seg_path = Path(clip["video_path"])
                    if seg_path.exists():
                        save_segment_cache(url, cand["start"], cand["end"], seg_path)

            # The dynamic framing engine performs its own YuNet tracking. The
            # old face_stage pass duplicated that work for every selected clip
            # and its result was never consumed by the dynamic renderer.
            clip["face_data"] = None

            # 2. Render
            source_for_renderer = (
                clip.get("video_path")
                or clip.get("audio_path")
                or info.get("audio_path")
            )
            if not source_for_renderer or not Path(str(source_for_renderer)).exists():
                _bridge("render", f"  clip {i+1} failed: media file not found on disk for rendering")
                return None

            if not clip.get("video_path") and not clip.get("audio_path") and info.get("audio_path"):
                _vsrc = 0.0
                clip["video_source_start"] = 0.0
                clip["video_source_end"] = float(info.get("duration_s", 999999))
            else:
                _vsrc = clip.get("video_source_start")
            # FIX 2026-06-16: use video_source_start (padded) not source_start (audio, unpadded).
            # video_source_start is set when video segment is attached to clip.
            # If not set (e.g. video downloaded inline below), compute it now.
            if _vsrc is None:
                # Video was just downloaded inline — surgical uses padded boundaries.
                _vsrc = max(0.0, float(clip.get("source_start", clip.get("start", 0))) - SURGICAL_BUFFER_SECONDS)
                clip["video_source_start"] = _vsrc
                clip["video_source_end"] = float(clip.get("source_end", clip.get("end", 0))) + SURGICAL_BUFFER_SECONDS
            seg_start = _vsrc  # video file starts at padded boundary
            # Pass absolute start/end to render_clip — it computes rel_start/rel_end internally.
            # Only set video_source_start so render_clip knows where the file actually starts.
            render_clip = dict(clip)
            render_clip["caption_font"] = caption_font
            render_clip["style"] = caption_style or {"preset": caption_font, "overrides": {}}
            render_clip["video_path"] = str(source_for_renderer)
            render_clip["video_source_start"] = _vsrc
            render_clip["video_source_end"] = clip.get("video_source_end", float(clip.get("source_end", clip.get("end", 0))) + SURGICAL_BUFFER_SECONDS)
            render_clip["url"] = url
            if "transcript" in clip:
                render_clip["transcript"] = clip["transcript"]
            out = renderer_module.render_clip(
                video_path=source_for_renderer,
                clip=render_clip,
                clip_index=i + 1,
                video_id=video_id or "local",
                task_id=task_id,
                progress_callback=lambda m: _bridge("render", m),
            )
            if out:
                for caption_key in ("caption_words", "caption_style", "caption_layout", "subject_track"):
                    if render_clip.get(caption_key) is not None:
                        out[caption_key] = render_clip[caption_key]
                out["start"] = clip.get("start")
                out["end"] = clip.get("end")
                out["source_start"] = clip.get("source_start")
                out["source_end"] = clip.get("source_end")
                return {**clip, **out}
        except Exception as e:
            _bridge("render", f"  clip {i+1} failed: {e}")
        return None

    # Run all clips as independent streaming pipelines. as_completed yields
    # results in the order they finish — so the fastest clip's render can
    # complete and be returned before the slowest download even finishes.
    pool = ThreadPoolExecutor(max_workers=min(3, len(final_clips)), thread_name_prefix="stream")
    try:
        futures = {pool.submit(_process_clip, i, c): i for i, c in enumerate(final_clips)}
        completed_count = 0
        try:
            for fut in as_completed(futures, timeout=420):
                i = futures[fut]
                try:
                    out = fut.result()
                    if out:
                        rendered_by_rank[i] = out
                except Exception as e:
                    _bridge("render", f"  clip {i+1} worker crashed: {e}")
                completed_count += 1
                _bridge("render", f"Rendered {completed_count}/{len(final_clips)} clips",
                        step=6, sub_progress=completed_count / max(1, len(final_clips)))
        except TimeoutError:
            _bridge("render", f"Render deadline reached — keeping {len(rendered_by_rank)} completed clip(s)")
            if not rendered_by_rank:
                raise RuntimeError("All clip render tasks timed out")
    finally:
        pool.shutdown(wait=False, cancel_futures=True)

    # Parallel workers finish in duration/hardware order. Restore the original
    # LLM rank so clip 1 and cache slices always mean "best clip", not
    # "fastest render".
    rendered = [rendered_by_rank[i] for i in sorted(rendered_by_rank)]
    _bridge("done", f"Pipeline complete: {len(rendered)} clip(s)")
    from ..segmentation import deduplicate_preserving_order
    rendered_count = len(rendered)
    rendered = deduplicate_preserving_order(rendered)
    if len(rendered) != rendered_count:
        _bridge(
            "filter",
            f"Removed {rendered_count - len(rendered)} duplicate rendered output(s)",
        )
    if not rendered:
        raise RuntimeError(
            "Rendering produced zero playable clips. The task is failed and will not be reported as successful."
        )
    # Strip non-serializable / circular fields before returning
    clean_rendered = []
    for c in rendered:
        clean = {k: v for k, v in c.items() if k not in ("face_data", "transcript")}
        # SIMPLIFIED 2026-06-15: `platform` is now cosmetic/analytics-only.
        # All clips are the same universal 9:16 22-30s format.
        clean["platform"] = "universal"
        clean_rendered.append(clean)
    n_clips = max(1, len(clean_rendered))  # always show per-pick cost
    return {
        "clips": clean_rendered,
        "hooks": [m.__dict__ for m in moments],  # serialize dataclasses
        "video_meta": video_meta,
        "stages_run": [1, 2, 4, 5, 6, 7, 8],
        "task_id": task_id,
        "llm_provider": provider_used or "fallback",
        "llm_cost_usd": round(run_cost_usd, 6),
        "cost_per_clip_usd": round(run_cost_usd / n_clips, 6),
        "clips_requested": target_clip_count,
        "clips_suggested_by_llm": len(picks_sorted),
        "clips_verified": sum(1 for c in clean_rendered if c.get("verified")),
        "clips_unverified": sum(1 for c in clean_rendered if not c.get("verified")),
        "best_effort_count": sum(1 for c in clean_rendered if c.get("best_effort")),
        "platform": "universal",  # SIMPLIFIED 2026-06-15
        "target_clip_count": target_clip_count,
        "duration": float(video_duration_s or 0.0),
    }


async def run_youtube_pipeline_async(
    task_id: str,
    url: str,
    callback,
    platform: str = "tiktok",
    caption_font: str = "studio",
    caption_style: Optional[dict] = None,
    requested_clip_count: Optional[int] = None,
    credit_reservation: Optional[CreditReservation] = None,
    is_remake: bool = False,
    max_source_duration_s: Optional[int] = None,
    llm_provider_preference: Optional[str] = None,
):
    async def settle_credits(output_clips: int = 0, *, failed: bool = False):
        if credit_reservation is None:
            return
        try:
            from ..database.session import async_session
            async with async_session() as credit_session:
                await settle_job(
                    credit_session,
                    credit_reservation,
                    output_clips=output_clips,
                    failed=failed,
                )
        except Exception as credit_error:
            # Accounting failures must be visible, but must not replace the
            # pipeline's original result or make a successful clip disappear.
            print(f"[CREDITS] Settlement failed for {task_id}: {credit_error}")

    # Unified Database Cache Check (Supabase / PostgreSQL with local file fallback)
    # Checks by canonical 11-char video ID so all URL variants share the same entry.
    try:
        from ..caching.service import get_cached_video
        from ..database.session import async_session, _DB_AVAILABLE
        cached = None
        if is_remake or caption_font != "studio":
            cached = None
        elif _DB_AVAILABLE:
            async with async_session() as session:
                cached = await get_cached_video(session, url, verify_media=True)
        else:
            cached = await get_cached_video(None, url, verify_media=True)

        if cached and cached.get("clips"):
            from ..segmentation import deduplicate_preserving_order
            from ..pipeline.clip_count import resolve_target_clip_count
            cached_duration = float(cached.get("duration_s") or cached.get("duration") or 0.0)
            if max_source_duration_s and cached_duration > max_source_duration_s:
                raise RuntimeError(
                    f"SOURCE_TOO_LONG: this plan accepts source videos up to {max_source_duration_s // 60} minutes."
                )
            cached_target = (
                resolve_target_clip_count(cached_duration, requested_clip_count)
                if requested_clip_count is not None or cached_duration > 0
                else None
            )
            clips = deduplicate_preserving_order(cached.get("clips", []))
            if cached_target is None or len(clips) < cached_target:
                cached = None
            else:
                clips = clips[:cached_target]

        if cached and cached.get("clips"):
            savings = cached.get("_cache_savings_usd", 0.0)
            age_h = cached.get("_cache_age_hours", 0.0)
            task_store.update_task(
                task_id,
                status=TaskStatus.COMPLETE,
                progress=100,
                step_number=6,
                step_name="Complete",
                clips=clips,
                current_step=(
                    f"Cache hit · {len(clips)} clips · "
                    f"${savings:.4f} saved · age {age_h:.1f}h"
                ),
            )
            callback(
                f"CACHE HIT: {len(clips)} clips returned from database cache "
                f"(${savings:.4f} saved, age {age_h:.1f}h)",
                step=6, progress=100,
            )
            task_store.update_task(
                task_id,
                llm_cost_usd=0.0,
                cost_per_clip_usd=0.0,
                llm_provider=cached.get("llm_provider", "database_cache"),
                cache_hit=True,
                cache_age_hours=age_h,
                cache_savings_usd=savings,
            )
            await settle_credits(len(clips))
            _release_active_task(task_id)
            task_store.try_promote_queued()
            return
    except Exception as e:
        # Cache must never break the pipeline — log and continue
        print(f"[CACHE] Database cache check failed (continuing): {e}")

    if PIPELINE_VERSION == 2:
        # Delegate to the new orchestrator.
        try:
            result = await run_youtube_orchestrator(
                task_id,
                url,
                callback,
                platform=platform,
                caption_font=caption_font,
                caption_style=caption_style,
                requested_clip_count=requested_clip_count,
                max_source_duration_s=max_source_duration_s,
                llm_provider_preference=llm_provider_preference,
            )
            clips = result.get("clips", [])
            cost_usd = result.get("llm_cost_usd", 0.0)
            cpp = result.get("cost_per_clip_usd", 0.0)
            llm_prov = result.get("llm_provider", "fallback")
            task_store.update_task(
                task_id,
                status=TaskStatus.COMPLETE,
                progress=100,
                step_number=6,
                step_name="Complete",
                clips=clips,
                current_step=(
                    f"Complete - {len(clips)} clips · "
                    f"${cost_usd:.4f} LLM (${cpp:.4f}/clip) · {llm_prov}"
                ),
            )
            callback(
                f"SUCCESS: {len(clips)} clips · ${cost_usd:.4f} LLM · ${cpp:.4f}/clip",
                step=6, progress=100,
            )
            # Persist cost data in the task for the status endpoint
            task_store.update_task(
                task_id,
                llm_cost_usd=cost_usd,
                cost_per_clip_usd=cpp,
                llm_provider=llm_prov,
                clips_verified=result.get("clips_verified"),
                clips_unverified=result.get("clips_unverified"),
                clips_requested=result.get("clips_requested"),
                honest_result=result.get("honest_result", False),
                honest_message=result.get("honest_message"),
            )
            # Save to Database Cache (Supabase PostgreSQL + local file backup)
            # Universal cache key (canonical video_id) so all formats share the entry.
            if caption_font == "studio" and clips and clips[0].get("file_path"):
                try:
                    from ..caching.service import save_cached_video
                    from ..database.session import async_session, _DB_AVAILABLE
                    if _DB_AVAILABLE:
                        async with async_session() as session:
                            await save_cached_video(session, url, result)
                    else:
                        await save_cached_video(None, url, result)
                except Exception as e:
                    print(f"[CACHE] Database cache save failed (continuing): {e}")
            await settle_credits(len(clips))
        except Exception as e:
            import traceback
            tb = traceback.format_exc()
            print(f"[PIPELINE ERROR TRACEBACK]:\n{tb}")
            task_store.update_task(
                task_id, status=TaskStatus.FAILED, error=f"{e} | {tb.splitlines()[-2] if len(tb.splitlines()) > 1 else ''}",
            )
            callback(f"FAILED: {e}", step=6, progress=0)
            await settle_credits(failed=True)
        _release_active_task(task_id)
        task_store.try_promote_queued()
        return

    # Legacy 6-stage path (PIPELINE_VERSION=1)
    funnel = YouTubeSurgicalFunnel(url, task_id, callback)

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, funnel.run)

    if result.get("success"):
        clips = result.get("clips", [])
        task_store.update_task(
            task_id,
            status=TaskStatus.COMPLETE,
            progress=100,
            step_number=6,
            step_name="Complete",
            clips=clips,
            current_step=f"Complete - {len(clips)} clips generated"
        )
        callback(f"SUCCESS: {len(clips)} clips generated!", step=6, progress=100)
        await settle_credits(len(clips))
    else:
        task_store.update_task(
            task_id,
            status=TaskStatus.FAILED,
            error=result.get("error", "Unknown error")
        )
        await settle_credits(failed=True)

    _release_active_task(task_id)
    task_store.try_promote_queued()


import re

YOUTUBE_URL_REGEX = re.compile(
    r'^(https?://)?(www\.)?(youtube\.com/watch\?v=|youtu\.be/|youtube\.com/shorts/|youtube\.com/embed/)[A-Za-z0-9_-]{11}',
    re.IGNORECASE
)

router = APIRouter(prefix="/process/youtube", tags=["YouTube"])


@router.post("", response_model=ProcessResponse)
async def process_youtube_url(
    request: dict,
    user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    url = (request.get("url") or "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")
    if not YOUTUBE_URL_REGEX.match(url):
        raise HTTPException(status_code=400, detail="Invalid YouTube URL format. Must be a valid youtube.com or youtu.be link.")
    # SIMPLIFIED 2026-06-15: `platform` is now cosmetic/analytics-only.
    # All platforms (TikTok/Reels/Shorts) produce the same universal 9:16 22-30s
    # clip. We keep the param for downstream analytics/logging, but no longer
    # differentiate output. Default = "universal" for clarity.
    platform = (request.get("platform") or "universal").lower().strip() or "universal"
    from ..pipeline.captions import normalize_caption_preset
    caption_font = normalize_caption_preset(request.get("caption_font"))
    raw_caption_style = request.get("caption_style") if isinstance(request.get("caption_style"), dict) else None
    caption_style = raw_caption_style or {"preset": caption_font, "overrides": {}}
    is_remake = bool(request.get("is_remake", False))
    raw_clip_count = request.get("clip_count")
    # Two clips is the default first run and exactly matches the two starter
    # credits granted during onboarding. Users may explicitly request 1..4.
    requested_clip_count = 1 if is_remake else 2
    if raw_clip_count not in (None, "", "auto"):
        try:
            requested_clip_count = int(raw_clip_count)
        except (TypeError, ValueError):
            raise HTTPException(status_code=422, detail="clip_count must be an integer from 1 to 4, or omitted for Auto")
        if requested_clip_count < 1 or requested_clip_count > 4:
            raise HTTPException(status_code=422, detail="clip_count must be between 1 and 4")

    plan_concurrency = concurrency_limit(user.plan_tier)
    # Serialize admission per user across backend workers. The task row is
    # committed before the advisory lock is released by TaskRepository.create.
    await session.execute(text("SELECT pg_advisory_xact_lock(hashtext(:user_id))"), {"user_id": user.id})
    active_count = (await session.execute(
        select(func.count(TaskModel.task_id)).where(
            TaskModel.user_id == user.id,
            TaskModel.status.in_(["queued", "processing"]),
        )
    )).scalar() or 0
    if active_count >= plan_concurrency:
        raise HTTPException(
            status_code=409,
            detail={"code": "ACTIVE_JOB_LIMIT", "message": f"Your plan allows {plan_concurrency} active processing task(s) at a time."},
        )

    task = task_store.create_task(f"YouTube [{platform}]: {url[:50]}", user_id=user.id, persist=False)
    _active_user_tasks.setdefault(user.id, set()).add(task["task_id"])

    try:
        await TaskRepository.create(
            session,
            task["url"],
            task["task_id"],
            user_id=user.id,
            status=task["status"].value,
        )
        reservation = await reserve_for_job(
            session,
            user_id=user.id,
            task_id=task["task_id"],
            clip_count=requested_clip_count,
            is_remake=is_remake,
        )
    except IntegrityError:
        await session.rollback()
        _release_active_task(task["task_id"])
        raise HTTPException(409, f"Your plan allows {plan_concurrency} active processing task(s) at a time.") from None
    except Exception:
        _release_active_task(task["task_id"])
        task_store.update_task(
            task["task_id"],
            status=TaskStatus.FAILED,
            error="Credit reservation failed",
        )
        raise

    loop = asyncio.get_event_loop()
    _active_tasks[task["task_id"]] = loop.create_task(
        run_youtube_pipeline_async(
            task["task_id"],
            url,
            create_progress_callback(task["task_id"]),
            platform=platform,
            caption_font=caption_font,
            caption_style=caption_style,
            requested_clip_count=requested_clip_count,
            credit_reservation=reservation,
            is_remake=is_remake,
            max_source_duration_s=source_limit_seconds(
                user.plan_tier,
                is_admin=user.is_admin or is_admin_email(user.email),
            ),
            llm_provider_preference="claude" if user.plan_tier in {"go", "creator_go"} else None,
        )
    )

    return ProcessResponse(
        task_id=task["task_id"],
        status=task["status"],
        credits_reserved=reservation.reserved,
        credits_remaining=reservation.balance_after,
    )
