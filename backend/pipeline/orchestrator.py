"""
Pipeline orchestrator — runs the 9-stage new pipeline end-to-end.

This is the "configured and works" entrypoint. It glues together:
  1. URL analysis
  2. Audio energy peaks
  3. Hook detection
  4. Surgical segment download
  5. Per-segment transcription
  6. Taste/Niche selection (LLM with energy-peak fallback)
  7. Face detection
  8. Render
  9. Captions

Designed to be:
  - Testable: every stage is pluggable (smoke test injects fakes).
  - Resilient: each stage's failure is caught; the pipeline continues
    with a sensible fallback (no-LLM → energy fallback, etc).
  - Observable: each stage emits a progress callback.

Usage:
    from backend.pipeline.orchestrator import run_new_pipeline

    result = run_new_pipeline(
        source="https://youtube.com/watch?v=...",
        creator_id="creator_123",
        task_id="task_abc",
        progress=lambda step, msg: print(f"[{step}] {msg}"),
    )
"""
from typing import List, Dict, Optional, Callable
import logging
import time
from pathlib import Path
import uuid

from ..utils.config import TEMP_DIR, OUTPUTS_DIR
from . import audio_analysis
from . import hooks as hook_stage
from . import surgical as surgical_stage
from . import transcription as transcription_module
from . import face_detection as face_stage
from . import renderer as renderer_module
from . import url_analyzer
from ..taste import icl as taste_icl
from ..taste import selector as taste_selector
from ..taste import store as taste_store
from ..taste.providers import select_provider as _select_provider  # noqa: E402

# Use the new services-layer transcription (auto-picks RunPod if configured,
# falls back to local faster-whisper otherwise).
from ..services import transcription as transcription_service

log = logging.getLogger(__name__)

ProgressCallback = Optional[Callable[[str, str], None]]


def get_default_llm_callable() -> Callable[[str], str]:
    """Return a callable that uses the auto-selected LLM provider.

    Used when the orchestrator's `llm_callable` arg is not provided.
    Selects the highest-priority available provider (Claude → Deepseek → MiniMax).
    """
    provider = _select_provider()
    log.info(f"Default LLM callable using provider: {provider.name}")
    return provider.generate


def _emit(progress: ProgressCallback, stage: str, msg: str) -> None:
    """Fire a progress event. Never raises (UI must not break the pipeline)."""
    try:
        if progress:
            progress(stage, msg)
    except Exception as e:
        log.warning(f"progress callback failed: {e}")


def _detect_source_type(source: str) -> str:
    if "youtube.com" in source or "youtu.be" in source:
        return "youtube"
    return "local"


def _run_stage_1_url_analyze(source: str, progress: ProgressCallback) -> Dict:
    """Stage 1: analyze URL/path and extract metadata (no full download)."""
    _emit(progress, "analyze", f"Analyzing source: {source[:80]}")
    return url_analyzer.analyze_url(source)


def _run_stage_2_energy(audio_path: str, progress: ProgressCallback) -> Dict:
    """Stage 2: extract RMS energy peaks from the audio."""
    _emit(progress, "energy", "Analyzing audio energy peaks...")
    return audio_analysis.analyze_audio_peaks(audio_path)


def _run_stage_3_hooks(peaks: Dict, transcript: Optional[Dict], progress: ProgressCallback) -> Dict:
    """Stage 3: turn peaks into ranked hook candidates."""
    _emit(progress, "hooks", f"Scoring hooks from {len(peaks.get('peaks', []))} energy peaks...")
    return hook_stage.detect_hooks(peaks, transcript=transcript)


def _run_stage_4_surgical(
    source: str, candidates: List[Dict], source_type: str,
    task_id: str, progress: ProgressCallback,
) -> List[Dict]:
    """Stage 4: download only the segments around each hook candidate."""
    _emit(progress, "surgical", f"Fetching {len(candidates)} segment(s)...")
    log_fn = lambda m: _emit(progress, "surgical", m)
    if source_type == "youtube":
        return surgical_stage.surgical_download_youtube(
            source, candidates, task_id, log_fn=log_fn,
        )
    return surgical_stage.surgical_extract_local(
        source, candidates, task_id, log_fn=log_fn,
    )


def _run_stage_5_transcribe_segments(
    segments: List[Dict], task_id: str, progress: ProgressCallback,
    precomputed_transcript: Optional[Dict] = None,
) -> List[Dict]:
    """Stage 5: transcribe each segment individually.

    If `precomputed_transcript` is provided (e.g. YouTube captions via
    transcript_fetcher), skip RunPod entirely and attach the pre-built
    segments to each surgical segment. This is the cost-saver path: when
    YouTube already has captions, we pay nothing for transcription.
    """
    if precomputed_transcript and precomputed_transcript.get("segments"):
        _emit(progress, "transcribe", f"Using pre-built transcript ({len(precomputed_transcript['segments'])} segments) — skipping cloud transcription")
        for seg in segments:
            seg["transcript"] = precomputed_transcript
        return segments

    results = []
    for i, seg in enumerate(segments):
        path = seg.get("audio_path")
        if not path or not Path(path).exists():
            log.warning(f"segment {i} has no audio_path, skipping transcription")
            continue
        _emit(progress, "transcribe", f"Transcribing segment {i+1}/{len(segments)}...")
        try:
            tr = transcription_service.transcribe(
                path, task_id=f"{task_id}_seg{i}",
                progress=lambda msg: _emit(progress, "transcribe", f"  seg{i}: {msg}"),
            )
            seg["transcript"] = tr
            results.append(seg)
        except Exception as e:
            log.error(f"transcription failed for segment {i}: {e}")
    return results


def _run_stage_6_taste_select(
    candidates: List[Dict],
    transcript: Optional[Dict],
    creator_id: Optional[str],
    video_meta: Dict,
    progress: ProgressCallback,
    llm_callable: Optional[Callable[[str], str]] = None,
) -> List[Dict]:
    """Stage 6: build ICL prompt, call LLM, parse, rank, filter."""
    _emit(progress, "taste", "Selecting clips with taste-aware AI...")

    history = []
    if creator_id and taste_store.creator_exists(creator_id):
        history = taste_store.load_history(creator_id, limit=10)

    hook_dataclasses = [
        taste_icl.HookCandidate(
            start=c.get("start", 0),
            end=c.get("end", 0),
            hook_score=c.get("hook_score", 0),
            components=c.get("components", {}),
            reason=c.get("reason", ""),
            # Pass surgery context through if stage 4 ran and we have it
            surgical_padding_s=float(c.get("surgical_padding_s", 0) or 0),
            source_start=c.get("source_start"),
            source_end=c.get("source_end"),
            source_url=c.get("source_url"),
        )
        for c in candidates
    ]

    prompt = taste_icl.build_prompt(
        creator_history=history,
        hook_candidates=hook_dataclasses,
        video_meta=video_meta,
    )

    # Auto-default to the highest-priority LLM provider if none was passed in.
    # The user typically wants Claude to run hook selection when a key is set.
    if llm_callable is None:
        try:
            llm_callable = get_default_llm_callable()
        except Exception as e:
            log.warning(f"Could not init default LLM callable: {e}")

    llm_response: Optional[List[Dict]] = None
    if llm_callable is not None:
        try:
            raw = llm_callable(prompt)
            llm_response = taste_icl.parse_response(raw)
        except Exception as e:
            log.warning(f"LLM call failed, falling back to energy: {e}")
    else:
        _emit(progress, "taste", "No LLM configured — using energy-peak fallback")

    return taste_selector.rank_candidates(
        candidates, llm_response, video_duration=video_meta.get("duration_s", 0),
    )


def _run_stage_7_face_data(
    source: str, segments: List[Dict], progress: ProgressCallback,
) -> List[Dict]:
    """Stage 7: face data for the renderer (one pass per segment)."""
    for seg in segments:
        path = seg.get("audio_path")  # the audio segment we already have
        if not path or not Path(path).exists():
            seg["face_data"] = None
            continue
        try:
            # get_batch_face_data takes clips list, returns face tracking
            face_data = face_stage.get_batch_face_data(path, [seg])
            seg["face_data"] = face_data[0] if face_data else None
        except Exception as e:
            log.warning(f"face detection failed for segment, center-cropping: {e}")
            seg["face_data"] = None
    return segments


def _run_stage_8_render(
    clips: List[Dict], source: str, video_id: str, task_id: str,
    progress: ProgressCallback,
) -> List[Dict]:
    """Stage 8: render each final clip with ffmpeg."""
    from datetime import datetime
    rendered = []
    for i, clip in enumerate(clips):
        _emit(progress, "render", f"Rendering clip {i+1}/{len(clips)}...")
        try:
            out = renderer_module.render_clip(
                video_path=source,
                clip=clip,
                clip_index=i + 1,
                video_id=video_id or "local",
                task_id=task_id,
                progress_callback=lambda m: _emit(progress, "render", m),
            )
            if out:
                # The renderer returns a NEW clip_id; rebuild the clip dict
                # so the download endpoint can find the file by clip_id.
                duration = round(clip.get("end", 0) - clip.get("start", 0), 2)
                rendered.append({
                    **clip,
                    "clip_id": out.get("clip_id"),
                    "file_path": out.get("file_path"),  # was "output_path"
                    "file_size_mb": out.get("file_size_mb", 0),
                    "duration_s": duration,
                    "created_at": datetime.utcnow().isoformat() + "Z",
                })
        except Exception as e:
            log.error(f"render failed for clip {i}: {e}")
    return rendered


def _run_stage_9_captions(clips: List[Dict], progress: ProgressCallback) -> List[Dict]:
    """Stage 9: pass through captions (generation wiring is Day 2)."""
    _emit(progress, "captions", f"Preparing captions for {len(clips)} clip(s)...")
    for clip in clips:
        clip["caption"] = clip.get("suggested_caption") or clip.get("caption") or ""
    return clips


def run_new_pipeline(
    source: str,
    creator_id: Optional[str] = None,
    audio_path: Optional[str] = None,
    video_duration_s: float = 0.0,
    progress: ProgressCallback = None,
    llm_callable: Optional[Callable[[str], str]] = None,
    stages: Optional[List[int]] = None,
    task_id: Optional[str] = None,
    precomputed_transcript: Optional[Dict] = None,
) -> Dict:
    """Run the 9-stage pipeline. Returns a result dict.

    Args:
        source: Video URL or local file path.
        creator_id: Optional creator ID for ICL history lookup.
        audio_path: Optional pre-extracted audio path (skips extraction).
        video_duration_s: Source video duration, for bounds checking.
        progress: Optional (stage_name, message) callback.
        llm_callable: Optional LLM provider. None = energy fallback.
        stages: Optional list of stage numbers to run (default: all).
        task_id: Optional task ID; auto-generated if absent.

    Returns:
        {
          "clips": [...],            # final rendered clips
          "hooks": [...],            # hook candidates
          "transcript": {...},       # stitched transcript from segments
          "video_meta": {...},       # stage 1 output
          "stages_run": [1, 2, ...]  # which stages actually ran
        }
    """
    if stages is None:
        stages = [1, 2, 3, 4, 5, 6, 7, 8, 9]
    run_set = set(stages)
    task_id = task_id or f"orch_{uuid.uuid4().hex[:8]}"

    _emit(progress, "start", f"Running pipeline stages {stages} for {source[:60]}")

    result: Dict = {"clips": [], "stages_run": [], "task_id": task_id}

    # Stage 1: URL analyze (always runs — cheap, sets source_type)
    video_meta: Dict = {}
    if 1 in run_set:
        video_meta = _run_stage_1_url_analyze(source, progress)
        result["video_meta"] = video_meta
        result["stages_run"].append(1)
    else:
        video_meta = {
            "source": source,
            "source_type": _detect_source_type(source),
            "video_id": None,
            "duration_s": video_duration_s,
        }

    # Stage 2: Energy peaks
    peaks = None
    if 2 in run_set:
        if not audio_path:
            log.warning("Stage 2 needs audio_path; skipping")
        else:
            peaks = _run_stage_2_energy(audio_path, progress)
            result["stages_run"].append(2)
            if video_duration_s == 0 and peaks.get("duration"):
                video_duration_s = peaks["duration"]
                video_meta["duration_s"] = video_duration_s

    # Stage 3: Hook detection
    # Accepts peaks from stage 2 (preferred) OR a precomputed transcript
    # (the YouTube-captions cost-saver path). When transcript is available,
    # the hook detector will run a transcript-only scoring pass.
    hook_candidates: List[Dict] = []
    effective_transcript = precomputed_transcript
    if 3 in run_set:
        if peaks is None and not effective_transcript:
            log.warning("Stage 3 needs peaks or precomputed_transcript; skipping")
        else:
            # If we have peaks from stage 2 but no transcript yet, that's
            # the local-file path. The stage-5 transcription will supply
            # the transcript for stage-6's taste select.
            hook_result = _run_stage_3_hooks(
                peaks or {"peaks": [], "duration": 0.0},
                transcript=effective_transcript,
                progress=progress,
            )
            hook_candidates = hook_result["candidates"]
            result["hooks"] = hook_candidates
            result["stages_run"].append(3)

    # Stage 4: Surgical download
    segments: List[Dict] = []
    if 4 in run_set:
        if not hook_candidates:
            log.warning("Stage 4 needs hook candidates; skipping")
        else:
            segments = _run_stage_4_surgical(
                source, hook_candidates,
                video_meta.get("source_type", "youtube"),
                task_id, progress,
            )
            result["segments"] = segments
            result["stages_run"].append(4)

    # Stage 5: Per-segment transcription (or use precomputed YouTube captions)
    if 5 in run_set and segments:
        segments = _run_stage_5_transcribe_segments(
            segments, task_id, progress,
            precomputed_transcript=precomputed_transcript,
        )
        result["stages_run"].append(5)
        result["transcript"] = _stitch_transcripts(segments)

    # Stage 6: Taste/Niche select (LLM or fallback)
    final_clips: List[Dict] = []
    if 6 in run_set and hook_candidates:
        final_clips = _run_stage_6_taste_select(
            hook_candidates, result.get("transcript"),
            creator_id, video_meta, progress, llm_callable=llm_callable,
        )
        result["stages_run"].append(6)

    # Stage 7: Face detection
    if 7 in run_set and segments:
        segments = _run_stage_7_face_data(source, segments, progress)
        result["stages_run"].append(7)

    # Stage 8: Render
    rendered_clips: List[Dict] = []
    if 8 in run_set and final_clips:
        rendered_clips = _run_stage_8_render(
            final_clips, source, video_meta.get("video_id", "local"),
            task_id, progress,
        )
        result["stages_run"].append(8)

    # Stage 9: Captions — applies to whatever we have (rendered if available,
    # else the unrendered final_clips with at least caption metadata attached).
    if 9 in run_set:
        clips_to_caption = rendered_clips or final_clips
        if clips_to_caption:
            clips_to_caption = _run_stage_9_captions(clips_to_caption, progress)
            if rendered_clips:
                rendered_clips = clips_to_caption
            else:
                # No rendered clips — caption the raw final_clips so user
                # still gets the caption metadata even if render failed.
                final_clips = clips_to_caption
            result["stages_run"].append(9)

    result["clips"] = rendered_clips or final_clips
    _emit(progress, "done", f"Pipeline complete: {len(result['clips'])} clip(s)")
    return result


def _stitch_transcripts(segments: List[Dict]) -> Dict:
    """Combine per-segment transcripts into one timeline."""
    all_segments = []
    for seg in segments:
        tr = seg.get("transcript", {})
        offset = seg.get("source_start", 0)
        for s in tr.get("segments", []):
            all_segments.append({
                "start": round(s["start"] + offset, 3),
                "end": round(s["end"] + offset, 3),
                "text": s.get("text", ""),
            })
    return {
        "segments": all_segments,
        "language": "en",
        "source": "surgical",
    }
