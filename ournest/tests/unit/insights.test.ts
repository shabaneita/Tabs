import { describe, expect, it } from "vitest";
import { computeBudgetSummary } from "@/lib/finance/budget";
import { generateInsights, type InsightInput } from "@/lib/finance/insights";
import { goalProgress } from "@/lib/finance/savings";

const categories = [
  { id: "dining", name: "مطاعم وخروجات", system_key: "dining" },
  { id: "groceries", name: "أكل وسوبر ماركت", system_key: "groceries" },
  { id: "car_rent", name: "إيجار السيارة", system_key: "car_rent" },
  { id: "fuel", name: "بنزين وسالك ومواقف", system_key: "fuel" },
];
const lines = [
  { category_id: "dining", planned_minor: 50000 },
  { category_id: "groceries", planned_minor: 170000 },
  { category_id: "car_rent", planned_minor: 180000 },
  { category_id: "fuel", planned_minor: 50000 },
];
const tx = (amount_minor: number, category_id: string, occurred_on: string, visibility: "shared" | "private" = "shared", owner_id = "husband") =>
  ({ amount_minor, category_id, occurred_on, visibility, owner_id });

function input(transactions: InsightInput["transactions"], extra: Partial<InsightInput> = {}): InsightInput {
  const budget = computeBudgetSummary({ month: "2026-10-01", today: "2026-10-09", totalAllocationMinor: 1400000, lines, transactions });
  return { today: "2026-10-09", month: "2026-10-01", categories, budget, transactions, bills: [], goals: [], viewerId: "wife", ...extra };
}

describe("insights", () => {
  it("warns when close to exceeding the dining budget, with an explanation", () => {
    const list = generateInsights(input([tx(42000, "dining", "2026-10-05")]));
    const near = list.find((i) => i.id === "near:dining")!;
    expect(near.title).toBe("أنت قريب من تجاوز ميزانية مطاعم وخروجات.");
    expect(near.explanation).toContain("420 درهم");
    expect(near.scope).toBe("household");
  });

  it("builds the dining savings scenario from real shared history only", () => {
    const list = generateInsights(input([
      tx(100000, "dining", "2026-07-10"),
      tx(100000, "dining", "2026-08-10"),
      tx(100000, "dining", "2026-09-10"),
      tx(900000, "dining", "2026-09-11", "private", "wife"),
    ]));
    const s = list.find((i) => i.id === "dining:scenario")!;
    expect(s.title).toBe("لو قللت الخروجات 150 درهم شهريًا، هتوفر 1,800 درهم سنويًا.");
    expect(s.body).toContain("1,000 درهم");
  });

  it("never lets one spouse's private spending leak into household insights", () => {
    const withPrivate = generateInsights(input([tx(49000, "dining", "2026-10-03", "private", "husband")]));
    expect(withPrivate.some((i) => i.id.includes("dining"))).toBe(false);
    expect(JSON.stringify(withPrivate)).not.toContain("490");
  });

  it("flags car costs running above plan", () => {
    const list = generateInsights(input([tx(70000, "car_rent", "2026-10-02"), tx(10000, "fuel", "2026-10-03")]));
    expect(list.some((i) => i.id === "car:pace" && i.title === "مصاريف السيارة أعلى من المتوقع.")).toBe(true);
  });

  it("explains unallocated funds", () => {
    const list = generateInsights(input([]));
    const u = list.find((i) => i.id === "unallocated")!;
    expect(u.title).toContain("9,500 درهم");
    expect(u.explanation).toContain("14,000 درهم");
  });

  it("flags an under-funded emergency fund", () => {
    const progress = goalProgress({ target_minor: 3000000, target_date: "2027-04-01", monthly_contribution_minor: 100000 }, [{ amount_minor: 500000 }], "2026-10-09");
    const list = generateInsights(input([], { goals: [{ name: "صندوق الطوارئ", kind: "emergency", visibility: "shared", progress, monthly_contribution_minor: 100000 }] }));
    expect(list.find((i) => i.id === "emergency:boost")?.title).toBe("ميزانية الطوارئ محتاجة زيادة.");
  });

  it("produces personal insights only from the viewer's own private data", () => {
    const list = generateInsights(input([tx(300000, "groceries", "2026-10-02", "private", "wife"), tx(800000, "groceries", "2026-10-02", "private", "husband")], { personalIncomeMinor: 1000000 }));
    const p = list.find((i) => i.id === "personal:share")!;
    expect(p.scope).toBe("personal");
    expect(p.title).toContain("30٪");
  });

  it("orders insights by severity", () => {
    const list = generateInsights(input([tx(60000, "dining", "2026-10-02")]));
    expect(list[0].severity).toBe("critical");
  });
});
