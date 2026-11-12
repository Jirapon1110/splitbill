from sqlalchemy.orm import Session

from app.errors import Forbidden, NotFound, Unauthorized
from app.models import Group, User
from app.repositories import groups as repo


def current_user(session: Session, username: str | None) -> User:
    if not username:
        raise Unauthorized("The X-User header is required")
    user = repo.get_user_by_username(session, username.strip().lower())
    if user is None:
        raise Unauthorized(f"Unknown user '{username}'")
    return user


def groups_for(session: Session, user: User) -> list[Group]:
    return repo.list_groups_for_user(session, user)


def get_group_for_member(session: Session, user: User, group_id: int) -> Group:
    """Return the group if it exists and the user belongs to it.

    A missing group is 404; an existing group the user is not in is 403 (see README).
    """
    group = repo.get_group(session, group_id)
    if group is None:
        raise NotFound("Group not found")
    if user.id not in {member.id for member in group.members}:
        raise Forbidden("Not a member of this group")
    return group
