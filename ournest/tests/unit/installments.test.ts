import { describe, expect, it } from "vitest";
import { installmentSummary, monthlyInstallmentCommitment, simulateEarlyPayoff } from "@/lib/finance/installments";

const plan = { total_amount_minor: 600000, monthly_amount_minor: 100000, opening_paid_minor: 0, first_due_date: "2026-08-05" };

describe("installments", () => {
  it("tracks outstanding balance, remaining count and completion", () => {
    const s = installmentSummary(plan, [
      { amount_minor: 100000, period: "2026-08-05", paid_on: "2026-08-05" },
      { amount_minor: 100000, period: "2026-09-05", paid_on: "2026-09-04" },
    ], "2026-10-01");
    expect(s).toMatchObject({
      paidMinor: 200000,
      outstandingMinor: 400000,
      remainingInstallments: 4,
      totalInstallments: 6,
      nextDueDate: "2026-10-05",
      expectedCompletion: "2027-01-05",
      progressPct: 33,
      isComplete: false,
    });
    expect(s.overduePeriods).toEqual([]);
  });

  it("flags missed installments and pushes the completion date", () => {
    const s = installmentSummary(plan, [], "2026-10-10");
    expect(s.overduePeriods).toEqual(["2026-08-05", "2026-09-05", "2026-10-05"]);
    expect(s.nextDueDate).toBe("2026-08-05");
    // 6 installments still owed, earliest feasible due date is 5 Nov.
    expect(s.expectedCompletion).toBe("2027-04-05");
  });

  it("handles opening balance, uneven last installment and extra payments", () => {
    const uneven = { ...plan, total_amount_minor: 550000, opening_paid_minor: 200000 };
    const s = installmentSummary(uneven, [{ amount_minor: 150000, period: null, paid_on: "2026-08-20" }], "2026-08-01");
    expect(s.outstandingMinor).toBe(200000);
    expect(s.remainingInstallments).toBe(2);
    expect(s.lastInstallmentMinor).toBe(100000);
    expect(s.schedule.filter((x) => x.status === "covered")).toHaveLength(4);
  });

  it("reports completion", () => {
    const s = installmentSummary({ ...plan, opening_paid_minor: 600000 }, [], "2026-10-01");
    expect(s).toMatchObject({ isComplete: true, outstandingMinor: 0, remainingInstallments: 0, nextDueDate: null, expectedCompletion: null });
  });

  it("simulates early payoff in months saved", () => {
    const r = simulateEarlyPayoff({ outstandingMinor: 400000, monthlyMinor: 100000, extraMonthlyMinor: 100000, lumpSumMinor: 0, nextDueDate: "2026-10-05" });
    expect(r).toEqual({ monthsBefore: 4, monthsAfter: 2, monthsSaved: 2, completionBefore: "2027-01-05", completionAfter: "2026-11-05" });
    const lump = simulateEarlyPayoff({ outstandingMinor: 400000, monthlyMinor: 100000, extraMonthlyMinor: 0, lumpSumMinor: 999999999, nextDueDate: "2026-10-05" });
    expect(lump.monthsAfter).toBe(0);
    expect(lump.completionAfter).toBeNull();
  });

  it("computes the monthly budget commitment", () => {
    const a = installmentSummary(plan, [], "2026-08-01");
    const b = installmentSummary({ ...plan, opening_paid_minor: 550000 }, [], "2026-08-01");
    expect(monthlyInstallmentCommitment([
      { monthly_amount_minor: 100000, is_active: true, summary: a },
      { monthly_amount_minor: 100000, is_active: true, summary: b },
      { monthly_amount_minor: 100000, is_active: false, summary: a },
    ])).toBe(150000);
  });
});
