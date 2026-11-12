from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True)


class Group(Base):
    __tablename__ = "groups"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    members: Mapped[list[User]] = relationship(secondary="group_members", order_by=User.id)


class GroupMember(Base):
    __tablename__ = "group_members"

    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)


class Expense(Base):
    __tablename__ = "expenses"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_expenses_amount_positive"),
        # Idempotency is enforced by the database so it also holds for concurrent requests.
        # NULL keys are distinct in PostgreSQL, so expenses without a key never conflict.
        UniqueConstraint("group_id", "idempotency_key", name="uq_expenses_group_idempotency"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"), index=True)
    description: Mapped[str] = mapped_column(String(200))
    paid_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    idempotency_key: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    shares: Mapped[list["ExpenseShare"]] = relationship(
        order_by="ExpenseShare.position", cascade="all, delete-orphan"
    )
    payer: Mapped[User] = relationship(foreign_keys=[paid_by])


class ExpenseShare(Base):
    __tablename__ = "expense_shares"
    __table_args__ = (CheckConstraint("share > 0", name="ck_shares_positive"),)

    expense_id: Mapped[int] = mapped_column(ForeignKey("expenses.id"), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    share: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    position: Mapped[int] = mapped_column(default=0)

    user: Mapped[User] = relationship()
