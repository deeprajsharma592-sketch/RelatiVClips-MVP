"""
Test: YouTube fetch serialization (anti-bot hardening).

We added a threading.Lock around all yt-dlp subprocess calls in
backend.pipeline.ingestion to prevent YouTube's anti-bot layer from
flagging us for opening multiple connections from the same IP at once.

This test confirms the lock exists and serializes calls as expected.
It does NOT make any real network calls — we monkeypatch subprocess.run
to record timing and verify mutual exclusion.
"""
import threading
import time
from unittest.mock import patch, MagicMock

import pytest

# We need to patch the *real* subprocess module's `run` attribute on
# the ingestion module — but we can't replace the whole `subprocess`
# import in ingestion because the function body uses `subprocess.TimeoutExpired`
# in `except` clauses. Replacing the whole module would make Python try
# `except MagicMock:`, which fails with "catching classes that do not
# inherit from BaseException is not allowed".
#
# Solution: patch `ingestion.subprocess.run` and `ingestion.subprocess.TimeoutExpired`
# is left as the real one.


def _import_ingestion():
    from backend.pipeline import ingestion
    return ingestion


def test_yt_fetch_lock_exists_and_is_a_lock():
    """The module-level lock must exist and be a real threading.Lock."""
    ingestion = _import_ingestion()
    assert hasattr(ingestion, "_yt_fetch_lock"), \
        "ingestion._yt_fetch_lock missing — anti-bot cap not wired"
    assert isinstance(ingestion._yt_fetch_lock, type(threading.Lock())), \
        f"expected threading.Lock, got {type(ingestion._yt_fetch_lock)}"


def test_yt_fetch_lock_serializes_parallel_calls():
    """
    If two threads call download_video at the same time, the second
    must wait for the first to release the lock. We verify this by
    having subprocess.run sleep 100ms and observing that two parallel
    callers took ~200ms total, not ~100ms.
    """
    ingestion = _import_ingestion()

    # Track timing of subprocess.run invocations
    call_log = []

    def fake_subprocess_run(cmd, **kwargs):
        # Detect calls to yt-dlp (the one we care about for the lock)
        if cmd and "yt-dlp" in str(cmd[0]):
            call_log.append(time.monotonic())
            # Simulate network work
            time.sleep(0.1)
        # Return a fake CompletedProcess
        result = MagicMock()
        result.returncode = 0
        result.stderr = ""
        result.stdout = '{"title": "fake", "id": "fake123"}'
        return result

    def fake_extract(url):
        return "fake_id"

    with patch.object(ingestion.subprocess, "run", side_effect=fake_subprocess_run), \
         patch.object(ingestion, "TEMP_DIR", new=MagicMock()), \
         patch.object(ingestion, "extract_video_id", side_effect=fake_extract), \
         patch.object(ingestion, "Path", side_effect=lambda *a, **kw: MagicMock()):
        # Fire two threads at the same time
        threads = []
        results = []
        def worker():
            try:
                r = ingestion.download_video(
                    "https://www.youtube.com/watch?v=fake", "t1"
                )
                results.append(r)
            except Exception as e:
                results.append(e)

        t0 = time.monotonic()
        for _ in range(2):
            t = threading.Thread(target=worker)
            threads.append(t)
            t.start()
        for t in threads:
            t.join()
        elapsed = time.monotonic() - t0

        # Both should succeed
        assert len(results) == 2, f"expected 2 results, got {results}"
        for r in results:
            assert isinstance(r, dict), f"expected dict, got {type(r)}: {r}"

        # If the lock is working, total elapsed ≥ 0.2s (2 × 100ms serialized)
        # If the lock is broken, elapsed ≈ 0.1s (parallel)
        assert elapsed >= 0.18, \
            f"lock not serializing: 2 calls took {elapsed:.3f}s (expected ≥ 0.18s)"

        # Confirm 2 calls actually happened
        assert len(call_log) == 2, f"expected 2 subprocess calls, got {len(call_log)}"
        # And they were staggered by ~100ms (proving serialization)
        gap = call_log[1] - call_log[0]
        assert gap >= 0.08, \
            f"calls not serialized: gap = {gap:.3f}s (expected ≥ 0.08s)"


def test_lock_release_on_exception():
    """
    If the inner subprocess raises, the lock must still be released.
    Otherwise a single failure would deadlock all future fetches.
    """
    ingestion = _import_ingestion()

    def boom(*args, **kwargs):
        raise RuntimeError("simulated subprocess failure")

    def fake_extract(url):
        return "fake_id"

    with patch.object(ingestion.subprocess, "run", side_effect=boom), \
         patch.object(ingestion, "TEMP_DIR", new=MagicMock()), \
         patch.object(ingestion, "extract_video_id", side_effect=fake_extract), \
         patch.object(ingestion, "Path", side_effect=lambda *a, **kw: MagicMock()):
        # First call should raise
        with pytest.raises(RuntimeError):
            ingestion.download_video("https://www.youtube.com/watch?v=fake", "t1")

        # Lock should still be acquirable (not deadlocked)
        acquired = ingestion._yt_fetch_lock.acquire(blocking=False)
        assert acquired, "lock was not released after exception"
        ingestion._yt_fetch_lock.release()
