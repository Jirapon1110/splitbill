from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StrictStr


class EqualSplit(BaseModel):
    type: Literal["equal"]
    members: list[StrictStr]


class ExactSplit(BaseModel):
    type: Literal["exact"]
    shares: dict[str, StrictStr]


Split = Annotated[EqualSplit | ExactSplit, Field(discriminator="type")]


class ExpenseCreate(BaseModel):
    # amount is a StrictStr so JSON numbers (floats) are rejected outright.
    description: StrictStr = Field(min_length=1, max_length=200)
    paid_by: StrictStr
    amount: StrictStr
    split: Split


class ShareOut(BaseModel):
    username: str
    share: str


class ExpenseOut(BaseModel):
    id: int
    group_id: int
    description: str
    paid_by: str
    amount: str
    shares: list[ShareOut]
    created_at: datetime


class MemberOut(BaseModel):
    id: int
    username: str


class GroupOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class GroupDetailOut(GroupOut):
    members: list[MemberOut]


class BalanceOut(BaseModel):
    username: str
    balance: str


class BalancesOut(BaseModel):
    group_id: int
    balances: list[BalanceOut]
    total: str
