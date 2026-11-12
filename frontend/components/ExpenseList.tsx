import type { Expense } from "@/lib/api";
import { formatSatang, fromApiString } from "@/lib/money";

interface Props {
  expenses: Expense[];
  user: string;
  onDelete: (expense: Expense) => void;
}

export default function ExpenseList({ expenses, user, onDelete }: Props) {
  return (
    <section className="card" aria-label="Expenses">
      <h2 className="mb-4 text-xl font-semibold tracking-tight">Expenses</h2>
      {expenses.length === 0 && (
        <div className="rounded-2xl bg-sage px-4 py-8 text-center text-mute">
          No expenses yet. Add the first one above.
        </div>
      )}
      <ul className="divide-y divide-sage">
        {expenses.map((expense) => (
          <li key={expense.id} className="animate-fade-up py-4 first:pt-0 last:pb-0">
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-semibold">{expense.description}</span>
              <span className="text-lg font-bold tabular-nums">
                {formatSatang(fromApiString(expense.amount))}
              </span>
            </div>
            <p className="mt-1 text-sm text-mute">
              Paid by <span className="font-medium capitalize text-body">{expense.paid_by}</span>
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {expense.shares.map((s) => (
                <span
                  key={s.username}
                  className="rounded-full bg-sage px-3 py-1 text-xs font-medium capitalize text-body"
                >
                  {s.username} {formatSatang(fromApiString(s.share))}
                </span>
              ))}
            </div>
            {expense.paid_by === user && (
              <button
                className="-ml-3 mt-2 rounded-full px-3 py-1 text-sm font-semibold text-negative transition hover:bg-negative-pale active:scale-95"
                onClick={() => onDelete(expense)}
              >
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
