"""seed users and groups

Revision ID: 0002
Revises: 0001
"""

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

USERS = ["alice", "bob", "carol", "dan"]
GROUPS = {
    1: ("Chiang Mai trip", ["alice", "bob", "carol"]),
    2: ("Office lunch", ["bob", "dan"]),
}


def upgrade() -> None:
    conn = op.get_bind()
    for index, username in enumerate(USERS, start=1):
        conn.execute(
            sa.text("INSERT INTO users (id, username) VALUES (:id, :username)"),
            {"id": index, "username": username},
        )
    for group_id, (name, members) in GROUPS.items():
        conn.execute(
            sa.text("INSERT INTO groups (id, name) VALUES (:id, :name)"),
            {"id": group_id, "name": name},
        )
        for member in members:
            conn.execute(
                sa.text(
                    "INSERT INTO group_members (group_id, user_id) "
                    "SELECT :gid, id FROM users WHERE username = :username"
                ),
                {"gid": group_id, "username": member},
            )
    # Keep the serial sequences ahead of the explicit ids inserted above.
    conn.execute(sa.text("SELECT setval('users_id_seq', (SELECT max(id) FROM users))"))
    conn.execute(sa.text("SELECT setval('groups_id_seq', (SELECT max(id) FROM groups))"))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("DELETE FROM group_members"))
    conn.execute(sa.text("DELETE FROM groups"))
    conn.execute(sa.text("DELETE FROM users"))
