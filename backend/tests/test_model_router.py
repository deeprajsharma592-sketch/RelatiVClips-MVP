"""
Unit tests for the LLM model router and cost control with caching.

Verifies:
  - Tier selection logic (calibration → budget → fallback)
  - Cost estimation with and without prompt caching
  - Hard budget enforcement
  - Picks-per-dollar math
"""
import os
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from llm import cost_control, model_router
from llm.model_router import LLMTier, estimate_pick_cost, picks_per_dollar


def test_calibration_tier_default():
    """Default tier is calibration (or smart, which starts as calibration)."""
    os.environ["LLM_TIER"] = "calibration"
    # Reload (in production this would be done by restart)
    import importlib
    importlib.reload(model_router)
    model, tier, cpp = model_router.pick_model()
    assert model.startswith("claude-"), f"Expected claude, got {model}"
    assert tier == "calibration", f"Expected calibration, got {tier}"
    print(f"✓ calibration tier → {model} (${cpp:.6f}/pick)")


def test_budget_tier():
    os.environ["LLM_TIER"] = "budget"
    import importlib
    importlib.reload(model_router)
    model, tier, cpp = model_router.pick_model()
    assert "deepseek" in model or "gpt-oss" in model, f"Expected cheap model, got {model}"
    assert tier == "budget", f"Expected budget, got {tier}"
    print(f"✓ budget tier → {model} (${cpp:.6f}/pick)")


def test_fallback_tier():
    os.environ["LLM_TIER"] = "fallback"
    import importlib
    importlib.reload(model_router)
    model, tier, cpp = model_router.pick_model()
    assert "gpt-oss" in model, f"Expected gpt-oss, got {model}"
    assert tier == "fallback", f"Expected fallback, got {tier}"
    print(f"✓ fallback tier → {model} (${cpp:.6f}/pick)")


def test_cost_estimation_haiku_no_cache():
    """Haiku 4.5: 800 input + 200 output, no cache = $0.0018"""
    cost = estimate_pick_cost("claude-haiku-4-5-20251001", 800, 200, cache_hit_ratio=0.0)
    expected = (800/1_000_000 * 1.0) + (200/1_000_000 * 5.0)
    assert abs(cost - expected) < 1e-6, f"Expected ${expected}, got ${cost}"
    print(f"✓ Haiku no cache: 800/200 tokens = ${cost:.6f}")


def test_cost_estimation_haiku_with_cache():
    """Haiku 4.5: 800 input, 700 cached + 100 fresh + 200 output"""
    cost = estimate_pick_cost("claude-haiku-4-5-20251001", 800, 200, cache_hit_ratio=0.875)
    # 700 * 0.10 + 100 * 1.0 + 200 * 5.0 = 0.07 + 0.1 + 1.0 = $1.17/M
    expected = (700/1_000_000 * 0.10) + (100/1_000_000 * 1.0) + (200/1_000_000 * 5.0)
    assert abs(cost - expected) < 1e-6, f"Expected ${expected}, got ${cost}"
    print(f"✓ Haiku cached (87.5%): 800/200 tokens = ${cost:.6f} (vs ${(800/1_000_000*1.0+200/1_000_000*5.0):.6f} without cache)")


def test_cost_estimation_deepseek_flash():
    """V4-Flash: $0.14 input + $0.28 output, 10x cheaper than Haiku"""
    cost = estimate_pick_cost("deepseek-v4-flash", 800, 200)
    expected = (800/1_000_000 * 0.14) + (200/1_000_000 * 0.28)
    assert abs(cost - expected) < 1e-6
    print(f"✓ DeepSeek V4-Flash: 800/200 tokens = ${cost:.6f}")


def test_cost_estimation_gpt_oss():
    """GPT OSS 20B: cheapest of all, $0.075 + $0.30"""
    cost = estimate_pick_cost("gpt-oss-20b", 800, 200)
    expected = (800/1_000_000 * 0.075) + (200/1_000_000 * 0.30)
    assert abs(cost - expected) < 1e-6
    print(f"✓ Groq GPT OSS 20B: 800/200 tokens = ${cost:.6f}")


def test_picks_per_dollar():
    """$1 should buy us at least 500 picks on every tier."""
    for model in ["claude-haiku-4-5-20251001", "deepseek-v4-flash", "gpt-oss-20b"]:
        ppd = picks_per_dollar(model)
        assert ppd > 500, f"{model}: only {ppd} picks/$1"
        print(f"✓ {model}: {ppd} picks per $1")


def test_budget_enforcement():
    """After 2000 picks in calibration, switch to budget tier."""
    os.environ["LLM_TIER"] = "smart"
    import importlib
    importlib.reload(model_router)
    # Simulate 1999 picks (just under threshold)
    for _ in range(1999):
        model_router.record_pick("claude-haiku-4-5-20251001", 0.001)
    model, tier, cpp = model_router.pick_model()
    assert tier == "calibration", f"Expected calibration at 1999 picks, got {tier}"
    # Bump to threshold
    model_router.record_pick("claude-haiku-4-5-20251001", 0.001)
    model, tier, cpp = model_router.pick_model()
    assert tier == "budget", f"Expected budget at 2000 picks, got {tier}"
    print(f"✓ smart mode: 1999 picks → calibration, 2000+ → budget ({tier})")


def test_hard_budget_fallback():
    """Burn through hard budget → fallback tier."""
    os.environ["LLM_TIER"] = "smart"
    import importlib
    importlib.reload(model_router)
    # Record a $1.50 burn (over $1.00 hard cap)
    model_router.record_pick("claude-haiku-4-5-20251001", 1.50)
    model, tier, cpp = model_router.pick_model()
    assert tier == "fallback", f"Expected fallback after hard budget, got {tier}"
    print(f"✓ smart mode: hard budget exceeded → fallback ({tier})")


def test_cost_status_includes_routing():
    """The /cost-status endpoint should now show routing info."""
    status = cost_control.cost_status()
    assert "routing" in status, "routing key missing from cost_status"
    routing = status["routing"]
    assert "active_tier" in routing
    assert "active_model" in routing
    assert "picks_per_dollar" in routing
    assert "all_tier_options" in routing
    print(f"✓ cost_status includes routing: active={routing['active_model']}, "
          f"{routing['picks_per_dollar']} picks/$1")


def test_cache_savings_tracking():
    """Cache savings should be tracked when cache_read > 0."""
    initial = cost_control.cost_status().get("cache_savings_usd_today", 0)
    # 1000 input, 800 cached, 200 fresh
    cost_control.record_call("claude-haiku-4-5-20251001", 1000, 200, cache_read=800)
    after = cost_control.cost_status()["cache_savings_usd_today"]
    # Savings = 1000*1.0 - (800*0.10 + 200*1.0) = 1000 - 280 = 720 (in micro-USD = $0.00072)
    expected_savings = 1000/1_000_000 * 1.0 - (800/1_000_000 * 0.10 + 200/1_000_000 * 1.0)
    assert after >= initial + expected_savings - 1e-6, \
        f"Expected savings ≥ {expected_savings}, got {after - initial}"
    print(f"✓ cache savings tracked: ${after - initial:.6f} from 1 call with 80% cache hit")


if __name__ == "__main__":
    test_calibration_tier_default()
    test_budget_tier()
    test_fallback_tier()
    test_cost_estimation_haiku_no_cache()
    test_cost_estimation_haiku_with_cache()
    test_cost_estimation_deepseek_flash()
    test_cost_estimation_gpt_oss()
    test_picks_per_dollar()
    test_budget_enforcement()
    test_hard_budget_fallback()
    test_cost_status_includes_routing()
    test_cache_savings_tracking()
    print("\n✓ All model router + cost control tests passed")
