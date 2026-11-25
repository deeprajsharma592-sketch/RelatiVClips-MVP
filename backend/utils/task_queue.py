"""
First-Come, First-Served (FCFS) Time-Wise Task Queue & Stale Task Reconciliation.

Ensures:
1. Jobs execute strictly in chronological submission order (created_at, sequence).
2. No more than `max_concurrent` heavy GPU/FFmpeg pipelines run simultaneously.
3. Orphaned `queued`/`processing` rows left in PostgreSQL after crashes or restarts
   are automatically cleaned up so users never get stuck with phantom concurrency locks.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta
import itertools
import logging
from typing import Awaitable, Callable, Dict, Optional, Tuple

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..database.models import TaskModel, TaskStatus as DBTaskStatus
from .task_store import TaskStatus, task_store

logger = logging.getLogger("relativ.queue")


class FCFSTaskQueue:
    """Time-wise First-Come, First-Served async worker queue."""

    def __init__(self, max_concurrent: int = 2):
        self._max_concurrent = max_concurrent
        self._queue: Optional[asyncio.PriorityQueue] = None
        self._workers: list[asyncio.Task] = []
        self._seq = itertools.count(1)
        self._pending_ids: list[str] = []
        self._running_ids: set[str] = set()
        self._started = False

    def start(self) -> None:
        if self._started:
            return
        self._queue = asyncio.PriorityQueue()
        self._started = True
        for i in range(self._max_concurrent):
            worker = asyncio.create_task(self._worker_loop(i), name=f"fcfs-worker-{i}")
            self._workers.append(worker)
        logger.info(f"[FCFSQueue] Started {self._max_concurrent} worker(s)")

    async def stop(self) -> None:
        self._started = False
        for w in self._workers:
            w.cancel()
        if self._workers:
            await asyncio.gather(*self._workers, return_exceptions=True)
        self._workers.clear()

    def _refresh_queue_positions(self) -> None:
        """Update 1-based FCFS queue positions in task_store for waiting tasks."""
        for idx, tid in enumerate(self._pending_ids, start=1):
            task = task_store.get_task(tid)
            if task and task.get("status") == TaskStatus.QUEUED:
                task_store.update_task(
                    tid,
                    position=idx,
                    current_step=f"Queued (position #{idx} in line)...",
                )

    async def enqueue(
        self,
        task_id: str,
        created_at: datetime,
        coro_factory: Callable[[], Awaitable[None]],
    ) -> int:
        """Enqueue a job ordered strictly by (created_at, sequence).

        Returns the initial 1-based queue position (0 if workers are idle and it runs immediately).
        """
        if not self._started or self._queue is None:
            self.start()

        seq = next(self._seq)
        priority: Tuple[float, int] = (created_at.timestamp(), seq)
        self._pending_ids.append(task_id)
        self._refresh_queue_positions()

        await self._queue.put((priority, task_id, coro_factory))
        pos = self._pending_ids.index(task_id) + 1 if task_id in self._pending_ids else 0
        logger.info(f"[FCFSQueue] Enqueued task {task_id} (seq={seq}, pending={len(self._pending_ids)})")
        return pos

    def is_task_live(self, task_id: str) -> bool:
        """Return True if task is currently running or waiting in the FCFS queue."""
        return task_id in self._running_ids or task_id in self._pending_ids

    async def _worker_loop(self, worker_idx: int) -> None:
        assert self._queue is not None
        while self._started:
            try:
                priority, task_id, coro_factory = await self._queue.get()
            except asyncio.CancelledError:
                break

            try:
                if task_id in self._pending_ids:
                    self._pending_ids.remove(task_id)
                self._running_ids.add(task_id)
                self._refresh_queue_positions()

                # Transition task to PROCESSING in task_store right as worker picks it up
                task = task_store.get_task(task_id)
                if task and task.get("status") == TaskStatus.QUEUED:
                    task_store.update_task(
                        task_id,
                        status=TaskStatus.PROCESSING,
                        position=None,
                        step_number=1,
                        step_name="Starting...",
                        current_step="Starting pipeline...",
                    )

                logger.info(f"[FCFSQueue:W{worker_idx}] Running task {task_id}")
                await coro_factory()
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.error(f"[FCFSQueue:W{worker_idx}] Task {task_id} crashed: {exc}", exc_info=True)
                task_store.update_task(
                    task_id,
                    status=TaskStatus.FAILED,
                    error=f"Pipeline failed: {exc}",
                )
            finally:
                self._running_ids.discard(task_id)
                task_store.try_promote_queued()
                self._queue.task_done()


fcfs_queue = FCFSTaskQueue(max_concurrent=2)


async def reconcile_stale_tasks(
    session: AsyncSession,
    user_id: Optional[str] = None,
    stale_after_seconds: int = 90,
) -> int:
    """Mark orphaned `queued` or `processing` DB tasks as `failed`.

    - On startup (`user_id=None`): any `queued`/`processing` task in Postgres from a
      previous process has no live worker in this process, so mark it `failed`.
    - Per-user check (`user_id=...`): any `queued`/`processing` task for that user
      that is NOT live in `fcfs_queue` / `task_store` and hasn't been updated recently
      is orphaned and marked `failed`.

    Returns the number of tasks reconciled.
    """
    query = select(TaskModel).where(
        TaskModel.status.in_([DBTaskStatus.QUEUED.value, DBTaskStatus.PROCESSING.value])
    )
    if user_id is not None:
        query = query.where(TaskModel.user_id == user_id)

    rows = (await session.execute(query)).scalars().all()
    if not rows:
        return 0

    now = datetime.now()
    cutoff = now - timedelta(seconds=stale_after_seconds)
    cleaned = 0

    for row in rows:
        if user_id is None:
            # Startup cleanup: no in-memory workers exist yet
            is_stale = True
        else:
            # Live in this process?
            in_memory = task_store.get_task(row.task_id)
            in_queue = fcfs_queue.is_task_live(row.task_id)
            if in_queue or (in_memory and in_memory.get("status") in (TaskStatus.QUEUED, TaskStatus.PROCESSING)):
                is_stale = False
            else:
                # Not in live memory/queue of this process. If older than cutoff (or
                # not in memory at all on single-worker), mark failed so user isn't blocked.
                updated_at = row.updated_at or row.created_at or now
                is_stale = updated_at <= cutoff or in_memory is None

        if is_stale:
            row.status = DBTaskStatus.FAILED.value
            row.error = (
                "Interrupted by server restart"
                if user_id is None
                else "Previous job timed out or was interrupted"
            )
            row.updated_at = now
            cleaned += 1

    if cleaned > 0:
        await session.commit()
        logger.info(f"[QueueReconcile] Marked {cleaned} orphaned task(s) as failed (user_id={user_id})")

    return cleaned
