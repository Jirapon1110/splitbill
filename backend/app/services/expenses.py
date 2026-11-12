from decimal import Decimal

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.errors import Forbidden, NotFound, ValidationFailed
from app.models import Expense, Group, User
from app.repositories import expenses as repo
from app.schemas import EqualSplit, ExactSplit, ExpenseCreate
from app.services.money import parse_amount, split_equally

ZERO = Decimal("0.00")


def _require_members(names: list[str], members: dict[str, User]) -> None:
    outsiders = [name for name in names if name not in members]
    if outsiders:
        raise ValidationFailed(f"Not a member of this group: {', '.join(outsiders)}")


def _resolve_shares(
    data: ExpenseCreate, amount: Decimal, members: dict[str, User]
) -> list[tuple[User, Decimal]]:
    split = data.split
    if isinstance(split, EqualSplit):
        names = [name.strip().lower() for name in split.members]
        if not names:
            raise ValidationFailed("split.members must contain at least one member")
        if len(set(names)) != len(names):
            raise ValidationFailed("split.members must not contain duplicates")
        _require_members(names, members)
        allocated = split_equally(amount, names)
        if min(allocated.values()) <= 0:
            raise ValidationFailed(
                f"The amount {amount} is too small to split among {len(names)} members: "
                "every share must be at least 0.01"
            )
    else:
        assert isinstance(split, ExactSplit)
        names = [name.strip().lower() for name in split.shares]
        if not names:
            raise ValidationFailed("split.shares must contain at least one member")
        if len(set(names)) != len(names):
            raise ValidationFailed("split.shares must not contain duplicates")
        _require_members(names, members)
        allocated = {
            name.strip().lower(): parse_amount(value, f"share for {name}")
            for name, value in split.shares.items()
        }
        total = sum(allocated.values(), ZERO)
        if total != amount:
            raise ValidationFailed(
                f"The shares add up to {total} but the expense amount is {amount}"
            )
    return [(members[name], share) for name, share in allocated.items()]


def create_expense(
    session: Session, group: Group, data: ExpenseCreate, idempotency_key: str | None
) -> tuple[Expense, bool]:
    """Create an expense. Returns (expense, created); created is False for an idempotent replay."""
    if idempotency_key:
        existing = repo.find_by_idempotency_key(session, group.id, idempotency_key)
        if existing is not None:
            return existing, False

    description = data.description.strip()
    if not description:
        raise ValidationFailed("description must not be blank")
    members = {member.username: member for member in group.members}
    amount = parse_amount(data.amount)
    payer_name = data.paid_by.strip().lower()
    if payer_name not in members:
        raise ValidationFailed(f"Payer is not a member of this group: {payer_name}")
    shares = _resolve_shares(data, amount, members)

    try:
        expense = repo.add_expense(
            session,
            group_id=group.id,
            description=description,
            payer=members[payer_name],
            amount=amount,
            idempotency_key=idempotency_key or None,
            shares=shares,
        )
        session.commit()
    except IntegrityError:
        # A concurrent request with the same key won the race: the unique constraint on
        # (group_id, idempotency_key) rejected this insert, so return the winner's expense.
        session.rollback()
        if idempotency_key:
            existing = repo.find_by_idempotency_key(session, group.id, idempotency_key)
            if existing is not None:
                return existing, False
        raise
    created = repo.get_expense(session, group.id, expense.id)
    assert created is not None
    return created, True


def delete_expense(session: Session, group: Group, user: User, expense_id: int) -> None:
    expense = repo.get_expense(session, group.id, expense_id)
    if expense is None or expense.deleted_at is not None:
        raise NotFound("Expense not found")
    if expense.paid_by != user.id:
        raise Forbidden("Only the payer can delete this expense")
    repo.soft_delete(session, expense)
    session.commit()


def list_expenses(session: Session, group: Group) -> list[Expense]:
    return repo.list_expenses(session, group.id)


def balances(session: Session, group: Group) -> list[tuple[str, Decimal]]:
    """Net balance per member: paid minus own shares. Positive means the group owes them."""
    paid = repo.totals_paid(session, group.id)
    owed = repo.totals_owed(session, group.id)
    return [
        (member.username, paid.get(member.id, ZERO) - owed.get(member.id, ZERO))
        for member in group.members
    ]
