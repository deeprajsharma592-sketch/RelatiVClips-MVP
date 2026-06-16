import uuid
from datetime import datetime, timedelta
from typing import Optional
from enum import Enum
import threading
import asyncio

class TaskStatus(str, Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETE = "complete"
    FAILED = "failed"


PIPELINE_STEPS = [
    {"number": 1, "name": "Downloading video", "weight": 0.10, "progress_start": 0, "progress_end": 10},
    {"number": 2, "name": "Analyzing audio peaks", "weight": 0.10, "progress_start": 10, "progress_end": 20},
    {"number": 3, "name": "Transcribing audio", "weight": 0.40, "progress_start": 20, "progress_end": 60},
    {"number": 4, "name": "Selecting clips with AI", "weight": 0.10, "progress_start": 60, "progress_end": 70},
    {"number": 5, "name": "Detecting faces", "weight": 0.15, "progress_start": 70, "progress_end": 85},
    {"number": 6, "name": "Rendering clips", "weight": 0.15, "progress_start": 85, "progress_end": 100},
]


# Event loop bridge for sync-to-async DB persistence from worker threads
_event_loop: Optional[asyncio.AbstractEventLoop] = None

def set_event_loop(loop: Optional[asyncio.AbstractEventLoop]):
    global _event_loop
    _event_loop = loop
def _run_async(coro):
    """
    Dispatch a coroutine to the app's event loop from a worker thread.

    BUGFIX 2026-06-16: was block-waiting 5s per DB write. The orchestrator
    calls update_task 50+ times per run → 50+ × 5s = minutes of blocking.
    The event loop gets clogged with DB I/O, /health endpoints time out,
    the server appears wedged. Now we fire-and-forget: the coroutine is
    scheduled on the event loop and we return immediately. If the loop
    is busy, the DB write just queues — that's fine, the in-memory store
    is the source of truth for the UI. The DB is just for crash recovery.

    If no loop is bound (tests, or DB disabled), closes the coroutine to
    suppress Python's `RuntimeWarning: coroutine was never awaited`. The
    in-memory task store still works — only DB persistence is skipped.
    """
    if _event_loop is not None and _event_loop.is_running():
        try:
            # Schedule and return — NO future.result() wait.
            # Errors are caught inside the coroutine itself.
            asyncio.run_coroutine_threadsafe(coro, _event_loop)
        except RuntimeError:
            # Loop was closed between the check and the schedule — close
            # the coroutine to silence warnings.
            try:
                coro.close()
            except Exception:
                pass
        return None
    # No loop — close coroutine to silence the 'never awaited' warning.
    try:
        coro.close()
    except Exception:
        pass
    return None


def _run_async_fire_and_log(coro, label: str = "db-op"):
    """
    Same as _run_async but logs errors from a background thread.
    The coroutine itself catches exceptions, so this is a safety net.
    """
    if _event_loop is not None and _event_loop.is_running():
        try:
            asyncio.run_coroutine_threadsafe(coro, _event_loop)
        except RuntimeError:
            try:
                coro.close()
            except Exception:
                pass
    else:
        try:
            coro.close()
        except Exception:
            pass


class TaskStore:
    """
    In-memory task store with max 2 concurrent task limit.

    WHY THIS MATTERS:
    - RTX 5050 can only handle 1 heavy GPU task + 1 medium task safely
    - Without a lock, multiple requests could trigger CUDA OOM
    - This acts as a "traffic cop" for GPU resources

    The lock ensures only 2 tasks can be in "processing" state at once.
    Additional tasks wait in "queued" state until a slot opens.
    """

    def __init__(self, max_concurrent: int = 2):
        self._tasks = {}
        self._lock = threading.Lock()
        self._max_concurrent = max_concurrent

    def create_task(self, url: str) -> dict:
        """Create a new task and assign it a slot or queue position."""
        task_id = str(uuid.uuid4())

        with self._lock:
            active_count = self._count_by_status(TaskStatus.PROCESSING)

            if active_count < self._max_concurrent:
                status = TaskStatus.PROCESSING
                position = None
            else:
                status = TaskStatus.QUEUED
                position = self._count_by_status(TaskStatus.QUEUED) + 1

            task = {
                "task_id": task_id,
                "url": url,
                "status": status,
                "position": position,
                "created_at": datetime.now(),
                "current_step": "Waiting in queue..." if status == TaskStatus.QUEUED else "Starting...",
                "progress": 0,
                "step_number": 0,
                "step_name": "Queued" if status == TaskStatus.QUEUED else "Starting",
                "clips": [],
                "error": None,
                "step_times": [],
                "task_name": url,
            }

            self._tasks[task_id] = task

        _run_async(self._db_create_task(task_id, url, status.value))

        return task

    async def _db_create_task(self, task_id: str, url: str, status: str):
        try:
            from ..database.session import async_session
            from ..database.repository import TaskRepository
            async with async_session() as session:
                await TaskRepository.create(session, url, task_id)
        except Exception as e:
            print(f"[DB] Failed to persist task {task_id}: {e}")

    def get_task(self, task_id: str) -> Optional[dict]:
        """Retrieve task by ID."""
        return self._tasks.get(task_id)

    def update_task(self, task_id: str, **kwargs) -> Optional[dict]:
        """Update task fields.

        BUGFIX 2026-06-16: now rate-limits DB writes. `current_step` is
        updated 20+ times per pipeline run as a noisy progress string —
        persisting every one clogs the DB. We only persist on milestone
        changes (status, step_number, step_name, error, clips) plus the
        final progress %.
        """
        db_snapshot = None
        is_milestone = bool(
            {"status", "step_number", "step_name", "error", "clips"} & kwargs.keys()
        )
        with self._lock:
            if task_id in self._tasks:
                task = self._tasks[task_id]

                if "step_number" in kwargs and kwargs["step_number"] != task.get("step_number"):
                    task["step_times"].append({
                        "step": kwargs["step_number"],
                        "started_at": datetime.now()
                    })

                task.update(kwargs)

                # BUGFIX 2026-06-16: skip DB persist for noisy current_step
                # text. Only persist milestones + progress at completion.
                if is_milestone or kwargs.get("progress") == 100:
                    db_snapshot = {
                        k: task[k] for k in (
                            "status", "current_step", "step_number", "step_name",
                            "progress", "error", "clips",
                        )
                        if k in task
                    }

                return task

        if db_snapshot is not None:
            _run_async(self._db_update_task(task_id, db_snapshot))
        return None

    async def _db_update_task(self, task_id: str, data: dict):
        try:
            from ..database.session import async_session
            from ..database.repository import TaskRepository, ClipRepository

            async with async_session() as session:
                kwargs = {}
                for key in ("status", "current_step", "step_number", "step_name", "progress", "error"):
                    if key in data:
                        kwargs[key] = data[key]
                if kwargs:
                    await TaskRepository.update(session, task_id, **kwargs)

                clips = data.get("clips", [])
                if clips:
                    clip_data = []
                    for clip in clips:
                        clip_data.append({
                            "clip_id": clip.get("clip_id", ""),
                            "task_id": task_id,
                            "start": clip.get("start", 0),
                            "end": clip.get("end", 0),
                            "duration_s": clip.get("duration_s", 0),
                            "caption": clip.get("caption", ""),
                            "viral_title": clip.get("viral_title", ""),
                            "hashtags": clip.get("hashtags", ""),
                            "file_path": clip.get("file_path", ""),
                            "file_size_mb": clip.get("file_size_mb", 0),
                        })
                    if clip_data:
                        await ClipRepository.bulk_create(session, clip_data)
        except Exception as e:
            print(f"[DB] Failed to update task {task_id}: {e}")

    def get_task_status(self, task_id: str) -> Optional[dict]:
        """Get lightweight status object for API responses.

        NEW 2026-06-16: exposes `step_times` + `step_durations` so the
        frontend can show "Step 4 took 12s" type animations and per-stage
        timing breakdowns.
        """
        task = self._tasks.get(task_id)
        if not task:
            return None

        now = datetime.now()
        created_at = task.get("created_at", now)
        elapsed_seconds = int((now - created_at).total_seconds())

        step_number = task.get("step_number", 0)
        progress = task.get("progress", 0)

        time_estimate = self._calculate_eta(task, elapsed_seconds)

        # Build per-step durations for the frontend.
        # step_times is a list of {step, started_at}; diff successive ones
        # to get how long each step took. If we're mid-step, the "current"
        # step gets a duration from its start to now.
        step_times = task.get("step_times", []) or []
        step_durations = []
        for i, st in enumerate(step_times):
            try:
                started = st["started_at"]
                if i + 1 < len(step_times):
                    ended = step_times[i + 1]["started_at"]
                else:
                    ended = now
                dur = max(0, int((ended - started).total_seconds()))
                step_durations.append({
                    "step": st["step"],
                    "duration_s": dur,
                    "started_at": started.isoformat() if hasattr(started, "isoformat") else str(started),
                })
            except Exception:
                pass

        return {
            "task_id": task["task_id"],
            "status": task["status"],
            "current_step": task.get("current_step"),
            "progress": progress,
            "step_number": step_number,
            "total_steps": 6,
            "step_name": task.get("step_name", "Processing"),
            "time_elapsed_seconds": elapsed_seconds,
            "time_estimate_seconds": time_estimate,
            "clips": task.get("clips", []) if task["status"] == TaskStatus.COMPLETE else [],
            "error": task.get("error"),
            # Cost data (added with the verified-picks flow)
            "llm_cost_usd": task.get("llm_cost_usd"),
            "cost_per_clip_usd": task.get("cost_per_clip_usd"),
            "llm_provider": task.get("llm_provider"),
            "clips_verified": task.get("clips_verified"),
            "clips_unverified": task.get("clips_unverified"),
            "clips_requested": task.get("clips_requested"),
            "honest_result": task.get("honest_result", False),
            "honest_message": task.get("honest_message"),
            # NEW 2026-06-16: cache + per-stage timing
            "cache_hit": task.get("cache_hit", False),
            "cache_age_hours": task.get("cache_age_hours"),
            "cache_savings_usd": task.get("cache_savings_usd"),
            "step_times": step_durations,
            "started_at": created_at.isoformat() if hasattr(created_at, "isoformat") else str(created_at),
        }

    def _calculate_eta(self, task: dict, elapsed_seconds: int) -> int:
        """Calculate estimated remaining time based on progress."""
        progress = task.get("progress", 0)

        if progress <= 0:
            return max(60, elapsed_seconds)

        if progress >= 100:
            return 0

        step_times = task.get("step_times", [])

        if len(step_times) >= 2:
            total_time = 0
            for i in range(len(step_times) - 1):
                t1 = step_times[i]["started_at"]
                t2 = step_times[i + 1]["started_at"]
                total_time += (t2 - t1).total_seconds()

            avg_per_percent = total_time / progress if progress > 0 else 60
            remaining = (100 - progress) * avg_per_percent
            return max(10, int(remaining))
        else:
            estimated_total = elapsed_seconds * (100 / max(progress, 1))
            return max(10, int(estimated_total - elapsed_seconds))

    def try_promote_queued(self) -> None:
        """
        Promote next queued task to processing if slots available.

        Called after a task completes or fails to free up a slot.
        """
        promoted_id = None
        with self._lock:
            active_count = self._count_by_status(TaskStatus.PROCESSING)

            if active_count < self._max_concurrent:
                for task_id, task in self._tasks.items():
                    if task["status"] == TaskStatus.QUEUED:
                        task["status"] = TaskStatus.PROCESSING
                        task["position"] = None
                        task["step_number"] = 1
                        task["step_name"] = "Starting..."
                        promoted_id = task_id
                        break

        if promoted_id:
            _run_async(self._db_update_task(promoted_id, {"status": TaskStatus.PROCESSING.value}))

    def get_queue_info(self) -> dict:
        """Get current queue status for API."""
        with self._lock:
            return {
                "active": self._count_by_status(TaskStatus.PROCESSING),
                "queued": self._count_by_status(TaskStatus.QUEUED),
                "completed": self._count_by_status(TaskStatus.COMPLETE),
                "failed": self._count_by_status(TaskStatus.FAILED),
                "max_concurrent": self._max_concurrent
            }

    def _count_by_status(self, status: TaskStatus) -> int:
        """Count tasks with given status."""
        return sum(1 for task in self._tasks.values() if task["status"] == status)

    def remove_task(self, task_id: str) -> bool:
        """Remove completed/failed task from store."""
        should_promote = False
        with self._lock:
            if task_id in self._tasks:
                status = self._tasks[task_id]["status"]
                if status in (TaskStatus.COMPLETE, TaskStatus.FAILED):
                    del self._tasks[task_id]
                    should_promote = True

        if should_promote:
            self.try_promote_queued()
            _run_async(self._db_remove_task(task_id))
            return True
        return False

    async def _db_remove_task(self, task_id: str):
        try:
            from ..database.session import async_session
            from ..database.repository import TaskRepository
            async with async_session() as session:
                await TaskRepository.remove(session, task_id)
        except Exception as e:
            print(f"[DB] Failed to remove task {task_id}: {e}")


task_store = TaskStore(max_concurrent=2)