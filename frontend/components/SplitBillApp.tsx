"use client";

import { useCallback, useEffect, useState } from "react";
import {
  api,
  friendlyError,
  type Balances as BalancesData,
  type Expense,
  type Group,
  type GroupDetail,
} from "@/lib/api";
import Balances from "./Balances";
import ExpenseForm from "./ExpenseForm";
import ExpenseList from "./ExpenseList";
import Select from "./Select";

const USERS = ["alice", "bob", "carol", "dan"];

const titleCase = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

export default function SplitBillApp() {
  const [user, setUser] = useState(USERS[0]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<BalancesData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load only the selected user's groups.
  useEffect(() => {
    let cancelled = false;
    setGroups([]);
    setGroupId(null);
    setGroup(null);
    setError(null);
    api
      .groups(user)
      .then((list) => {
        if (cancelled) return;
        setGroups(list);
        setGroupId(list[0]?.id ?? null);
      })
      .catch((e) => !cancelled && setError(friendlyError(e)));
    return () => {
      cancelled = true;
    };
  }, [user]);

  const refresh = useCallback(async () => {
    if (groupId === null) return;
    try {
      const [detail, list, bal] = await Promise.all([
        api.group(user, groupId),
        api.expenses(user, groupId),
        api.balances(user, groupId),
      ]);
      setGroup(detail);
      setExpenses(list);
      setBalances(bal);
    } catch (e) {
      setError(friendlyError(e));
    }
  }, [user, groupId]);

  useEffect(() => {
    setGroup(null);
    setExpenses([]);
    setBalances(null);
    void refresh();
  }, [refresh]);

  async function remove(expense: Expense) {
    if (groupId === null) return;
    try {
      await api.deleteExpense(user, groupId, expense.id);
      setError(null);
      await refresh();
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  return (
    <main className="mx-auto max-w-2xl space-y-5 px-4 py-8 sm:py-12">
      <header className="space-y-1">
        <h1 className="text-5xl font-black tracking-tight text-ink sm:text-6xl">SplitBill</h1>
        <p className="text-body">Share costs with your group and see who owes whom.</p>
      </header>

      {/* z-30 keeps the open dropdown above the cards that follow (each animates in its own layer). */}
      <div className="card relative z-30 grid gap-4 sm:grid-cols-2">
        <Select
          label="Signed in as"
          value={user}
          onChange={setUser}
          options={USERS.map((name) => ({ value: name, label: titleCase(name) }))}
        />
        <Select
          label="Group"
          value={groupId === null ? "" : String(groupId)}
          onChange={(value) => setGroupId(Number(value))}
          disabled={groups.length === 0}
          placeholder="No groups"
          options={groups.map((g) => ({ value: String(g.id), label: g.name }))}
        />
      </div>

      {error && (
        <p
          className="animate-fade-up rounded-2xl border border-negative/30 bg-negative-pale px-4 py-3 text-sm font-medium text-negative"
          role="alert"
        >
          {error}
        </p>
      )}

      {group && (
        <>
          <Balances data={balances} />
          <ExpenseForm key={`${user}-${group.id}`} user={user} group={group} onCreated={refresh} />
          <ExpenseList expenses={expenses} user={user} onDelete={remove} />
        </>
      )}
    </main>
  );
}
