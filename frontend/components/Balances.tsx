import type { Balances as BalancesData } from "@/lib/api";
import { formatSatang, fromApiString } from "@/lib/money";
import { titleCase } from "@/lib/ui";
import Avatar from "./Avatar";

export default function Balances({ data, user }: { data: BalancesData | null; user: string }) {
  return (
    <section className="card" aria-label="Balances">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-xl font-semibold tracking-tight">Balances</h2>
        <span className="text-xs text-mute">+ is owed · − owes</span>
      </div>
      <ul className="space-y-1">
        {data?.balances.map(({ username, balance }) => {
          const satang = fromApiString(balance);
          const owed = satang > 0;
          const owes = satang < 0;
          return (
            <li
              key={username}
              className={`-mx-3 flex items-center gap-3 rounded-2xl px-3 py-2 transition-colors ${
                username === user ? "bg-canvas" : "hover:bg-canvas/60"
              }`}
            >
              <Avatar name={username} />
              <div className="flex-1">
                <p className="font-semibold">
                  {titleCase(username)}
                  {username === user && (
                    <span className="ml-2 rounded-full bg-ink px-2 py-0.5 align-middle text-[11px] font-semibold text-lime">
                      You
                    </span>
                  )}
                </p>
                <p className="text-sm text-mute">
                  {owed ? "is owed" : owes ? "owes" : "all settled"}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-sm font-semibold tabular-nums transition-colors duration-300 ${
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
