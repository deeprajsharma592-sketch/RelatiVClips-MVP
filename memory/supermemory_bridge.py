#!/usr/bin/env python3
"""
Supermemory bridge for Hermes / RelatiV agent.

Complements the existing `memory` (always-on notes) and `fact_store`
(52 facts with trust scoring) tools. Supermemory adds:

- Cross-session graph memory (people, projects, decisions evolve over time)
- Sub-300ms semantic recall
- Auto-extracted entities, relations, temporal facts
- Sub-300ms latency at 1.5B memories scale (10x faster than Zep, 25x faster than Mem0)

Free tier: $5/month usage credit. Sign up at https://supermemory.ai → Settings → API keys.

Usage:
    from supermemory_bridge import recall, remember, status

    context = recall("what does Deepraj want for RelatiV homepage?")
    remember("Deepraj bought relativclips.com on Vercel for $11.25", tags=["relativ", "domain"])

The bridge is a no-op if SUPERMEMORY_API_KEY is not set — safe to import.
"""

from __future__ import annotations

import os
import sys
import json
from pathlib import Path
from typing import Any

CONTAINER_TAG = "relativ-agent"
ENV_KEY = "SUPERMEMORY_API_KEY"
ENV_FILE = Path("/app/RelatiV/.env")

_client: Any = None
_enabled: bool = False


def _load_key() -> str | None:
    """Read API key from env or .env file."""
    key = os.environ.get(ENV_KEY)
    if key:
        return key
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text().splitlines():
            if line.startswith(f"{ENV_KEY}="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None


def _get_client() -> Any:
    """Lazy-init the supermemory client. Returns None if not configured."""
    global _client, _enabled
    if _client is not None or not _enabled:
        return _client
    key = _load_key()
    if not key:
        _enabled = False
        return None
    try:
        from supermemory import Supermemory
        _client = Supermemory(api_key=key)
        _enabled = True
        return _client
    except Exception as e:
        print(f"[supermemory] init failed: {e}", file=sys.stderr)
        _enabled = False
        return None


def status() -> dict:
    """Check whether the bridge is wired up and how to enable it."""
    key = _load_key()
    return {
        "enabled": _enabled and _client is not None,
        "key_present": bool(key),
        "container": CONTAINER_TAG,
        "key_env_var": ENV_KEY,
        "signup_url": "https://supermemory.ai",
        "free_tier": "$5/month usage credit (sign up → Settings → API keys)",
        "tier": "free" if key else "not configured",
    }


def remember(content: str, tags: list[str] | None = None, container: str = CONTAINER_TAG) -> dict:
    """Add a memory. Returns {"ok": bool, "id": str|None, "error": str|None}."""
    c = _get_client()
    if c is None:
        return {"ok": False, "id": None, "error": "Supermemory not configured. Set SUPERMEMORY_API_KEY in /app/RelatiV/.env"}
    try:
        result = c.memories.add(
            content=content,
            container_tag=container,
            metadata={"tags": tags or [], "source": "hermes-agent"},
        )
        return {"ok": True, "id": getattr(result, "id", None), "error": None}
    except Exception as e:
        return {"ok": False, "id": None, "error": str(e)}


def recall(query: str, container: str = CONTAINER_TAG, limit: int = 5) -> list[dict]:
    """Search memories. Returns list of {content, score, metadata}."""
    c = _get_client()
    if c is None:
        return []
    try:
        result = c.memories.search(
            q=query,
            container_tag=container,
            limit=limit,
        )
        out = []
        for m in getattr(result, "results", []) or []:
            out.append({
                "content": getattr(m, "content", ""),
                "score": getattr(m, "score", None),
                "metadata": getattr(m, "metadata", {}) or {},
            })
        return out
    except Exception as e:
        print(f"[supermemory] recall failed: {e}", file=sys.stderr)
        return []


def profile(container: str = CONTAINER_TAG) -> dict:
    """Get the synthesized user profile for the container."""
    c = _get_client()
    if c is None:
        return {}
    try:
        result = c.profile.get(container_tag=container)
        return {
            "static": getattr(result, "static", []),
            "dynamic": getattr(result, "dynamic", []),
        }
    except Exception as e:
        return {"error": str(e)}


# ─── CLI helper ────────────────────────────────────────────────────────────

def _cli():
    import argparse
    p = argparse.ArgumentParser(description="Supermemory bridge for Hermes/RelatiV")
    sub = p.add_subparsers(dest="cmd")

    p_status = sub.add_parser("status", help="Check if bridge is configured")
    p_status.set_defaults(func=lambda _: print(json.dumps(status(), indent=2)))

    p_remember = sub.add_parser("remember", help="Add a memory")
    p_remember.add_argument("content", help="Memory content (text)")
    p_remember.add_argument("--tag", action="append", default=[], help="Tag (repeatable)")
    p_remember.set_defaults(func=lambda a: print(json.dumps(remember(a.content, a.tag), indent=2)))

    p_recall = sub.add_parser("recall", help="Search memories")
    p_recall.add_argument("query", help="Search query")
    p_recall.add_argument("--limit", type=int, default=5)
    p_recall.set_defaults(func=lambda a: print(json.dumps(recall(a.query, limit=a.limit), indent=2)))

    p_profile = sub.add_parser("profile", help="Get synthesized profile")
    p_profile.set_defaults(func=lambda _: print(json.dumps(profile(), indent=2)))

    args = p.parse_args()
    if not args.cmd:
        p.print_help()
        sys.exit(1)
    args.func(args)


if __name__ == "__main__":
    _cli()
