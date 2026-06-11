"""
Tests for the bgutil YouTube PO-token provider integration.

These tests are not full E2E (which would require a real YouTube URL to
succeed against YouTube's anti-bot). They verify the *plumbing*:

1. The bgutil-ytdlp-pot-provider plugin is auto-discovered by yt-dlp.
2. The local bgutil HTTP server (if running) is reachable on :4416.
3. The ingestion module builds the right `--extractor-args` string.
4. The optional SOCKS5 proxy env var is plumbed correctly.

Mark the YouTube-fetch tests as xfail when the host IP is rate-limited
by YouTube — they pass on a fresh Hetzner IP but fail locally until then.
"""

import os
import subprocess
from pathlib import Path
import pytest


BACKEND = Path("/app/RelatiV/backend")


def test_pip_plugin_installed():
    """The bgutil-ytdlp-pot-provider plugin must be in the venv."""
    from importlib.metadata import version, PackageNotFoundError
    try:
        v = version("bgutil-ytdlp-pot-provider")
        assert v.startswith("1."), f"unexpected version: {v}"
    except PackageNotFoundError:
        pytest.fail("bgutil-ytdlp-pot-provider not installed in venv")


def test_plugin_files_in_expected_location():
    """yt-dlp's plugin directory must contain the bgutil provider files."""
    plugin_dir = BACKEND / ".venv/lib/python3.11/site-packages/yt_dlp_plugins/extractor"
    assert plugin_dir.exists(), f"missing plugin dir: {plugin_dir}"
    assert (plugin_dir / "getpot_bgutil.py").exists()
    assert (plugin_dir / "getpot_bgutil_http.py").exists()
    assert (plugin_dir / "getpot_bgutil_script.py").exists()


def test_yt_dlp_discovers_bgutil_plugin():
    """yt-dlp's verbose log should list bgutil:http as an available provider."""
    ytdlp = BACKEND / ".venv/bin/yt-dlp"
    result = subprocess.run(
        [str(ytdlp), "--verbose", "--skip-download",
         "--dump-json", "https://www.youtube.com/watch?v=jNQXAC9IVRw"],  # 'Me at the zoo' — first YT video, very stable
        capture_output=True, text=True, timeout=60,
    )
    combined = result.stdout + result.stderr
    assert "bgutil:http" in combined, (
        f"bgutil:http not in yt-dlp output. "
        f"Provider discovery may be broken. Output:\n{combined[:2000]}"
    )
    # The HTTP provider is listed as 'external' (i.e. it knows there's
    # an external HTTP server to call). The script-based ones are
    # 'unavailable' because we don't have Deno or the script bundled.
    assert "bgutil:http" in combined and "external" in combined


def test_extractor_args_in_ingestion_module():
    """The ingestion module should reference BGUTIL_POT_BASE_URL in its ytdlp cmd."""
    from backend.utils.config import BGUTIL_POT_BASE_URL, YT_PROXY
    assert BGUTIL_POT_BASE_URL, "BGUTIL_POT_BASE_URL must be set"
    assert BGUTIL_POT_BASE_URL.startswith("http"), f"bad URL: {BGUTIL_POT_BASE_URL}"

    # The source should not contain the old static extractor-args
    src = (BACKEND / "pipeline/ingestion.py").read_text()
    assert "player_client=web,default_client=web" not in src, (
        "Old static extractor-args still present — should be replaced by "
        "youtubepot-bgutilhttp:base_url"
    )
    assert "youtubepot-bgutilhttp:base_url" in src


def test_js_runtime_node_passed_to_yt_dlp():
    """The ytdlp cmd must include --js-runtimes node for signature solving."""
    src = (BACKEND / "pipeline/ingestion.py").read_text()
    # Both the main downloader and segment downloader should pass it
    assert src.count("--js-runtimes") >= 2 or src.count('"--js-runtimes", "node"') >= 2


def test_socks5_proxy_optional():
    """YT_PROXY defaults to empty and only adds --proxy when set."""
    from backend.utils.config import YT_PROXY
    # Default (no env var) is empty
    saved = os.environ.pop("YT_PROXY", None)
    try:
        # Force reimport with the env var removed
        import importlib
        from backend.utils import config
        importlib.reload(config)
        assert config.YT_PROXY == "", f"default should be empty, got: {config.YT_PROXY!r}"
    finally:
        if saved is not None:
            os.environ["YT_PROXY"] = saved


def test_socks5_proxy_added_when_set(monkeypatch):
    """When YT_PROXY is set, the ytdlp cmd should include --proxy <url>."""
    monkeypatch.setenv("YT_PROXY", "socks5://user:pass@example.com:1080")
    import importlib
    from backend.utils import config
    importlib.reload(config)
    # Reload ingestion too so it picks up the new YT_PROXY
    from backend.pipeline import ingestion
    importlib.reload(ingestion)
    from backend.pipeline.ingestion import download_video
    # Inspect the ytdlp cmd assembly by monkey-patching subprocess.run
    captured_cmd = {}

    def fake_run(cmd, **kwargs):
        captured_cmd["cmd"] = cmd
        # Return a fake result
        from unittest.mock import MagicMock
        r = MagicMock()
        r.returncode = 0
        r.stderr = ""
        r.stdout = ""
        return r

    monkeypatch.setattr("subprocess.run", fake_run)

    try:
        download_video("https://www.youtube.com/watch?v=jNQXAC9IVRw", "test_task")
    except Exception:
        # We don't actually want to call yt-dlp; we just want to inspect the cmd
        pass

    assert "--proxy" in captured_cmd.get("cmd", []), (
        f"--proxy not in cmd when YT_PROXY is set. cmd: {captured_cmd.get('cmd')}"
    )
    assert "socks5://user:pass@example.com:1080" in captured_cmd.get("cmd", [])


@pytest.mark.skipif(
    os.getenv("SKIP_BGUTIL_LIVE", "1") == "1",
    reason="Skips live bgutil HTTP test by default (host IP may be rate-limited). "
           "Set SKIP_BGUTIL_LIVE=0 to actually hit the local server."
)
def test_live_bgutil_http_reachable():
    """If bgutil container is running locally, /ping should return JSON."""
    import httpx
    r = httpx.get("http://127.0.0.1:4416/ping", timeout=5)
    assert r.status_code == 200
    data = r.json()
    assert "version" in data
