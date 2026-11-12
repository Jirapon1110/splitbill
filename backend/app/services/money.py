"""Money parsing and exact allocation. All arithmetic uses Decimal / integer satang, never float."""

import re
from decimal import Decimal

from app.errors import ValidationFailed

_AMOUNT_RE = re.compile(r"^[0-9]+(\.[0-9]+)?$")  # ASCII only: \d also matches other scripts
MAX_AMOUNT = Decimal("9999999999.99")  # NUMERIC(12,2)
SATANG = Decimal("0.01")


def parse_amount(raw: str, field: str = "amount") -> Decimal:
    """Parse a money string. Rejects >2 decimals, zero, negatives and non-numeric input."""
    text = raw.strip()
    if text.startswith("-"):
        raise ValidationFailed(f"{field} must be greater than zero")
    if not _AMOUNT_RE.match(text):
        raise ValidationFailed(f'{field} must be a decimal string such as "1000.00"')
    if "." in text and len(text.split(".")[1]) > 2:
        raise ValidationFailed(f"{field} must have at most 2 decimal places")
    value = Decimal(text).quantize(SATANG)
    if value <= 0:
        raise ValidationFailed(f"{field} must be greater than zero")
    if value > MAX_AMOUNT:
        raise ValidationFailed(f"{field} is too large")
    return value


def to_satang(value: Decimal) -> int:
    return int(value * 100)


def from_satang(satang: int) -> Decimal:
    return Decimal(satang).scaleb(-2).quantize(SATANG)


def split_equally(amount: Decimal, members: list[str]) -> dict[str, Decimal]:
    """Split evenly; leftover satang go one at a time to members in the listed order."""
    total = to_satang(amount)
    base, remainder = divmod(total, len(members))
    return {
        member: from_satang(base + (1 if index < remainder else 0))
        for index, member in enumerate(members)
    }
