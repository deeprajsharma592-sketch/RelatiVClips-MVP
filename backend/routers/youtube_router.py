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

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel
from typing import Optional

from ..models import ProcessResponse, TaskStatus
from ..utils.task_store import task_store
from ..utils.config import (
    TEMP_DIR, YTDLP_PATH, FFMPEG_PATH, FFPROBE_PATH,
    TARGET_SAMPLE_RATE, PEAK_THRESHOLD_MULTIPLIER,
    NUM_CLIPS_YOUTUBE, SURGICAL_DOWNLOAD_SECONDS,
    MAX_SURGICAL_SEGMENTS, COOKIES_PATH, MIN_CLIPS, PIPELINE_VERSION,
)
from ..pipeline.transcript_fetcher import _download_audio

progress_logs = {}
_active_tasks = {}

VIRAL_KEYWORDS = [
    'insane', 'huge', 'wow', 'literally', 'never', 'amazing', 'incredible',
    'unbelievable', 'crazy', 'nuts', 'absolutely', 'totally', 'seriously',
    'actually', 'basically', 'honestly', 'truthfully', 'this is', 'listen',
    'watch', 'check', 'look', "here's", "here is", "let me", "going to",
    "quick story", "fun fact", "did you know", "most important", "key point",
    "main reason", "guess what", "wait for it", "hold on", "don't skip"
]

try:
    import librosa
    import numpy as np
    LIBROSA_AVAILABLE = True
except ImportError:
    LIBROSA_AVAILABLE = False


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

        if LIBROSA_AVAILABLE and os.path.exists(audio_path):
            try:
                self.log("  Running Librosa audio analysis...")
                y, sr = librosa.load(audio_path, sr=TARGET_SAMPLE_RATE, mono=True)
                hop_length = 512
                rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]
                mean_energy = float(np.mean(rms))
                threshold = mean_energy * PEAK_THRESHOLD_MULTIPLIER

                for i, energy in enumerate(rms):
                    if energy > threshold:
                        timestamp = float(i * hop_length / sr)
                        peaks.append({
                            "timestamp": round(timestamp, 2),
                            "energy_score": round(float(energy), 4),
                            "relative_to_mean": round(float(energy / mean_energy), 2)
                        })

                peaks.sort(key=lambda x: x["energy_score"], reverse=True)
                peaks = peaks[:15]
                self.log(f"  Found {len(peaks)} audio peaks")
            except Exception as e:
                self.log(f"  Librosa error: {e}")

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

            ytdlp_cmd = [
                YTDLP_PATH,
                "--download-sections", f"*{ts['start']}-{ts['end']}",
                "--force-keyframes-at-cuts",
                "-f", "best[height<=720]+bestaudio/best[height<=720]",
                "--merge-output-format", "mp4",
                "-o", str(video_path),
                "--no-warnings",
                "--no-check-certificates",
                self.url
            ]

            if COOKIES_PATH and COOKIES_PATH.exists():
                ytdlp_cmd.extend(["--cookies", str(COOKIES_PATH)])

            player_clients = ["web", "android", "ios", "tv"]
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


def create_progress_callback(task_id: str):
    def callback(message: str, step: int = None, progress: int = None):
        if task_id not in progress_logs:
            progress_logs[task_id] = []
        progress_logs[task_id].append({
            "timestamp": __import__('datetime').datetime.now().isoformat(),
            "message": message
        })
        updates = {"current_step": message}
        if step is not None:
            updates["step_number"] = step
        if progress is not None:
            updates["progress"] = progress
        task_store.update_task(task_id, **updates)
    return callback


async def run_youtube_orchestrator(task_id: str, url: str, callback):
    """New 9-stage pipeline path (PIPELINE_VERSION=2).

    The orchestrator downloads surgically via stage 4 and transcribes per-segment
    via stage 5 — no full audio download. This is the strategic direction.

    Cost-saver: tries yt-dlp captions first. If YouTube has auto-captions, we
    skip the RunPod transcription call entirely. This is the difference between
    $0 and $0.01+ per video.
    """
    from ..pipeline.orchestrator import run_new_pipeline

    def _bridge(stage: str, msg: str) -> None:
        # Map orchestrator progress (stage, msg) → legacy (msg, step, progress)
        try:
            step = int(stage) if str(stage).isdigit() else None
        except Exception:
            step = None
        try:
            callback(msg, step=step)
        except Exception:
            pass

    # Try YouTube captions first (free, no RunPod cost).
    precomputed_transcript = None
    try:
        from ..pipeline.transcript_fetcher import fetch_transcript
        callback("Checking YouTube captions...", step=1)
        log_messages = []
        tr = fetch_transcript(url, task_id, log=lambda m: log_messages.append(m))
        if tr and tr.get("segments") and tr.get("source") in ("ytdlp_vtt", "ytdlp_srt"):
            precomputed_transcript = tr
            callback(
                f"Found {len(tr['segments'])} caption segments — skipping cloud transcription",
                step=1,
            )
        else:
            for m in log_messages:
                callback(m, step=1)
    except Exception as e:
        callback(f"Caption fetch failed: {e} — will use cloud transcription", step=1)

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        lambda: run_new_pipeline(
            source=url,
            # Stage 1 (analyze) + Stage 3 (hooks from transcript) + Stage 4
            # (surgical) + downstream. Stage 2 (energy peaks) is skipped
            # because we don't have full audio yet — captions came from
            # YouTube directly. The hook detector falls back to a
            # transcript-only scoring pass when no peaks are present.
            stages=[1, 3, 4, 5, 6, 7, 8, 9],
            progress=_bridge,
            task_id=task_id,
            precomputed_transcript=precomputed_transcript,
        ),
    )
    return result


async def run_youtube_pipeline_async(task_id: str, url: str, callback):
    if PIPELINE_VERSION == 2:
        # Delegate to the new orchestrator.
        try:
            result = await run_youtube_orchestrator(task_id, url, callback)
            clips = result.get("clips", [])
            task_store.update_task(
                task_id,
                status=TaskStatus.COMPLETE,
                progress=100,
                step_number=9,
                step_name="Complete",
                clips=clips,
                current_step=f"Complete - {len(clips)} clips generated",
            )
            callback(f"SUCCESS: {len(clips)} clips generated!", step=9, progress=100)
        except Exception as e:
            task_store.update_task(
                task_id, status=TaskStatus.FAILED, error=str(e),
            )
            callback(f"FAILED: {e}", step=9, progress=0)
        _active_tasks.pop(task_id, None)
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
    else:
        task_store.update_task(
            task_id,
            status=TaskStatus.FAILED,
            error=result.get("error", "Unknown error")
        )

    _active_tasks.pop(task_id, None)
    task_store.try_promote_queued()


router = APIRouter(prefix="/process/youtube", tags=["YouTube"])


@router.post("", response_model=ProcessResponse)
async def process_youtube_url(request: dict):
    url = request.get("url")
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")

    task = task_store.create_task(f"YouTube: {url[:50]}")

    loop = asyncio.get_event_loop()
    _active_tasks[task["task_id"]] = loop.create_task(
        run_youtube_pipeline_async(
            task["task_id"],
            url,
            create_progress_callback(task["task_id"])
        )
    )

    return ProcessResponse(
        task_id=task["task_id"],
        status=task["status"]
    )
