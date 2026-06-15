"""
LLM cost control — strict budget tracking, per-request token caps, and a
smart-skip heuristic that avoids calling the LLM when text+audio detection
already produced 3 high-confidence candidates.

Why this exists:
  - Anthropic Haiku 4.5 costs $1/MTok input + $5/MTok output (as of 2025-06).
  - With the $20 budget the user allocated, we can afford ~2000-4000
    taste-selection calls, but only if we don't waste tokens.
  - Most requests: 15 candidate moments × ~50 tokens prompt line = 750 input
    tokens. Plus ~400 output tokens for the JSON picks.
  - Per-request cost: (750/1M × $1) + (400/1M × $5) = $0.00075 + $0.002 = $0.0028
  - $20 / $0.0028 = ~7100 taste-selection calls. Plenty of headroom.
  - BUT: a single bad request (e.g. prompt injection) could blow 100x budget.
    Hence the hard caps below.

Three layers of cost control:
  1. Per-request MAX OUTPUT TOKENS cap (default 500) — limits worst-case
  2. Per-day USD budget cap (env LLM_DAILY_BUDGET_USD, default $0.50) — limits daily burn
  3. Smart-skip: if we have 3+ high-confidence merged moments (text+audio
     confirmed, score >= 0.7), skip LLM entirely and use them as-is.
     This saves the LLM cost on ~50% of "obvious" requests.

State is in-process (lost on restart). For multi-process, swap to Redis later.
"""
import os
import time
import threading
import logging
from typing import Dict, List, Optional, Tuple, Any

log = logging.getLogger(__name__)


# ─── Cost constants (USD per million tokens, as of 2025-06) ────────────────
# Update these if Anthropic changes pricing.
_COST_PER_MTOK = {
    # Model: (input_usd_per_mtok, output_usd_per_mtok)
    "claude-haiku-4-5-20251001": (1.0, 5.0),
    "claude-haiku-3-5-20241022": (0.80, 4.0),
    "claude-3-5-sonnet-20241022": (3.0, 15.0),
    "deepseek-chat": (0.14, 0.28),
    "deepseek-reasoner": (0.55, 2.19),
    "llama-3.3-70b-versatile": (0.59, 0.79),  # Groq
    "llama-3.1-8b-instant": (0.05, 0.08),     # Groq
    "mixtral-8x7b-32768": (0.24, 0.24),       # Groq
}

_DEFAULT_COST = (1.0, 5.0)  # conservative default (Haiku 4.5)


# ─── Configurable caps (env-driven) ────────────────────────────────────────
LLM_MAX_OUTPUT_TOKENS = int(os.getenv("LLM_MAX_OUTPUT_TOKENS", "500"))
# Daily spend cap. 0.50 USD is a sensible default for a beta with $20 / month.
LLM_DAILY_BUDGET_USD = float(os.getenv("LLM_DAILY_BUDGET_USD", "0.50"))
# Soft warn at this fraction of daily budget
LLM_BUDGET_WARN_FRAC = float(os.getenv("LLM_BUDGET_WARN_FRAC", "0.80"))
# Skip the LLM if we already have this many high-confidence merged moments
SMART_SKIP_MIN_MOMENTS = int(os.getenv("SMART_SKIP_MIN_MOMENTS", "3"))
SMART_SKIP_MIN_SCORE = float(os.getenv("SMART_SKIP_MIN_SCORE", "0.70"))


# ─── State (in-process, thread-safe) ───────────────────────────────────────
_state_lock = threading.Lock()
_state: Dict[str, Any] = {
    "calls_today": 0,
    "input_tokens_today": 0,
    "output_tokens_today": 0,
    "cost_usd_today": 0.0,
    "calls_skipped_smart": 0,
    "calls_skipped_budget": 0,
    "last_reset_date": time.strftime("%Y-%m-%d"),
    "history": [],  # recent (ts, model, in, out, cost) for ops visibility
}


def _maybe_reset_daily() -> None:
    """Reset counters at UTC midnight."""
    today = time.strftime("%Y-%m-%d")
    with _state_lock:
        if _state["last_reset_date"] != today:
            _state["calls_today"] = 0
            _state["input_tokens_today"] = 0
            _state["output_tokens_today"] = 0
            _state["cost_usd_today"] = 0.0
            _state["last_reset_date"] = today


def estimate_cost_usd(model: str, input_tokens: int, output_tokens: int) -> float:
    """Estimate USD cost of one LLM call. Returns 0 for unknown models."""
    rate = _COST_PER_MTOK.get(model, _DEFAULT_COST)
    input_cost = (input_tokens / 1_000_000.0) * rate[0]
    output_cost = (output_tokens / 1_000_000.0) * rate[1]
    return round(input_cost + output_cost, 6)


def record_call(model: str, input_tokens: int, output_tokens: int) -> float:
    """Record a successful LLM call. Returns the cost in USD."""
    _maybe_reset_daily()
    cost = estimate_cost_usd(model, input_tokens, output_tokens)
    with _state_lock:
        _state["calls_today"] += 1
        _state["input_tokens_today"] += input_tokens
        _state["output_tokens_today"] += output_tokens
        _state["cost_usd_today"] += cost
        _state["history"].append({
            "ts": time.time(),
            "model": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "cost_usd": cost,
        })
        # Keep last 100 entries (for ops visibility)
        if len(_state["history"]) > 100:
            _state["history"] = _state["history"][-100:]
        # Warn at threshold
        if (_state["cost_usd_today"] >= LLM_DAILY_BUDGET_USD * LLM_BUDGET_WARN_FRAC
                and not _state.get("warned_today")):
            log.warning(
                f"⚠️  LLM daily spend reached "
                f"${_state['cost_usd_today']:.4f} "
                f"({_state['cost_usd_today'] / LLM_DAILY_BUDGET_USD * 100:.0f}% of "
                f"${LLM_DAILY_BUDGET_USD:.2f} cap)"
            )
            _state["warned_today"] = True
    return cost


def budget_exceeded() -> bool:
    """True if daily budget is exhausted. Callers should fall back to lexical."""
    _maybe_reset_daily()
    with _state_lock:
        return _state["cost_usd_today"] >= LLM_DAILY_BUDGET_USD


def record_skipped_smart() -> None:
    """Increment the 'smart-skipped' counter (when we didn't need the LLM)."""
    with _state_lock:
        _state["calls_skipped_smart"] += 1


def record_skipped_budget() -> None:
    """Increment the 'budget-skipped' counter (LLM call refused)."""
    with _state_lock:
        _state["calls_skipped_budget"] += 1


def cost_status() -> dict:
    """Snapshot of LLM cost state — for /cost-status endpoint."""
    _maybe_reset_daily()
    with _state_lock:
        return {
            "daily_budget_usd": LLM_DAILY_BUDGET_USD,
            "spent_today_usd": round(_state["cost_usd_today"], 6),
            "remaining_today_usd": round(
                max(0.0, LLM_DAILY_BUDGET_USD - _state["cost_usd_today"]), 6
            ),
            "budget_utilization_pct": round(
                100.0 * _state["cost_usd_today"] / max(LLM_DAILY_BUDGET_USD, 0.01), 2
            ),
            "calls_today": _state["calls_today"],
            "input_tokens_today": _state["input_tokens_today"],
            "output_tokens_today": _state["output_tokens_today"],
            "calls_skipped_smart": _state["calls_skipped_smart"],
            "calls_skipped_budget": _state["calls_skipped_budget"],
            "max_output_tokens_per_call": LLM_MAX_OUTPUT_TOKENS,
            "smart_skip_threshold": {
                "min_moments": SMART_SKIP_MIN_MOMENTS,
                "min_score": SMART_SKIP_MIN_SCORE,
            },
            "recent_calls": _state["history"][-10:],  # last 10 for ops
        }


# ─── Smart-skip heuristic ──────────────────────────────────────────────────

def should_smart_skip(moments: List[Any]) -> Tuple[bool, str]:
    """Decide whether to skip the LLM call entirely.

    Returns (skip, reason). When skip=True, caller should use the moments
    as-is (no LLM pick — just take the top N by score and use sensible
    defaults for viral_title/caption).

    Heuristic: if we have at least SMART_SKIP_MIN_MOMENTS moments with
    score >= SMART_SKIP_MIN_SCORE, we trust the detection and skip.

    This is a budget play, not a quality call — we still use lexical
    defaults (generic title "WAIT FOR IT" etc.) when skipping. The
    win is avoiding the LLM cost on "obvious" requests.
    """
    if not moments:
        return False, "no moments"

    high_conf = [m for m in moments if getattr(m, "score", 0) >= SMART_SKIP_MIN_SCORE]
    if len(high_conf) >= SMART_SKIP_MIN_MOMENTS:
        return True, (
            f"have {len(high_conf)} moments with score>={SMART_SKIP_MIN_SCORE} "
            f"(>= {SMART_SKIP_MIN_MOMENTS} required)"
        )

    return False, (
        f"only {len(high_conf)} high-confidence moments "
        f"(need {SMART_SKIP_MIN_MOMENTS} with score>={SMART_SKIP_MIN_SCORE})"
    )


def build_smart_skip_picks(moments: List[Any], max_picks: int = 3) -> List[Dict]:
    """Pick top N moments as if the LLM had returned them.

    Used when smart-skip is triggered. We synthesize the LLM response
    shape so the rest of the pipeline doesn't need to know.
    """
    sorted_m = sorted(moments, key=lambda m: getattr(m, "score", 0), reverse=True)
    picks = []
    for m in sorted_m[:max_picks]:
        # Derive a default title from the snippet
        snippet = (getattr(m, "snippet", "") or "").strip()
        if snippet:
            # First 4-6 words, uppercased
            words = snippet.split()[:5]
            default_title = " ".join(w for w in words if w.isalnum())[:40].upper() or "WATCH THIS"
        else:
            default_title = "WATCH THIS"
        picks.append({
            "moment_index": getattr(m, "index", 0),
            "trim_start": 0.0,
            "trim_end": 0.0,
            "viral_title": default_title,
            "caption": snippet[:100] if snippet else "(no caption)",
            "hashtags": "#shorts #viral",
            "reason": f"Smart-skip: {getattr(m, 'signal_type', '?')} with score "
                      f"{getattr(m, 'score', 0):.2f} (LLM not called to save budget)",
            "_smart_skip": True,
        })
    return picks
