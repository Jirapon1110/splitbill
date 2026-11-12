"use client";

import { useMemo, useRef, useState } from "react";
import { titleCase } from "@/lib/ui";
import Avatar from "./Avatar";
import Select from "./Select";
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
  const descriptionInput = useRef<HTMLInputElement>(null);

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

  // Tell the user why the button is disabled instead of leaving them guessing.
  const blockedReason = (() => {
    if (canSubmit || submitting) return null;
    if (description.trim() === "") return "Add a description to continue.";
    if (total === null) return "Enter an amount to continue.";
    if (splitType === "equal") {
      if (selected.length === 0) return "Select at least one member to split with.";
      if (tooSmall) return "The amount is too small to split that many ways.";
      return null;
    }
    if (preview.invalid) return "Fix the invalid share amount to continue.";
    if (unallocated !== 0) return "Allocate the full amount to continue.";
    return "Enter at least one share.";
  })();

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
      descriptionInput.current?.focus();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSubmitting(false);
    }
  }

  const exactOk = unallocated === 0 && !preview.invalid;

  return (
    <form onSubmit={submit} className="card relative z-20 space-y-5" aria-label="Add expense">
      <h2 className="text-xl font-semibold tracking-tight">Add expense</h2>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-body">Description</span>
        <input
          ref={descriptionInput}
          className="field"
          placeholder="Dinner at the night market"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-body">Amount (THB)</span>
          <input
            className="field text-lg font-semibold tabular-nums"
            inputMode="decimal"
            placeholder="1,000.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onBlur={() => parsed.ok && setAmount(formatSatang(parsed.satang))}
            aria-invalid={amountProblem !== null}
          />
          {amountProblem && <span className="mt-1 block text-sm text-negative">{amountProblem}</span>}
        </label>
        <Select
          label="Paid by"
          value={payer}
          onChange={setPayer}
          options={usernames.map((name) => ({
            value: name,
            label: titleCase(name),
          }))}
        />
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-body">Split</legend>
        <div className="inline-flex h-12 items-center rounded-full bg-sage p-1" role="radiogroup">
          {(["equal", "exact"] as const).map((type) => (
            <label
              key={type}
              className={`flex h-10 cursor-pointer items-center rounded-full px-5 text-sm font-semibold transition-all duration-200 active:scale-95 ${
                splitType === type ? "bg-ink text-lime shadow-card" : "text-body hover:text-ink"
              }`}
            >
              <input
                type="radio"
                name="split-type"
                className="sr-only"
                checked={splitType === type}
                onChange={() => setSplitType(type)}
              />
              {type === "equal" ? "Equal" : "Exact amounts"}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2 rounded-2xl bg-canvas p-4" aria-label="Split preview">
        {splitType === "equal"
          ? usernames.map((name) => {
              const entry = preview.entries.find((e) => e.name === name);
              const on = selected.includes(name);
              return (
                <div key={name} className="flex items-center justify-between">
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-[#163300]"
                      checked={on}
                      onChange={() => toggleMember(name)}
                    />
                    <Avatar name={name} size="sm" />
                    <span className={`font-medium ${on ? "" : "text-mute"}`}>{titleCase(name)}</span>
                  </label>
                  <span className="font-semibold tabular-nums">
                    {entry?.share != null ? formatSatang(entry.share) : "—"}
                  </span>
                </div>
              );
            })
          : usernames.map((name) => (
              <div key={name} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-3 font-medium">
                  <Avatar name={name} size="sm" />
                  {titleCase(name)}
                </span>
                <input
                  className="field field-sm"
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
        <p className="text-sm font-medium text-negative" role="status">
          This amount is too small to split among {preview.entries.length} members (each share must
          be at least 0.01).
        </p>
      )}

      {splitType === "exact" && total !== null && (
        <div
          className="h-2 overflow-hidden rounded-full bg-sage"
          role="progressbar"
          aria-label="Amount allocated"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(100, Math.round((allocated / total) * 100))}
        >
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              allocated > total ? "bg-negative" : "bg-lime"
            }`}
            style={{ width: `${Math.min(100, (allocated / total) * 100)}%` }}
          />
        </div>
      )}

      {splitType === "exact" && (
        <p
          className={`block w-fit rounded-full px-4 py-1.5 text-sm font-semibold transition-colors duration-200 ${
            exactOk ? "bg-lime-pale text-positive" : "bg-negative-pale text-negative"
          }`}
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
        <p
          className="animate-shake rounded-2xl border border-negative/30 bg-negative-pale px-4 py-3 text-sm font-medium text-negative"
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <button type="submit" disabled={!canSubmit} className="btn-primary w-full sm:w-auto">
          {submitting ? "Saving…" : "Add expense"}
        </button>
        {blockedReason && <p className="text-sm text-mute">{blockedReason}</p>}
      </div>
    </form>
  );
}
