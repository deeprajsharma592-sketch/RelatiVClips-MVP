"""
Local Video Router
Handles processing of local video files through the async pipeline.
"""
import sys
import os
from pathlib import Path
import asyncio
import traceback

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..models import ProcessResponse, TaskStatus
from ..utils.task_store import task_store
from ..utils.config import PIPELINE_VERSION

progress_logs = {}
_active_tasks = {}


class LocalProcessRequest(BaseModel):
    file_path: str


def create_progress_callback(task_id: str):
    def callback(message: str, step: int = None, progress: int = None):
        print(f"[LocalPipeline:{task_id}] {message}")
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


async def run_local_orchestrator(task_id: str, file_path: str, callback):
    """New 9-stage pipeline path (PIPELINE_VERSION=2) for local uploads.

    The orchestrator handles URL analysis (stage 1 detects local file),
    energy peaks (2), hooks (3), surgical extract (4 — cuts segments from
    the local file), per-segment transcription (5), taste/Claude (6),
    face (7), render (8), and captions (9).
    """
    from ..pipeline.orchestrator import run_new_pipeline

    def _bridge(stage: str, msg: str) -> None:
        try:
            step = int(stage) if str(stage).isdigit() else None
        except Exception:
            step = None
        try:
            callback(msg, step=step)
        except Exception:
            pass

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None,
        lambda: run_new_pipeline(
            source=file_path,  # orchestrator stage 1 detects "local" automatically
            audio_path=file_path,  # full file is available for local
            progress=_bridge,
            task_id=task_id,
        ),
    )


async def run_local_pipeline(task_id: str, file_path: str):
    callback = create_progress_callback(task_id)

    if PIPELINE_VERSION == 2:
        try:
            result = await run_local_orchestrator(task_id, file_path, callback)
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
        finally:
            _active_tasks.pop(task_id, None)
            task_store.try_promote_queued()
        return

    try:
        callback("Starting local pipeline...", step=1, progress=5)

        # Step 1: Load local video
        callback("Loading local video file...", step=1, progress=10)
        from ..pipeline.ingestion import load_local_video

        try:
            download_result = await asyncio.to_thread(
                load_local_video, file_path, task_id,
                lambda m: callback(m, step=1, progress=15)
            )
        except Exception as e:
            callback(f"Error loading video: {str(e)}", step=1, progress=5)
            task_store.update_task(task_id, status=TaskStatus.FAILED, error=str(e))
            return

        video_path = download_result["video_path"]
        audio_path = download_result["audio_path"]
        video_id = download_result["video_id"]

        callback(f"Video loaded: {video_id}", step=1, progress=20)

        # Step 2: Audio Analysis
        callback("Analyzing audio peaks...", step=2, progress=25)
        from ..pipeline.audio_analysis import analyze_audio_peaks, estimate_speech_segments

        audio_analysis = {"peaks": [], "_video_duration": 0}
        speech_segments = []
        try:
            audio_analysis = await asyncio.to_thread(
                analyze_audio_peaks, audio_path,
                lambda m: callback(m, step=2, progress=30)
            )
            speech_segments = await asyncio.to_thread(estimate_speech_segments, audio_path)
            callback(f"Found {len(speech_segments)} speech segments", step=2, progress=35)
        except Exception as e:
            callback(f"Audio analysis error: {str(e)}", step=2, progress=30)

        # Step 3: Transcription
        callback("Transcribing audio...", step=3, progress=40)
        from ..pipeline.transcription import transcribe_audio

        try:
            transcript = await asyncio.to_thread(
                transcribe_audio, audio_path, task_id,
                lambda m: callback(m, step=3, progress=55)
            )
            callback("Transcription complete!", step=3, progress=60)
        except Exception as e:
            callback(f"Transcription error: {str(e)}", step=3, progress=50)
            task_store.update_task(task_id, status=TaskStatus.FAILED, error=f"Transcription failed: {str(e)}")
            return

        # Clear VRAM before AI
        try:
            from ..utils.vram_manager import clear_gpu
            await asyncio.to_thread(clear_gpu)
        except:
            pass

        # Step 4: Clip Selection with Claude
        callback("Selecting clips with AI...", step=4, progress=65)
        from ..pipeline.clip_selector import select_clips_with_claude_wrapper

        try:
            clip_result = await asyncio.to_thread(
                select_clips_with_claude_wrapper,
                transcript,
                audio_analysis,
                speech_segments,
                task_id,
                lambda m: callback(m, step=4, progress=70)
            )
            clips = clip_result.get("clips", [])
            callback(f"AI selected {len(clips)} clips", step=4, progress=75)
        except Exception as e:
            callback(f"Clip selection error: {str(e)}", step=4, progress=70)
            task_store.update_task(task_id, status=TaskStatus.FAILED, error=f"Clip selection failed: {str(e)}")
            return

        if len(clips) == 0:
            callback("No clips selected - processing complete", step=4, progress=75)
            task_store.update_task(
                task_id,
                status=TaskStatus.FAILED,
                progress=100,
                step_number=6,
                step_name="Failed",
                clips=[],
                current_step="Failed - No clips selected by AI"
            )
            return

        # Clear VRAM before face detection
        try:
            from ..utils.vram_manager import clear_gpu
            await asyncio.to_thread(clear_gpu)
        except:
            pass

        # Step 5: Face Detection
        callback("Detecting faces for centered cropping...", step=5, progress=80)
        from ..pipeline.face_detection import get_batch_face_data

        try:
            clips_with_faces = await asyncio.to_thread(
                get_batch_face_data,
                video_path,
                clips,
                lambda m: callback(m, step=5, progress=85)
            )
            callback("Face detection complete", step=5, progress=88)
        except Exception as e:
            callback(f"Face detection error: {str(e)}", step=5, progress=85)
            clips_with_faces = clips

        # Step 6: Rendering
        callback("Rendering clips...", step=6, progress=92)
        from ..pipeline.renderer import render_all_clips

        try:
            rendered_clips = await asyncio.to_thread(
                render_all_clips,
                video_path,
                clips_with_faces,
                video_id,
                task_id,
                lambda m: callback(m, step=6, progress=98)
            )
            if len(rendered_clips) == 0:
                callback("Render produced no clips", step=6, progress=95)
                task_store.update_task(task_id, status=TaskStatus.FAILED, progress=100, error="All clips failed to render")
                return
            callback(f"SUCCESS: {len(rendered_clips)} clips generated!", step=6, progress=100)
        except Exception as e:
            callback(f"Render error: {str(e)}", step=6, progress=95)
            task_store.update_task(task_id, status=TaskStatus.FAILED, error=f"Render failed: {str(e)}")
            return

        # Clear VRAM
        try:
            from ..utils.vram_manager import clear_gpu
            await asyncio.to_thread(clear_gpu)
        except:
            pass

        # Update task status
        task_store.update_task(
            task_id,
            status=TaskStatus.COMPLETE,
            progress=100,
            step_number=6,
            step_name="Complete",
            clips=rendered_clips,
            current_step="Complete"
        )

        # Cleanup
        try:
            from ..pipeline.ingestion import cleanup_temp_files
            await asyncio.to_thread(cleanup_temp_files, task_id)
        except:
            pass

    except Exception as e:
        error_msg = f"Pipeline error: {str(e)}"
        print(f"[LocalPipeline:{task_id}] ERROR: {error_msg}")
        print(traceback.format_exc())
        callback(f"ERROR: {error_msg}", step=1, progress=0)
        task_store.update_task(
            task_id,
            status=TaskStatus.FAILED,
            error=error_msg
        )
    finally:
        _active_tasks.pop(task_id, None)
        task_store.try_promote_queued()


router = APIRouter(prefix="/process/local", tags=["Local Video"])


@router.post("", response_model=ProcessResponse)
async def process_local_video(request: LocalProcessRequest):
    if not request.file_path or not Path(request.file_path).exists():
        raise HTTPException(status_code=400, detail="Invalid file path")

    task = task_store.create_task(f"Local: {Path(request.file_path).name}")

    loop = asyncio.get_event_loop()
    _active_tasks[task["task_id"]] = loop.create_task(
        run_local_pipeline(task["task_id"], request.file_path)
    )

    return ProcessResponse(
        task_id=task["task_id"],
        status=task["status"]
    )
