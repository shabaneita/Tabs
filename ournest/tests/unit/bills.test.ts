import { describe, expect, it } from "vitest";
import { billOccurrences, monthlyEquivalent, occurrencesBetween } from "@/lib/finance/bills";

const base = { id: "b1", is_active: true, end_date: null, reminder_days: 3, interval_count: 1, amount_minor: 550000 } as const;

describe("bill schedule", () => {
  it("keeps month-end anchors stable (no drift)", () => {
    const bill = { ...base, frequency: "monthly" as const, anchor_date: "2026-01-31" };
    expect(occurrencesBetween(bill, "2026-01-01", "2026-05-31")).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31"]);
  });

  it("supports weekly, quarterly and yearly rules and end dates", () => {
    expect(occurrencesBetween({ ...base, frequency: "weekly", anchor_date: "2026-10-01" }, "2026-10-01", "2026-10-31")).toHaveLength(5);
    expect(occurrencesBetween({ ...base, frequency: "quarterly", anchor_date: "2026-01-15" }, "2026-01-01", "2026-12-31")).toEqual(["2026-01-15", "2026-04-15", "2026-07-15", "2026-10-15"]);
    expect(occurrencesBetween({ ...base, frequency: "yearly", anchor_date: "2025-03-01" }, "2026-01-01", "2027-12-31")).toEqual(["2026-03-01", "2027-03-01"]);
    expect(occurrencesBetween({ ...base, frequency: "monthly", anchor_date: "2026-01-05", end_date: "2026-03-05" }, "2026-01-01", "2026-12-31")).toHaveLength(3);
    expect(occurrencesBetween({ ...base, frequency: "monthly", interval_count: 2, anchor_date: "2026-01-10" }, "2026-01-01", "2026-06-30")).toEqual(["2026-01-10", "2026-03-10", "2026-05-10"]);
  });

  it("never yields dates before the anchor or for inactive bills", () => {
    expect(occurrencesBetween({ ...base, frequency: "monthly", anchor_date: "2026-10-20" }, "2026-01-01", "2026-10-31")).toEqual(["2026-10-20"]);
    expect(occurrencesBetween({ ...base, is_active: false, frequency: "monthly", anchor_date: "2026-10-20" }, "2026-01-01", "2026-12-31")).toEqual([]);
  });

  it("derives paid / overdue / due soon / upcoming without double counting", () => {
    const bill = { ...base, frequency: "monthly" as const, anchor_date: "2026-08-01" };
    const occ = billOccurrences([bill], [{ id: "tx1", bill_id: "b1", bill_period: "2026-09-01" }], "2026-10-09", "2026-08-01", "2026-11-30");
    expect(occ.map((o) => [o.dueDate, o.status])).toEqual([
      ["2026-08-01", "overdue"],
      ["2026-09-01", "paid"],
      ["2026-10-01", "overdue"],
      ["2026-11-01", "upcoming"],
    ]);
    const soon = billOccurrences([{ ...bill, anchor_date: "2026-10-11" }], [], "2026-10-09", "2026-10-01", "2026-10-31");
    expect(soon[0]).toMatchObject({ status: "due_soon", daysUntil: 2 });
  });

  it("computes monthly equivalents", () => {
    expect(monthlyEquivalent({ amount_minor: 120000, frequency: "yearly", interval_count: 1 })).toBe(10000);
    expect(monthlyEquivalent({ amount_minor: 30000, frequency: "quarterly", interval_count: 1 })).toBe(10000);
    expect(monthlyEquivalent({ amount_minor: 1200, frequency: "weekly", interval_count: 1 })).toBe(5200);
  });
});
