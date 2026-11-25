"""Product entitlements and compute guardrails.

Keep billing, the API, and the UI backed by the same server-side values.
"""
from __future__ import annotations

CLIP_CREDIT_COST = 200
ONBOARDING_CLIPS = 2
ONBOARDING_CREDITS = ONBOARDING_CLIPS * CLIP_CREDIT_COST
REMAKE_BASE_CREDITS = 2 * CLIP_CREDIT_COST

GO_MONTHLY_CREDITS = 20_000
GO_MONTHLY_CLIPS = GO_MONTHLY_CREDITS // CLIP_CREDIT_COST
GO_MAX_SOURCE_SECONDS = 60 * 60
PRO_MONTHLY_CREDITS = 60_000
PRO_MONTHLY_CLIPS = PRO_MONTHLY_CREDITS // CLIP_CREDIT_COST
PRO_MAX_SOURCE_SECONDS = 60 * 60
MAX_MONTHLY_CREDITS = 200_000
MAX_MONTHLY_CLIPS = MAX_MONTHLY_CREDITS // CLIP_CREDIT_COST
MAX_MAX_SOURCE_SECONDS = 90 * 60
CLIP_RETENTION_DAYS = 7

PLAN_CATALOG = {
    "creator_go": {
        "credits": GO_MONTHLY_CREDITS,
        "clips": GO_MONTHLY_CLIPS,
        "price_cents": 999,
        "source_limit_seconds": GO_MAX_SOURCE_SECONDS,
        "concurrency": 1,
    },
    "creator_pro": {
        "credits": PRO_MONTHLY_CREDITS,
        "clips": PRO_MONTHLY_CLIPS,
        "price_cents": 1499,
        "source_limit_seconds": PRO_MAX_SOURCE_SECONDS,
        "concurrency": 1,
    },
    "creator_max": {
        "credits": MAX_MONTHLY_CREDITS,
        "clips": MAX_MONTHLY_CLIPS,
        "price_cents": 2499,
        "source_limit_seconds": MAX_MAX_SOURCE_SECONDS,
        "concurrency": 2,
    },
}

# Go calibration starts with Claude Haiku 5.5 and uses only the strict
# fallbacks defined in backend.llm.chain.
GO_LLM_MODEL = "claude-haiku-5-5"


def source_limit_seconds(plan_tier: str, *, is_admin: bool = False) -> int | None:
    if is_admin:
        return None
    return {
        "free": GO_MAX_SOURCE_SECONDS,
        "go": GO_MAX_SOURCE_SECONDS,
        "creator_go": GO_MAX_SOURCE_SECONDS,
        "pro": PRO_MAX_SOURCE_SECONDS,
        "creator_pro": PRO_MAX_SOURCE_SECONDS,
        "max": MAX_MAX_SOURCE_SECONDS,
        "creator_max": MAX_MAX_SOURCE_SECONDS,
    }.get((plan_tier or "free").lower(), GO_MAX_SOURCE_SECONDS)


def concurrency_limit(plan_tier: str) -> int:
    return 2 if (plan_tier or "free").lower() in {"max", "creator_max"} else 1


def normalize_plan_key(value: str | None) -> str | None:
    aliases = {
        "go": "creator_go",
        "creator_go": "creator_go",
        "pro": "creator_pro",
        "creator_pro": "creator_pro",
        "max": "creator_max",
        "creator_max": "creator_max",
    }
    return aliases.get((value or "").strip().lower())


def effective_plan_tier(user) -> str:
    if user.polar_subscription_status in {"canceled", "revoked"} or user.polar_cancel_at_period_end:
        return "free"
    return user.plan_tier
