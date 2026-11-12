from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal

from fastapi.testclient import TestClient

from app.main import create_app
from tests.conftest import alice_dinner

ALICE = {"X-User": "alice"}
BOB = {"X-User": "bob"}


def _balances(client, headers=ALICE, group=1):
    body = client.get(f"/groups/{group}/balances", headers=headers).json()
    return {row["username"]: row["balance"] for row in body["balances"]}, body["total"]


# --- required cases -------------------------------------------------------------------------


def test_equal_split_of_100_among_three_balances_sum_to_zero(client):
    response = client.post(
        "/groups/1/expenses",
        headers=ALICE,
        json=alice_dinner(amount="100.00", description="Taxi"),
    )
    assert response.status_code == 201
    shares = {s["username"]: s["share"] for s in response.json()["shares"]}
    assert shares == {"alice": "33.34", "bob": "33.33", "carol": "33.33"}

    balances, total = _balances(client)
    assert balances == {"alice": "66.66", "bob": "-33.33", "carol": "-33.33"}
    assert total == "0.00"
    assert sum(Decimal(v) for v in balances.values()) == Decimal("0.00")


def test_brief_example_dinner_balances(client):
    client.post("/groups/1/expenses", headers=ALICE, json=alice_dinner())
    balances, total = _balances(client)
    assert balances == {"alice": "666.66", "bob": "-333.33", "carol": "-333.33"}
    assert total == "0.00"


def test_exact_split_not_summing_is_rejected(client):
    response = client.post(
        "/groups/1/expenses",
        headers=ALICE,
        json=alice_dinner(
            split={
                "type": "exact",
                "shares": {"alice": "500.00", "bob": "300.00", "carol": "100.00"},
            }
        ),
    )
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert "900.00" in error["message"] and "1000.00" in error["message"]
    assert client.get("/groups/1/expenses", headers=ALICE).json() == []


def test_exact_split_summing_is_accepted(client):
    response = client.post(
        "/groups/1/expenses",
        headers=ALICE,
        json=alice_dinner(
            split={
                "type": "exact",
                "shares": {"alice": "500.00", "bob": "300.00", "carol": "200.00"},
            }
        ),
    )
    assert response.status_code == 201


def test_amount_with_three_decimals_is_rejected(client):
    response = client.post("/groups/1/expenses", headers=ALICE, json=alice_dinner(amount="10.005"))
    assert response.status_code == 422
    assert "2 decimal places" in response.json()["error"]["message"]


def test_non_positive_and_numeric_amounts_are_rejected(client):
    for amount in ("0.00", "-1.00", 10.5):
        response = client.post(
            "/groups/1/expenses", headers=ALICE, json=alice_dinner(amount=amount)
        )
        assert response.status_code == 422, amount


def test_repeated_idempotency_key_creates_one_expense(client):
    headers = {**ALICE, "Idempotency-Key": "7f3c2a10-dinner-0001"}
    first = client.post("/groups/1/expenses", headers=headers, json=alice_dinner())
    second = client.post("/groups/1/expenses", headers=headers, json=alice_dinner())
    assert first.status_code == 201
    assert second.status_code == 200
    assert first.json()["id"] == second.json()["id"]
    assert len(client.get("/groups/1/expenses", headers=ALICE).json()) == 1


def test_idempotency_key_is_safe_under_concurrent_requests(client):
    headers = {**ALICE, "Idempotency-Key": "concurrent-key"}

    def post(_):
        with TestClient(create_app()) as local:
            return local.post("/groups/1/expenses", headers=headers, json=alice_dinner())

    with ThreadPoolExecutor(max_workers=8) as pool:
        responses = list(pool.map(post, range(8)))

    assert {r.status_code for r in responses} <= {200, 201}
    assert len({r.json()["id"] for r in responses}) == 1
    assert len(client.get("/groups/1/expenses", headers=ALICE).json()) == 1


def test_same_idempotency_key_in_different_groups_is_independent(client):
    headers = {"X-User": "bob", "Idempotency-Key": "shared-key"}
    one = client.post("/groups/1/expenses", headers=headers, json=alice_dinner(paid_by="bob"))
    two = client.post(
        "/groups/2/expenses",
        headers=headers,
        json={
            "description": "Lunch",
            "paid_by": "bob",
            "amount": "200.00",
            "split": {"type": "equal", "members": ["bob", "dan"]},
        },
    )
    assert one.status_code == two.status_code == 201
    assert one.json()["id"] != two.json()["id"]


def test_alice_can_neither_read_nor_write_group_2(client):
    for method, path, kwargs in [
        ("get", "/groups/2", {}),
        ("get", "/groups/2/expenses", {}),
        ("get", "/groups/2/balances", {}),
        (
            "post",
            "/groups/2/expenses",
            {
                "json": {
                    "description": "Sneaky",
                    "paid_by": "bob",
                    "amount": "10.00",
                    "split": {"type": "equal", "members": ["bob", "dan"]},
                }
            },
        ),
    ]:
        response = getattr(client, method)(path, headers=ALICE, **kwargs)
        assert response.status_code == 403, path
        assert response.json()["error"]["code"] == "forbidden"

    bob_expense = client.post(
        "/groups/2/expenses",
        headers={"X-User": "dan"},
        json={
            "description": "Lunch",
            "paid_by": "dan",
            "amount": "100.00",
            "split": {"type": "equal", "members": ["bob", "dan"]},
        },
    ).json()
    assert (
        client.delete(f"/groups/2/expenses/{bob_expense['id']}", headers=ALICE).status_code == 403
    )


def test_only_the_payer_can_delete(client):
    expense = client.post("/groups/1/expenses", headers=ALICE, json=alice_dinner()).json()
    url = f"/groups/1/expenses/{expense['id']}"

    forbidden = client.delete(url, headers=BOB)
    assert forbidden.status_code == 403
    assert len(client.get("/groups/1/expenses", headers=ALICE).json()) == 1

    assert client.delete(url, headers=ALICE).status_code == 204


# --- additional rules -----------------------------------------------------------------------


def test_delete_is_soft_and_excluded_from_balances(client):
    from sqlalchemy import text

    from app.db import get_engine

    expense = client.post("/groups/1/expenses", headers=ALICE, json=alice_dinner()).json()
    client.delete(f"/groups/1/expenses/{expense['id']}", headers=ALICE)

    assert client.get("/groups/1/expenses", headers=ALICE).json() == []
    balances, total = _balances(client)
    assert balances == {"alice": "0.00", "bob": "0.00", "carol": "0.00"}
    assert total == "0.00"
    with get_engine().connect() as conn:
        row = conn.execute(
            text("SELECT deleted_at FROM expenses WHERE id = :i"), {"i": expense["id"]}
        )
        assert row.scalar() is not None  # record retained and flagged
    assert client.delete(f"/groups/1/expenses/{expense['id']}", headers=ALICE).status_code == 404


def test_payer_and_split_members_must_belong_to_group(client):
    outsider_payer = client.post(
        "/groups/1/expenses", headers=ALICE, json=alice_dinner(paid_by="dan")
    )
    assert outsider_payer.status_code == 422
    outsider_split = client.post(
        "/groups/1/expenses",
        headers=ALICE,
        json=alice_dinner(split={"type": "equal", "members": ["alice", "dan"]}),
    )
    assert outsider_split.status_code == 422
    assert "dan" in outsider_split.json()["error"]["message"]


def test_expenses_listed_newest_first(client):
    for name in ("first", "second", "third"):
        client.post("/groups/1/expenses", headers=ALICE, json=alice_dinner(description=name))
    names = [e["description"] for e in client.get("/groups/1/expenses", headers=ALICE).json()]
    assert names == ["third", "second", "first"]


def test_groups_listing_and_auth(client):
    assert [g["id"] for g in client.get("/groups", headers=ALICE).json()] == [1]
    assert [g["id"] for g in client.get("/groups", headers=BOB).json()] == [1, 2]
    assert client.get("/groups").status_code == 401
    assert client.get("/groups", headers={"X-User": "mallory"}).status_code == 401
    assert client.get("/groups/99", headers=ALICE).status_code == 404
    detail = client.get("/groups/1", headers=ALICE).json()
    assert [m["username"] for m in detail["members"]] == ["alice", "bob", "carol"]


def test_blank_description_is_rejected(client):
    response = client.post(
        "/groups/1/expenses", headers=ALICE, json=alice_dinner(description="   ")
    )
    assert response.status_code == 422


def test_equal_split_too_small_for_each_member_is_rejected_cleanly(client):
    response = client.post("/groups/1/expenses", headers=ALICE, json=alice_dinner(amount="0.02"))
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
    assert "0.01" in response.json()["error"]["message"]
    assert client.get("/groups/1/expenses", headers=ALICE).json() == []


def test_unexpected_errors_still_return_the_json_error_shape(client):
    from app.main import create_app

    app = create_app()

    @app.get("/boom")
    def boom():
        raise RuntimeError("unexpected")

    with TestClient(app, raise_server_exceptions=False) as local:
        response = local.get("/boom")
    assert response.status_code == 500
    assert response.json() == {
        "error": {"code": "internal_error", "message": "Internal server error"}
    }


def test_out_of_range_ids_are_client_errors_not_500(client):
    assert client.get("/groups/99999999999", headers=ALICE).status_code == 422
    assert client.delete("/groups/1/expenses/99999999999", headers=ALICE).status_code == 422


def test_overlong_idempotency_key_is_rejected(client):
    headers = {**ALICE, "Idempotency-Key": "k" * 201}
    response = client.post("/groups/1/expenses", headers=headers, json=alice_dinner())
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_control_characters_in_description_are_rejected(client):
    response = client.post(
        "/groups/1/expenses", headers=ALICE, json=alice_dinner(description="a\u0000b")
    )
    assert response.status_code == 422
    assert "invalid characters" in response.json()["error"]["message"]
