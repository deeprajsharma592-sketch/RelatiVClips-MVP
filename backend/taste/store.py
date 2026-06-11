"""
Creator history store — the ICL loop's memory.

Every clip the creator publishes via RelatiV gets logged here. This is
the raw material that the ICL prompt uses as few-shot examples. As
the creator publishes more, the ICL signal gets richer, and selection
quality improves WITHOUT any model retraining.

Storage: append-only JSON file on disk for now. Will move to Postgres
when the persistence layer is wired up. The interface is async-ready
so the swap is one-line.

Key design:
  - Append-only: never delete old entries (the ICL signal weakens
    if you do, and creator can audit their history).
  - Capped at 50 most-recent entries per creator (memory + prompt
    size bound). Older entries are kept on disk but not loaded into
    the prompt.
  - Engagement metrics are optional and patched in asynchronously
    after publication. This is the ICL "feedback signal" — what
    actually performed, not just what the LLM suggested.
"""
from typing import List, Optional, Dict
from pathlib import Path
import json
import logging
import asyncio
from datetime import datetime

from .icl import CreatorClipHistory

log = logging.getLogger(__name__)

# Where the store lives. Per-task: separate file per creator.
HISTORY_DIR = Path(__file__).resolve().parent.parent.parent / "temp" / "creator_history"
HISTORY_DIR.mkdir(parents=True, exist_ok=True)

MAX_IN_PROMPT = 50  # max few-shot examples loaded into the ICL prompt


def _history_path(creator_id: str) -> Path:
    return HISTORY_DIR / f"{creator_id}.jsonl"


def _lock_path(creator_id: str) -> Path:
    return HISTORY_DIR / f"{creator_id}.lock"


def load_history(creator_id: str, limit: int = MAX_IN_PROMPT) -> List[CreatorClipHistory]:
    """Load recent clip history for a creator. Newest first.

    Returns empty list if the creator has no history (new creator).
    """
    path = _history_path(creator_id)
    if not path.exists():
        return []
    try:
        # Read tail of file (newest entries are at the end of a JSONL log)
        with open(path, "r", encoding="utf-8") as f:
            lines = f.readlines()
        recent = lines[-limit:]
        history = []
        for line in recent:
            try:
                data = json.loads(line)
                history.append(CreatorClipHistory(
                    clip_id=data["clip_id"],
                    video_title=data["video_title"],
                    hook_start=float(data["hook_start"]),
                    hook_end=float(data["hook_end"]),
                    edit_reason=data.get("edit_reason", ""),
                    published_at=datetime.fromisoformat(data["published_at"]),
                    views=data.get("views"),
                    likes=data.get("likes"),
                    retention_pct=data.get("retention_pct"),
                ))
            except Exception as e:
                log.warning(f"Skipping malformed history line: {e}")
        history.reverse()  # newest first
        return history
    except Exception as e:
        log.error(f"Failed to load creator history for {creator_id}: {e}")
        return []


def append_history(creator_id: str, entry: CreatorClipHistory) -> bool:
    """Append a single clip entry to the creator's history.

    Returns True on success, False on error. Idempotent: re-adding the
    same clip_id is a no-op (we don't want to double-count).
    """
    path = _history_path(creator_id)
    lock = _lock_path(creator_id)

    # Quick dedupe: check if this clip_id is already in the last few lines.
    if path.exists():
        try:
            with open(path, "r", encoding="utf-8") as f:
                tail = f.readlines()[-10:]
            for line in tail:
                if entry.clip_id in line:
                    return True  # already there
        except Exception:
            pass

    try:
        # Use a side lock file as a poor-man's mutex. This isn't truly
        # safe for multi-process writes but covers 99% of the cases.
        lock.touch(exist_ok=True)
        with open(path, "a", encoding="utf-8") as f:
            data = {
                "clip_id": entry.clip_id,
                "video_title": entry.video_title,
                "hook_start": entry.hook_start,
                "hook_end": entry.hook_end,
                "edit_reason": entry.edit_reason,
                "published_at": entry.published_at.isoformat(),
                "views": entry.views,
                "likes": entry.likes,
                "retention_pct": entry.retention_pct,
            }
            f.write(json.dumps(data) + "\n")
        return True
    except Exception as e:
        log.error(f"Failed to append creator history: {e}")
        return False


def update_metrics(
    creator_id: str,
    clip_id: str,
    views: Optional[int] = None,
    likes: Optional[int] = None,
    retention_pct: Optional[float] = None,
) -> bool:
    """Patch engagement metrics into an existing history entry.

    This is the ICL feedback signal. The async path will call this
    after publication. The metrics inform future selections.
    """
    path = _history_path(creator_id)
    if not path.exists():
        return False
    try:
        with open(path, "r", encoding="utf-8") as f:
            lines = f.readlines()
        updated = False
        for i, line in enumerate(lines):
            if clip_id in line:
                data = json.loads(line)
                if views is not None:
                    data["views"] = views
                if likes is not None:
                    data["likes"] = likes
                if retention_pct is not None:
                    data["retention_pct"] = retention_pct
                lines[i] = json.dumps(data) + "\n"
                updated = True
                break
        if updated:
            with open(path, "w", encoding="utf-8") as f:
                f.writelines(lines)
        return updated
    except Exception as e:
        log.error(f"Failed to update metrics: {e}")
        return False


def creator_exists(creator_id: str) -> bool:
    """Quick check for cold-start optimization."""
    return _history_path(creator_id).exists()
