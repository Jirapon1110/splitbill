# SplitBill

A shared-expense tracker: record costs split within a group and see each member's net balance,
accurate to the satang. FastAPI + PostgreSQL 16 backend, Next.js (TypeScript, Tailwind) frontend.

```
backend/    FastAPI app, Alembic migrations, pytest suite
frontend/   Next.js single page, vitest unit tests for the money maths
docker-compose.yml   API + PostgreSQL with one command
```

## Setup (from a fresh clone)

Prerequisites: Python 3.12+, Node 20+, and either Docker or a local PostgreSQL 16.

### 1. Database

Easiest, using Docker:

```bash
docker run -d --name splitbill-pg -e POSTGRES_USER=splitbill -e POSTGRES_PASSWORD=change-me \
  -e POSTGRES_DB=splitbill -p 5432:5432 postgres:16
```

Or use your own PostgreSQL 16 and create a `splitbill` database and user.

### 2. Backend

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate            # Windows;  source .venv/bin/activate on macOS/Linux
pip install -r requirements-dev.txt
cp .env.example .env              # set the password to match your database
alembic upgrade head              # creates the schema and seeds users and groups
uvicorn app.main:app --reload     # http://localhost:8000  (docs at /docs)
```

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local        # NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev                       # http://localhost:3000
```

### One-command alternative (API + database)

```bash
docker compose up --build         # API on :8000, migrations run on start
```

Then run the frontend as in step 3.

## Tests and linting

```bash
cd backend && pytest              # one command; creates and migrates the splitbill_test database
cd backend && ruff check . && ruff format --check .
cd frontend && npm test           # vitest: money maths, allocation and formatting
cd frontend && npm run lint
```

The backend tests need PostgreSQL running and reachable through `TEST_DATABASE_URL` (see
`backend/.env.example`). They run against real PostgreSQL rather than SQLite because the rules
depend on database behaviour: `NUMERIC` precision, the unique idempotency constraint and
concurrent inserts.

## API

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/groups` | Groups of the requesting user |
| GET | `/groups/{id}` | Group with members |
| POST | `/groups/{id}/expenses` | `Idempotency-Key` header optional; 201 on create, 200 on replay |
| GET | `/groups/{id}/expenses` | Newest first, deleted ones excluded |
| DELETE | `/groups/{id}/expenses/{eid}` | Payer only, soft delete, 204 |
| GET | `/groups/{id}/balances` | Positive = owed to the member; includes `total` (always `0.00`) |

The user is identified by the `X-User` header (`alice`, `bob`, `carol`, `dan`). Every error has the
shape `{"error": {"code": "...", "message": "..."}}`.

## Design decisions

**403 rather than 404 for non-members.** A request from a non-member for an existing group returns
403 with "Not a member of this group"; a group that does not exist returns 404. 404 would hide that
a group exists, but group ids here are sequential integers and not secret, so hiding gains little.
403 gives the frontend and the user an accurate, actionable message. If group ids became
guessable-sensitive (e.g. invite-only private groups), switching to 404 is a one-line change in
`services/groups.py`.

**Money storage.** Amounts are `NUMERIC(12,2)` in PostgreSQL and `Decimal` in Python; `float` is never
used. Amounts travel as JSON strings, and the request schema uses strict string types so a JSON
number such as `10.5` is rejected instead of silently going through a float. Amounts with more than
2 decimals (`"10.005"`), zero, negatives, non-numeric text and non-ASCII digits are rejected with 422.

**Allocating the remaining satang.** For an equal split the amount is converted to integer satang,
divided with `divmod`, and the remainder is handed out one satang at a time to members in the order
listed in the request (so 1,000.00 over alice, bob, carol gives 333.34 / 333.33 / 333.33). Exact
splits must add up to the amount to the satang, otherwise 422 with a message naming both totals.

**Zero-sum balances.** Each member's balance is `sum(amounts they paid) - sum(their shares)`,
computed from non-deleted expenses. Because every expense's shares add up exactly to its amount,
the group total is exactly 0.00 by construction, and the API returns `total` so this is checkable.

**Idempotency.** `UNIQUE (group_id, idempotency_key)` on `expenses` makes the database the
arbiter. The service first looks the key up (the cheap, common replay path), then inserts; if two
concurrent requests race past the lookup, the loser hits the unique constraint, rolls back and
returns the winner's expense. A test fires 8 parallel requests with one key and asserts a single
row. The same key in a different group is independent. The key is optional (PostgreSQL treats
NULLs as distinct).

**Soft delete and immutability.** There is no update endpoint. Delete sets `deleted_at`; the row and
its shares are retained and excluded from lists and balances. Only the payer may delete (403
otherwise); deleting an already-deleted expense returns 404.

**Layering.** `routers/` (HTTP, headers, response shapes) -> `services/` (business rules) ->
`repositories/` (SQL). Rules live only in services and `money.py`.

**Frontend decimal approach.** The browser never uses floating point for money. Inputs are parsed
into integer satang, summed and divided as integers, and formatted by hand with Thai-style grouping
(`1,000.00`). `lib/money.ts` mirrors the backend's allocation, so the preview matches the server
exactly: 100.00 over three members shows 33.34 / 33.33 / 33.33 and 0.1 + 0.2 shows 0.30 (both
covered by vitest). The form sends one `Idempotency-Key` per submission attempt, so retrying after
a network failure cannot create a duplicate expense.

## Assumptions

- Usernames are case-insensitive and normalised to lower case.
- The payer need not be part of the split (a payer who owes nothing is valid).
- Exact-split shares must each be greater than zero; to exclude a member, leave them out.
- Equal-split member lists must be non-empty and contain no duplicates.
- A repeated `Idempotency-Key` returns the original expense even if the new body differs; the key
  alone identifies the request. (A production API might return 409 for a mismatched body.)
- "Reverse chronological" is by creation time, newest first, ties broken by id.
- Expense `description` is required and may not be blank; maximum 200 characters.
- The user list in the frontend is the four seeded users; there is no authentication, per the brief.

## Known limitations and next steps

- Optional extensions (settle-up suggestions and the repayments endpoint) are not implemented.
  Next step: `GET /settle-up` by greedily matching largest creditor and debtor, and a `payments`
  table folded into balances.
- No pagination on the expense list.
- The idempotency key does not compare request bodies (see assumptions).
- The frontend has unit tests for the money maths but no component or end-to-end tests.
- `X-User` is trusted as given; real authentication would replace it.
- Single currency (THB); no expense categories or editing.

## Time spent

Roughly 3 hours with AI assistance: backend about 1.5 h, frontend about 1 h, tests, Docker and
documentation about 0.5 h.
