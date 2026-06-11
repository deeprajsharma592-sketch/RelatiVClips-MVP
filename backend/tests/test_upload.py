"""
Tests for the /upload endpoint and its interaction with /process/local.
"""
import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    sys_path = "/app/RelatiV"
    import sys
    if sys_path not in sys.path:
        sys.path.insert(0, sys_path)
    from backend.main import app
    return TestClient(app)


class TestUpload:
    def test_upload_mp4_succeeds(self, client, tmp_path):
        """Real multipart upload returns file_path + task_id."""
        fake = b"\x00\x00\x00\x20ftypisom" + b"\x00" * 1000
        r = client.post(
            "/upload",
            files={"file": ("myvideo.mp4", fake, "video/mp4")},
        )
        assert r.status_code == 200
        body = r.json()
        assert "file_path" in body
        assert "task_id" in body
        assert body["file_path"].endswith(".mp4")
        assert body["size_mb"] >= 0
        # File actually exists on disk
        from pathlib import Path
        assert Path(body["file_path"]).exists()

    def test_upload_rejects_non_video(self, client):
        """Rejects extensions outside the allowlist."""
        r = client.post(
            "/upload",
            files={"file": ("malware.exe", b"fake", "application/octet-stream")},
        )
        assert r.status_code == 400
        assert "Unsupported video format" in r.json()["detail"]

    def test_upload_accepts_all_formats(self, client):
        """mp4, mov, mkv, webm, etc. all accepted."""
        for ext in ["mp4", "mov", "avi", "mkv", "webm", "m4v", "flv", "wmv"]:
            r = client.post(
                "/upload",
                files={"file": (f"v.{ext}", b"fake", "video/mp4")},
            )
            assert r.status_code == 200, f"{ext} rejected: {r.text}"

    def test_upload_with_explicit_task_id(self, client):
        """Caller can supply a task_id; we use it as the filename stem."""
        r = client.post(
            "/upload?task_id=mycustomid",
            files={"file": ("test.mp4", b"fake", "video/mp4")},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["task_id"] == "mycustomid"
        assert "mycustomid" in body["file_path"]
