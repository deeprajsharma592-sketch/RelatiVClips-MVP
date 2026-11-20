import json

import pytest

from backend.utils import ytagent_downloader as adapter


class _ProbeResult:
    def __init__(self, payload, returncode=0):
        self.returncode = returncode
        self.stdout = json.dumps(payload)
        self.stderr = ""


def test_only_direct_verified_methods_are_allowed():
    assert set(adapter.SAFE_METHOD_NAMES) == {
        "transcript_probe",
        "ytdlp_default",
        "ytdlp_jsless",
        "ytdlp_ios",
    }
    assert "socks5_farm" not in adapter.SAFE_METHOD_NAMES
    assert "cobalt_community" not in adapter.SAFE_METHOD_NAMES
    assert "github_actions_farm" not in adapter.SAFE_METHOD_NAMES


def test_probe_requires_high_quality_video_and_audio(monkeypatch, tmp_path):
    results = iter([
        _ProbeResult({"streams": [{"codec_type": "video", "width": 1920, "height": 1080, "codec_name": "h264"}]}),
        _ProbeResult({"streams": [{"codec_name": "aac"}]}),
    ])
    monkeypatch.setattr(adapter.subprocess, "run", lambda *args, **kwargs: next(results))

    meta = adapter._probe_video(tmp_path / "source.mp4")

    assert meta["width"] == 1920
    assert meta["height"] == 1080
    assert meta["audio_codec"] == "aac"


def test_probe_rejects_silent_video(monkeypatch, tmp_path):
    results = iter([
        _ProbeResult({"streams": [{"codec_type": "video", "width": 1920, "height": 1080, "codec_name": "h264"}]}),
        _ProbeResult({"streams": []}),
    ])
    monkeypatch.setattr(adapter.subprocess, "run", lambda *args, **kwargs: next(results))

    with pytest.raises(adapter.YtAgentError, match="no audio stream"):
        adapter._probe_video(tmp_path / "silent.mp4")


def test_probe_rejects_low_resolution_fallback(monkeypatch, tmp_path):
    results = iter([
        _ProbeResult({"streams": [{"codec_type": "video", "width": 640, "height": 360, "codec_name": "h264"}]}),
        _ProbeResult({"streams": [{"codec_name": "aac"}]}),
    ])
    monkeypatch.setattr(adapter.subprocess, "run", lambda *args, **kwargs: next(results))

    with pytest.raises(adapter.YtAgentError, match="minimum accepted quality"):
        adapter._probe_video(tmp_path / "low.mp4")
