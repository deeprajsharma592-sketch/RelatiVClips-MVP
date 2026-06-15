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


async def run_youtube_orchestrator(task_id: str, url: str, callback, platform: str = "tiktok"):
    """New pipeline path (PIPELINE_VERSION=2) — caption-first, audio-only-for-librosa.

    Flow (the "v3" pipeline):
      1. Try YouTube captions via yt-dlp (FREE, no audio download)
      2. If captions succeed: build candidate moments from word density + pauses
      3. If captions fail: download audio (low priority), run librosa peaks + valleys,
         build candidate moments from those
      4. Run the rest of the pipeline (surgical, render) on top moments
      5. LLM (claude/deepseek) picks 2-5 with strict JSON, low token cost
      6. Apply platform-specific duration + caption style (NEW 2026-06-15)

    Audio is NEVER used as input to the LLM. Audio is ONLY used for librosa
    energy analysis when captions aren't available. Captions are 80%+ of the
    pipeline; audio is the fallback.

    `platform` is one of "tiktok" | "reels" | "shorts". Default = "tiktok".
    """
    from ..pipeline.orchestrator import run_new_pipeline
    from ..pipeline.moment_detector import detect_moments, Moment
    from ..taste.icl import build_moment_prompt, build_archetype_aware_prompt, parse_moment_response
    from ..pipeline.platforms import (
        get_platform, adjust_clip_for_platform, platform_prompt_guidance,
        limit_hashtags, style_caption, PLATFORMS,
    )

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
    # Build the prompt. Use the new archetype-aware prompt (2026-06-15) when
    # we have enough moments to give the LLM context. Fall back to the legacy
    # moment prompt for edge cases.
    # ALSO inject platform guidance (TikTok/Reels/Shorts) so the LLM writes
    # platform-native copy, not generic copy. (2026-06-15)
    platform_spec = get_platform(platform)
    platform_guidance = platform_prompt_guidance(platform_spec)
    try:
        # Quick archetype detection (fast, no LLM)
        from ..pipeline.archetype import detect_archetype
        # Build a transcript dict from moment snippets (each is 8-20 words)
        synth_transcript = {
            "segments": [
                {"start": m.start, "end": m.end, "text": m.snippet}
                for m in moments[:30]
            ]
        }
        arch_result = detect_archetype(synth_transcript)
        if arch_result.confidence > 0.1:
            prompt = build_archetype_aware_prompt(
                moments=moments, video_meta=video_meta,
                archetype=arch_result.primary,
                archetype_confidence=arch_result.confidence,
                max_picks=3,
            )
        else:
            prompt = build_moment_prompt(moments, video_meta, max_picks=3)
        # Inject platform guidance at the end of the prompt
        prompt = f"{prompt}\n\n{platform_guidance}"
    except Exception:
        # Fall back to legacy prompt on any error
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
            platform=platform,
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
) -> dict:
    """Run the surgical download + LLM select + render in a thread.

    LLM key is currently INVALID (per 2026-06-14 audit), so this falls
    back to the moment-based heuristic when the LLM fails. The fallback
    picks the top-N moments by score and synthesizes viral_title/caption.
    """
    from ..pipeline import surgical as surgical_stage
    from ..pipeline import face_detection as face_stage
    from ..pipeline import renderer as renderer_module
    from ..pipeline.platforms import (
        get_platform, adjust_clip_for_platform, style_caption, limit_hashtags,
    )
    from datetime import datetime
    from ..llm.chain import call_with_fallback
    from ..taste.icl import parse_moment_response

    # NEW 2026-06-15: Resolve the platform spec once. Used for:
    #   - adjusting final clip duration to platform sweet spot
    #   - styling caption (ALL CAPS for TikTok, mixed for Reels/Shorts)
    #   - limiting hashtag count to platform's max
    _platform_spec = get_platform(platform)

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

    # 1b. Run audio analysis on each downloaded segment so the LLM sees
    # real audio features (peaks, valleys, energy) — not just the text
    # snippet. The Moment.audio_features dict gets populated here.
    try:
        from ..pipeline import audio_analysis
        from ..pipeline.moment_detector import (
            _audio_moments_from_file, _merge_text_and_audio_moments,
        )
        for seg, m in zip(segments, top_for_surgery):
            ap = seg.get("audio_path")
            if not ap or not Path(ap).exists():
                continue
            try:
                audio_moments = _audio_moments_from_file(ap, m.end - m.start)
                if audio_moments:
                    # Boost the matching text moment with audio features
                    # from the segment that overlaps its range.
                    merged = _merge_text_and_audio_moments([m], audio_moments)
                    if merged:
                        m.audio_features = merged[0].audio_features
                        m.signal_type = merged[0].signal_type
                        m.score = merged[0].score
            except Exception as e:
                _bridge("audio_an", f"  audio analysis failed for seg {ap}: {e}")
        _bridge("audio_an", "Audio features extracted for all segments", step=4, sub_progress=0.8)
    except Exception as e:
        _bridge("audio_an", f"Audio enrichment skipped: {e}", step=4, sub_progress=0.8)

    # 1c. NEW 2026-06-15 (A1+A3): Speculative video download for top-3
    #     candidates in PARALLEL with the LLM call. If LLM picks one of
    #     the top-3, the video is already on disk and we skip the
    #     expensive re-download step (saves ~35s).
    #     Risk: 3 video downloads even if LLM picks none of them (~1.5MB
    #     extra bandwidth). Win: 35s faster on the common case.
    spec_results: Dict[int, Dict] = {}
    try:
        from ..pipeline.speculative import speculative_video_download
        _bridge("video_dl", "Pre-fetching video for top-3 candidates (speculative, in parallel with LLM)...",
                step=4, sub_progress=0.82)
        spec_results = speculative_video_download(
            url=url,
            top_candidates=moment_dicts,  # 0-indexed list, same order as top_for_surgery
            task_id=task_id,
            log_fn=_bridge,
            max_workers=2,
        )
        n_spec_ok = sum(1 for v in spec_results.values() if v.get("video_path"))
        _bridge("video_dl", f"Speculative video: {n_spec_ok}/{len(spec_results)} ready",
                step=4, sub_progress=0.84)
    except Exception as e:
        _bridge("video_dl", f"Speculative video download failed: {e}",
                step=4, sub_progress=0.84)

    # 2. Try LLM taste select
    _bridge("taste", "Calling LLM with strict-JSON prompt...")
    picks = []
    provider_used = None
    # LLM is a quick call within stage 4 (60-70%). Keep sub_progress at
    # 0.85 (≈68%) so the bar doesn't visually dip from surgical-complete.
    _bridge("taste", "Calling LLM with strict-JSON prompt...", step=4, sub_progress=0.85)

    # Snapshot the cost before the LLM call so we can report the
    # per-run cost in the final response.
    cost_before_usd = 0.0
    try:
        from ..llm.cost_control import cost_status
        cost_before_usd = float(cost_status().get("spent_today_usd", 0.0))
    except Exception:
        pass

    try:
        text, provider_used = call_with_fallback(prompt)
        if text:
            picks = parse_moment_response(text)
            _bridge("taste", f"LLM ({provider_used}) picked {len(picks)} moments",
                    step=4, sub_progress=0.95)

            # ── NEW 2026-06-15: archetype + retention + post-check pre-pass ──
            try:
                from ..pipeline.archetype import detect_archetype
                from ..pipeline.postcheck import post_check_picks
                from ..pipeline.clip_design import design_clip

                # Reconstruct a transcript dict from the moment snippets so
                # archetype detection can run. Each moment's snippet is a
                # 8-20 word window of the original transcript.
                transcript_segments = []
                # Use the original transcript from info if available, otherwise
                # synthesize from moment snippets.
                orig_transcript = info.get("transcript") or {}
                if orig_transcript.get("segments"):
                    transcript_segments = orig_transcript["segments"]
                else:
                    for m in moments:
                        transcript_segments.append({
                            "start": m.start,
                            "end": m.end,
                            "text": m.snippet,
                        })
                transcript_dict = {"segments": transcript_segments}

                arch_result = detect_archetype(transcript_dict)
                _bridge("taste",
                        f"Archetype: {arch_result.primary} "
                        f"(conf={arch_result.confidence:.2f})",
                        step=4, sub_progress=0.96)

                # Source-side clip design: snap picks to sentence boundaries
                for p in picks:
                    mid = int(p.get("moment_index", 0))
                    m = moment_by_idx.get(mid)
                    if not m:
                        continue
                    bounds = design_clip(
                        start=float(m.start),
                        end=float(m.end),
                        transcript=transcript_dict,
                        audio_features={},
                        video_duration=video_duration_s,
                    )
                    p["start"] = bounds.start
                    p["end"] = bounds.end
                    p["_snap_reasons"] = {
                        "start": bounds.snap_start_reason,
                        "end": bounds.snap_end_reason,
                    }

                # Post-check: hook quality, title rewrite, time overlap
                picks, _post_results = post_check_picks(
                    picks, archetype=arch_result.primary, min_confidence=0.3,
                )
                rewrites = sum(len(r.rewrites_applied) for r in _post_results)
                _bridge("taste",
                        f"Post-check: {rewrites} rewrite(s) for "
                        f"archetype={arch_result.primary}",
                        step=4, sub_progress=0.97)
            except Exception as e:
                _bridge("taste", f"Archetype/retention pre-pass failed: {e}",
                        step=4, sub_progress=0.96)
    except Exception as e:
        _bridge("taste", f"LLM failed: {e} — using moment-based fallback",
                step=4, sub_progress=0.95)

    # Compute the per-run LLM cost
    cost_after_usd = cost_before_usd
    try:
        from ..llm.cost_control import cost_status
        cost_after_usd = float(cost_status().get("spent_today_usd", 0.0))
    except Exception:
        pass
    run_cost_usd = max(0.0, cost_after_usd - cost_before_usd)
    _bridge("taste", f"LLM cost this run: ${run_cost_usd:.4f} (provider: {provider_used or 'none'})",
            step=4, sub_progress=0.95)

    # 3. Map LLM picks to actual moments (using moment_index)
    # Sort by confidence descending so the best pick is first
    picks_sorted = sorted(
        picks,
        key=lambda p: float(p.get("confidence", 0.0)),
        reverse=True,
    )
    moment_by_idx = {m.index: m for m in moments}

    # ── NEW 2026-06-15: archetype + retention + post-check pre-pass ──
    try:
        from ..pipeline.archetype import detect_archetype
        from ..pipeline.postcheck import post_check_picks
        from ..pipeline.clip_design import design_clip

        # Reconstruct a transcript dict from the moment snippets so
        # archetype detection can run. Each moment's snippet is a
        # 8-20 word window of the original transcript.
        transcript_segments = []
        orig_transcript = info.get("transcript") or {}
        if orig_transcript.get("segments"):
            transcript_segments = orig_transcript["segments"]
        else:
            for m in moments:
                transcript_segments.append({
                    "start": m.start,
                    "end": m.end,
                    "text": m.snippet,
                })
        transcript_dict = {"segments": transcript_segments}

        arch_result = detect_archetype(transcript_dict)
        _bridge("taste",
                f"Archetype: {arch_result.primary} "
                f"(conf={arch_result.confidence:.2f})",
                step=4, sub_progress=0.96)

        # Source-side clip design: snap picks to sentence boundaries
        for p in picks_sorted:
            mid = int(p.get("moment_index", 0))
            m = moment_by_idx.get(mid)
            if not m:
                continue
            bounds = design_clip(
                start=float(m.start),
                end=float(m.end),
                transcript=transcript_dict,
                audio_features={},
                video_duration=video_duration_s,
            )
            p["start"] = bounds.start
            p["end"] = bounds.end
            p["_snap_reasons"] = {
                "start": bounds.snap_start_reason,
                "end": bounds.snap_end_reason,
            }

        # Post-check: hook quality, title rewrite, time overlap
        picks_sorted, _post_results = post_check_picks(
            picks_sorted, archetype=arch_result.primary, min_confidence=0.3,
        )
        rewrites = sum(len(r.rewrites_applied) for r in _post_results)
        _bridge("taste",
                f"Post-check: {rewrites} rewrite(s) for "
                f"archetype={arch_result.primary}",
                step=4, sub_progress=0.97)
    except Exception as e:
        _bridge("taste", f"Archetype/retention pre-pass failed: {e}",
                step=4, sub_progress=0.96)

    final_clips: List[Dict] = []
    unverified_count = 0
    if picks_sorted:
        for p in picks_sorted:
            m = moment_by_idx.get(int(p.get("moment_index", 0)))
            if not m:
                continue
            conf = float(p.get("confidence", 0.0))
            # Threshold: include if confidence >= 0.4 (worth showing).
            # Below 0.4, skip — too much filler.
            if conf < 0.4:
                unverified_count += 1
                _bridge(
                    "filter",
                    f"  skipping low-conf pick #{m.index} (conf={conf:.2f}): "
                    f"{p.get('reason', '')[:50]}",
                )
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
                "confidence": round(conf, 3),
                "verified": True,
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
            matching_seg = next(
                (s for s in segments
                 if abs(float(s.get("source_start", -1)) - m.start) < 0.5),
                None,
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
    if not final_clips:
        # LLM didn't return picks (network error, etc.) — fall back to top-3
        # by score as a last resort so the user still gets SOMETHING.
        _bridge("taste", "LLM didn't return picks — using moment-based fallback (top 3 by score)")
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
            }.get((m.signal_type or "").split("+")[-1] if m.signal_type else "", "TOP MOMENT")
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
            })

    # 3a. Apply per-platform adjustments (NEW 2026-06-15)
    #      TikTok/Reels/Shorts each have different sweet-spot durations.
    #      A clip that works for Shorts (35s) is too long for Reels (30s).
    #      We adjust [start, end] to fit the target platform.
    try:
        _bridge("platform", f"Applying {_platform_spec.name} adjustments "
                            f"({_platform_spec.min_duration_s:.0f}-{_platform_spec.max_duration_s:.0f}s, "
                            f"target {_platform_spec.target_duration_s:.0f}s)")
        adjusted = []
        for clip in final_clips:
            new_start, new_end, reason = adjust_clip_for_platform(
                float(clip.get("start", 0)),
                float(clip.get("end", 0)),
                _platform_spec,
            )
            clip["start"] = round(new_start, 2)
            clip["end"] = round(new_end, 2)
            clip["_platform_adjustment"] = reason
            # Apply platform-specific caption styling + hashtag limit
            clip["caption"] = style_caption(clip.get("caption", ""), _platform_spec)
            clip["hashtags"] = limit_hashtags(clip.get("hashtags", ""), _platform_spec)
            adjusted.append(clip)
        final_clips = adjusted
    except Exception as e:
        _bridge("platform", f"Platform adjustment skipped: {e}")

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
            "start": c.get("source_start", c["start"]),
            "end": c.get("source_end", c["end"]),
        }
        for c in final_clips
    ]

    # NEW 2026-06-15 (A3): Try to use the speculative video cache first.
    # If a LLM pick matches one of the top-3 pre-fetched videos, use it
    # directly. Only fall back to the re-download for picks NOT in the
    # speculative cache. This is the 35s speedup.
    n_from_spec = 0
    n_need_download = 0
    final_clips_with_video = []
    for c in final_clips:
        # Try speculative match
        c_src_start = float(c.get("source_start", c.get("start", 0)))
        spec_match = None
        for spec in spec_results.values():
            if not spec.get("video_path"):
                continue
            spec_start = float(spec.get("source_start", 0))
            if abs(spec_start - c_src_start) < 0.5:
                spec_match = spec
                break
        if spec_match:
            c["video_path"] = spec_match["video_path"]
            n_from_spec += 1
            final_clips_with_video.append(c)
        else:
            c["_needs_video_download"] = True
            final_clips_with_video.append(c)
            n_need_download += 1
    final_clips = final_clips_with_video

    if n_from_spec > 0:
        _bridge("video_dl", f"Using {n_from_spec} pre-fetched video(s) from speculative cache",
                step=4, sub_progress=0.97)

    if n_need_download > 0:
        # Only download the ones we couldn't pre-fetch
        video_candidates_to_fetch = [
            {"start": c.get("source_start", c["start"]),
             "end": c.get("source_end", c["end"])}
            for c in final_clips if c.get("_needs_video_download")
        ]
        video_segs = surgical_stage.surgical_download_video_youtube(
            url, video_candidates_to_fetch, task_id,
            log_fn=_bridge,
            on_segment_done=_on_vid_done,
        )
        # Attach video_path to each clip (in order)
        for clip, vs in zip(
            [c for c in final_clips if c.get("_needs_video_download")],
            video_segs,
        ):
            clip["video_path"] = vs.get("video_path")
            clip.pop("_needs_video_download", None)
        # Mark non-downloaded clips as done
        for c in final_clips:
            c.pop("_needs_video_download", None)
    else:
        # All clips already have video. Fake the progress callback.
        for i in range(len(final_clips)):
            _on_vid_done(i, len(final_clips), True)

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

    # 5. Render — prefer the freshly-downloaded video segment if present,
    # fall back to the audio file (renderer will compose still+audio).
    _bridge("render", f"Rendering {len(final_clips)} clip(s)...",
            step=6, sub_progress=0.0)
    rendered = []
    video_id = info.get("transcript", {}).get("video_id") if info.get("transcript") else None
    for i, clip in enumerate(final_clips):
        try:
            # Use the actual video segment if we got one; otherwise fall
            # back to the audio file (renderer will use still+audio).
            source_for_renderer = (
                clip.get("video_path")
                or clip.get("audio_path")
                or clip.get("source_start", url)
            )
            # Translate absolute source timestamps into offsets WITHIN the
            # downloaded video segment. The segment file was downloaded
            # with `[source_start - pad, source_end + pad]`, so the start
            # of the file corresponds to (source_start - SURGICAL_BUFFER).
            # The renderer's -ss is an offset into the file, not an
            # absolute timestamp.
            from ..utils.config import SURGICAL_BUFFER_SECONDS
            seg_file_start = float(clip.get("source_start", 0)) - SURGICAL_BUFFER_SECONDS
            clip_offset_start = max(0.0, float(clip.get("start", 0)) - seg_file_start)
            clip_offset_end = max(clip_offset_start + 1, float(clip.get("end", 0)) - seg_file_start)
            print(f"[DEBUG-render] clip {i}: src_start={clip.get('source_start')} start={clip.get('start')} end={clip.get('end')} → seg_file_start={seg_file_start} offsets=({clip_offset_start}, {clip_offset_end})")
            # Build a render-friendly clip with the offset timestamps
            render_clip = dict(clip)
            render_clip["start"] = round(clip_offset_start, 2)
            render_clip["end"] = round(clip_offset_end, 2)
            out = renderer_module.render_clip(
                video_path=source_for_renderer,
                clip=render_clip,
                clip_index=i + 1,
                video_id=video_id or "local",
                task_id=task_id,
                progress_callback=lambda m: _bridge("render", m),
            )
            if out:
                # Put back the absolute timestamps in the response so the
                # UI can display "from 46.5s in the source video"
                out["start"] = clip.get("start")
                out["end"] = clip.get("end")
                out["source_start"] = clip.get("source_start")
                out["source_end"] = clip.get("source_end")
                rendered.append({
                    **clip,
                    **out,
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
        # NEW 2026-06-15: Tag every clip with the platform it was
        # optimised for, so the UI/response can show it.
        clean["platform"] = _platform_spec.name
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
        "clips_requested": len(picks_sorted),
        "clips_verified": sum(1 for c in clean_rendered if c.get("verified")),
        "clips_unverified": sum(1 for c in clean_rendered if not c.get("verified")),
        "best_effort_count": sum(1 for c in clean_rendered if c.get("best_effort")),
        "platform": _platform_spec.name,  # NEW 2026-06-15
    }


async def run_youtube_pipeline_async(task_id: str, url: str, callback, platform: str = "tiktok"):
    if PIPELINE_VERSION == 2:
        # Delegate to the new orchestrator.
        try:
            result = await run_youtube_orchestrator(task_id, url, callback, platform=platform)
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
    # NEW 2026-06-15: per-platform output (TikTok/Reels/Shorts).
    # Default = "tiktok" (most popular, most platform-native).
    platform = (request.get("platform") or "tiktok").lower().strip()
    if platform not in ("tiktok", "reels", "shorts"):
        platform = "tiktok"

    task = task_store.create_task(f"YouTube [{platform}]: {url[:50]}")

    loop = asyncio.get_event_loop()
    _active_tasks[task["task_id"]] = loop.create_task(
        run_youtube_pipeline_async(
            task["task_id"],
            url,
            create_progress_callback(task["task_id"]),
            platform=platform,
        )
    )

    return ProcessResponse(
        task_id=task["task_id"],
        status=task["status"]
    )
