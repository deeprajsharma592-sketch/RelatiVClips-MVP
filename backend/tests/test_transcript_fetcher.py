import pytest
from types import SimpleNamespace

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

    def test_parses_youtube_rolling_karaoke_vtt(self, tmp_path):
        rolling_vtt = """WEBVTT
Kind: captions
Language: en

00:00:01.120 --> 00:00:03.510 align:start position:0%
 
65%<00:00:02.120><c> of</c><00:00:02.320><c> startups</c><00:00:02.760><c> shut</c><00:00:03.000><c> down</c>

00:00:03.510 --> 00:00:03.520 align:start position:0%
65% of startups shut down
 

00:00:03.520 --> 00:00:06.030 align:start position:0%
65% of startups shut down
founders<00:00:03.960><c> fight</c>
"""
        path = tmp_path / "rolling.vtt"
        path.write_text(rolling_vtt)
        segments = _parse_vtt(str(path))
        assert len(segments) == 1
        assert "65% of startups shut down" in segments[0]["text"]
        assert "founders fight" in segments[0]["text"]

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


class TestYouTubeAudioFallback:
    def test_ytagent_source_is_used_for_local_audio(self, monkeypatch, tmp_path):
        from backend.pipeline import transcript_fetcher as fetcher
        from backend.utils import ytagent_downloader

        source_path = tmp_path / "verified.mp4"
        source_path.write_bytes(b"verified source")
        monkeypatch.setattr(fetcher, "TEMP_DIR", tmp_path)
        monkeypatch.setattr(fetcher, "get_cookie_args", lambda: [])
        monkeypatch.setattr(
            ytagent_downloader,
            "download_high_quality_source",
            lambda url, log=None: {"path": str(source_path), "method": "cache"},
        )

        def fake_run(command, **kwargs):
            # Simulate FFmpeg creating the 16 kHz mono WAV requested by the adapter.
            if command[0] == fetcher.FFMPEG_PATH:
                (tmp_path / "audio_task_audio.wav").write_bytes(b"0" * 2048)
            return SimpleNamespace(returncode=0, stdout="", stderr="")

        monkeypatch.setattr(fetcher.subprocess, "run", fake_run)
        result = fetcher._download_audio("https://youtu.be/abc", "audio_task", lambda _: None)

        assert result == str(tmp_path / "audio_task_audio.wav")

    def test_authenticated_audio_uses_default_client_and_skips_ytagent(self, monkeypatch, tmp_path):
        from backend.pipeline import transcript_fetcher as fetcher
        from backend.utils import ytagent_downloader

        monkeypatch.setattr(fetcher, "TEMP_DIR", tmp_path)
        monkeypatch.setattr(fetcher, "get_cookie_args", lambda: ["--cookies", "/secret/cookies.txt"])
        monkeypatch.setattr(
            ytagent_downloader,
            "download_high_quality_source",
            lambda *args, **kwargs: pytest.fail("ytagent should not run when cookies are available"),
        )

        observed = {}

        def fake_run(command, **kwargs):
            observed["command"] = command
            (tmp_path / "cookie_task_audio.wav").write_bytes(b"0" * 2048)
            return SimpleNamespace(returncode=0, stdout="", stderr="")

        monkeypatch.setattr(fetcher.subprocess, "run", fake_run)
        result = fetcher._download_audio("https://youtu.be/abc", "cookie_task", lambda _: None)

        assert result == str(tmp_path / "cookie_task_audio.wav")
        assert "--cookies" in observed["command"]
        assert "youtube:player_client=tv_embedded,web_creator,mweb,web,android" not in observed["command"]

    def test_auth_challenge_stops_direct_retries(self, monkeypatch):
        from backend.pipeline import transcript_fetcher as fetcher

        calls = []

        def blocked_run(*args, **kwargs):
            calls.append(1)
            return SimpleNamespace(
                returncode=1,
                stdout="",
                stderr="ERROR: Sign in to confirm you're not a bot",
            )

        monkeypatch.setattr(fetcher.subprocess, "run", blocked_run)
        result = fetcher._run_with_retry(["yt-dlp"], lambda _: None, max_attempts=4)

        assert result.returncode == 1
        assert len(calls) == 1
