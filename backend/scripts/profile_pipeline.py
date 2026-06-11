"""
Latency profiler — read-only timing of each pipeline stage.

Run:  cd /app/RelatiV/backend && .venv/bin/python scripts/profile_pipeline.py

Outputs a table of stage → median / p95 / wall-clock time across N
synthetic runs. Doesn't touch production code. Use the data to
prioritize the latency pass (queue item #6 in the CTO iteration list).

This profile uses SYNTHETIC data — real videos will differ. For real
data, run a YouTube URL through /process/youtube and watch the
time_elapsed_seconds in the StatusResponse (the orchestrator already
records this).
"""

from __future__ import annotations

import asyncio
import statistics
import sys
import time
from pathlib import Path

# Run from the repo root so 'backend' is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))


def time_callable(fn, *args, n_runs: int = 5, **kwargs):
    """Run `fn(*args, **kwargs)` n_runs times, return list of durations in seconds."""
    durations = []
    for _ in range(n_runs):
        t0 = time.perf_counter()
        try:
            fn(*args, **kwargs)
        except Exception as e:
            print(f"  ⚠ call failed: {e}")
            return None
        durations.append(time.perf_counter() - t0)
    return durations


def fmt_stats(durations):
    if not durations:
        return "FAILED"
    return (
        f"median={statistics.median(durations)*1000:.1f}ms "
        f"p95={sorted(durations)[int(len(durations)*0.95)]*1000:.1f}ms "
        f"min={min(durations)*1000:.1f}ms max={max(durations)*1000:.1f}ms"
    )


def main():
    print("=" * 70)
    print("RelatiV pipeline latency profile (synthetic data, n=5 per stage)")
    print("=" * 70)
    print()

    # Stage 1: URL analyze (no network, just regex parsing)
    print("[1] url_analyzer.analyze_url (synthetic YouTube URL)")
    from backend.pipeline.url_analyzer import analyze_url
    durations = time_callable(analyze_url, "https://youtube.com/watch?v=dQw4w9WgXcQ")
    print(f"    {fmt_stats(durations) if durations else 'FAILED'}")
    print()

    # Stage 2: Audio energy (needs a real audio file — skip with a clear message)
    print("[2] audio_analysis.analyze_audio_peaks")
    print("    requires a real audio file (WAV). Profile against outputs/ or a sample.")
    print()

    # Stage 6: LLM taste selector
    print("[6] taste selector (Claude Haiku)")
    try:
        from backend.taste.providers import select_provider
        provider = select_provider()
        print(f"    using provider: {provider.name}")

        sample = "The biggest mistake I see founders make is focusing on features instead of retention."
        durations = time_callable(provider.generate, sample)
        print(f"    {fmt_stats(durations) if durations else 'FAILED'}")
    except Exception as e:
        print(f"    skipped: {e}")
    print()

    # Stage 8: Renderer (needs a real video + segment — skipped, can't easily fake)
    print("[8] renderer")
    print("    requires a real video file + segment. Profile via /process/youtube StatusResponse.")
    print()

    print("=" * 70)
    print("To profile a real run: POST to /process/youtube, watch time_elapsed_seconds")
    print("in the StatusResponse. Stages are tagged in the pipeline logs.")
    print("=" * 70)


if __name__ == "__main__":
    main()
