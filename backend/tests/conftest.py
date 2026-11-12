"""Test setup: a real PostgreSQL database (needed to exercise constraints and concurrency).

Run with `pytest` from backend/. The test database is created and migrated automatically.
"""

import os
from pathlib import Path

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from alembic import command
from alembic.config import Config

BACKEND_DIR = Path(__file__).resolve().parent.parent
DEFAULT_TEST_URL = "postgresql+psycopg://splitbill:splitbill@localhost:5432/splitbill_test"


def _test_database_url() -> str:
    if "TEST_DATABASE_URL" in os.environ:
        return os.environ["TEST_DATABASE_URL"]
    env_file = BACKEND_DIR / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if line.startswith("TEST_DATABASE_URL="):
                return line.split("=", 1)[1].strip()
    return DEFAULT_TEST_URL


TEST_URL = _test_database_url()
# Must be set before `app` is imported so the app talks to the test database.
os.environ["DATABASE_URL"] = TEST_URL
os.environ["ALEMBIC_DATABASE_URL"] = TEST_URL


@pytest.fixture(scope="session", autouse=True)
def _database():
    url = make_url(TEST_URL)
    admin = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        exists = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": url.database}
        ).scalar()
        if not exists:
            conn.execute(text(f'CREATE DATABASE "{url.database}"'))
    admin.dispose()

    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    command.upgrade(config, "head")
    yield


@pytest.fixture(autouse=True)
def _clean_expenses():
    from app.db import get_engine

    with get_engine().begin() as conn:
        conn.execute(text("TRUNCATE expense_shares, expenses RESTART IDENTITY CASCADE"))
    yield


@pytest.fixture
def client():
    from fastapi.testclient import TestClient

    from app.main import create_app

    with TestClient(create_app()) as test_client:
        yield test_client


def alice_dinner(**overrides):
    payload = {
        "description": "Dinner at the night market",
        "paid_by": "alice",
        "amount": "1000.00",
        "split": {"type": "equal", "members": ["alice", "bob", "carol"]},
    }
    payload.update(overrides)
    return payload
