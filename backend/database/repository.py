from datetime import datetime
from typing import Optional, List
from sqlalchemy import select, func, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from .models import TaskModel, ClipModel, TaskStatus


class TaskRepository:

    @staticmethod
    async def create(session: AsyncSession, url: str, task_id: str) -> TaskModel:
        task = TaskModel(task_id=task_id, url=url)
        session.add(task)
        await session.commit()
        await session.refresh(task)
        return task

    @staticmethod
    async def get(session: AsyncSession, task_id: str) -> Optional[TaskModel]:
        result = await session.execute(select(TaskModel).where(TaskModel.task_id == task_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def update(session: AsyncSession, task_id: str, **kwargs) -> Optional[TaskModel]:
        task = await TaskRepository.get(session, task_id)
        if not task:
            return None
        for key, value in kwargs.items():
            if hasattr(task, key):
                setattr(task, key, value)
        task.updated_at = datetime.now()
        await session.commit()
        await session.refresh(task)
        return task

    @staticmethod
    async def get_queue_info(session: AsyncSession) -> dict:
        counts = {}
        for status in TaskStatus:
            result = await session.execute(
                select(func.count(TaskModel.task_id)).where(TaskModel.status == status.value)
            )
            counts[status.value] = result.scalar() or 0
        return {
            "active": counts.get("processing", 0),
            "queued": counts.get("queued", 0),
            "completed": counts.get("complete", 0),
            "failed": counts.get("failed", 0),
            "max_concurrent": 2,
        }

    @staticmethod
    async def count_by_status(session: AsyncSession, status: TaskStatus) -> int:
        result = await session.execute(
            select(func.count(TaskModel.task_id)).where(TaskModel.status == status.value)
        )
        return result.scalar() or 0

    @staticmethod
    async def promote_queued(session: AsyncSession, max_concurrent: int = 2) -> Optional[str]:
        active = await TaskRepository.count_by_status(session, TaskStatus.PROCESSING)
        if active < max_concurrent:
            result = await session.execute(
                select(TaskModel).where(TaskModel.status == TaskStatus.QUEUED.value)
                .order_by(TaskModel.created_at).limit(1)
            )
            task = result.scalar_one_or_none()
            if task:
                task.status = TaskStatus.PROCESSING
                task.position = None
                task.step_number = 1
                task.step_name = "Starting..."
                await session.commit()
                return task.task_id
        return None

    @staticmethod
    async def remove(session: AsyncSession, task_id: str) -> bool:
        task = await TaskRepository.get(session, task_id)
        if task and task.status in (TaskStatus.COMPLETE.value, TaskStatus.FAILED.value):
            await session.delete(task)
            await session.commit()
            return True
        return False


class ClipRepository:

    @staticmethod
    async def bulk_create(session: AsyncSession, clips_data: list[dict]) -> list[ClipModel]:
        clips = []
        for data in clips_data:
            clip = ClipModel(**data)
            session.add(clip)
            clips.append(clip)
        await session.commit()
        for clip in clips:
            await session.refresh(clip)
        return clips

    @staticmethod
    async def get_by_task(session: AsyncSession, task_id: str) -> list[ClipModel]:
        result = await session.execute(
            select(ClipModel).where(ClipModel.task_id == task_id).order_by(ClipModel.start)
        )
        return list(result.scalars().all())

    @staticmethod
    async def get_by_clip_id(session: AsyncSession, clip_id: str) -> Optional[ClipModel]:
        result = await session.execute(select(ClipModel).where(ClipModel.clip_id == clip_id))
        return result.scalar_one_or_none()
