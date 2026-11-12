"use client";

import { useMemo, useRef, useState } from "react";
import { api, friendlyError, type ExpensePayload, type GroupDetail } from "@/lib/api";
import {
  formatSatang,
  parseAmount,
  splitEqually,
  sum,
  toApiString,
  type Satang,
} from "@/lib/money";

interface Props {
  user: string;
  group: GroupDetail;
  onCreated: () => void;
}

type SplitType = "equal" | "exact";

export default function ExpenseForm({ user, group, onCreated }: Props) {
  const usernames = group.members.map((m) => m.username);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [payer, setPayer] = useState(usernames.includes(user) ? user : usernames[0]);
  const [splitType, setSplitType] = useState<SplitType>("equal");
  const [selected, setSelected] = useState<string[]>(usernames);
  const [exact, setExact] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // One key per logical submission: a retry after a network failure cannot create a duplicate.
  const idempotencyKey = useRef(crypto.randomUUID());

  const parsed = parseAmount(amount);
  const total: Satang | null = parsed.ok ? parsed.satang : null;

  const preview = useMemo(() => {
    if (splitType === "equal") {
      const members = usernames.filter((name) => selected.includes(name));
      const shares = total === null ? [] : splitEqually(total, members.length);
      return { entries: members.map((name, i) => ({ name, share: shares[i] ?? null })), invalid: false };
    }
    let invalid = false;
    const entries = usernames.map((name) => {
      const raw = exact[name] ?? "";
      if (raw.trim() === "") return { name, share: null as Satang | null };
      const result = parseAmount(raw);
      if (!result.ok) {
        invalid = true;
        return { name, share: null };
      }
      return { name, share: result.satang };
    });
    return { entries, invalid };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitType, selected, exact, total, group]);

  const allocated = sum(preview.entries.map((e) => e.share ?? 0));
  const unallocated = total === null ? null : total - allocated;

  const amountProblem = (() => {
    if (amount.trim() === "" || parsed.ok) return null;
    return parsed.reason === "too_many_decimals"
      ? "Amounts can have at most 2 decimal places."
      : "Enter an amount greater than zero, such as 1,000.00.";
  })();

  // The backend rejects equal splits that would give a member less than 0.01.
  const tooSmall =
    splitType === "equal" &&
    total !== null &&
    preview.entries.length > 0 &&
    preview.entries.some((e) => e.share === 0);

  const canSubmit =
    !submitting &&
    description.trim() !== "" &&
    total !== null &&
    (splitType === "equal"
      ? selected.length > 0 && !tooSmall
      : !preview.invalid && unallocated === 0 && preview.entries.some((e) => e.share));

  function toggleMember(name: string) {
    setSelected((current) =>
      current.includes(name) ? current.filter((n) => n !== name) : [...current, name],
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit || total === null) return;
    const split: ExpensePayload["split"] =
      splitType === "equal"
        ? { type: "equal", members: usernames.filter((n) => selected.includes(n)) }
        : {
            type: "exact",
            shares: Object.fromEntries(
              preview.entries.filter((e) => e.share).map((e) => [e.name, toApiString(e.share!)]),
            ),
          };
    setSubmitting(true);
    setError(null);
    try {
      await api.createExpense(
        user,
        group.id,
        { description: description.trim(), paid_by: payer, amount: toApiString(total), split },
        idempotencyKey.current,
      );
      idempotencyKey.current = crypto.randomUUID();
      setDescription("");
      setAmount("");
      setExact({});
      onCreated();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded border p-4" aria-label="Add expense">
      <h2 className="text-lg font-semibold">Add expense</h2>

      <label className="block">
        <span className="text-sm">Description</span>
        <input
          className="mt-1 w-full rounded border p-2"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm">Amount (THB)</span>
          <input
            className="mt-1 w-full rounded border p-2"
            inputMode="decimal"
            placeholder="1,000.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={amountProblem !== null}
          />
          {amountProblem && <span className="text-sm text-red-600">{amountProblem}</span>}
        </label>
        <label className="block">
          <span className="text-sm">Paid by</span>
          <select
            className="mt-1 w-full rounded border p-2"
            value={payer}
            onChange={(e) => setPayer(e.target.value)}
          >
            {usernames.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
      </div>

      <fieldset>
        <legend className="text-sm">Split</legend>
        <div className="mt-1 flex gap-4">
          {(["equal", "exact"] as const).map((type) => (
            <label key={type} className="flex items-center gap-1">
              <input
                type="radio"
                name="split-type"
                checked={splitType === type}
                onChange={() => setSplitType(type)}
              />
              {type === "equal" ? "Equal" : "Exact amounts"}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2" aria-label="Split preview">
        {splitType === "equal"
          ? usernames.map((name) => {
              const entry = preview.entries.find((e) => e.name === name);
              return (
                <div key={name} className="flex items-center justify-between">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selected.includes(name)}
                      onChange={() => toggleMember(name)}
                    />
                    {name}
                  </label>
                  <span className="tabular-nums">
                    {entry?.share != null ? formatSatang(entry.share) : "—"}
                  </span>
                </div>
              );
            })
          : usernames.map((name) => (
              <div key={name} className="flex items-center justify-between gap-4">
                <span>{name}</span>
                <input
                  className="w-32 rounded border p-1 text-right tabular-nums"
                  inputMode="decimal"
                  placeholder="0.00"
                  aria-label={`Share for ${name}`}
                  value={exact[name] ?? ""}
                  onChange={(e) => setExact({ ...exact, [name]: e.target.value })}
                />
              </div>
            ))}
      </div>

      {tooSmall && (
        <p className="text-sm text-red-600" role="status">
          This amount is too small to split among {preview.entries.length} members (each share must
          be at least 0.01).
        </p>
      )}

      {splitType === "exact" && (
        <p
          className={`text-sm ${unallocated === 0 ? "text-green-700" : "text-red-600"}`}
          role="status"
        >
          {unallocated === null
            ? "Enter the total amount first."
            : preview.invalid
              ? "One of the shares is not a valid amount."
              : unallocated === 0
                ? "Fully allocated."
                : `Unallocated: ${formatSatang(unallocated)}${unallocated < 0 ? " (over-allocated)" : ""}`}
        </p>
      )}

      {error && (
        <p className="rounded bg-red-50 p-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="rounded bg-blue-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? "Saving…" : "Add expense"}
      </button>
    </form>
  );
}
