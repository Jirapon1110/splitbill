import type { Expense } from "@/lib/api";
import { formatSatang, fromApiString } from "@/lib/money";
import { formatWhen, titleCase } from "@/lib/ui";
import Avatar from "./Avatar";

interface Props {
  expenses: Expense[];
  user: string;
  onDelete: (expense: Expense) => void;
}

export default function ExpenseList({ expenses, user, onDelete }: Props) {
  return (
    <section className="card" aria-label="Expenses">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-xl font-semibold tracking-tight">Expenses</h2>
        {expenses.length > 0 && (
          <span className="text-xs text-mute">
            {expenses.length} {expenses.length === 1 ? "expense" : "expenses"}
          </span>
        )}
      </div>
      {expenses.length === 0 && (
        <div className="rounded-2xl bg-sage px-4 py-10 text-center">
          <p className="font-semibold">No expenses yet</p>
          <p className="mt-1 text-sm text-mute">Add the first one with the form above.</p>
        </div>
      )}
      <ul className="divide-y divide-sage">
        {expenses.map((expense) => (
          <li key={expense.id} className="animate-fade-up py-4 first:pt-0 last:pb-0">
            <div className="flex items-start gap-3">
              <Avatar name={expense.paid_by} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="truncate font-semibold">{expense.description}</span>
                  <span className="text-lg font-bold tabular-nums">
                    {formatSatang(fromApiString(expense.amount))}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-mute">
                  Paid by{" "}
                  <span className="font-medium text-body">
                    {expense.paid_by === user ? "you" : titleCase(expense.paid_by)}
                  </span>{" "}
                  · {formatWhen(expense.created_at)}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {expense.shares.map((s) => (
                    <span
                      key={s.username}
                      className="rounded-full bg-sage px-3 py-1 text-xs font-medium text-body"
                    >
                      {titleCase(s.username)} {formatSatang(fromApiString(s.share))}
                    </span>
                  ))}
                </div>
                {expense.paid_by === user && (
                  <button
                    className="-ml-3 mt-2 rounded-full px-3 py-1 text-sm font-semibold text-negative transition hover:bg-negative-pale active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-negative/20"
                    onClick={() => onDelete(expense)}
                    aria-label={`Delete ${expense.description}`}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
