"""
Base interfaces, time series types, and safe execution wrappers for signals.
All providers return List[Tuple[float, float, float]] (t_start, t_end, value) or None.
Every provider is optional and fails silently (timeout 8s, 1 retry, log, return None).
"""
import time
import logging
import json
from pathlib import Path
from typing import List, Tuple, Optional, Callable, Any
from ..utils.config import CACHE_DIR

log = logging.getLogger("relativ.signals")

# TimeSeries format: List of (t_start, t_end, value)
TimeSeries = List[Tuple[float, float, float]]

SIGNALS_CACHE_DIR = CACHE_DIR / "signals"
SIGNALS_CACHE_DIR.mkdir(parents=True, exist_ok=True)


def get_cached_signal(cache_key: str, max_age_seconds: float = 86400) -> Optional[TimeSeries]:
    """Retrieve cached time series from disk if still fresh (default 24h)."""
    try:
        path = SIGNALS_CACHE_DIR / f"{cache_key}.json"
        if not path.exists():
            return None
        data = json.loads(path.read_text(encoding="utf-8"))
        cached_at = data.get("cached_at", 0)
        if time.time() - cached_at > max_age_seconds:
            return None
        series = [tuple(item) for item in data.get("series", [])]
        return series  # type: ignore
    except Exception as e:
        log.debug(f"Cache read error for {cache_key}: {e}")
        return None


def set_cached_signal(cache_key: str, series: TimeSeries) -> None:
    """Store time series to disk cache."""
    try:
        path = SIGNALS_CACHE_DIR / f"{cache_key}.json"
        payload = {
            "cached_at": time.time(),
            "series": [list(item) for item in series],
        }
        path.write_text(json.dumps(payload), encoding="utf-8")
    except Exception as e:
        log.debug(f"Cache write error for {cache_key}: {e}")


def run_with_silent_fail(
    func: Callable[..., Optional[TimeSeries]],
    provider_name: str,
    *args,
    timeout_s: float = 8.0,
    **kwargs,
) -> Optional[TimeSeries]:
    """
    Executes a signal fetcher with timeout 8s and 1 retry.
    Catches all exceptions, logs a structured warning, and returns None on failure.
    Pipeline MUST work with zero external signals.
    """
    import concurrent.futures

    for attempt in range(1, 3):
        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(func, *args, **kwargs)
                result = future.result(timeout=timeout_s)
                if result is not None and len(result) > 0:
                    log.info(f"[{provider_name}] Successfully fetched {len(result)} data points (attempt {attempt})")
                    return result
                return None
        except concurrent.futures.TimeoutError:
            log.warning(f"[{provider_name}] Timeout after {timeout_s}s (attempt {attempt}/2)")
        except Exception as e:
            log.warning(f"[{provider_name}] Failed on attempt {attempt}/2: {e}")

    log.info(f"[{provider_name}] Provider returned None (silent fail)")
    return None
