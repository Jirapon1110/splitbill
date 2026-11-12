# AI_NOTES

## Tools used

- **Claude Code (Claude Sonnet 5.5)**, used for the whole submission:
  - backend: schema and Alembic migrations, FastAPI routing, services, repositories, money maths
  - tests: the pytest suite and the vitest suite
  - frontend: the Next.js page, API client, live split preview, error messages
  - Docker Compose, README and this file

## Effective prompts

1. The overall brief, given as a single goal listing every business rule, the required test cases
   and the "done when" conditions (tests pass, linters clean, runs locally, no secrets, incremental
   commits). Stating the acceptance criteria up front made the model build the test list from the
   brief instead of inventing its own.
2. "Why use Docker, can't it run on the machine directly?" led to checking what was actually
   installed (no PostgreSQL on the machine, even though `PATH` listed its folder) and to the
   `DATABASE_URL`-only configuration, so either a Docker or a local database works.

## Incorrect or unsafe AI output, and how it was caught

1. **Amount validation accepted non-ASCII digits.** The first version of `parse_amount` used the
   regex `^\d+(\.\d+)?$`. In Python, `\d` matches digits from other scripts, so `"٣.00"` (Arabic-Indic
   three) was accepted and silently converted to `3.00`. That is a money-validation hole, not a
   style issue. *Detected* during my own review of the diff against the "reject malformed amounts"
   rule, by asking what else `\d` matches. *Corrected* by writing a failing test first
   (`test_parse_amount_rejects_invalid` with `"٣.00"`), then switching to `[0-9]`.
2. **Whitespace-only descriptions passed validation.** `min_length=1` accepted `"   "`, which was
   then stripped and stored as an empty string. *Detected* in the same review pass; fixed by
   validating after stripping, with `test_blank_description_is_rejected` failing before the fix.
3. **An equal split of a tiny amount crashed with a 500.** `0.01` split three ways gives shares of
   0.01, 0.00 and 0.00; the database `CHECK (share > 0)` constraint rejected the zero shares and the
   API returned an unformatted 500, breaking the "consistent JSON errors" rule. The unit tests did
   not cover it. *Detected* by a live probe script that sent about 60 edge-case requests to the
   running API (a non-JSON 500 body crashed the probe itself). *Corrected* by a failing test first,
   then a 422 with a clear message in the service, the same rule mirrored in the frontend preview
   (submit disabled with an explanation), and a catch-all handler so any unexpected error still
   returns `{"error": {...}}`.
4. **Three UI defects that compiled, linted and type-checked cleanly.** Found only by driving the
   real page in a browser while adding a delete-confirmation dialog, toasts and coloured avatars:
   (a) the dialog's `fixed inset-0` overlay sat inside `<main className="space-y-5">`, whose sibling
   margin pushed it down 20px, so clicking the top strip did not dismiss it; (b) switching user
   re-fetched the *previous* user's group id, producing six 403 responses in the console; (c) the
   avatar colour classes lived in `lib/ui.ts`, a folder Tailwind was not scanning, so the colours
   silently did not exist. *Detected* by Playwright checks (overlay hit-test, console errors,
   screenshots). *Corrected* by moving the dialog and toast outside `<main>`, tracking which user
   the loaded groups belong to, and adding `lib/` to Tailwind's `content` paths.
5. **A large shell heredoc silently half-applied.** The model wrote seven source files in one
   shell command; the shell failed to parse it and only some files existed afterwards. *Detected*
   with `ls` and `wc -l`, which showed missing and present files that did not match what was
   reported. *Corrected* by recreating the missing files individually and confirming each existed
   before running anything.

## Review process before each commit

- Read the diff for every file rather than trusting the summary, checking each against the numbered
  business rules in the brief (exact allocation, zero-sum, precision, access, membership,
  idempotency, immutability).
- Ran the full pytest suite against a real PostgreSQL 16 database, `ruff check` and `ruff format`
  for the backend, and `npm run lint`, `tsc --noEmit` and `npm test` for the frontend. Nothing was
  committed with a failing check.
- For bug fixes, wrote the failing test first, then the fix, so the test is proven to detect the
  regression.
- Ran a live probe against the running API (invalid amounts, bad splits, membership, access,
  idempotency replays, 16 concurrent requests, delete rules, 60 random equal splits checked to the
  satang). This is what found item 3.
- Verified behaviour end to end by hand: the brief's dinner example through the live API produced
  333.34 / 333.33 / 333.33 and balances +666.66 / -333.33 / -333.33 summing to 0.00; alice's
  access to group 2 returned 403; Docker Compose brought up the API and database with one command.
- Committed in small, single-purpose steps (migrations, money maths, API, tests, frontend library,
  frontend page, fixes, Docker) so the history shows how the work was built.
