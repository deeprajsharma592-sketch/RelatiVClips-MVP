import pytest

from backend.utils.task_store import TaskStore


@pytest.fixture
def store():
    return TaskStore()


class TestTaskStore:
    def test_create_and_get_task(self, store):
        task = store.create_task("test_video.mp4")
        task_id = task["task_id"]
        assert task_id is not None

        result = store.get_task_status(task_id)
        assert result is not None
        assert result["progress"] == 0

    def test_create_task_generates_unique_ids(self, store):
        t1 = store.create_task("a.mp4")
        t2 = store.create_task("b.mp4")
        assert t1["task_id"] != t2["task_id"]

    def test_update_task_progress(self, store):
        task = store.create_task("video.mp4")
        task_id = task["task_id"]
        store.update_task(task_id, status="processing", progress=50)
        result = store.get_task_status(task_id)
        assert result["status"] == "processing"
        assert result["progress"] == 50

    def test_update_task_clips(self, store):
        task = store.create_task("video.mp4")
        task_id = task["task_id"]
        # Must set complete for clips to appear
        store.update_task(task_id, status="complete", progress=100, clips=[{"id": "c1", "title": "Clip 1"}])
        result = store.get_task_status(task_id)
        assert result["status"] == "complete"
        assert len(result["clips"]) == 1

    def test_get_nonexistent_task(self, store):
        result = store.get_task_status("nonexistent")
        assert result is None

    def test_remove_task_requires_complete_status(self, store):
        task = store.create_task("video.mp4")
        task_id = task["task_id"]
        # Can't remove while still processing
        result = store.remove_task(task_id)
        assert result is False

    def test_remove_completed_task(self, store):
        task = store.create_task("video.mp4")
        task_id = task["task_id"]
        store.update_task(task_id, status="complete", progress=100)
        result = store.remove_task(task_id)
        assert result is True
        assert store.get_task_status(task_id) is None

    def test_get_queue_info(self, store):
        store.create_task("a.mp4")
        store.create_task("b.mp4")
        info = store.get_queue_info()
        assert "queued" in info
        assert info["max_concurrent"] == 2

    def test_try_promote_queued(self, store):
        # Create enough tasks to fill slots
        store.create_task("a.mp4")
        store.create_task("b.mp4")
        task3 = store.create_task("c.mp4")
        task3_id = task3["task_id"]

        # task3 should be queued (2 already processing)
        info_before = store.get_queue_info()
        assert info_before["queued"] > 0

        # Complete one task to free a slot
        store.update_task(task3_id, status="complete", progress=100)
        store.remove_task(task3_id)

        # Promote queued tasks
        store.try_promote_queued()
        info_after = store.get_queue_info()
        assert info_after["active"] <= 2
