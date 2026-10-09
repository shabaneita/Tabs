"use client";

/**
 * Query hooks. Every read goes through the browser Supabase client with
 * the signed-in user's JWT, so Postgres RLS decides what comes back.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "../supabase/client";
import { fetchAll, unwrap } from "./fetch";
import { monthEnd, monthStart, type ISODate } from "../dates";
import type {
  ActivityLog, AppNotification, Budget, BudgetItem, Category, FinancialAccount, Household, HouseholdContribution,
  HouseholdMember, IncomeSource, InstallmentPayment, InstallmentPlan, Invitation, PersonalNote, Profile, RecurringBill,
  SavingsContribution, SavingsGoal, Transaction, UserSettings,
} from "../types";

export interface Me {
  user: { id: string; email: string };
  profile: Profile;
  settings: UserSettings;
  household: Household | null;
  membership: HouseholdMember | null;
  members: (Profile & { joined_via: string })[];
  partner: Profile | null;
}

export const qk = {
  me: ["me"] as const,
  categories: ["categories"] as const,
  transactions: (from: ISODate, to: ISODate) => ["transactions", from, to] as const,
  budget: (month: ISODate) => ["budget", month] as const,
  contributions: ["contributions"] as const,
  bills: ["bills"] as const,
  plans: ["plans"] as const,
  goals: ["goals"] as const,
  income: ["income"] as const,
  accounts: ["accounts"] as const,
  notifications: ["notifications"] as const,
  activity: ["activity"] as const,
  notes: ["notes"] as const,
  invitations: ["invitations"] as const,
};

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------
export async function loadMe(): Promise<Me | null> {
  const sb = getSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;

  const [profile, settings, membership] = await Promise.all([
    sb.from("profiles").select("id, display_name, avatar_color").eq("id", user.id).single().then(unwrap<Profile>),
    sb.from("user_settings").select("*").eq("user_id", user.id).single().then(unwrap<UserSettings>),
    sb.from("household_members").select("*").eq("user_id", user.id).maybeSingle().then(unwrap<HouseholdMember | null>),
  ]);

  let household: Household | null = null;
  let members: Me["members"] = [];
  if (membership) {
    const [h, m] = await Promise.all([
      sb.from("households").select("id, name, currency, timezone, created_by").eq("id", membership.household_id).single().then(unwrap<Household>),
      sb.from("household_members").select("user_id, joined_via").eq("household_id", membership.household_id).then(unwrap<{ user_id: string; joined_via: string }[]>),
    ]);
    household = h;
    const profiles = await sb
      .from("profiles")
      .select("id, display_name, avatar_color")
      .in("id", m.map((x) => x.user_id))
      .then(unwrap<Profile[]>);
    members = m.map((x) => ({ ...(profiles.find((p) => p.id === x.user_id) ?? { id: x.user_id, display_name: "", avatar_color: "sage" }), joined_via: x.joined_via }));
  }

  return {
    user: { id: user.id, email: user.email ?? "" },
    profile,
    settings,
    household,
    membership,
    members,
    partner: members.find((m) => m.id !== user.id) ?? null,
  };
}

export function useMeQuery() {
  return useQuery({ queryKey: qk.me, queryFn: loadMe, staleTime: 60_000 });
}

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------
export function useCategories() {
  return useQuery({
    queryKey: qk.categories,
    queryFn: async () =>
      unwrap<Category[]>(await getSupabase().from("categories").select("*").order("sort_order").order("name")),
    staleTime: 5 * 60_000,
  });
}

export function useAccounts() {
  return useQuery({
    queryKey: qk.accounts,
    queryFn: async () => unwrap<FinancialAccount[]>(await getSupabase().from("financial_accounts").select("*").order("created_at")),
  });
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------
export async function loadTransactions(from: ISODate, to: ISODate): Promise<Transaction[]> {
  const sb = getSupabase();
  return fetchAll<Transaction>((a, b) =>
    sb
      .from("transactions")
      .select("*, receipt_attachments(id, storage_path, mime_type, size_bytes, uploaded_by, created_at, transaction_id)")
      .gte("occurred_on", from)
      .lte("occurred_on", to)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false })
      .range(a, b),
  );
}

export function useTransactions(from: ISODate, to: ISODate) {
  return useQuery({ queryKey: qk.transactions(from, to), queryFn: () => loadTransactions(from, to) });
}

export function useMonthTransactions(month: ISODate) {
  return useTransactions(monthStart(month), monthEnd(month));
}

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------
export function useBudget(month: ISODate, enabled = true) {
  return useQuery({
    queryKey: qk.budget(monthStart(month)),
    enabled,
    queryFn: async () => {
      const sb = getSupabase();
      const id = unwrap<string>(await sb.rpc("ensure_month_budget", { p_month: monthStart(month) }));
      const [budget, items] = await Promise.all([
        sb.from("budgets").select("*").eq("id", id).single().then(unwrap<Budget>),
        sb.from("budget_items").select("*").eq("budget_id", id).then(unwrap<BudgetItem[]>),
      ]);
      return { budget, items };
    },
  });
}

export function useContributions() {
  return useQuery({
    queryKey: qk.contributions,
    queryFn: async () =>
      unwrap<HouseholdContribution[]>(await getSupabase().from("household_contributions").select("*").order("effective_month", { ascending: false })),
  });
}

// ---------------------------------------------------------------------------
// Bills, installments, goals, income
// ---------------------------------------------------------------------------
export function useBills() {
  return useQuery({
    queryKey: qk.bills,
    queryFn: async () => unwrap<RecurringBill[]>(await getSupabase().from("recurring_bills").select("*").order("anchor_date")),
  });
}

/** Transactions that settle bills (any date) — used for paid status. */
export function useBillPayments() {
  return useQuery({
    queryKey: ["bill-payments"],
    queryFn: async () => {
      const sb = getSupabase();
      return fetchAll<Pick<Transaction, "id" | "bill_id" | "bill_period" | "amount_minor" | "occurred_on">>((a, b) =>
        sb.from("transactions").select("id, bill_id, bill_period, amount_minor, occurred_on").not("bill_id", "is", null).range(a, b),
      );
    },
  });
}

export type PlanWithPayments = InstallmentPlan & { installment_payments: InstallmentPayment[] };
export function usePlans() {
  return useQuery({
    queryKey: qk.plans,
    queryFn: async () =>
      unwrap<PlanWithPayments[]>(await getSupabase().from("installment_plans").select("*, installment_payments(*)").order("created_at")),
  });
}

export type GoalWithContributions = SavingsGoal & { savings_contributions: SavingsContribution[] };
export function useGoals() {
  return useQuery({
    queryKey: qk.goals,
    queryFn: async () =>
      unwrap<GoalWithContributions[]>(await getSupabase().from("savings_goals").select("*, savings_contributions(*)").order("created_at")),
  });
}

export function useIncome() {
  return useQuery({
    queryKey: qk.income,
    queryFn: async () => unwrap<IncomeSource[]>(await getSupabase().from("income_sources").select("*").order("starts_on", { ascending: false })),
  });
}

// ---------------------------------------------------------------------------
// Social: notifications, activity, invitations, notes
// ---------------------------------------------------------------------------
export function useNotifications() {
  return useQuery({
    queryKey: qk.notifications,
    queryFn: async () =>
      unwrap<AppNotification[]>(await getSupabase().from("notifications").select("*").order("created_at", { ascending: false }).limit(100)),
    refetchInterval: 60_000,
  });
}

export function useActivity(limit = 60) {
  return useQuery({
    queryKey: [...qk.activity, limit],
    queryFn: async () =>
      unwrap<ActivityLog[]>(await getSupabase().from("activity_logs").select("*").order("created_at", { ascending: false }).limit(limit)),
  });
}

export function useInvitations() {
  return useQuery({
    queryKey: qk.invitations,
    queryFn: async () =>
      unwrap<Invitation[]>(
        await getSupabase()
          .from("invitations")
          .select("id, household_id, email, invited_by, status, expires_at, created_at")
          .order("created_at", { ascending: false })
          .limit(10),
      ),
  });
}

export function useNotes() {
  return useQuery({
    queryKey: qk.notes,
    queryFn: async () =>
      unwrap<PersonalNote[]>(
        await getSupabase().from("personal_notes").select("*").order("is_pinned", { ascending: false }).order("updated_at", { ascending: false }),
      ),
  });
}

// ---------------------------------------------------------------------------
// Generic mutation helper with cache invalidation
// ---------------------------------------------------------------------------
export function useInvalidate() {
  const qc = useQueryClient();
  return (...keys: (readonly unknown[])[]) => Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: k })));
}

export function useSupabaseMutation<V, R = unknown>(fn: (v: V) => Promise<R>, invalidate: (readonly unknown[])[]) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => inv(...invalidate),
  });
}

/** Keys touched by anything that changes spending. */
export const SPENDING_KEYS: (readonly unknown[])[] = [["transactions"], ["budget"], ["bill-payments"], qk.plans, qk.activity, qk.notifications];
