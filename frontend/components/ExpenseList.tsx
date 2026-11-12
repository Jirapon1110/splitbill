import type { Expense } from "@/lib/api";
import { formatSatang, fromApiString } from "@/lib/money";

interface Props {
  expenses: Expense[];
  user: string;
  onDelete: (expense: Expense) => void;
}

export default function ExpenseList({ expenses, user, onDelete }: Props) {
  return (
    <section className="rounded border p-4" aria-label="Expenses">
      <h2 className="mb-2 text-lg font-semibold">Expenses</h2>
      {expenses.length === 0 && <p className="text-gray-500">No expenses yet.</p>}
      <ul className="divide-y">
        {expenses.map((expense) => (
          <li key={expense.id} className="py-2">
            <div className="flex justify-between">
              <span className="font-medium">{expense.description}</span>
              <span className="tabular-nums">{formatSatang(fromApiString(expense.amount))}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>
                paid by {expense.paid_by} · split:{" "}
                {expense.shares
                  .map((s) => `${s.username} ${formatSatang(fromApiString(s.share))}`)
                  .join(", ")}
              </span>
              {expense.paid_by === user && (
                <button className="text-red-600 underline" onClick={() => onDelete(expense)}>
                  Delete
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
