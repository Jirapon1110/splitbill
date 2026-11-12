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

const USERS = ["alice", "bob", "carol", "dan"];

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

      <div className="card grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-body">Signed in as</span>
          <select
            className="field capitalize"
            value={user}
            onChange={(e) => setUser(e.target.value)}
          >
            {USERS.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-body">Group</span>
          <select
            className="field"
            value={groupId ?? ""}
            onChange={(e) => setGroupId(Number(e.target.value))}
            disabled={groups.length === 0}
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <p
          className="rounded-2xl border border-negative/30 bg-negative-pale px-4 py-3 text-sm font-medium text-negative"
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
