import type { Balances as BalancesData } from "@/lib/api";
import { formatSatang, fromApiString } from "@/lib/money";

function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="flex h-10 w-10 items-center justify-center rounded-full bg-lime text-sm font-bold uppercase text-lime-deep"
    >
      {name.slice(0, 1)}
    </span>
  );
}

export default function Balances({ data }: { data: BalancesData | null }) {
  return (
    <section className="card" aria-label="Balances">
      <h2 className="mb-4 text-xl font-semibold tracking-tight">Balances</h2>
      <ul className="space-y-3">
        {data?.balances.map(({ username, balance }) => {
          const satang = fromApiString(balance);
          const owed = satang > 0;
          const owes = satang < 0;
          return (
            <li key={username} className="flex items-center gap-3">
              <Avatar name={username} />
              <div className="flex-1">
                <p className="font-semibold capitalize">{username}</p>
                <p className="text-sm text-mute">
                  {owed ? "is owed" : owes ? "owes" : "all settled"}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-sm font-semibold tabular-nums ${
                  owed
                    ? "bg-lime-pale text-positive"
                    : owes
                      ? "bg-negative-pale text-negative"
                      : "bg-sage text-mute"
                }`}
              >
                {owed ? "+" : ""}
                {formatSatang(satang)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
