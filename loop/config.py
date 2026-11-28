"""Scoring and run configuration for the loop.

Weights live in ``loop/weights.json`` (override with EDIT_WEIGHTS_PATH). Changing
them is a deliberate config edit, never something a report applies on its own.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping

import engine_config

WEIGHTS_PATH = Path(__file__).resolve().parent / "weights.json"
DEFAULT_WEIGHTS = {"hook": 0.30, "arc": 0.25, "readability": 0.20, "overload": 0.15, "audio": 0.10}


@lru_cache(maxsize=1)
def weights() -> dict[str, float]:
    path = Path(engine_config.env("EDIT_WEIGHTS_PATH") or WEIGHTS_PATH)
    if path.exists():
        payload = json.loads(path.read_text(encoding="utf-8"))
        found = payload.get("weights") or {}
        merged = {**DEFAULT_WEIGHTS, **{k: float(v) for k, v in found.items()}}
    else:
        merged = dict(DEFAULT_WEIGHTS)
    total = sum(merged.values()) or 1.0
    return {k: v / total for k, v in merged.items()}


def reset_weights_cache() -> None:
    weights.cache_clear()


def weighted_score(scores: Mapping[str, Any] | None) -> float:
    if not scores:
        return 0.0
    w = weights()
    return round(sum(float(scores.get(dim, 0)) * weight for dim, weight in w.items()), 3)


def production_ready_required() -> bool:
    return engine_config.env_bool("EDIT_REQUIRE_PRODUCTION_READY", True)


def explain_weights() -> str:
    w = weights()
    return ", ".join(f"{k} {v:.2f}" for k, v in w.items())
