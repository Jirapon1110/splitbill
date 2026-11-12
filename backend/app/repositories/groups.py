from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Group, GroupMember, User


def get_user_by_username(session: Session, username: str) -> User | None:
    return session.scalar(select(User).where(User.username == username))


def list_groups_for_user(session: Session, user: User) -> list[Group]:
    stmt = (
        select(Group)
        .join(GroupMember, GroupMember.group_id == Group.id)
        .where(GroupMember.user_id == user.id)
        .order_by(Group.id)
    )
    return list(session.scalars(stmt))


def get_group(session: Session, group_id: int) -> Group | None:
    return session.get(Group, group_id)
