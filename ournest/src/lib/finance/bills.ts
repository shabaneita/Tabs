/**
 * Recurring bill schedule. Due dates are always computed from the anchor
 * (never by repeatedly adding to the previous date) so month-end anchors
 * don't drift (31 Jan → 28 Feb → 31 Mar).
 */
import { addDays, addMonths, diffDays, diffMonths, type ISODate } from "../dates";
import type { BillFrequency, RecurringBill } from "../types";

type Schedule = Pick<RecurringBill, "frequency" | "interval_count" | "anchor_date" | "end_date" | "is_active">;

function nth(bill: Schedule, k: number): ISODate {
  const n = bill.interval_count * k;
  switch (bill.frequency) {
    case "weekly":
      return addDays(bill.anchor_date, 7 * n);
    case "monthly":
      return addMonths(bill.anchor_date, n);
    case "quarterly":
      return addMonths(bill.anchor_date, 3 * n);
    case "yearly":
      return addMonths(bill.anchor_date, 12 * n);
  }
}

function approxIndex(bill: Schedule, date: ISODate): number {
  const step = bill.interval_count;
  switch (bill.frequency) {
    case "weekly":
      return Math.floor(diffDays(date, bill.anchor_date) / (7 * step));
    case "monthly":
      return Math.floor(diffMonths(date, bill.anchor_date) / step);
    case "quarterly":
      return Math.floor(diffMonths(date, bill.anchor_date) / (3 * step));
    case "yearly":
      return Math.floor(diffMonths(date, bill.anchor_date) / (12 * step));
  }
}

/** All due dates in [from, to] (inclusive). */
export function occurrencesBetween(bill: Schedule, from: ISODate, to: ISODate): ISODate[] {
  if (!bill.is_active || to < from) return [];
  const out: ISODate[] = [];
  let k = Math.max(0, approxIndex(bill, from) - 1);
  for (let guard = 0; guard < 600; guard++, k++) {
    const due = nth(bill, k);
    if (bill.end_date && due > bill.end_date) break;
    if (due > to) break;
    if (due >= from && due >= bill.anchor_date) out.push(due);
  }
  return out;
}

export type BillOccurrenceStatus = "paid" | "overdue" | "due_soon" | "upcoming";

export interface BillOccurrence<B extends Schedule & { id: string; reminder_days: number } = RecurringBill> {
  bill: B;
  dueDate: ISODate;
  status: BillOccurrenceStatus;
  daysUntil: number;
  paidTransactionId: string | null;
}

export type BillPayment = { id: string; bill_id: string | null; bill_period: ISODate | null };

/**
 * Status of every occurrence between `from` and `to`. An occurrence is paid
 * when a transaction references (bill_id, bill_period) — the same pair the
 * database keeps unique, so a paid bill can never be counted twice.
 */
export function billOccurrences<B extends Schedule & { id: string; reminder_days: number }>(
  bills: B[],
  payments: BillPayment[],
  today: ISODate,
  from: ISODate,
  to: ISODate,
): BillOccurrence<B>[] {
  const paid = new Map<string, string>();
  for (const p of payments) if (p.bill_id && p.bill_period) paid.set(`${p.bill_id}:${p.bill_period}`, p.id);

  const out: BillOccurrence<B>[] = [];
  for (const bill of bills) {
    for (const dueDate of occurrencesBetween(bill, from, to)) {
      const txId = paid.get(`${bill.id}:${dueDate}`) ?? null;
      const daysUntil = diffDays(dueDate, today);
      let status: BillOccurrenceStatus;
      if (txId) status = "paid";
      else if (daysUntil < 0) status = "overdue";
      else if (daysUntil <= Math.max(bill.reminder_days, 0)) status = "due_soon";
      else status = "upcoming";
      out.push({ bill, dueDate, status, daysUntil, paidTransactionId: txId });
    }
  }
  out.sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
  return out;
}

/** Average monthly cost of a bill, in fils (for budget impact & breakdowns). */
export function monthlyEquivalent(bill: { amount_minor: number; frequency: BillFrequency; interval_count: number }): number {
  const n = bill.interval_count;
  switch (bill.frequency) {
    case "weekly":
      return Math.round((bill.amount_minor * 52) / 12 / n);
    case "monthly":
      return Math.round(bill.amount_minor / n);
    case "quarterly":
      return Math.round(bill.amount_minor / (3 * n));
    case "yearly":
      return Math.round(bill.amount_minor / (12 * n));
  }
}
