"""
YouTube 'Most Replayed' heatmap provider.
Fetches normalized heatmap (~100 buckets, peak = 1.0) from watch page ytInitialData.
Unofficial, wrapped in safe runner, cached per video_id for 24h.
Feature flag: ENABLE_YT_REPLAY.
"""
import re
import json
import urllib.request
import urllib.parse
from typing import Optional, List, Tuple
from .base import TimeSeries, get_cached_signal, set_cached_signal, run_with_silent_fail, log
from ..utils.config import ENABLE_YT_REPLAY


def extract_youtube_video_id(url_or_id: str) -> Optional[str]:
    """Extract standard 11-char YouTube video ID from various URL formats."""
    if not url_or_id:
        return None
    url_or_id = url_or_id.strip()
    if len(url_or_id) == 11 and re.match(r"^[A-Za-z0-9_-]{11}$", url_or_id):
        return url_or_id
    patterns = [
        r"(?:v=|\/v\/|youtu\.be\/|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})",
        r"[?&]v=([A-Za-z0-9_-]{11})",
    ]
    for p in patterns:
        m = re.search(p, url_or_id)
        if m:
            return m.group(1)
    return None


def _fetch_yt_replay_raw(video_id: str) -> Optional[TimeSeries]:
    """Inner network fetch & parser for YouTube watch page data."""
    url = f"https://www.youtube.com/watch?v={video_id}"
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    with urllib.request.urlopen(req, timeout=6.0) as resp:
        html = resp.read().decode("utf-8", errors="ignore")

    # Locate ytInitialData in HTML
    match = re.search(r"var ytInitialData\s*=\s*({.+?});</script>", html)
    if not match:
        match = re.search(r"window\[\"ytInitialData\"\]\s*=\s*({.+?});", html)
    if not match:
        log.debug(f"[yt_replay] ytInitialData not found in HTML for {video_id}")
        return None

    try:
        data = json.loads(match.group(1))
    except Exception as e:
        log.debug(f"[yt_replay] Failed to parse ytInitialData JSON: {e}")
        return None

    # Search for heatmap markers in ytInitialData
    # Format A: frameworkUpdates -> entityBatchUpdate -> mutations
    raw_markers = []
    mutations = data.get("frameworkUpdates", {}).get("entityBatchUpdate", {}).get("mutations", [])
    for m in mutations:
        payload = m.get("payload", {})
        macro = payload.get("macroMarkersListEntityPayload", {})
        markers = macro.get("markersList", {}).get("markers", [])
        if markers:
            for item in markers:
                marker_data = item.get("heatMarkerIntensityScoreNormalized")
                if marker_data is not None:
                    raw_markers.append(item)

    # Format B: multiMarkersPlayerBarRenderer
    if not raw_markers:
        def _walk_dict(obj):
            if isinstance(obj, dict):
                if "heatMarkerRenderer" in obj:
                    raw_markers.append(obj["heatMarkerRenderer"])
                elif "heatMarkers" in obj:
                    raw_markers.extend(obj.get("heatMarkers") or [])
                else:
                    for v in obj.values():
                        _walk_dict(v)
            elif isinstance(obj, list):
                for v in obj:
                    _walk_dict(v)

        _walk_dict(data)

    if not raw_markers:
        log.debug(f"[yt_replay] No heatMarkers found for {video_id}")
        return None

    # Parse marker timestamps and intensities
    time_series: TimeSeries = []
    current_time_s = 0.0

    for m in raw_markers:
        # Duration can be in markerDurationMillis or durationMillis
        dur_ms = m.get("markerDurationMillis") or m.get("durationMillis") or 5000
        dur_s = float(dur_ms) / 1000.0
        score = float(m.get("heatMarkerIntensityScoreNormalized", 0.0))

        # Some formats give startMillis explicitly
        start_ms = m.get("startMillis")
        if start_ms is not None:
            t_start = float(start_ms) / 1000.0
            t_end = t_start + dur_s
            current_time_s = t_end
        else:
            t_start = current_time_s
            t_end = t_start + dur_s
            current_time_s = t_end

        time_series.append((t_start, t_end, score))

    if not time_series:
        return None

    # Normalize so peak is 1.0
    max_val = max(val for _, _, val in time_series)
    if max_val > 0:
        time_series = [(s, e, round(val / max_val, 4)) for s, e, val in time_series]

    return time_series


def fetch_youtube_replay_signal(url_or_id: str) -> Optional[TimeSeries]:
    """
    Public entry point. Fetches YouTube Replay heatmap with 24h caching & silent fail.
    Returns [(t_start, t_end, normalized_heat)] or None.
    """
    if not ENABLE_YT_REPLAY:
        log.debug("[yt_replay] Feature flag ENABLE_YT_REPLAY is false, skipping.")
        return None

    video_id = extract_youtube_video_id(url_or_id)
    if not video_id:
        return None

    cache_key = f"yt_replay_{video_id}"
    cached = get_cached_signal(cache_key, max_age_seconds=86400)
    if cached is not None:
        log.debug(f"[yt_replay] Cache hit for {video_id}")
        return cached

    result = run_with_silent_fail(
        _fetch_yt_replay_raw,
        provider_name="youtube_replay",
        video_id=video_id,
        timeout_s=8.0,
    )
    if result:
        set_cached_signal(cache_key, result)
    return result
