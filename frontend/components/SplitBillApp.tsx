"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  friendlyError,
  type Balances as BalancesData,
  type Expense,
  type Group,
  type GroupDetail,
} from "@/lib/api";
import { formatSatang, fromApiString } from "@/lib/money";
import { titleCase } from "@/lib/ui";
import Balances from "./Balances";
import ConfirmDialog from "./ConfirmDialog";
import ExpenseForm from "./ExpenseForm";
import ExpenseList from "./ExpenseList";
import Select from "./Select";
import Toast, { type ToastData } from "./Toast";

const USERS = ["alice", "bob", "carol", "dan"];

function Skeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading group">
      {[140, 320].map((height) => (
        <div
          key={height}
          className="animate-pulse rounded-card bg-white/70 shadow-card"
          style={{ height }}
        />
      ))}
    </div>
  );
}

export default function SplitBillApp() {
  const [user, setUser] = useState(USERS[0]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  // Which user the loaded groups belong to; stops us requesting a stale group id for a new user.
  const [groupsOwner, setGroupsOwner] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<BalancesData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);

  // Only the most recent refresh may update state, so a slow response for a previous user or
  // group can never overwrite the current one.
  const latestRefresh = useRef(0);

  const notify = (message: string) => setToast({ id: Date.now(), message });
  const closeToast = useCallback(() => setToast(null), []);
  const cancelDelete = useCallback(() => setPendingDelete(null), []);

  // Load only the selected user's groups.
  useEffect(() => {
    let cancelled = false;
    setGroups([]);
    setGroupsLoaded(false);
    setGroupsOwner(null);
    setGroupId(null);
    setGroup(null);
    setError(null);
    api
      .groups(user)
      .then((list) => {
        if (cancelled) return;
        setGroups(list);
        setGroupId(list[0]?.id ?? null);
        setGroupsOwner(user);
        setGroupsLoaded(true);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(friendlyError(e));
        setGroupsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const refresh = useCallback(async () => {
    if (groupId === null || groupsOwner !== user) return;
    const stamp = ++latestRefresh.current;
    try {
      const [detail, list, bal] = await Promise.all([
        api.group(user, groupId),
        api.expenses(user, groupId),
        api.balances(user, groupId),
      ]);
      if (stamp !== latestRefresh.current) return;
      setGroup(detail);
      setExpenses(list);
      setBalances(bal);
    } catch (e) {
      if (stamp === latestRefresh.current) setError(friendlyError(e));
    }
  }, [user, groupId, groupsOwner]);

  useEffect(() => {
    setGroup(null);
    setExpenses([]);
    setBalances(null);
    setError(null);
    void refresh();
  }, [refresh]);

  async function confirmDelete() {
    if (groupId === null || pendingDelete === null) return;
    setDeleting(true);
    try {
      await api.deleteExpense(user, groupId, pendingDelete.id);
      setError(null);
      await refresh();
      notify(`Deleted “${pendingDelete.description}”`);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  }

  const loading =
    !groupsLoaded || (groupId !== null && group === null && error === null);

  return (
    <>
      <main className="mx-auto max-w-2xl space-y-5 px-4 py-8 sm:py-12">
        <header className="space-y-1">
          <h1 className="text-5xl font-black tracking-tight text-ink sm:text-6xl">
            SplitBill
          </h1>
          <p className="text-body">
            Share costs with your group and see who owes whom.
          </p>
        </header>

        {/* z-30 keeps the open dropdown above the cards that follow (each animates in its own layer). */}
        <div className="card relative z-30 grid gap-4 sm:grid-cols-2">
          <Select
            label="Signed in as"
            value={user}
            onChange={setUser}
            options={USERS.map((name) => ({
              value: name,
              label: titleCase(name),
            }))}
          />
          <Select
            label="Group"
            value={groupId === null ? "" : String(groupId)}
            onChange={(value) => setGroupId(Number(value))}
            disabled={groups.length === 0}
            placeholder={groupsLoaded ? "No groups" : "Loading…"}
            options={groups.map((g) => ({
              value: String(g.id),
              label: g.name,
            }))}
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

        {loading && <Skeleton />}

        {groupsLoaded && groups.length === 0 && !error && (
          <div className="card text-center text-body">
            <p className="font-semibold text-ink">No groups yet</p>
            <p className="mt-1 text-sm">
              {titleCase(user)} is not a member of any group.
            </p>
          </div>
        )}

        {group && (
          <>
            <Balances data={balances} user={user} />
            <ExpenseForm
              key={`${user}-${group.id}`}
              user={user}
              group={group}
              onCreated={async () => {
                await refresh();
                notify("Expense added");
              }}
            />
            <ExpenseList
              expenses={expenses}
              user={user}
              onDelete={setPendingDelete}
            />
          </>
        )}
      </main>

      {/* Outside <main>: its space-y-5 would otherwise add a top margin to these fixed layers. */}
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this expense?"
        confirmLabel="Delete expense"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      >
        {pendingDelete && (
          <>
            <p>
              <span className="font-semibold text-ink">
                {pendingDelete.description}
              </span>{" "}
              · {formatSatang(fromApiString(pendingDelete.amount))} THB
            </p>
            <p className="mt-2 text-sm">
              It will be removed from the list and everyone&apos;s balances will
              be recalculated.
            </p>
          </>
        )}
      </ConfirmDialog>

      <Toast toast={toast} onClose={closeToast} />
    </>
  );
}
