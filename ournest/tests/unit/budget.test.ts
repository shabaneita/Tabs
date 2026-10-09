import { describe, expect, it } from "vitest";
import { categoryStatus, computeBudgetSummary, projectMonthEnd } from "@/lib/finance/budget";

const template = [
  ["rent", 550000], ["car_rent", 180000], ["fuel", 50000], ["utilities", 65000], ["municipality", 27500],
  ["telecom", 45000], ["groceries", 170000], ["dining", 50000], ["shared_personal", 40000],
  ["installments", 100000], ["emergency", 40000],
] as const;

const lines = template.map(([category_id, planned_minor]) => ({ category_id, planned_minor }));

describe("household budget", () => {
  it("matches the initial template: 14,000 allocated, 13,175 planned, 825 unallocated", () => {
    const s = computeBudgetSummary({ month: "2026-10-01", today: "2026-10-09", totalAllocationMinor: 1400000, lines, transactions: [] });
    expect(s.plannedTotalMinor).toBe(1317500);
    expect(s.unallocatedMinor).toBe(82500);
    expect(s.actualTotalMinor).toBe(0);
    expect(s.remainingMinor).toBe(1400000);
  });

  it("treats planned amounts as plans, never as paid spending", () => {
    const s = computeBudgetSummary({ month: "2026-10-01", today: "2026-10-31", totalAllocationMinor: 1400000, lines, transactions: [] });
    expect(s.consumedPct).toBe(0);
    expect(s.categories.every((c) => c.actualMinor === 0)).toBe(true);
  });

  it("counts only shared expenses of the selected month", () => {
    const s = computeBudgetSummary({
      month: "2026-10-01",
      today: "2026-10-15",
      totalAllocationMinor: 1400000,
      lines,
      transactions: [
        { amount_minor: 45000, category_id: "dining", occurred_on: "2026-10-03", visibility: "shared" },
        { amount_minor: 99999, category_id: "dining", occurred_on: "2026-10-04", visibility: "private" },
        { amount_minor: 10000, category_id: "dining", occurred_on: "2026-09-30", visibility: "shared" },
        { amount_minor: 2000, category_id: "gifts", occurred_on: "2026-10-05", visibility: "shared" },
      ],
    });
    expect(s.actualTotalMinor).toBe(47000);
    const dining = s.categories.find((c) => c.categoryId === "dining")!;
    expect(dining).toMatchObject({ actualMinor: 45000, remainingMinor: 5000, pct: 90, status: "near" });
    expect(s.categories.find((c) => c.categoryId === "gifts")!.status).toBe("unplanned");
    expect(s.unplannedActualMinor).toBe(2000);
    expect(s.elapsedPct).toBe(48);
  });

  it("classifies statuses at the boundaries", () => {
    expect(categoryStatus(100, 79)).toBe("ok");
    expect(categoryStatus(100, 80)).toBe("near");
    expect(categoryStatus(100, 99)).toBe("near");
    expect(categoryStatus(100, 100)).toBe("full");
    expect(categoryStatus(100, 101)).toBe("over");
    expect(categoryStatus(0, 0)).toBe("idle");
  });

  it("projects month-end spending linearly", () => {
    expect(projectMonthEnd(31000, "2026-10-01", "2026-10-10")).toBe(96100);
  });
});
