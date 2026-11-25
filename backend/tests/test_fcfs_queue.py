"""Tests for FCFS time-wise queue ordering and stale task reconciliation."""

import asyncio
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest

from backend.database.models import TaskModel, TaskStatus as DBTaskStatus
from backend.utils.task_queue import FCFSTaskQueue, reconcile_stale_tasks


@pytest.mark.asyncio
async def test_fcfs_queue_executes_in_chronological_order():
    """Verify tasks run strictly in first-come, first-served (created_at) order."""
    queue = FCFSTaskQueue(max_concurrent=1)
    queue.start()
    execution_order: list[str] = []
    gate = asyncio.Event()

    t0 = datetime.now()

    async def blocker():
        execution_order.append("blocker")
        await gate.wait()

    async def job(name: str):
        execution_order.append(name)

    # Start blocker so subsequent tasks wait in the queue
    await queue.enqueue("t_blocker", t0, blocker)
    await asyncio.sleep(0.02)

    # Enqueue later timestamp first, earlier timestamp second to verify priority ordering
    await queue.enqueue("t_third", t0 + timedelta(seconds=10), lambda: job("third"))
    await queue.enqueue("t_second", t0 + timedelta(seconds=5), lambda: job("second"))

    # Release blocker and let queue drain
    gate.set()
    await asyncio.sleep(0.1)
    await queue.stop()

    assert execution_order == ["blocker", "second", "third"]


@pytest.mark.asyncio
async def test_reconcile_stale_tasks_on_startup_and_per_user():
    """Verify orphaned DB tasks from crashes/restarts are marked failed."""
    now = datetime.now()
    stale_task = TaskModel(
        task_id="orphan_123",
        user_id="user_1",
        url="https://youtube.com/watch?v=abc",
        status=DBTaskStatus.PROCESSING.value,
        created_at=now - timedelta(minutes=10),
        updated_at=now - timedelta(minutes=10),
    )

    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [stale_task]
    mock_session.execute = AsyncMock(return_value=mock_result)

    # Startup reconciliation (user_id=None) should clear it
    cleaned = await reconcile_stale_tasks(mock_session, user_id=None)
    assert cleaned == 1
    assert stale_task.status == DBTaskStatus.FAILED.value
    assert "restart" in stale_task.error.lower()
    assert mock_session.commit.called

    # Per-user reconciliation when task is not in live queue/memory should clear it too
    stale_task.status = DBTaskStatus.QUEUED.value
    stale_task.error = None
    mock_session.commit.reset_mock()

    cleaned_user = await reconcile_stale_tasks(mock_session, user_id="user_1")
    assert cleaned_user == 1
    assert stale_task.status == DBTaskStatus.FAILED.value
    assert mock_session.commit.called
