/** Aggregations for charts & reports, over already-authorized rows. */
import { addDays, daysInMonth, isSameMonth, lastMonths, monthKey, monthStart, type ISODate } from "../dates";
import type { Scope, Visibility } from "../types";

export type AnalyticsTx = { amount_minor: number; category_id: string; occurred_on: ISODate; visibility: Visibility; owner_id: string };

/** household = shared only; mine = my private only; all = everything I can see. */
export function filterByScope<T extends { visibility: Visibility; owner_id: string }>(rows: T[], scope: Scope, viewerId: string): T[] {
  if (scope === "household") return rows.filter((r) => r.visibility === "shared");
  if (scope === "mine") return rows.filter((r) => r.visibility === "private" && r.owner_id === viewerId);
  return rows.filter((r) => r.visibility === "shared" || r.owner_id === viewerId);
}

export function totalsByCategory(rows: AnalyticsTx[]): { categoryId: string; totalMinor: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.category_id, (m.get(r.category_id) ?? 0) + r.amount_minor);
  return [...m.entries()].map(([categoryId, totalMinor]) => ({ categoryId, totalMinor })).sort((a, b) => b.totalMinor - a.totalMinor);
}

export function monthlyTotals(rows: AnalyticsTx[], endMonth: ISODate, count: number): { month: ISODate; totalMinor: number }[] {
  const months = lastMonths(endMonth, count);
  const m = new Map(months.map((mo) => [monthKey(mo), 0]));
  for (const r of rows) {
    const k = monthKey(r.occurred_on);
    if (m.has(k)) m.set(k, (m.get(k) ?? 0) + r.amount_minor);
  }
  return months.map((mo) => ({ month: mo, totalMinor: m.get(monthKey(mo)) ?? 0 }));
}

/** Cumulative spending per day of the month, with a straight budget pace line. */
export function dailyCumulative(rows: AnalyticsTx[], month: ISODate, budgetMinor: number, today: ISODate) {
  const start = monthStart(month);
  const days = daysInMonth(start);
  const perDay = new Array<number>(days).fill(0);
  for (const r of rows) if (isSameMonth(r.occurred_on, start)) perDay[Number(r.occurred_on.slice(8, 10)) - 1] += r.amount_minor;
  let running = 0;
  return perDay.map((v, i) => {
    running += v;
    const date = addDays(start, i);
    return {
      day: i + 1,
      date,
      cumulativeMinor: date <= today ? running : null,
      paceMinor: Math.round((budgetMinor * (i + 1)) / days),
    };
  });
}

/** Average spend per active month (months with no data are ignored). */
export function averageMonthly(values: number[]): number {
  const active = values.filter((v) => v > 0);
  return active.length ? Math.round(active.reduce((s, v) => s + v, 0) / active.length) : 0;
}
