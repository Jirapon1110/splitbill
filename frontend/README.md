# SplitBill frontend

Single-page Next.js (App Router), TypeScript and Tailwind CSS client for the SplitBill API.
Setup, design decisions and the full project overview are in the [root README](../README.md).

```bash
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev                  # http://localhost:3000  (the API must be running)
npm test                     # vitest: integer-satang money maths
npm run lint                 # ESLint
```

## Layout

- `lib/money.ts` — all money maths in integer satang (no floats); mirrors the backend's allocation.
- `lib/api.ts` — typed API client and plain-language error messages.
- `components/` — `SplitBillApp` (page state), `ExpenseForm` (live split preview), `Balances`,
  `ExpenseList`, `Select` (accessible dropdown).
