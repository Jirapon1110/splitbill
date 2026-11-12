const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface Group {
  id: number;
  name: string;
}

export interface GroupDetail extends Group {
  members: { id: number; username: string }[];
}

export interface Expense {
  id: number;
  group_id: number;
  description: string;
  paid_by: string;
  amount: string;
  shares: { username: string; share: string }[];
  created_at: string;
}

export interface Balances {
  balances: { username: string; balance: string }[];
  total: string;
}

export type SplitPayload =
  | { type: "equal"; members: string[] }
  | { type: "exact"; shares: Record<string, string> };

export interface ExpensePayload {
  description: string;
  paid_by: string;
  amount: string;
  split: SplitPayload;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Turn any failure into a plain-language message for the user. */
export function friendlyError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "Could not reach the server. Check that the API is running and try again.";
  }
  switch (error.status) {
    case 401:
      return "Unknown user. Pick one of the listed users.";
    case 403:
      return error.message.startsWith("Only the payer")
        ? "Only the person who paid can delete this expense."
        : "Not a member of this group.";
    case 404:
      return "That item no longer exists.";
    case 422:
      return error.message;
    default:
      return "Something went wrong on the server. Please try again.";
  }
}

async function request<T>(
  path: string,
  user: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: init.method ?? "GET",
      headers: {
        "X-User": user,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new Error("network");
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ApiError(
      response.status,
      payload?.error?.code ?? "error",
      payload?.error?.message ?? response.statusText,
    );
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export const api = {
  groups: (user: string) => request<Group[]>("/groups", user),
  group: (user: string, id: number) => request<GroupDetail>(`/groups/${id}`, user),
  expenses: (user: string, id: number) => request<Expense[]>(`/groups/${id}/expenses`, user),
  balances: (user: string, id: number) => request<Balances>(`/groups/${id}/balances`, user),
  createExpense: (user: string, id: number, body: ExpensePayload, idempotencyKey: string) =>
    request<Expense>(`/groups/${id}/expenses`, user, {
      method: "POST",
      body,
      headers: { "Idempotency-Key": idempotencyKey },
    }),
  deleteExpense: (user: string, groupId: number, expenseId: number) =>
    request<void>(`/groups/${groupId}/expenses/${expenseId}`, user, { method: "DELETE" }),
};
