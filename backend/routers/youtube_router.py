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
from typing import Optional, List, Dict
from pathlib import Path

from ..models import ProcessResponse, TaskStatus
from ..utils.task_store import task_store, PIPELINE_STEPS
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


async def run_youtube_orchestrator(task_id: str, url: str, callback):
    """New pipeline path (PIPELINE_VERSION=2) — caption-first, audio-only-for-librosa.

    Flow (the "v3" pipeline):
      1. Try YouTube captions via yt-dlp (FREE, no audio download)
      2. If captions succeed: build candidate moments from word density + pauses
      3. If captions fail: download audio (low priority), run librosa peaks + valleys,
         build candidate moments from those
      4. Run the rest of the pipeline (surgical, render) on top moments
      5. LLM (claude/deepseek) picks 2-5 with strict JSON, low token cost

    Audio is NEVER used as input to the LLM. Audio is ONLY used for librosa
    energy analysis when captions aren't available. Captions are 80%+ of the
    pipeline; audio is the fallback.
    """
    from ..pipeline.orchestrator import run_new_pipeline
    from ..pipeline.moment_detector import detect_moments, Moment
    from ..taste.icl import build_moment_prompt, parse_moment_response

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
    # Try captions first; if they fail, download audio for librosa.
    callback("Fetching captions and source metadata...", step=1, sub_progress=0.0)
    moments, info = detect_moments(
        source=url,
        task_id=task_id,
        log=lambda m: callback(m, step=1, sub_progress=0.5),
    )
    callback("Source analyzed", step=1, sub_progress=1.0)

    if not moments:
        callback("No candidate moments found — pipeline will not render", step=2, sub_progress=0.0)
        return {
            "clips": [],
            "hooks": [],
            "transcript": info.get("transcript"),
            "video_meta": info,
            "stages_run": [1, 2],
            "task_id": task_id,
        }
    callback(
        f"Built {len(moments)} candidate moments from "
        f"{'captions (no audio download)' if info['source'] == 'captions' else 'audio peaks + valleys'}",
        step=2,
        sub_progress=1.0,
    )

    # --- STAGE 3: download the source video so we can extract audio per moment
    # (PIPELINE_STEPS slot 3 is "Transcribing audio" — collapsed with stage 1
    # since we read captions first; we still update the slot so the bar moves
    # smoothly through the 20-60% range).
    callback("Preparing source media for clip extraction...", step=3, sub_progress=0.5)

    # --- STAGE 3-5: surgical download of top moments ---
    # We use the top 8 moments (more than LLM picks so the LLM has good candidates)
    top_for_surgery = moments[:8]
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
    prompt = build_moment_prompt(moments, video_meta, max_picks=3)
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
) -> dict:
    """Run the surgical download + LLM select + render in a thread.

    LLM key is currently INVALID (per 2026-06-14 audit), so this falls
    back to the moment-based heuristic when the LLM fails. The fallback
    picks the top-N moments by score and synthesizes viral_title/caption.
    """
    from ..pipeline import surgical as surgical_stage
    from ..pipeline import face_detection as face_stage
    from ..pipeline import renderer as renderer_module
    from datetime import datetime
    from ..llm.chain import call_with_fallback
    from ..taste.icl import parse_moment_response

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

    # 1. Surgical download of the top moments
    # Note: surgical_download_youtube uses dict-style access, so convert
    # Moment objects to dicts first.
    _bridge("surgical", f"Fetching audio for top {len(top_for_surgery)} moments...")
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
    _bridge("surgical", "Fetching audio for top moments...", step=4, sub_progress=0.0)

    # Track per-segment progress for the UI progress bar.
    # Surgical downloads run in parallel; we count done/total.
    _seg_done = {"n": 0}
    _seg_total = len(moment_dicts)

    def _on_seg_done(idx: int, total: int, ok: bool) -> None:
        _seg_done["n"] += 1
        frac = min(0.85, _seg_done["n"] / max(1, _seg_total))
        _bridge(
            "surgical",
            f"Fetched {_seg_done['n']}/{_seg_total} audio segments",
            step=4,
            sub_progress=frac,
        )

    segments = surgical_stage.surgical_download_youtube(
        url, moment_dicts, task_id,
        log_fn=_bridge,
        on_segment_done=_on_seg_done,
    )
    _bridge("surgical", f"Fetched {len(segments)} audio segments", step=4, sub_progress=1.0)

    # 2. Try LLM taste select
    _bridge("taste", "Calling LLM with strict-JSON prompt...")
    picks = []
    provider_used = None
    # LLM is a quick call within stage 4 (60-70%). Keep sub_progress at
    # 0.85 (≈68%) so the bar doesn't visually dip from surgical-complete.
    _bridge("taste", "Calling LLM with strict-JSON prompt...", step=4, sub_progress=0.85)
    try:
        text, provider_used = call_with_fallback(prompt)
        if text:
            picks = parse_moment_response(text)
            _bridge("taste", f"LLM ({provider_used}) picked {len(picks)} moments",
                    step=4, sub_progress=0.95)
    except Exception as e:
        _bridge("taste", f"LLM failed: {e} — using moment-based fallback",
                step=4, sub_progress=0.95)

    # 3. Map LLM picks to actual moments (using moment_index)
    moment_by_idx = {m.index: m for m in moments}
    final_clips: List[Dict] = []
    if picks:
        for p in picks:
            m = moment_by_idx.get(int(p.get("moment_index", 0)))
            if not m:
                continue
            trim_s = float(p.get("trim_start", 0))
            trim_e = float(p.get("trim_end", 0))
            clip_start = max(0, m.start + trim_s)
            clip_end = max(clip_start + 5, m.end - trim_e)
            # Find the matching surgical segment
            matching_seg = next(
                (s for s in segments
                 if abs(float(s.get("source_start", -1)) - m.start) < 0.5),
                None,
            )
            final_clips.append({
                "start": round(clip_start, 2),
                "end": round(clip_end, 2),
                "source_start": matching_seg.get("source_start") if matching_seg else m.start,
                "source_end": matching_seg.get("source_end") if matching_seg else m.end,
                "audio_path": matching_seg.get("audio_path") if matching_seg else None,
                "viral_title": p.get("viral_title", m.snippet[:40]),
                "caption": p.get("caption", ""),
                "hashtags": p.get("hashtags", "#shorts #viral"),
                "reason": p.get("reason", m.snippet[:60]),
                "signal_type": m.signal_type,
                "llm_provider": provider_used or "fallback",
            })
    if not final_clips:
        # Fallback: take top 3 moments by score, synthesize viral_title
        _bridge("taste", "Using moment-based fallback (top 3 by score)")
        for m in moments[:3]:
            matching_seg = next(
                (s for s in segments
                 if abs(float(s.get("source_start", -1)) - m.start) < 0.5),
                None,
            )
            default_title = {
                "peak": "THIS MOMENT HITS",
                "valley": "THE AWKWARD PAUSE",
                "density": "FAST FORWARD",
                "silence": "WAIT FOR IT",
            }.get(m.signal_type, "TOP MOMENT")
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
            })

    # 4. Face detection (only on segments with audio)
    _bridge("face", "Detecting faces...", step=5, sub_progress=0.0)
    for face_idx, clip in enumerate(final_clips):
        ap = clip.get("audio_path")
        if ap and Path(ap).exists():
            try:
                face_data = face_stage.get_batch_face_data(ap, [clip])
                clip["face_data"] = face_data[0] if face_data else None
            except Exception as e:
                _bridge("face", f"  face detection failed: {e}")
                clip["face_data"] = None
        else:
            clip["face_data"] = None
        if final_clips:
            _bridge("face", f"  face {face_idx+1}/{len(final_clips)}",
                    step=5, sub_progress=(face_idx + 1) / max(1, len(final_clips)))

    # 5. Render (uses the audio+still composition we wired in earlier)
    _bridge("render", f"Rendering {len(final_clips)} clip(s)...",
            step=6, sub_progress=0.0)
    rendered = []
    video_id = info.get("transcript", {}).get("video_id") if info.get("transcript") else None
    for i, clip in enumerate(final_clips):
        try:
            out = renderer_module.render_clip(
                video_path=clip.get("audio_path") or clip.get("source_start", url),
                clip=clip,
                clip_index=i + 1,
                video_id=video_id or "local",
                task_id=task_id,
                progress_callback=lambda m: _bridge("render", m),
            )
            if out:
                rendered.append({
                    **clip,
                    "clip_id": out.get("clip_id"),
                    "file_path": out.get("file_path"),
                    "file_size_mb": out.get("file_size_mb", 0),
                    "duration_s": round(clip.get("end", 0) - clip.get("start", 0), 2),
                    "created_at": datetime.utcnow().isoformat() + "Z",
                })
        except Exception as e:
            _bridge("render", f"  render failed for clip {i}: {e}")
        if final_clips:
            _bridge("render", f"Rendered {i+1}/{len(final_clips)} clips",
                    step=6, sub_progress=(i + 1) / max(1, len(final_clips)))

    _bridge("done", f"Pipeline complete: {len(rendered)} clip(s)")
    # Strip non-serializable / circular fields before returning
    clean_rendered = []
    for c in rendered:
        clean = {k: v for k, v in c.items() if k not in ("face_data", "transcript")}
        clean_rendered.append(clean)
    return {
        "clips": clean_rendered,
        "hooks": [m.__dict__ for m in moments],  # serialize dataclasses
        "video_meta": video_meta,
        "stages_run": [1, 2, 4, 5, 6, 7, 8],
        "task_id": task_id,
    }


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
                step_number=6,
                step_name="Complete",
                clips=clips,
                current_step=f"Complete - {len(clips)} clips generated",
            )
            callback(f"SUCCESS: {len(clips)} clips generated!", step=6, progress=100)
        except Exception as e:
            task_store.update_task(
                task_id, status=TaskStatus.FAILED, error=str(e),
            )
            callback(f"FAILED: {e}", step=6, progress=0)
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
