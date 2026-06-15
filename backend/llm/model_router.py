"""
LLM model tier router — picks the right model for the right job.

Why this exists:
  - Story-type content (podcasts, interviews, vlogs) needs narrative understanding.
  - Different cost/quality tradeoffs make sense for different phases of the product:
      * Calibration phase (first ~2-3 months): high quality (Haiku 4.5) to build
        a "taste" dataset we can later distill to cheaper models.
      * Post-calibration: switch to budget tier (DeepSeek V4-Flash).
      * Always: hard fallback (Groq GPT OSS 20B) if everything else is down.

Pricing reference (as of 2025-06):
  ┌──────────────────────┬────────────┬────────────┬──────────────┐
  │ Model                │ Input $/MT │ Output $/MT│ Cache read   │
  ├──────────────────────┼────────────┼────────────┼──────────────┤
  │ claude-haiku-4-5     │ 1.00       │ 5.00       │ 0.10         │
  │ deepseek-v4-flash    │ 0.14       │ 0.28       │ 0.0028       │
  │ deepseek-v4-pro      │ 0.435      │ 0.87       │ 0.003625     │
  │ gpt-oss-20b (Groq)   │ 0.075      │ 0.30       │ n/a          │
  └──────────────────────┴────────────┴────────────┴──────────────┘

Per-pick cost (assume 800 input + 200 output tokens, Haiku WITHOUT caching):
  - Haiku 4.5:       800/1M * 1.0  +  200/1M * 5.0  =  $0.00180
  - Haiku 4.5 (cached, 700/800 hit): 700/1M*0.10 + 100/1M*1.0 + 200/1M*5.0 = $0.00117
  - DeepSeek V4-Flash: 800/1M * 0.14 + 200/1M * 0.28 = $0.000168
  - DeepSeek V4-Pro:   800/1M * 0.435 + 200/1M * 0.87 = $0.000522
  - Groq GPT OSS 20B:  800/1M * 0.075 + 200/1M * 0.30 = $0.000120

$20 budget yields:
  - Haiku 4.5 no cache:   ~11,100 picks
  - Haiku 4.5 with cache: ~17,000 picks
  - DeepSeek V4-Flash:    ~119,000 picks
  - Groq GPT OSS 20B:     ~166,000 picks

The router:
  1. Honors a forced tier (env LLM_TIER = "calibration" | "budget" | "fallback")
  2. Auto-selects based on phase + budget remaining
  3. Returns the model name and an estimated cost per pick
"""
import logging
import os
from enum import Enum
from typing import Optional, Tuple

log = logging.getLogger(__name__)


# ─── Tier enum + default config ─────────────────────────────────────────────

class LLMTier(str, Enum):
    CALIBRATION = "calibration"   # Best quality, for building the taste dataset
    BUDGET = "budget"             # Cheap, for steady-state once calibrated
    FALLBACK = "fallback"         # Free/cheapest, emergency only
    SMART = "smart"               # Router decides per-request


# Map tier -> (primary model, fallback chain)
# Note: "smart" is a router meta-tier, not a real choice — it dispatches to
# one of the other three at runtime. We omit it from TIER_CONFIG.
TIER_CONFIG = {
    LLMTier.CALIBRATION: {
        "primary": "claude-haiku-4-5-20251001",
        "fallback": ["claude-haiku-4-5-20251001"],
        "description": "High quality for story/hook calibration. Uses Claude's prompt caching.",
        "use_cache": True,  # critical for Haiku cost reduction
    },
    LLMTier.BUDGET: {
        "primary": "deepseek-v4-flash",
        "fallback": ["deepseek-v4-flash", "gpt-oss-20b"],
        "description": "Steady-state after calibration. ~10x cheaper than Haiku.",
        "use_cache": True,
    },
    LLMTier.FALLBACK: {
        "primary": "gpt-oss-20b",
        "fallback": ["gpt-oss-20b"],
        "description": "Always-on cheap fallback (Groq GPT OSS 20B).",
        "use_cache": False,
    },
}


# ─── Cost constants (USD per million tokens) ────────────────────────────────
COST_PER_MTOK = {
    "claude-haiku-4-5-20251001": {
        "input": 1.0, "output": 5.0,
        "cache_read": 0.10, "cache_write": 1.25,
    },
    "deepseek-v4-flash": {
        "input": 0.14, "output": 0.28,
        "cache_read": 0.0028, "cache_write": 0.14,
    },
    "deepseek-v4-pro": {
        "input": 0.435, "output": 0.87,
        "cache_read": 0.003625, "cache_write": 0.435,
    },
    "gpt-oss-20b": {
        "input": 0.075, "output": 0.30,
        "cache_read": None, "cache_write": None,
    },
}


# ─── Env-driven config ──────────────────────────────────────────────────────

LLM_TIER = os.getenv("LLM_TIER", "smart").lower()  # calibration | budget | fallback | smart
# When in "smart" mode, switch from calibration → budget after this many picks
LLM_SMART_THRESHOLD = int(os.getenv("LLM_SMART_THRESHOLD", "2000"))
# Hard budget that forces fallback tier even in smart mode
LLM_HARD_BUDGET_USD = float(os.getenv("LLM_HARD_BUDGET_USD", "1.00"))  # per day


# ─── State (tracks picks, cost, tier switch) ────────────────────────────────

_state = {
    "total_picks": 0,
    "total_cost_usd": 0.0,
    "current_tier": LLM_TIER if LLM_TIER != "smart" else LLMTier.CALIBRATION.value,
    "tier_history": [],  # (ts, from_tier, to_tier, reason)
}

import threading
# RLock so get_routing_state (which holds it) can call pick_model (which takes it)
_state_lock = threading.RLock()


# ─── Router ─────────────────────────────────────────────────────────────────

def estimate_pick_cost(
    model: str,
    input_tokens: int = 800,
    output_tokens: int = 200,
    cache_hit_ratio: float = 0.0,
) -> float:
    """Estimate USD cost of one taste-selection pick with this model.

    cache_hit_ratio: fraction of input tokens that hit cache (0.0 to 1.0).
    """
    rates = COST_PER_MTOK.get(model, COST_PER_MTOK["claude-haiku-4-5-20251001"])
    if rates.get("cache_read") is not None and cache_hit_ratio > 0:
        cached = input_tokens * cache_hit_ratio
        fresh = input_tokens * (1.0 - cache_hit_ratio)
        in_cost = (cached / 1_000_000.0) * rates["cache_read"] + \
                  (fresh / 1_000_000.0) * rates["input"]
    else:
        in_cost = (input_tokens / 1_000_000.0) * rates["input"]
    out_cost = (output_tokens / 1_000_000.0) * rates["output"]
    return round(in_cost + out_cost, 6)


def picks_per_dollar(model: str, cache_hit_ratio: float = 0.0) -> int:
    """How many taste picks fit in $1 of budget."""
    cost = estimate_pick_cost(model, cache_hit_ratio=cache_hit_ratio)
    if cost <= 0:
        return 0
    return int(1.0 / cost)


def _determine_smart_tier() -> str:
    """Smart-mode decision: calibration until threshold, then budget."""
    with _state_lock:
        picks = _state["total_picks"]
        cost = _state["total_cost_usd"]
    # If we've burned too much today, fall back
    if cost >= LLM_HARD_BUDGET_USD:
        return LLMTier.FALLBACK.value
    # Calibration phase: first 2000 picks (or until budget tightens)
    if picks < LLM_SMART_THRESHOLD and cost < LLM_HARD_BUDGET_USD * 0.5:
        return LLMTier.CALIBRATION.value
    return LLMTier.BUDGET.value


def pick_model() -> Tuple[str, str, float]:
    """Pick the right model for the next pick.

    Returns (model_name, tier, estimated_cost_per_pick_usd).
    """
    # Honor forced tier from env
    if LLM_TIER in (LLMTier.CALIBRATION.value, LLMTier.BUDGET.value, LLMTier.FALLBACK.value):
        tier = LLM_TIER
    else:
        tier = _determine_smart_tier()

    # Update current_tier in state
    with _state_lock:
        if _state["current_tier"] != tier:
            _state["tier_history"].append({
                "ts": __import__("time").time(),
                "from": _state["current_tier"],
                "to": tier,
            })
            if len(_state["tier_history"]) > 50:
                _state["tier_history"] = _state["tier_history"][-50:]
            log.info(f"LLM tier switched: {_state['current_tier']} → {tier}")
            _state["current_tier"] = tier

    cfg = TIER_CONFIG.get(LLMTier(tier), TIER_CONFIG[LLMTier.CALIBRATION])
    model = cfg["primary"]
    # Haiku cache hit ratio is typically 0.7-0.9 (ICL prompt is constant)
    cache_hit = 0.85 if cfg.get("use_cache") and model.startswith("claude-") else 0.0
    cost_per_pick = estimate_pick_cost(model, cache_hit_ratio=cache_hit)
    return model, tier, cost_per_pick


def record_pick(model: str, cost_usd: float) -> None:
    """Record a successful pick for smart-mode switching."""
    with _state_lock:
        _state["total_picks"] += 1
        _state["total_cost_usd"] += cost_usd


def reset_state() -> None:
    """Reset all in-process state. For tests."""
    with _state_lock:
        _state["total_picks"] = 0
        _state["total_cost_usd"] = 0.0
        _state["current_tier"] = (
            LLM_TIER if LLM_TIER != "smart" else LLMTier.CALIBRATION.value
        )
        _state["tier_history"] = []


def get_routing_state() -> dict:
    """Snapshot of routing state — for /cost-status endpoint."""
    with _state_lock:
        # Project: how much budget left at current model?
        model, tier, cpp = pick_model()
        remaining_budget_usd = max(0.0, LLM_HARD_BUDGET_USD - _state["total_cost_usd"])
        remaining_picks = int(remaining_budget_usd / cpp) if cpp > 0 else 0
        cfg = TIER_CONFIG[LLMTier(tier)]
        return {
            "llm_tier_env": LLM_TIER,
            "active_tier": tier,
            "active_model": model,
            "tier_description": cfg["description"],
            "smart_threshold": LLM_SMART_THRESHOLD,
            "hard_budget_usd_per_day": LLM_HARD_BUDGET_USD,
            "spent_today_usd": round(_state["total_cost_usd"], 6),
            "remaining_today_usd": round(remaining_budget_usd, 6),
            "remaining_picks_estimated": remaining_picks,
            "total_picks": _state["total_picks"],
            "estimated_cost_per_pick_usd": cpp,
            "picks_per_dollar": picks_per_dollar(model, cache_hit_ratio=0.85 if cfg.get("use_cache") and model.startswith("claude-") else 0.0),
            "tier_history": _state["tier_history"][-5:],
            "all_tier_options": {
                t.value: {
                    "primary_model": TIER_CONFIG[t]["primary"],
                    "description": TIER_CONFIG[t]["description"],
                    "picks_per_dollar": picks_per_dollar(
                        TIER_CONFIG[t]["primary"],
                        cache_hit_ratio=0.85 if TIER_CONFIG[t].get("use_cache") and TIER_CONFIG[t]["primary"].startswith("claude-") else 0.0,
                    ),
                }
                for t in LLMTier if t in TIER_CONFIG
            },
        }
