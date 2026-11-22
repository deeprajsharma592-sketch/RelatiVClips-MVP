import pytest

from backend.services.credits import calculate_credit_cost


def test_generation_costs_one_credit_per_clip():
    assert calculate_credit_cost(1) == 200
    assert calculate_credit_cost(2) == 400
    assert calculate_credit_cost(4) == 800


def test_remake_adds_two_credit_fee():
    assert calculate_credit_cost(1, is_remake=True) == 600
    assert calculate_credit_cost(2, is_remake=True) == 800


@pytest.mark.parametrize("count", [0, 5, -1])
def test_invalid_clip_count_is_rejected(count):
    with pytest.raises(ValueError):
        calculate_credit_cost(count)
