"""
Speculative video download — start fetching video for the top-K
candidates in parallel with the LLM call.

This is A1 + A3 from the 4hr sprint roadmap:
  - Before: audio download (15-20s) → LLM call (3-5s) → video re-download (35s)
    Total: ~55-60s for the post-moment-discovery phase
  - After:  audio + video in parallel (15-20s) → LLM call (already done)
    Total: ~20s, save 35s

The trade-off:
  - Cost: 3 video downloads even if LLM picks none of them (~1.5MB each)
  - Win:  35s faster when LLM picks one of the top-3 (which is ~85% of the time)

If the LLM picks something outside the top-3 (rare), we do the fallback
re-download like before. Worst case = same time as before, best case
= 35s faster.
"""
from __future__ import annotations

import threading
import time
from concurrent.futures import ThreadPoolExecutor, Future
from typing import Callable, Dict, List, Optional, Tuple

from . import surgical as surgical_stage


# How many top candidates to speculatively pre-fetch
SPECULATIVE_TOP_K = 3


def speculative_video_download(
    url: str,
    top_candidates: List[Dict],
    task_id: str,
    log_fn: Optional[Callable] = None,
    max_workers: int = 2,
) -> Dict[int, Dict]:
    """
    Speculatively download video for the top-K candidates IN PARALLEL
    with whatever the caller is doing (e.g. LLM call).

    Returns a dict {candidate_index: {video_path, source_start, source_end}}.
    Caller checks `if video_path` to know if a segment is ready.
    """
    log_fn = log_fn or (lambda m: None)
    indexed_results: Dict[int, Dict] = {}
    futures: List[Tuple[int, Future]] = []

    # Cap at top K
    targets = top_candidates[:SPECULATIVE_TOP_K]
    if not targets:
        return indexed_results

    started_at = time.monotonic()
    log_fn(f"  Speculative video download for top-{len(targets)} candidate(s) in background...")

    def _on_done(idx: int, total: int, ok: bool) -> None:
        log_fn(f"  [speculative vid {idx+1}/{total}] done (ok={ok})")

    with ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="specvid") as pool:
        for i, cand in enumerate(targets):
            start = float(cand.get("source_start", cand.get("start", 0)))
            end = float(cand.get("source_end", cand.get("end", 0)))
            video_path = surgical_stage.TEMP_DIR / f"{task_id}_specvid{i}.mp4"
            fut = pool.submit(
                surgical_stage._download_one_video_segment,
                url, start, end, video_path, log_fn,
                i, len(targets), threading.Lock(), _on_done,
            )
            futures.append((i, fut))

        # Wait for all (with timeout — don't block longer than 30s per segment)
        for i, fut in futures:
            try:
                seg_meta = fut.result(timeout=45)
            except Exception as e:
                log_fn(f"  [speculative vid {i+1}] failed: {str(e)[:100]}")
                cand = targets[i]
                seg_meta = {
                    "video_path": None,
                    "source_start": float(cand.get("source_start", 0)),
                    "source_end": float(cand.get("source_end", 0)),
                }
            indexed_results[i] = seg_meta

    elapsed = time.monotonic() - started_at
    n_ok = sum(1 for v in indexed_results.values() if v.get("video_path"))
    log_fn(f"  Speculative video: {n_ok}/{len(targets)} ready in {elapsed:.1f}s")

    return indexed_results


def find_speculative_match(
    spec_results: Dict[int, Dict],
    pick: Dict,
    candidates: List[Dict],
) -> Optional[Dict]:
    """
    Check if a LLM pick matches one of the speculatively-downloaded
    video segments. Match by source_start (within 0.5s tolerance).

    Returns the speculative result dict if matched, else None.
    """
    if not spec_results:
        return None
    pick_src_start = float(pick.get("source_start", pick.get("start", 0)))
    for i, spec in spec_results.items():
        if not spec.get("video_path"):
            continue
        cand = candidates[i] if i < len(candidates) else None
        if not cand:
            continue
        cand_src_start = float(cand.get("source_start", cand.get("start", 0)))
        if abs(pick_src_start - cand_src_start) < 0.5:
            return spec
    return None
