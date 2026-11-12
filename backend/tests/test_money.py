from decimal import Decimal

import pytest

from app.errors import ValidationFailed
from app.services.money import parse_amount, split_equally


def test_equal_split_gives_remainder_satang_in_listed_order():
    shares = split_equally(Decimal("100.00"), ["alice", "bob", "carol"])
    assert list(shares.values()) == [Decimal("33.34"), Decimal("33.33"), Decimal("33.33")]
    assert sum(shares.values()) == Decimal("100.00")


def test_equal_split_two_leftover_satang():
    shares = split_equally(Decimal("0.05"), ["a", "b", "c"])
    assert list(shares.values()) == [Decimal("0.02"), Decimal("0.02"), Decimal("0.01")]


@pytest.mark.parametrize("raw", ["10.005", "0", "0.00", "-5.00", "abc", "", "1e3", "NaN", "1,000"])
def test_parse_amount_rejects_invalid(raw):
    with pytest.raises(ValidationFailed):
        parse_amount(raw)


@pytest.mark.parametrize(
    ("raw", "expected"), [("1000.00", "1000.00"), ("10", "10.00"), ("0.1", "0.10")]
)
def test_parse_amount_accepts_valid(raw, expected):
    assert parse_amount(raw) == Decimal(expected)
