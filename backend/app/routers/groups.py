from decimal import Decimal

from fastapi import APIRouter, Depends, Header, Response, status
from sqlalchemy.orm import Session

from app.db import get_session
from app.models import Expense, User
from app.schemas import (
    BalanceOut,
    BalancesOut,
    ExpenseCreate,
    ExpenseOut,
    GroupDetailOut,
    GroupOut,
    MemberOut,
    ShareOut,
)
from app.services import expenses as expense_service
from app.services import groups as group_service

router = APIRouter()


def get_current_user(
    x_user: str | None = Header(default=None), session: Session = Depends(get_session)
) -> User:
    return group_service.current_user(session, x_user)


def _expense_out(expense: Expense) -> ExpenseOut:
    return ExpenseOut(
        id=expense.id,
        group_id=expense.group_id,
        description=expense.description,
        paid_by=expense.payer.username,
        amount=f"{expense.amount:.2f}",
        shares=[ShareOut(username=s.user.username, share=f"{s.share:.2f}") for s in expense.shares],
        created_at=expense.created_at,
    )


@router.get("/groups", response_model=list[GroupOut])
def list_groups(user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    return group_service.groups_for(session, user)


@router.get("/groups/{group_id}", response_model=GroupDetailOut)
def get_group(
    group_id: int, user: User = Depends(get_current_user), session: Session = Depends(get_session)
):
    group = group_service.get_group_for_member(session, user, group_id)
    return GroupDetailOut(
        id=group.id,
        name=group.name,
        members=[MemberOut(id=m.id, username=m.username) for m in group.members],
    )


@router.post("/groups/{group_id}/expenses", response_model=ExpenseOut, status_code=201)
def create_expense(
    group_id: int,
    data: ExpenseCreate,
    response: Response,
    idempotency_key: str | None = Header(default=None),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    group = group_service.get_group_for_member(session, user, group_id)
    expense, created = expense_service.create_expense(session, group, data, idempotency_key)
    if not created:
        response.status_code = status.HTTP_200_OK
    return _expense_out(expense)


@router.get("/groups/{group_id}/expenses", response_model=list[ExpenseOut])
def list_expenses(
    group_id: int, user: User = Depends(get_current_user), session: Session = Depends(get_session)
):
    group = group_service.get_group_for_member(session, user, group_id)
    return [_expense_out(e) for e in expense_service.list_expenses(session, group)]


@router.delete("/groups/{group_id}/expenses/{expense_id}", status_code=204)
def delete_expense(
    group_id: int,
    expense_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    group = group_service.get_group_for_member(session, user, group_id)
    expense_service.delete_expense(session, group, user, expense_id)
    return Response(status_code=204)


@router.get("/groups/{group_id}/balances", response_model=BalancesOut)
def get_balances(
    group_id: int, user: User = Depends(get_current_user), session: Session = Depends(get_session)
):
    group = group_service.get_group_for_member(session, user, group_id)
    rows = expense_service.balances(session, group)
    total = sum((value for _, value in rows), Decimal("0.00"))
    return BalancesOut(
        group_id=group.id,
        balances=[BalanceOut(username=name, balance=f"{value:.2f}") for name, value in rows],
        total=f"{total:.2f}",
    )
