from backend.services.entitlements import (
    CLIP_CREDIT_COST,
    GO_MONTHLY_CLIPS,
    GO_MONTHLY_CREDITS,
    source_limit_seconds,
)


def test_go_allowance_is_exactly_100_clips():
    assert CLIP_CREDIT_COST == 200
    assert GO_MONTHLY_CREDITS == 20_000
    assert GO_MONTHLY_CLIPS == 100


def test_starter_source_limit_and_admin_bypass():
    assert source_limit_seconds("free") == 30 * 60
    assert source_limit_seconds("go") == 30 * 60
    assert source_limit_seconds("go", is_admin=True) is None
