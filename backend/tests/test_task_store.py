import pytest

from utils.task_store import TaskStore


@pytest.fixture
def store():
    return TaskStore()


class TestTaskStore:
    def test_create_and_get_task(self, store):
        task_id = store.create_task("test_video.mp4", "local")
        assert task_id is not None

        task = store.get_task_status(task_id)
        assert task is not None
        assert task["status"] == "queued"
        assert task["progress"] == 0

    def test_create_task_generates_unique_ids(self, store):
        id1 = store.create_task("a.mp4", "local")
        id2 = store.create_task("b.mp4", "local")
        assert id1 != id2

    def test_update_task_progress(self, store):
        task_id = store.create_task("video.mp4", "local")
        store.update_task(task_id, status="processing", progress=50)
        task = store.get_task_status(task_id)
        assert task["status"] == "processing"
        assert task["progress"] == 50

    def test_update_task_clips(self, store):
        task_id = store.create_task("video.mp4", "local")
        clips = [{"id": "c1", "title": "Clip 1"}]
        store.update_task(task_id, status="complete", progress=100, clips=clips)
        task = store.get_task_status(task_id)
        assert task["status"] == "complete"
        assert len(task["clips"]) == 1

    def test_get_nonexistent_task(self, store):
        task = store.get_task_status("nonexistent")
        assert task is None

    def test_remove_task(self, store):
        task_id = store.create_task("video.mp4", "local")
        store.remove_task(task_id)
        assert store.get_task_status(task_id) is None

    def test_get_queue_info(self, store):
        store.create_task("a.mp4", "local")
        store.create_task("b.mp4", "local")
        info = store.get_queue_info()
        assert info["queued"] >= 2
        assert info["max_concurrent"] == 2
        assert len(info["tasks"]) >= 2

    def test_promote_task(self, store):
        id1 = store.create_task("a.mp4", "local")
        id2 = store.create_task("b.mp4", "local")

        # Promote both (within concurrency limit)
        promoted1 = store.promote_next_task()
        assert promoted1 is not None
        task1 = store.get_task_status(promoted1)
        assert task1["status"] == "processing"

        promoted2 = store.promote_next_task()
        assert promoted2 is not None
        task2 = store.get_task_status(promoted2)
        assert task2["status"] == "processing"

        # Third should be None (max 2 concurrent)
        assert store.promote_next_task() is None

    def test_get_active_task_list(self, store):
        id1 = store.create_task("a.mp4", "local")
        id2 = store.create_task("b.mp4", "local")
        id3 = store.create_task("c.mp4", "local")

        store.promote_next_task()
        active = store.get_active_tasks()
        assert len(active) == 1

        store.promote_next_task()
        active = store.get_active_tasks()
        assert len(active) == 2
