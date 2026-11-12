from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models import Expense, ExpenseShare, User


def _with_relations():
    return (
        selectinload(Expense.shares).selectinload(ExpenseShare.user),
        selectinload(Expense.payer),
    )


def find_by_idempotency_key(session: Session, group_id: int, key: str) -> Expense | None:
    stmt = (
        select(Expense)
        .where(Expense.group_id == group_id, Expense.idempotency_key == key)
        .options(*_with_relations())
    )
    return session.scalar(stmt)


def get_expense(session: Session, group_id: int, expense_id: int) -> Expense | None:
    stmt = (
        select(Expense)
        .where(Expense.group_id == group_id, Expense.id == expense_id)
        .options(*_with_relations())
    )
    return session.scalar(stmt)


def list_expenses(session: Session, group_id: int) -> list[Expense]:
    stmt = (
        select(Expense)
        .where(Expense.group_id == group_id, Expense.deleted_at.is_(None))
        .order_by(Expense.created_at.desc(), Expense.id.desc())
        .options(*_with_relations())
    )
    return list(session.scalars(stmt))


def add_expense(
    session: Session,
    *,
    group_id: int,
    description: str,
    payer: User,
    amount: Decimal,
    idempotency_key: str | None,
    shares: list[tuple[User, Decimal]],
) -> Expense:
    expense = Expense(
        group_id=group_id,
        description=description,
        paid_by=payer.id,
        amount=amount,
        idempotency_key=idempotency_key,
        shares=[
            ExpenseShare(user_id=user.id, share=share, position=index)
            for index, (user, share) in enumerate(shares)
        ],
    )
    session.add(expense)
    session.flush()  # raises IntegrityError on a duplicate (group_id, idempotency_key)
    return expense


def soft_delete(session: Session, expense: Expense) -> None:
    expense.deleted_at = func.now()
    session.flush()


def totals_paid(session: Session, group_id: int) -> dict[int, Decimal]:
    stmt = (
        select(Expense.paid_by, func.sum(Expense.amount))
        .where(Expense.group_id == group_id, Expense.deleted_at.is_(None))
        .group_by(Expense.paid_by)
    )
    return {user_id: total for user_id, total in session.execute(stmt)}


def totals_owed(session: Session, group_id: int) -> dict[int, Decimal]:
    stmt = (
        select(ExpenseShare.user_id, func.sum(ExpenseShare.share))
        .join(Expense, Expense.id == ExpenseShare.expense_id)
        .where(Expense.group_id == group_id, Expense.deleted_at.is_(None))
        .group_by(ExpenseShare.user_id)
    )
    return {user_id: total for user_id, total in session.execute(stmt)}
