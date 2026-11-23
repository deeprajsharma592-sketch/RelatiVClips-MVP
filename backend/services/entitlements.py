"""Product entitlements and compute guardrails.

Keep billing, the API, and the UI backed by the same server-side values.
"""

CLIP_CREDIT_COST = 200
ONBOARDING_CLIPS = 2
ONBOARDING_CREDITS = ONBOARDING_CLIPS * CLIP_CREDIT_COST
REMAKE_BASE_CREDITS = 2 * CLIP_CREDIT_COST

GO_MONTHLY_CREDITS = 20_000
GO_MONTHLY_CLIPS = GO_MONTHLY_CREDITS // CLIP_CREDIT_COST
GO_MAX_SOURCE_SECONDS = 30 * 60
MAX_ACTIVE_TASKS_PER_USER = 1
CLIP_RETENTION_DAYS = 7

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
        "pro": 90 * 60,
        "creator_pro": 90 * 60,
        "premium": 3 * 60 * 60,
        "creator_premium": 3 * 60 * 60,
    }.get((plan_tier or "free").lower(), GO_MAX_SOURCE_SECONDS)

