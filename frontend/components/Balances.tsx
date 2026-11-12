import type { Balances as BalancesData } from "@/lib/api";
import { formatSatang, fromApiString } from "@/lib/money";

export default function Balances({ data }: { data: BalancesData | null }) {
  return (
    <section className="rounded border p-4" aria-label="Balances">
      <h2 className="mb-2 text-lg font-semibold">Balances</h2>
      <ul className="space-y-1">
        {data?.balances.map(({ username, balance }) => {
          const satang = fromApiString(balance);
          const label = satang > 0 ? "is owed" : satang < 0 ? "owes" : "settled";
          const color =
            satang > 0 ? "text-green-700" : satang < 0 ? "text-red-600" : "text-gray-500";
          return (
            <li key={username} className="flex justify-between">
              <span>
                {username} <span className="text-sm text-gray-500">{label}</span>
              </span>
              <span className={`tabular-nums font-medium ${color}`}>
                {satang > 0 ? "+" : ""}
                {formatSatang(satang)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
