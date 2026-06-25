"""
RelatiV RAG Store — ChromaDB-backed vector retrieval.

Multi-tenant by design: one ChromaDB collection per creator.
Each creator's taste data is a separate namespace — no cross-contamination.

Schema:
  creator_id   → collection name  ("taste_<uuid>")
  chunk_type   → metadata field   ("hit" | "miss" | "taste" | "hook")
  archetype    → metadata field   ("trap_rap" | "tech_reviewer" | ...)
  performance  → metadata JSON   ({retention, ctr, views_7d, ...})

Embedding: sentence-transformers/all-MiniLM-L6-v2 (384-dim, CPU, free)
Storage:   /app/chroma_data (persistent, survives container restarts)
"""

from __future__ import annotations

__version__ = "1.0.0"

import json
import logging
import os
import re
import time
import uuid
from datetime import datetime
from typing import Any, Optional

import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer

log = logging.getLogger("rag_store")

# ─── Paths ────────────────────────────────────────────────────────────────────

CHROMA_DIR = os.environ.get("CHROMA_PERSIST_DIR", "/app/chroma_data")
os.makedirs(CHROMA_DIR, exist_ok=True)

# ─── Singleton model (loaded once, reused) ───────────────────────────────────

_EMBEDDING_MODEL: Optional[SentenceTransformer] = None

def _get_embedding_model() -> SentenceTransformer:
    global _EMBEDDING_MODEL
    if _EMBEDDING_MODEL is None:
        _EMBEDDING_MODEL = SentenceTransformer("all-MiniLM-L6-v2")
        log.info("Embedding model loaded: all-MiniLM-L6-v2 (384-dim)")
    return _EMBEDDING_MODEL

# ─── ChromaDB client (persistent, survives restarts) ─────────────────────────

_CLIENT: Optional[chromadb.PersistentClient] = None

def _get_chroma_client() -> chromadb.PersistentClient:
    global _CLIENT
    if _CLIENT is None:
        _CLIENT = chromadb.PersistentClient(
            path=CHROMA_DIR,
            settings=Settings(
                anonymized_telemetry=False,
                allow_reset=True,
            ),
        )
        log.info(f"ChromaDB client initialised at {CHROMA_DIR}")
    return _CLIENT

# ─── Helpers ─────────────────────────────────────────────────────────────────

def _col_name(creator_id: str) -> str:
    """One ChromaDB collection per creator — hard namespace isolation."""
    safe = re.sub(r"[^a-z0-9]", "_", creator_id.lower())
    return f"taste_{safe[:48]}"

def _now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"

def _safe_json(raw: Any) -> str:
    try:
        return json.dumps(raw)
    except Exception:
        return "{}"

# ─── Init ───────────────────────────────────────────────────────────────────

def init_rag_store() -> None:
    """
    Call once on app startup.
    Validates ChromaDB connectivity and that the embedding model loads.
    """
    client = _get_chroma_client()
    model = _get_embedding_model()
    _ = model.get_embedding_dimension()
    log.info("RAG store initialised — ChromaDB + all-MiniLM-L6-v2 ready")

# ─── Store operations ────────────────────────────────────────────────────────

def upsert_chunk(
    creator_id: str,
    chunk_type: str,       # "hit" | "miss" | "taste" | "hook"
    archetype: str,
    content: str,
    meta: Optional[dict] = None,
    clip_id: Optional[str] = None,
    chunk_id: Optional[str] = None,
) -> str:
    """
    Upsert a taste chunk into the creator's ChromaDB collection.
    If chunk_id is provided, replaces the existing entry.
    Otherwise generates a new ID (idempotent by content hash if needed).
    """
    client = _get_chroma_client()
    col = client.get_or_create_collection(
        name=_col_name(creator_id),
        metadata={"creator_id": creator_id, "archetype": archetype},
    )

    if chunk_id is None:
        chunk_id = str(uuid.uuid4())

    col.upsert(
        ids=[chunk_id],
        documents=[content],
        metadatas=[{
            "creator_id":  creator_id,
            "chunk_type":  chunk_type,
            "archetype":   archetype,
            "meta":        _safe_json(meta or {}),
            "clip_id":     clip_id or "",
            "created_at":  _now_iso(),
        }],
        embeddings=[_get_embedding_model().encode(content).tolist()],
    )
    log.debug(f"Upserted {chunk_type} chunk for creator {creator_id[:8]}…")
    return chunk_id


def delete_chunks_by_clip(creator_id: str, clip_id: str) -> int:
    """Remove all chunks linked to a specific clip (e.g. after a miss verdict)."""
    client = _get_chroma_client()
    col = client.get_or_create_collection(name=_col_name(creator_id))
    try:
        res = col.get(where={"clip_id": clip_id})
        if res and res.get("ids"):
            col.delete(ids=res["ids"])
            return len(res["ids"])
    except Exception as e:
        log.warning(f"delete_chunks_by_clip failed: {e}")
    return 0


def retrieve(
    creator_id: str,
    query: str,
    top_k: int = 5,
    chunk_types: Optional[list[str]] = None,
    archetype_filter: Optional[str] = None,
) -> list[dict]:
    """
    ChromaDB vector retrieval.  Multi-tenant: only searches creator's collection.

    ChromaDB 1.x `where` limitation: one key→condition pair per query.
    When chunk_types has 1+ values, we run one query per type and merge.
    """
    client = _get_chroma_client()
    col = client.get_or_create_collection(name=_col_name(creator_id))

    all_results: list[dict] = []

    # One query per chunk_type (single-key where clause is all ChromaDB 1.x supports)
    # Archetype is filtered in Python after fetching results.
    types_to_query = chunk_types if chunk_types else ["taste"]
    for ct in types_to_query:

        try:
            results = col.query(
                query_texts=[query],
                n_results=top_k,
                where={"chunk_type": ct},   # single-key where — ChromaDB 1.x constraint
                include=["documents", "metadatas", "distances"],
            )
        except Exception as e:
            log.warning(f"ChromaDB query failed (ct={ct}): {e}")
            continue

        docs  = results.get("documents", [[]])[0] or []
        metas = results.get("metadatas", [[]])[0] or []
        dists = results.get("distances", [[]])[0] or []
        ids   = (results.get("ids", [[]])[0] or []) if "ids" in results else []

        for i, (doc, meta, dist) in enumerate(zip(docs, metas, dists)):
            if not doc:
                continue
            # Archetype filter (ChromaDB 1.x limitation: done in Python post-query)
            if archetype_filter and meta.get("archetype") != archetype_filter:
                continue
            try:
                parsed_meta = json.loads(meta.get("meta", "{}")) if meta.get("meta") else {}
            except Exception:
                parsed_meta = {}
            chunk_id = ids[i] if i < len(ids) else ""
            all_results.append({
                "chunk_id":    chunk_id,
                "chunk_type":  meta.get("chunk_type", ct),
                "archetype":   meta.get("archetype", ""),
                "content":     doc,
                "meta":        parsed_meta,
                "clip_id":     meta.get("clip_id", ""),
                "created_at":  meta.get("created_at", ""),
                "distance":    dist,
                "similarity":  max(0.0, 1.0 - (dist or 0.5)),
            })

    # De-duplicate by (chunk_type, content), sort by similarity desc
    # Different chunk_types from the same clip can coexist — use content hash
    seen: set = set()
    deduped: list[dict] = []
    for r in sorted(all_results, key=lambda x: x["similarity"], reverse=True):
        # Key by (chunk_type, content[:50]) to avoid cross-type dedup
        key = (r["chunk_type"], r["content"][:50])
        if key not in seen:
            seen.add(key)
            deduped.append(r)

    return deduped[:top_k]


# ─── High-level: RAG prompt builder ──────────────────────────────────────────

def build_rag_context(
    creator_id: str,
    transcript_window: str,
    archetype: str,
    top_k: int = 5,
) -> dict:
    """
    Build a structured RAG context block for the LLM.

    Returns:
        {
            "hits":   [...],    # top hit chunks
            "misses": [...],    # top miss chunks
            "taste":  {...} or None,   # taste profile chunk
            "hooks":  [...],    # hook pattern chunks
            "total_tokens_approx": int,
        }
    """
    hits   = retrieve(creator_id, transcript_window, top_k=3,
                      chunk_types=["hit"], archetype_filter=archetype)
    misses = retrieve(creator_id, transcript_window, top_k=3,
                      chunk_types=["miss"], archetype_filter=archetype)
    taste  = retrieve(creator_id, transcript_window, top_k=1,
                      chunk_types=["taste"], archetype_filter=archetype)
    hooks  = retrieve(creator_id, transcript_window, top_k=2,
                      chunk_types=["hook"], archetype_filter=archetype)

    # Approximate token count (words * 1.33)
    all_text = " ".join(
        ([] if not taste else [taste[0]["content"]]) +
        [h["content"] for h in hits] +
        [m["content"] for m in misses] +
        [h["content"] for h in hooks]
    )
    token_approx = int(len(all_text.split()) * 1.33)

    return {
        "hits":   hits,
        "misses": misses,
        "taste":  taste[0] if taste else None,
        "hooks":  hooks,
        "total_tokens_approx": token_approx,
    }


def build_rag_prompt(
    creator_id: str,
    transcript_window: str,
    archetype: str,
    top_k: int = 5,
) -> str:
    """
    Assemble retrieved chunks into an LLM-ready prompt block.
    Replaces flat taste profile stuffing — only retrieved content is sent.
    """
    ctx = build_rag_context(creator_id, transcript_window, archetype, top_k)

    if not ctx["hits"] and not ctx["taste"]:
        return transcript_window  # No RAG data — fallback to transcript only

    lines = []

    if ctx["taste"]:
        taste_content = ctx["taste"]["content"]
        lines.append(f"[TASTE PROFILE]\n{taste_content[:500]}\n")

    if ctx["hits"]:
        hits_block = "\n".join(
            f"  • {h['content'][:250]}"
            f" (ret={h['meta'].get('retention', '?')}, ctr={h['meta'].get('ctr', '?')})"
            for h in ctx["hits"][:3]
        )
        lines.append(f"[WHAT WORKS FOR THIS CREATOR — verified clips]\n{hits_block}\n")

    if ctx["misses"]:
        misses_block = "\n".join(
            f"  • {m['content'][:250]}"
            f" (ret={m['meta'].get('retention', '?')})"
            for m in ctx["misses"][:2]
        )
        lines.append(f"[WHAT DOESN'T WORK — avoid these patterns]\n{misses_block}\n")

    if ctx["hooks"]:
        hooks_block = "\n".join(f"  • {h['content'][:200]}" for h in ctx["hooks"][:2])
        lines.append(f"[HOOK PATTERNS — use these structures]\n{hooks_block}\n")

    lines.append(f"[TRANSCRIPT — pick the best moment]\n{transcript_window[:600]}")

    return "\n".join(lines)


# ─── Clip snapshot → automatic RAG update ───────────────────────────────────

def process_clip_snapshot(
    creator_id: str,
    clip_id: str,
    archetype: str,
    hook_type: str,
    retention_rate: float,
    ctr: float,
    views_7d: int,
    verdict: str,           # "hit" | "miss" | "neutral"
    transcript_excerpt: str,
) -> None:
    """
    Called by the webhooks/platform API when clip performance comes back.
    Automatically upserts the clip outcome into ChromaDB so the next
    RAG query picks it up immediately.
    """
    meta = {
        "retention":    round(retention_rate, 4),
        "ctr":          round(ctr, 4),
        "views_7d":     views_7d,
        "hook_type":    hook_type,
        "verdict":      verdict,
        "clip_id":      clip_id,
        "archetype":    archetype,
    }

    if verdict == "hit":
        content = (
            f"VERIFIED HIT — ret={retention_rate:.0%}, ctr={ctr:.1%}, {views_7d} views (7d). "
            f"Hook type: {hook_type}. Clip: {transcript_excerpt[:300]}"
        )
        upsert_chunk(
            creator_id=creator_id,
            chunk_type="hit",
            archetype=archetype,
            content=content,
            meta=meta,
            clip_id=clip_id,
        )
        log.info(f"[RAG] HIT chunk stored for {creator_id[:8]}… ret={retention_rate:.0%}")

    elif verdict == "miss":
        content = (
            f"MISS — ret={retention_rate:.0%}, ctr={ctr:.1%}, {views_7d} views (7d). "
            f"Hook type: {hook_type}. Clip: {transcript_excerpt[:300]}"
        )
        upsert_chunk(
            creator_id=creator_id,
            chunk_type="miss",
            archetype=archetype,
            content=content,
            meta=meta,
            clip_id=clip_id,
        )
        log.info(f"[RAG] MISS chunk stored for {creator_id[:8]}… ret={retention_rate:.0%}")


# ─── Seed: load taste profile into ChromaDB ─────────────────────────────────

def seed_taste_profile(
    creator_id: str,
    archetype: str,
    taste_profile: dict,
) -> int:
    """
    Onboard a new creator: push their taste profile into ChromaDB.
    Called once when the creator completes the 5-question onboarding.

    taste_profile keys:
        niche, audience, hook_style, avoid_topics,
        caption_style, posting_frequency, top_creators, bio
    """
    chunks_stored = 0

    # Aggregate taste blurb
    niche       = taste_profile.get("niche", "")
    hook_style  = taste_profile.get("hook_style", "")
    caption     = taste_profile.get("caption_style", "")
    avoid       = taste_profile.get("avoid_topics", "")
    top_creators = ", ".join(taste_profile.get("top_creators", []))

    content_parts = [
        f"Niche: {niche}",
        f"Hook style: {hook_style}",
        f"Caption style: {caption}",
        f"Avoid: {avoid}",
        f"Role models: {top_creators}",
    ]
    content = "\n".join(filter(None, content_parts))

    if content.strip():
        upsert_chunk(
            creator_id=creator_id,
            chunk_type="taste",
            archetype=archetype,
            content=content,
            meta={"source": "onboarding", "archetype": archetype},
        )
        chunks_stored += 1

    # Store hook patterns if provided
    hooks = taste_profile.get("hook_patterns", [])
    if isinstance(hooks, list) and hooks:
        for hook in hooks[:5]:
            if hook and len(hook) > 10:
                upsert_chunk(
                    creator_id=creator_id,
                    chunk_type="hook",
                    archetype=archetype,
                    content=str(hook)[:300],
                    meta={"source": "onboarding"},
                )
                chunks_stored += 1

    log.info(f"[RAG] Taste profile seeded for {creator_id[:8]}… ({chunks_stored} chunks)")
    return chunks_stored


# ─── Debug / stats ────────────────────────────────────────────────────────────

def get_collection_stats(creator_id: str) -> dict:
    """Return chunk counts by type for a creator."""
    client = _get_chroma_client()
    col = client.get_or_create_collection(name=_col_name(creator_id))
    all_data = col.get(include=[])
    ids = all_data.get("ids", [])

    by_type: dict[str, int] = {}
    for i in range(len(ids)):
        # Fetch metadata one at a time (chroma doesn't have a cheap group-by)
        pass  # skip for now — use list count if needed
    return {"total_chunks": len(ids), "collection": _col_name(creator_id)}


def reset_collection(creator_id: str) -> None:
    """Delete all chunks for a creator. Use with caution."""
    client = _get_chroma_client()
    try:
        client.delete_collection(name=_col_name(creator_id))
        log.warning(f"[RAG] Collection deleted for creator {creator_id[:8]}…")
    except Exception as e:
        log.error(f"Failed to delete collection: {e}")
