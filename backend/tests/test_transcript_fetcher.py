import pytest

from backend.pipeline.transcript_fetcher import (
    _extract_video_id,
    _parse_vtt,
    _parse_srt,
)


class TestExtractVideoId:
    def test_standard_url(self):
        assert _extract_video_id("https://youtube.com/watch?v=abc123") == "abc123"

    def test_short_url(self):
        assert _extract_video_id("https://youtu.be/xyz789") == "xyz789"

    def test_shorts_url(self):
        assert _extract_video_id("https://youtube.com/shorts/short1") == "short1"

    def test_url_with_params(self):
        assert _extract_video_id("https://youtube.com/watch?v=abc123&t=30s") == "abc123"

    def test_invalid_url(self):
        assert _extract_video_id("https://example.com") == ""


SAMPLE_VTT = """WEBVTT

00:00:01.000 --> 00:00:04.000
Hello world

00:00:05.000 --> 00:00:08.500
This is a test
with multiple lines
"""

SAMPLE_SRT = """1
00:00:01,000 --> 00:00:04,000
Hello world

2
00:00:05,000 --> 00:00:08,500
This is a test
with multiple lines
"""


class TestParseVtt:
    def test_parses_segments(self, tmp_path):
        path = tmp_path / "test.vtt"
        path.write_text(SAMPLE_VTT)
        segments = _parse_vtt(str(path))
        assert len(segments) == 2
        assert segments[0]["start"] == 1.0
        assert segments[0]["end"] == 4.0
        assert segments[0]["text"] == "Hello world"

    def test_empty_file(self, tmp_path):
        path = tmp_path / "empty.vtt"
        path.write_text("")
        assert _parse_vtt(str(path)) == []

    def test_nonexistent_file(self):
        assert _parse_vtt("/nonexistent/file.vtt") == []


class TestParseSrt:
    def test_parses_segments(self, tmp_path):
        path = tmp_path / "test.srt"
        path.write_text(SAMPLE_SRT)
        segments = _parse_srt(str(path))
        assert len(segments) == 2
        assert segments[1]["start"] == 5.0
        assert segments[1]["end"] == 8.5
        assert "multiple lines" in segments[1]["text"]

    def test_empty_file(self, tmp_path):
        path = tmp_path / "empty.srt"
        path.write_text("")
        assert _parse_srt(str(path)) == []

    def test_nonexistent_file(self):
        assert _parse_srt("/nonexistent/file.srt") == []


class TestFetchTranscriptContract:
    """Verify the empty-result contract: if everything fails, return
    a well-formed empty transcript dict so callers don't crash."""

    def test_empty_result_shape(self, monkeypatch):
        from backend.pipeline.transcript_fetcher import fetch_transcript

        # Stub out both fetcher paths so no network is touched.
        monkeypatch.setattr(
            "backend.pipeline.transcript_fetcher._try_ytdlp_transcript",
            lambda url, task_id, log: None,
        )
        monkeypatch.setattr(
            "backend.pipeline.transcript_fetcher._try_whisper_transcript",
            lambda audio_path, task_id, log: None,
        )
        monkeypatch.setattr(
            "backend.pipeline.transcript_fetcher._download_audio",
            lambda url, task_id, log: None,
        )

        result = fetch_transcript("https://example.com/whatever", "test_task_1")
        assert result == {"segments": [], "language": "en", "source": None}
