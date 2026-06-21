"""
Tests for backend.utils.yt_dlp_bgutil — yt-dlp background download + proxy.

The actual live tests (hitting a real bgutil server) are skipped by default
because datacenter IPs are rate-limited by YouTube.  Run with
SKIP_BGUTIL_LIVE=0 to enable them.
"""
import os
import subprocess
from unittest.mock import MagicMock

import pytest


def test_default_no_proxy():
    """Without YT_PROXY, the default proxy string is empty."""
    from backend.utils import config
    assert config.YT_PROXY == "", f"default should be empty, got: {config.YT_PROXY!r}"


def test_proxy_env_read(monkeypatch):
    """YT_PROXY env var is picked up by the config module."""
    saved = os.environ.get("YT_PROXY")
    try:
        monkeypatch.setenv("YT_PROXY", "socks5://127.0.0.1:1080")
        import importlib
        from backend.utils import config
        importlib.reload(config)
        assert config.YT_PROXY == "socks5://127.0.0.1:1080"
    finally:
        if saved is not None:
            os.environ["YT_PROXY"] = saved


def test_socks5_proxy_added_when_set(monkeypatch):
    """When YT_PROXY is set, the yt-dlp subprocess call must include --proxy."""
    monkeypatch.setenv("YT_PROXY", "socks5://user:pass@example.com:1080")

    # Reload config so it picks up the new YT_PROXY value
    import importlib
    from backend.utils import config
    importlib.reload(config)

    # Break the residential import chain so _download_video_locked falls through
    # to yt-dlp instead of using the laptop's residential proxy.
    import sys
    sys.modules.pop("backend.utils.residential_downloader", None)
    from backend.pipeline import ingestion
    importlib.reload(ingestion)
    from backend.pipeline.ingestion import download_video

    # Capture the first subprocess.run call (yt-dlp). Subsequent calls are
    # audio-extraction (ffprobe/ffmpeg) and should be real-ish mocks.
    yt_dlp_cmd = {}

    def fake_run(cmd, **kwargs):
        if not yt_dlp_cmd:  # capture the first subprocess call (yt-dlp)
            yt_dlp_cmd["cmd"] = cmd
        # Let audio-extraction calls through so the function can complete
        if "ffmpeg" in cmd[0] or "ffprobe" in cmd[0]:
            r = MagicMock()
            r.returncode = 0
            r.stdout = ""
            r.stderr = ""
            return r
        # Real result for the yt-dlp call so the function doesn't raise
        r = MagicMock()
        r.returncode = 0
        r.stderr = ""
        r.stdout = ""
        return r

    monkeypatch.setattr("subprocess.run", fake_run)

    download_video("https://www.youtube.com/watch?v=jNQXAC9IVRw", "test_task")

    assert yt_dlp_cmd, "No subprocess call captured — yt-dlp was not invoked"
    assert "--proxy" in yt_dlp_cmd["cmd"], (
        f"--proxy not in yt-dlp cmd. cmd: {yt_dlp_cmd['cmd']}"
    )
    assert "socks5://user:pass@example.com:1080" in yt_dlp_cmd["cmd"]


@pytest.mark.skipif(
    os.getenv("SKIP_BGUTIL_LIVE", "1") == "1",
    reason="Skips live bgutil HTTP test by default (host IP may be rate-limited). "
           "Set SKIP_BGUTIL_LIVE=0 to actually hit the local server.",
)
def test_live_bgutil_http_reachable():
    """If bgutil container is running locally, /ping should return JSON."""
    import httpx
    r = httpx.get("http://127.0.0.1:4416/ping", timeout=5)
    assert r.status_code == 200
    data = r.json()
    assert "version" in data
