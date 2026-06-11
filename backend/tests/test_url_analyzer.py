"""
Tests for the URL analyzer (stage 1).

Uses monkeypatched subprocess.run so no network or local files are touched.
"""
import json
import subprocess
import pytest

from backend.pipeline.url_analyzer import (
    analyze_url, _extract_video_id, _looks_like_youtube,
)


# --- _extract_video_id ---

class TestExtractVideoId:
    def test_standard_url(self):
        assert _extract_video_id("https://youtube.com/watch?v=abc123def45") == "abc123def45"

    def test_short_url(self):
        assert _extract_video_id("https://youtu.be/xyz789abcde") == "xyz789abcde"

    def test_shorts_url(self):
        assert _extract_video_id("https://youtube.com/shorts/short1abcde") == "short1abcde"

    def test_url_with_params(self):
        assert _extract_video_id("https://youtube.com/watch?v=abc123def45&t=30s") == "abc123def45"

    def test_local_path(self):
        assert _extract_video_id("/tmp/video.mp4") is None


class TestLooksLikeYoutube:
    def test_youtube(self):
        assert _looks_like_youtube("https://youtube.com/watch?v=abc") is True

    def test_youtu_be(self):
        assert _looks_like_youtube("https://youtu.be/abc") is True

    def test_local(self):
        assert _looks_like_youtube("/tmp/video.mp4") is False

    def test_https_other(self):
        assert _looks_like_youtube("https://vimeo.com/123") is False


# --- analyze_url with mocked subprocess ---

class TestAnalyzeYoutube:
    def test_happy_path(self, monkeypatch):
        def fake_run(cmd, **kwargs):
            stdout = json.dumps({
                "id": "abc123def45",
                "title": "My Test Video",
                "duration": 600,
                "uploader": "Test Channel",
            })
            return subprocess.CompletedProcess(cmd, 0, stdout=stdout, stderr="")
        monkeypatch.setattr(subprocess, "run", fake_run)

        result = analyze_url("https://youtube.com/watch?v=abc123def45")
        assert result["source_type"] == "youtube"
        assert result["video_id"] == "abc123def45"
        assert result["title"] == "My Test Video"
        assert result["duration_s"] == 600.0
        assert result["channel"] == "Test Channel"

    def test_timeout_falls_back(self, monkeypatch):
        def fake_run(cmd, **kwargs):
            raise subprocess.TimeoutExpired(cmd, kwargs.get("timeout", 30))
        monkeypatch.setattr(subprocess, "run", fake_run)

        result = analyze_url("https://youtube.com/watch?v=abc123def45")
        # Fallback returns a well-formed partial dict
        assert result["source_type"] == "youtube"
        assert result["video_id"] == "abc123def45"  # extracted from URL
        assert result["title"] == "Unknown"
        assert result["duration_s"] == 0.0
        assert result["channel"] is None

    def test_nonzero_exit_falls_back(self, monkeypatch):
        def fake_run(cmd, **kwargs):
            return subprocess.CompletedProcess(cmd, 1, stdout="", stderr="err")
        monkeypatch.setattr(subprocess, "run", fake_run)

        result = analyze_url("https://youtube.com/watch?v=abc123def45")
        assert result["title"] == "Unknown"

    def test_garbage_json_falls_back(self, monkeypatch):
        def fake_run(cmd, **kwargs):
            return subprocess.CompletedProcess(cmd, 0, stdout="not json", stderr="")
        monkeypatch.setattr(subprocess, "run", fake_run)

        result = analyze_url("https://youtube.com/watch?v=abc123def45")
        assert result["title"] == "Unknown"


class TestAnalyzeLocal:
    def test_file_not_found(self):
        result = analyze_url("/tmp/nonexistent_file_xyz.mp4")
        assert result["source_type"] == "local"
        assert result["title"] == "Unknown"
        assert result["duration_s"] == 0.0
        assert result["video_id"] is None

    def test_happy_path(self, tmp_path, monkeypatch):
        f = tmp_path / "test_video.mp4"
        f.write_bytes(b"fake")

        def fake_run(cmd, **kwargs):
            stdout = json.dumps({
                "format": {
                    "duration": "120.5",
                    "tags": {"title": "Real Title", "artist": "Author Name"},
                }
            })
            return subprocess.CompletedProcess(cmd, 0, stdout=stdout, stderr="")
        monkeypatch.setattr(subprocess, "run", fake_run)

        result = analyze_url(str(f))
        assert result["source_type"] == "local"
        assert result["title"] == "Real Title"
        assert result["duration_s"] == 120.5
        assert result["channel"] == "Author Name"
        assert result["video_id"] is None

    def test_no_metadata_tags(self, tmp_path, monkeypatch):
        f = tmp_path / "plain.mp4"
        f.write_bytes(b"fake")

        def fake_run(cmd, **kwargs):
            stdout = json.dumps({"format": {"duration": "60.0"}})
            return subprocess.CompletedProcess(cmd, 0, stdout=stdout, stderr="")
        monkeypatch.setattr(subprocess, "run", fake_run)

        result = analyze_url(str(f))
        assert result["title"] == "plain"  # from file stem
        assert result["duration_s"] == 60.0
        assert result["channel"] is None
