import { describe, expect, it } from "vitest";
import { dailyCumulative, filterByScope, monthlyTotals, totalsByCategory } from "@/lib/finance/analytics";
import { toCSV } from "@/lib/csv";

const rows = [
  { amount_minor: 100, category_id: "a", occurred_on: "2026-10-01", visibility: "shared" as const, owner_id: "me" },
  { amount_minor: 200, category_id: "b", occurred_on: "2026-10-03", visibility: "private" as const, owner_id: "me" },
  { amount_minor: 400, category_id: "a", occurred_on: "2026-09-03", visibility: "shared" as const, owner_id: "spouse" },
  { amount_minor: 800, category_id: "a", occurred_on: "2026-10-03", visibility: "private" as const, owner_id: "spouse" },
];

describe("analytics scopes", () => {
  it("filters household, mine and all", () => {
    expect(filterByScope(rows, "household", "me").map((r) => r.amount_minor)).toEqual([100, 400]);
    expect(filterByScope(rows, "mine", "me").map((r) => r.amount_minor)).toEqual([200]);
    // Even if a spouse's private row somehow reached the client, "all" excludes it.
    expect(filterByScope(rows, "all", "me").map((r) => r.amount_minor)).toEqual([100, 200, 400]);
  });

  it("aggregates by category and month", () => {
    const visible = filterByScope(rows, "all", "me");
    expect(totalsByCategory(visible)).toEqual([{ categoryId: "a", totalMinor: 500 }, { categoryId: "b", totalMinor: 200 }]);
    expect(monthlyTotals(visible, "2026-10-01", 2)).toEqual([{ month: "2026-09-01", totalMinor: 400 }, { month: "2026-10-01", totalMinor: 300 }]);
  });

  it("builds a cumulative series that stops at today", () => {
    const s = dailyCumulative(filterByScope(rows, "all", "me"), "2026-10-01", 3100, "2026-10-02");
    expect(s).toHaveLength(31);
    expect(s[0]).toMatchObject({ cumulativeMinor: 100, paceMinor: 100 });
    expect(s[2].cumulativeMinor).toBeNull();
  });
});

describe("csv", () => {
  it("adds a BOM, escapes quotes/commas and neutralises formulas", () => {
    const csv = toCSV([{ d: 'كارفور, "دبي"', a: 12.5 }, { d: "=HYPERLINK()", a: -3 }], [
      { header: "الوصف", value: (r) => r.d },
      { header: "المبلغ", value: (r) => r.a },
    ]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"كارفور, ""دبي"""');
    expect(csv).toContain("'=HYPERLINK()");
    expect(csv).toContain(",-3");
  });
});
