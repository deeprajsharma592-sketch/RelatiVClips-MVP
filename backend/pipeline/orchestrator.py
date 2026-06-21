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
    audio_features: Optional[Dict] = None,
    taste_profile: Optional[Dict] = None,
) -> List[Dict]:
    """Stage 6: build ICL prompt, call LLM, parse, rank, filter.

    COST CONTROL — three layers, in order:
      1. Smart-skip: if we have 3+ high-confidence moments, skip the LLM
         entirely. Saves the ~$0.003 per call on "obvious" requests.
      2. Budget check: if daily budget is exhausted, skip the LLM and use
         lexical fallback. Prevents a runaway prompt from blowing the cap.
      3. Normal LLM call with strict token caps.

    audio_features (NEW 2026-06-15): dict with {peaks, valleys} from
    stage 2. Used by retention scoring + clip design.

    taste_profile (2026-06-21): creator's DB taste preferences. If not
    provided, loaded from the DB using creator_id. This drives the ICL
    prompt's hard constraints (niche, hook style, audience, avoid topics).
    """
    from ..llm import cost_control

    _emit(progress, "taste", "Selecting clips with taste-aware AI...")

    # ── LAYER 1: smart-skip ────────────────────────────────────────────
    # If we have 3+ moments with score >= SMART_SKIP_MIN_SCORE, the detection
    # has done its job and the LLM is not needed for selection. We still use
    # the orchestrator's rank_candidates to produce the final shape.
    smart_skip, skip_reason = cost_control.should_smart_skip(candidates)
    if smart_skip:
        cost_control.record_skipped_smart()
        _emit(progress, "taste",
              f"Smart-skip: {skip_reason}. Using top-3 by score (LLM not called).")
        # Use top-N by score as the "picks" — no LLM, no cost
        sorted_c = sorted(candidates, key=lambda c: c.get("score", 0), reverse=True)
        # Build a synthetic llm_response so rank_candidates does the right thing
        synthetic_picks = []
        for i, c in enumerate(sorted_c[:3], 1):
            snippet = (c.get("snippet") or c.get("text") or c.get("reason") or "").strip()
            words = snippet.split()[:5] if snippet else ["WATCH", "THIS"]
            default_title = " ".join(w.upper() for w in words if w.isalnum())[:40] or "WATCH THIS"
            synthetic_picks.append({
                "moment_index": i,
                "trim_start": 0.0,
                "trim_end": 0.0,
                "viral_title": default_title,
                "caption": snippet[:100] or "(no caption)",
                "hashtags": "#shorts #viral",
                "reason": f"Smart-skip: score={c.get('score', 0):.2f} (LLM not called)",
            })
        return taste_selector.rank_candidates(
            candidates, synthetic_picks, video_duration=video_meta.get("duration_s", 0),
        )

    # ── LAYER 2: budget check ──────────────────────────────────────────
    if cost_control.budget_exceeded():
        cost_control.record_skipped_budget()
        _emit(progress, "taste",
              f"LLM daily budget (${cost_control.LLM_DAILY_BUDGET_USD:.2f}) "
              f"exhausted. Using energy-peak fallback.")
        return taste_selector.rank_candidates(
            candidates, None, video_duration=video_meta.get("duration_s", 0),
        )

    # ── LAYER 2.5: pick model tier (smart / calibration / budget / fallback) ──
    from ..llm import model_router
    model_name, tier, cost_per_pick = model_router.pick_model()
    _emit(progress, "taste",
          f"LLM tier: {tier} ({model_name}, ${cost_per_pick:.6f}/pick)")

    history = []
    if creator_id and taste_store.creator_exists(creator_id):
        history = taste_store.load_history(creator_id, limit=10)

    # ── TASTE PROFILE: load from DB if not provided (2026-06-21) ──────
    # This is the creator's onboarding preferences that drive ICL constraints.
    if taste_profile is None and creator_id:
        try:
            import asyncio
            # run_new_pipeline is sync; use a fresh loop to await the DB call
            taste_profile = asyncio.get_event_loop().run_until_complete(
                taste_store.load_taste_profile_db(creator_id)
            )
        except Exception:
            taste_profile = {}
    if not taste_profile:
        taste_profile = {}

    # ── NEW (2026-06-15): Archetype + retention scoring pre-pass ─────────
    # 0 LLM tokens. ~50ms. Gives the LLM structured context so it can
    # write archetype-specific copy instead of guessing.
    # NOTE: 'transcript' is the function parameter, not video_meta._transcript.
    # 'audio_features' is the new function parameter.
    _af = audio_features or {}

    archetype: str = "general"
    arch_confidence: float = 0.0
    retention_scores: Optional[Dict[int, Dict[str, float]]] = None

    try:
        from .archetype import detect_archetype, archetype_specific_guidance
        from .retention import score_window, ARCHETYPE_WEIGHTS
        from .postcheck import post_check_picks
        from .clip_design import design_clip

        arch_result = detect_archetype(transcript) if transcript else None
        archetype = arch_result.primary if arch_result else "general"
        arch_confidence = arch_result.confidence if arch_result else 0.0

        # Score each candidate's retention features
        retention_scores = {}
        for i, c in enumerate(candidates, 1):
            s = float(c.get("start", 0))
            e = float(c.get("end", 0))
            f = score_window(transcript or {}, _af, s, e, archetype=archetype)
            retention_scores[i] = {
                "composite": f.composite(ARCHETYPE_WEIGHTS.get(archetype, ARCHETYPE_WEIGHTS["general"])),
                "energy_peak": f.energy_peak,
                "power_words": f.power_words,
                "question": f.question,
                "numbers": f.numbers,
                "first_person": f.first_person,
                "speech_rate": f.speech_rate,
            }
        _emit(progress, "taste",
              f"Archetype: {archetype} ({arch_confidence:.2f}) — "
              f"scored {len(retention_scores)} candidate(s)")
    except Exception as e:
        log.warning(f"Archetype/retention pre-pass failed: {e}")

    # Build moments list for the new prompt
    moment_list = []
    for i, c in enumerate(candidates, 1):
        moment_list.append(taste_icl.Moment(
            index=i,
            start=float(c.get("start", 0)),
            end=float(c.get("end", 0)),
            signal_type=c.get("signal_type", "peak"),
            score=float(c.get("score", c.get("hook_score", 0.5))),
            snippet=(c.get("snippet") or c.get("reason") or c.get("text") or "")[:200],
            source=c.get("source", "pre_scored"),
            story_position=float(c.get("story_position", 0.5)),
        ))

    # Use the NEW archetype-aware prompt when we have candidates + retention
    if moment_list and retention_scores:
        prompt = taste_icl.build_archetype_aware_prompt(
            moments=moment_list,
            video_meta=video_meta,
            archetype=archetype,
            archetype_confidence=arch_confidence,
            retention_scores=retention_scores,
            max_picks=3,
            creator_history=history,
            taste_profile=taste_profile,  # 2026-06-21: creator onboarding prefs
        )
    else:
        # Fallback to legacy prompt
        hook_dataclasses = [
            taste_icl.HookCandidate(
                start=c.get("start", 0),
                end=c.get("end", 0),
                hook_score=c.get("hook_score", 0),
                components=c.get("components", {}),
                reason=c.get("reason", ""),
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
            llm_response = taste_icl.parse_moment_response(raw)
            # NEW (2026-06-15): Post-check + clip design on the LLM picks
            try:
                # 1. Source-side clip design (sentence boundaries, rehook)
                designed_picks = []
                for p in llm_response or []:
                    mid = p.get("moment_index")
                    cand = next((c for i, c in enumerate(candidates, 1) if i == mid), None)
                    if not cand:
                        designed_picks.append(p)
                        continue
                    bounds = design_clip(
                        start=float(cand.get("start", 0)),
                        end=float(cand.get("end", 0)),
                        transcript=transcript or {},
                        audio_features=_af,
                        video_duration=video_meta.get("duration_s", 0),
                    )
                    p["start"] = bounds.start
                    p["end"] = bounds.end
                    p["source_start"] = cand.get("source_start", bounds.start)
                    p["source_end"] = cand.get("source_end", bounds.end)
                    p["_snap_reasons"] = {
                        "start": bounds.snap_start_reason,
                        "end": bounds.snap_end_reason,
                    }
                    designed_picks.append(p)
                # 2. Post-check (hook quality, title rewrite, time overlap)
                llm_response, _post_results = post_check_picks(
                    designed_picks, archetype=archetype, min_confidence=0.3,
                )
                rewrites = sum(len(r.rewrites_applied) for r in _post_results)
                _emit(progress, "taste",
                      f"Post-check: {rewrites} rewrite(s) applied for archetype={archetype}")
            except Exception as e:
                log.warning(f"Post-check failed (non-fatal): {e}")
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
    """Stage 8: render each final clip with ffmpeg.

    The renderer used to take `source` (the YouTube URL) as video_path,
    which FFmpeg can't open — YouTube URLs aren't valid FFmpeg inputs.
    Fix: pass each clip's local `audio_path` (downloaded in stage 4
    as a surgical audio segment) as the actual input. The renderer
    can then either:
      - emit an audio-only MP4 (current behavior, no video stream)
      - or compose video from a still + the audio (future enhancement)
    Either way, the audio_path is the right file to give FFmpeg.
    """
    from datetime import datetime
    rendered = []
    for i, clip in enumerate(clips):
        _emit(progress, "render", f"Rendering clip {i+1}/{len(clips)}...")
        # Use the segment's local audio file if available; fall back to source.
        clip_input = (
            clip.get("audio_path")
            or clip.get("file_path")
            or source
        )
        try:
            out = renderer_module.render_clip(
                video_path=clip_input,
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
            audio_features=peaks,  # NEW 2026-06-15: pass stage 2 peaks
        )
        # Enrich each taste pick with the audio_path from the matching
        # surgical segment. The taste selector doesn't know about the
        # local audio files; stage 8's renderer needs them.
        for clip in final_clips:
            if "audio_path" in clip:
                continue
            clip_start = float(clip.get("start", -1))
            matching = next(
                (s for s in segments
                 if abs(float(s.get("source_start", -1)) - clip_start) < 0.5),
                None,
            )
            if matching and matching.get("audio_path"):
                clip["audio_path"] = matching["audio_path"]
                clip["source_start"] = matching.get("source_start")
                clip["source_end"] = matching.get("source_end")
        result["stages_run"].append(6)

    # Stage 7: Face detection
    if 7 in run_set and segments:
        segments = _run_stage_7_face_data(source, segments, progress)
        result["stages_run"].append(7)

    # Stage 8: Render — uses the LOCAL segment files downloaded in stage 4
    # (their audio_path), not the source URL. FFmpeg can't open a YouTube
    # URL as a video source; it needs a real local file. The segments
    # carry the audio. When the renderer is enhanced to produce
    # video+audio (e.g. with a still image), this becomes the audio
    # input; for now it just verifies the audio path is reachable.
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
