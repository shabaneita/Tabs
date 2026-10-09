/**
 * Household budget maths. The household budget is an ALLOCATION; it is
 * compared only with SHARED household expenses. Private expenses never
 * touch it, so nothing private can be inferred from household numbers.
 */
import { isSameMonth, monthElapsedFraction, type ISODate } from "../dates";
import { percentOf } from "../money";
import type { Visibility } from "../types";

export type BudgetTx = { amount_minor: number; category_id: string; occurred_on: ISODate; visibility: Visibility };
export type BudgetLine = { category_id: string; planned_minor: number };

export type CategoryStatus = "ok" | "near" | "over" | "unplanned" | "idle";

export interface CategoryBudget {
  categoryId: string;
  plannedMinor: number;
  actualMinor: number;
  remainingMinor: number;
  pct: number;
  status: CategoryStatus;
}

export interface BudgetSummary {
  month: ISODate;
  totalAllocationMinor: number;
  plannedTotalMinor: number;
  /** Allocation not assigned to any category. Can be negative (over-planned). */
  unallocatedMinor: number;
  actualTotalMinor: number;
  /** Allocation minus actual shared spending. */
  remainingMinor: number;
  consumedPct: number;
  elapsedPct: number;
  categories: CategoryBudget[];
  /** Shared spending in categories that have no budget line this month. */
  unplannedActualMinor: number;
}

export const NEAR_THRESHOLD_PCT = 80;

export function categoryStatus(planned: number, actual: number): CategoryStatus {
  if (planned <= 0) return actual > 0 ? "unplanned" : "idle";
  if (actual > planned) return "over";
  if (percentOf(actual, planned) >= NEAR_THRESHOLD_PCT) return "near";
  return "ok";
}

export function computeBudgetSummary(input: {
  month: ISODate;
  today: ISODate;
  totalAllocationMinor: number;
  lines: BudgetLine[];
  transactions: BudgetTx[];
}): BudgetSummary {
  const { month, today, totalAllocationMinor, lines } = input;
  // Defence in depth: only shared expenses in this month count.
  const txs = input.transactions.filter((t) => t.visibility === "shared" && isSameMonth(t.occurred_on, month));

  const actualByCat = new Map<string, number>();
  for (const t of txs) actualByCat.set(t.category_id, (actualByCat.get(t.category_id) ?? 0) + t.amount_minor);

  const planned = new Map<string, number>();
  for (const l of lines) planned.set(l.category_id, (planned.get(l.category_id) ?? 0) + l.planned_minor);

  const ids = new Set([...planned.keys(), ...actualByCat.keys()]);
  const categories: CategoryBudget[] = [...ids].map((id) => {
    const p = planned.get(id) ?? 0;
    const a = actualByCat.get(id) ?? 0;
    return { categoryId: id, plannedMinor: p, actualMinor: a, remainingMinor: p - a, pct: percentOf(a, p), status: categoryStatus(p, a) };
  });
  categories.sort((x, y) => y.plannedMinor - x.plannedMinor || y.actualMinor - x.actualMinor);

  const plannedTotalMinor = lines.reduce((s, l) => s + l.planned_minor, 0);
  const actualTotalMinor = txs.reduce((s, t) => s + t.amount_minor, 0);
  const unplannedActualMinor = categories.filter((c) => c.plannedMinor === 0).reduce((s, c) => s + c.actualMinor, 0);

  return {
    month,
    totalAllocationMinor,
    plannedTotalMinor,
    unallocatedMinor: totalAllocationMinor - plannedTotalMinor,
    actualTotalMinor,
    remainingMinor: totalAllocationMinor - actualTotalMinor,
    consumedPct: percentOf(actualTotalMinor, totalAllocationMinor),
    elapsedPct: Math.round(monthElapsedFraction(month, today) * 100),
    categories,
    unplannedActualMinor,
  };
}

/** Straight-line projection of month-end spending from spending so far. */
export function projectMonthEnd(actualMinor: number, month: ISODate, today: ISODate): number {
  const f = monthElapsedFraction(month, today);
  if (f <= 0) return actualMinor;
  return Math.round(actualMinor / f);
}
