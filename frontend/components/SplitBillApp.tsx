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
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-2xl font-bold">SplitBill</h1>

      <div className="flex flex-wrap gap-4">
        <label className="block">
          <span className="text-sm">User</span>
          <select
            className="mt-1 block rounded border p-2"
            value={user}
            onChange={(e) => setUser(e.target.value)}
          >
            {USERS.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm">Group</span>
          <select
            className="mt-1 block rounded border p-2"
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
        <p className="rounded bg-red-50 p-2 text-sm text-red-700" role="alert">
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
