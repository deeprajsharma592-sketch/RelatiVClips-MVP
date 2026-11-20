"""
Twitch VOD clips density signal provider.
Queries Twitch Helix API for clips created from a VOD, using vod_offset, duration, and view_count.
Fails silently if API keys are missing or video is not from Twitch.
"""
import os
import re
import json
import urllib.request
from typing import Optional, List, Tuple
from .base import TimeSeries, get_cached_signal, set_cached_signal, run_with_silent_fail, log
from ..utils.config import ENABLE_TWITCH_SIGNALS

TWITCH_CLIENT_ID = os.getenv("TWITCH_CLIENT_ID", "")
TWITCH_CLIENT_SECRET = os.getenv("TWITCH_CLIENT_SECRET", "")
TWITCH_AUTH_TOKEN = os.getenv("TWITCH_AUTH_TOKEN", "")


def extract_twitch_vod_id(url: str) -> Optional[str]:
    """Extract Twitch VOD ID from twitch.tv/videos/123456789 or similar."""
    if not url:
        return None
    m = re.search(r"twitch\.tv\/videos\/(\d+)", url)
    if m:
        return m.group(1)
    if url.isdigit():
        return url
    return None


def _get_app_access_token() -> Optional[str]:
    """Get Twitch App OAuth token using client_id and client_secret if token not explicitly set."""
    if TWITCH_AUTH_TOKEN:
        return TWITCH_AUTH_TOKEN
    if not (TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET):
        return None
    try:
        url = "https://id.twitch.tv/oauth2/token"
        params = urllib.parse.urlencode({
            "client_id": TWITCH_CLIENT_ID,
            "client_secret": TWITCH_CLIENT_SECRET,
            "grant_type": "client_credentials",
        }).encode("utf-8")
        req = urllib.request.Request(url, data=params, method="POST")
        with urllib.request.urlopen(req, timeout=5.0) as resp:
            data = json.loads(resp.read().decode())
            return data.get("access_token")
    except Exception as e:
        log.debug(f"[twitch_clips] Failed to fetch Twitch OAuth token: {e}")
        return None


def _fetch_twitch_clips_raw(vod_id: str) -> Optional[TimeSeries]:
    """Fetch clips for the VOD and build density time intervals."""
    if not TWITCH_CLIENT_ID:
        return None
    token = _get_app_access_token()
    if not token:
        return None

    url = f"https://api.twitch.tv/helix/clips?video_id={vod_id}&first=100"
    req = urllib.request.Request(
        url,
        headers={
            "Client-ID": TWITCH_CLIENT_ID,
            "Authorization": f"Bearer {token}",
        },
    )
    with urllib.request.urlopen(req, timeout=6.0) as resp:
        data = json.loads(resp.read().decode("utf-8"))

    clips = data.get("data", [])
    if not clips:
        return None

    series: TimeSeries = []
    for c in clips:
        offset = c.get("vod_offset")
        dur = float(c.get("duration", 30.0))
        views = float(c.get("view_count", 1))
        if offset is not None:
            t_start = float(offset)
            t_end = t_start + dur
            # Weight by log(views + 1) or views directly
            weight = max(1.0, views)
            series.append((t_start, t_end, weight))

    if not series:
        return None

    # Normalize so peak is 1.0
    max_val = max(v for _, _, v in series)
    if max_val > 0:
        series = [(s, e, round(v / max_val, 4)) for s, e, v in series]

    return sorted(series, key=lambda x: x[0])


def fetch_twitch_clips_signal(url_or_id: str) -> Optional[TimeSeries]:
    """
    Public entry point for Twitch clips density signal.
    Returns [(t_start, t_end, density)] or None.
    """
    if not ENABLE_TWITCH_SIGNALS:
        return None
    vod_id = extract_twitch_vod_id(url_or_id)
    if not vod_id:
        return None

    cache_key = f"twitch_clips_{vod_id}"
    cached = get_cached_signal(cache_key, max_age_seconds=86400)
    if cached is not None:
        return cached

    result = run_with_silent_fail(
        _fetch_twitch_clips_raw,
        provider_name="twitch_clips",
        vod_id=vod_id,
        timeout_s=8.0,
    )
    if result:
        set_cached_signal(cache_key, result)
    return result
