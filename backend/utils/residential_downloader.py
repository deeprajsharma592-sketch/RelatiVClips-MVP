"""
Residential Downloader — routes YouTube video downloads to Deepraj's laptop.
Uses the laptop's residential IP (not Hetzner datacenter IP) for YouTube CDN access.

Setup:
    1. On laptop: python ytdlp-server.py (keeps running)
    2. On laptop: ngrok http 8765 (keeps running)
    3. Paste the ngrok URL in backend/utils/config.py -> RESIDENTIAL_DOWNLOAD_URL
    4. Restart backend: docker compose restart backend

The URL (ngrok or LAN IP) is configured in config.py.
"""

import os
import sys
from pathlib import Path
from typing import Optional

# Resolve config relative to this file
_config_path = Path(__file__).parent.parent.parent / "utils" / "config.py"
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

try:
    from .config import RESIDENTIAL_DOWNLOAD_URL, RESIDENTIAL_DOWNLOAD_TIMEOUT
except ImportError:
    # Fallback if config not loaded
    RESIDENTIAL_DOWNLOAD_URL = os.environ.get(
        "RESIDENTIAL_DOWNLOAD_URL",
        "https://overbid-unleaded-pencil.ngrok-free.dev"
    )
    RESIDENTIAL_DOWNLOAD_TIMEOUT = 300

# Strip trailing slash
BASE_URL = RESIDENTIAL_DOWNLOAD_URL.rstrip("/")


def is_reachable() -> bool:
    """Check if the residential download server is online."""
    try:
        import requests
        r = requests.get(f"{BASE_URL}/health", timeout=10, verify=True)
        return r.status_code == 200
    except Exception:
        return False


def download_video(
    url: str,
    output_path: str,
    start: Optional[float] = None,
    end: Optional[float] = None,
) -> str:
    """
    Download a YouTube video (or segment) via the residential server (laptop).
    The laptop's residential IP is used to access YouTube CDN.

    Args:
        url: YouTube video URL
        output_path: Local path to save the video
        start: Optional start time in seconds
        end: Optional end time in seconds

    Returns:
        Path to the downloaded file

    Raises:
        RuntimeError: If download fails
    """
    import requests

    params = {"url": url}

    if start is not None:
        params["start"] = str(start)
    if end is not None:
        params["end"] = str(end)

    try:
        with requests.get(
            f"{BASE_URL}/download",
            params=params,
            stream=True,
            timeout=RESIDENTIAL_DOWNLOAD_TIMEOUT,
            headers={"User-Agent": "RelatiV/2.0"},
        ) as r:
            if r.status_code != 200:
                raise RuntimeError(
                    f"Residential download failed: HTTP {r.status_code} — {r.text[:300]}"
                )

            # Stream to disk
            with open(output_path, "wb") as f:
                for chunk in r.iter_content(chunk_size=1024 * 1024):  # 1MB chunks
                    f.write(chunk)

            return output_path

    except requests.exceptions.ConnectionError as e:
        raise RuntimeError(
            f"Cannot reach laptop server at {BASE_URL}. "
            f"Make sure:\n"
            f"  1. python ytdlp-server.py is running on your laptop\n"
            f"  2. ngrok http 8765 is running on your laptop\n"
            f"  3. Update RESIDENTIAL_DOWNLOAD_URL in backend/utils/config.py with the ngrok URL"
        )
    except requests.exceptions.Timeout:
        raise RuntimeError(
            f"Download timed out ({RESIDENTIAL_DOWNLOAD_TIMEOUT}s). "
            f"Video may be too large or connection is slow."
        )
