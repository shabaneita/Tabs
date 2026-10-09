import { describe, expect, it } from "vitest";
import { goalProgress } from "@/lib/finance/savings";
import { monthlyIncomeTotal } from "@/lib/finance/income";

describe("savings goals", () => {
  it("estimates completion from the monthly contribution", () => {
    const p = goalProgress({ target_minor: 3000000, target_date: "2027-10-01", monthly_contribution_minor: 200000 }, [{ amount_minor: 500000 }, { amount_minor: -100000 }], "2026-10-09");
    expect(p).toMatchObject({ currentMinor: 400000, remainingMinor: 2600000, pct: 13, monthsToGo: 13, estimatedCompletion: "2027-11-01", requiredMonthlyMinor: 216667, onTrack: false });
  });

  it("is honest when there is no plan", () => {
    const p = goalProgress({ target_minor: 100000, target_date: null, monthly_contribution_minor: 0 }, [], "2026-10-09");
    expect(p).toMatchObject({ monthsToGo: null, estimatedCompletion: null, onTrack: null });
  });

  it("caps progress at 100% when reached", () => {
    const p = goalProgress({ target_minor: 100000, target_date: "2027-01-01", monthly_contribution_minor: 0 }, [{ amount_minor: 150000 }], "2026-10-09");
    expect(p).toMatchObject({ pct: 100, reached: true, remainingMinor: 0, onTrack: true });
  });
});

describe("private income", () => {
  it("sums monthly sources active in the month plus one-time income received in it", () => {
    const sources = [
      { frequency: "monthly" as const, amount_minor: 2000000, starts_on: "2026-01-25", ends_on: null },
      { frequency: "monthly" as const, amount_minor: 300000, starts_on: "2026-01-01", ends_on: "2026-09-30" },
      { frequency: "one_time" as const, amount_minor: 500000, starts_on: "2026-10-15", ends_on: null },
      { frequency: "one_time" as const, amount_minor: 700000, starts_on: "2026-09-15", ends_on: null },
      { frequency: "monthly" as const, amount_minor: 100000, starts_on: "2026-11-01", ends_on: null },
    ];
    expect(monthlyIncomeTotal(sources, "2026-10-01")).toBe(2500000);
  });
});
