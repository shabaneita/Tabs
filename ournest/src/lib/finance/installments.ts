/**
 * Installment plan maths. Plans are modelled as a fixed total payable
 * (any interest/fees included by the user) repaid in equal monthly
 * installments. Early payoff simulation therefore saves TIME, and only
 * saves money if the lender waives remaining fees — the UI says so.
 */
import { addMonths, type ISODate } from "../dates";
import { percentOf } from "../money";
import type { InstallmentPayment, InstallmentPlan } from "../types";

type Plan = Pick<InstallmentPlan, "total_amount_minor" | "monthly_amount_minor" | "opening_paid_minor" | "first_due_date">;
type Payment = Pick<InstallmentPayment, "amount_minor" | "period" | "paid_on">;

export interface InstallmentSummary {
  paidMinor: number;
  outstandingMinor: number;
  progressPct: number;
  totalInstallments: number;
  remainingInstallments: number;
  /** Amount of the final installment (may be smaller than the monthly amount). */
  lastInstallmentMinor: number;
  nextDueDate: ISODate | null;
  nextDueMinor: number;
  expectedCompletion: ISODate | null;
  /** Scheduled due dates whose period was not paid and is before today. */
  overduePeriods: ISODate[];
  schedule: { period: ISODate; status: "paid" | "covered" | "due" | "overdue" | "future" }[];
  isComplete: boolean;
}

export function installmentSummary(plan: Plan, payments: Payment[], today: ISODate): InstallmentSummary {
  const monthly = plan.monthly_amount_minor;
  const paymentsTotal = payments.reduce((s, p) => s + p.amount_minor, 0);
  const paidMinor = Math.min(plan.total_amount_minor, plan.opening_paid_minor + paymentsTotal);
  const outstandingMinor = Math.max(0, plan.total_amount_minor - paidMinor);
  const totalInstallments = Math.ceil(plan.total_amount_minor / monthly);
  const remainingInstallments = Math.ceil(outstandingMinor / monthly);
  const lastInstallmentMinor = remainingInstallments > 0 ? outstandingMinor - (remainingInstallments - 1) * monthly : 0;

  const paidPeriods = new Set(payments.map((p) => p.period).filter((p): p is string => !!p));
  // Installments settled before tracking began count from the start of the schedule.
  const openingCovered = Math.floor(plan.opening_paid_minor / monthly);

  const schedule: InstallmentSummary["schedule"] = [];
  const overduePeriods: ISODate[] = [];
  let nextDueDate: ISODate | null = null;
  let remainingToPlace = remainingInstallments;

  for (let k = 0; k < totalInstallments; k++) {
    const period = addMonths(plan.first_due_date, k);
    if (k < openingCovered) {
      schedule.push({ period, status: "covered" });
      continue;
    }
    if (paidPeriods.has(period)) {
      schedule.push({ period, status: "paid" });
      continue;
    }
    if (remainingToPlace <= 0) {
      // Extra payments shortened the plan: trailing periods are covered.
      schedule.push({ period, status: "covered" });
      continue;
    }
    remainingToPlace--;
    if (period < today) {
      overduePeriods.push(period);
      schedule.push({ period, status: "overdue" });
    } else {
      schedule.push({ period, status: nextDueDate ? "future" : "due" });
    }
    if (!nextDueDate) nextDueDate = period;
  }

  // Missed periods push the end date beyond the original schedule.
  const expectedCompletion =
    remainingInstallments > 0 && nextDueDate
      ? addMonths(nextDueDate < today ? monthAlignedFrom(today, plan.first_due_date) : nextDueDate, remainingInstallments - 1)
      : null;

  return {
    paidMinor,
    outstandingMinor,
    progressPct: percentOf(paidMinor, plan.total_amount_minor),
    totalInstallments,
    remainingInstallments,
    lastInstallmentMinor,
    nextDueDate,
    nextDueMinor: remainingInstallments === 1 ? lastInstallmentMinor : Math.min(monthly, outstandingMinor),
    expectedCompletion,
    overduePeriods,
    schedule,
    isComplete: outstandingMinor === 0,
  };
}

/** First due date (same day-of-month as the plan) on or after `today`. */
function monthAlignedFrom(today: ISODate, firstDue: ISODate): ISODate {
  let k = 0;
  let d = addMonths(firstDue, 0);
  while (d < today && k < 1200) d = addMonths(firstDue, ++k);
  return d;
}

export interface PayoffSimulation {
  monthsBefore: number;
  monthsAfter: number;
  monthsSaved: number;
  completionBefore: ISODate | null;
  completionAfter: ISODate | null;
}

/** Effect of an extra monthly amount and/or a one-off lump sum paid now. */
export function simulateEarlyPayoff(input: {
  outstandingMinor: number;
  monthlyMinor: number;
  extraMonthlyMinor: number;
  lumpSumMinor: number;
  nextDueDate: ISODate | null;
}): PayoffSimulation {
  const { outstandingMinor, monthlyMinor, nextDueDate } = input;
  const extra = Math.max(0, input.extraMonthlyMinor);
  const lump = Math.min(Math.max(0, input.lumpSumMinor), outstandingMinor);
  const monthsBefore = Math.ceil(outstandingMinor / monthlyMinor);
  const afterLump = outstandingMinor - lump;
  const monthsAfter = afterLump <= 0 ? 0 : Math.ceil(afterLump / (monthlyMinor + extra));
  const end = (m: number) => (nextDueDate && m > 0 ? addMonths(nextDueDate, m - 1) : null);
  return {
    monthsBefore,
    monthsAfter,
    monthsSaved: monthsBefore - monthsAfter,
    completionBefore: end(monthsBefore),
    completionAfter: end(monthsAfter),
  };
}

/**
 * Monthly budget impact of active plans: the regular installment, capped by
 * what is still outstanding (a nearly-finished plan costs less).
 */
export function monthlyInstallmentCommitment(items: { monthly_amount_minor: number; is_active: boolean; summary: InstallmentSummary }[]): number {
  return items
    .filter((i) => i.is_active && !i.summary.isComplete)
    .reduce((sum, i) => sum + Math.min(i.monthly_amount_minor, i.summary.outstandingMinor), 0);
}
