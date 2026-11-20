"""
Twitch Chat engagement signal provider.
Extracts message rate (messages/sec), emote-burst ratio, and caps/spam ratio from chat logs.
Shifts the entire series back 6.0 seconds to compensate for broadcast/chat lag.
"""
from typing import Optional, List, Dict, Any, Union
from pathlib import Path
import json
import re
from .base import TimeSeries, run_with_silent_fail, log


def _parse_chat_messages(chat_data: Union[str, List[Dict[str, Any]], Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Parse chat data from file path, json string, or pre-parsed list/dict."""
    if isinstance(chat_data, (str, Path)) and Path(str(chat_data)).exists():
        raw = Path(str(chat_data)).read_text(encoding="utf-8", errors="ignore")
        data = json.loads(raw)
    elif isinstance(chat_data, str):
        data = json.loads(chat_data)
    else:
        data = chat_data

    # Common Twitch chat download formats (e.g. TwitchDownloader CLI, Rechat)
    if isinstance(data, dict):
        if "comments" in data:
            messages = []
            for c in data["comments"]:
                offset = c.get("content_offset_seconds")
                body = c.get("message", {}).get("body", "")
                fragments = c.get("message", {}).get("fragments", [])
                has_emotes = any(f.get("emoticon") for f in fragments)
                if offset is not None:
                    messages.append({
                        "offset": float(offset),
                        "body": body,
                        "has_emotes": has_emotes,
                    })
            return messages
        elif "messages" in data:
            return data["messages"]
    elif isinstance(data, list):
        return data

    return []


def _extract_chat_signal_raw(chat_source: Any, bucket_s: float = 5.0) -> Optional[TimeSeries]:
    """Inner calculation of chat density metrics with -6s latency shift."""
    messages = _parse_chat_messages(chat_source)
    if not messages:
        return None

    # Group into time buckets
    buckets: Dict[int, List[Dict[str, Any]]] = {}
    max_offset = 0.0

    for m in messages:
        offset = float(m.get("offset") or m.get("time") or m.get("timestamp", 0.0))
        # Apply 6-second broadcast lag compensation
        adj_offset = max(0.0, offset - 6.0)
        max_offset = max(max_offset, adj_offset)
        bucket_idx = int(adj_offset // bucket_s)
        buckets.setdefault(bucket_idx, []).append(m)

    if not buckets:
        return None

    series: TimeSeries = []
    total_buckets = int(max_offset // bucket_s) + 1

    for b_idx in range(total_buckets):
        t_start = b_idx * bucket_s
        t_end = t_start + bucket_s
        msg_list = buckets.get(b_idx, [])
        if not msg_list:
            series.append((t_start, t_end, 0.0))
            continue

        msg_count = len(msg_list)
        # Emote ratio
        emote_count = sum(1 for m in msg_list if m.get("has_emotes") or "LUL" in m.get("body", "") or "KEKW" in m.get("body", "") or "OMEGALUL" in m.get("body", "") or "POG" in m.get("body", "").upper())
        emote_ratio = emote_count / max(1, msg_count)

        # Caps / hype ratio
        caps_letters = sum(sum(1 for char in m.get("body", "") if char.isupper()) for m in msg_list)
        total_letters = sum(sum(1 for char in m.get("body", "") if char.isalpha()) for m in msg_list)
        caps_ratio = (caps_letters / max(1, total_letters)) if total_letters > 0 else 0.0

        # Composite score: message velocity + emote excitement + caps hype
        score = (msg_count / bucket_s) * (1.0 + emote_ratio * 0.5 + caps_ratio * 0.5)
        series.append((t_start, t_end, score))

    # Normalize so peak is 1.0
    max_val = max(v for _, _, v in series)
    if max_val > 0:
        series = [(s, e, round(v / max_val, 4)) for s, e, v in series]

    return series


def fetch_twitch_chat_signal(chat_source: Any) -> Optional[TimeSeries]:
    """
    Public entry point for Twitch chat engagement signal.
    Returns [(t_start, t_end, normalized_heat)] with 6s lag offset or None.
    """
    if not chat_source:
        return None

    return run_with_silent_fail(
        _extract_chat_signal_raw,
        provider_name="twitch_chat",
        chat_source=chat_source,
        timeout_s=8.0,
    )
