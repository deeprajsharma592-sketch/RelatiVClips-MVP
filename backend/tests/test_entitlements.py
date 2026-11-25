from backend.services.entitlements import (
    CLIP_CREDIT_COST,
    GO_MONTHLY_CLIPS,
    GO_MONTHLY_CREDITS,
    PLAN_CATALOG,
    concurrency_limit,
    source_limit_seconds,
)


def test_go_allowance_is_exactly_100_clips():
    assert CLIP_CREDIT_COST == 200
    assert GO_MONTHLY_CREDITS == 20_000
    assert GO_MONTHLY_CLIPS == 100


def test_starter_source_limit_and_admin_bypass():
    assert source_limit_seconds("free") == 60 * 60
    assert source_limit_seconds("go") == 60 * 60
    assert source_limit_seconds("go", is_admin=True) is None


def test_creator_plan_catalog_and_limits():
    assert PLAN_CATALOG["creator_go"]["credits"] == 20_000
    assert PLAN_CATALOG["creator_pro"]["credits"] == 60_000
    assert PLAN_CATALOG["creator_max"]["credits"] == 200_000
    assert source_limit_seconds("creator_go") == 60 * 60
    assert source_limit_seconds("creator_pro") == 60 * 60
    assert source_limit_seconds("creator_max") == 90 * 60
    assert concurrency_limit("creator_pro") == 1
    assert concurrency_limit("creator_max") == 2
