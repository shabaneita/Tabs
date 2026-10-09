/**
 * Transparent, rule-based financial insights.
 *
 * Privacy contract:
 *  - "household" insights are computed from SHARED records only (filtered
 *    here again, on top of RLS) and are safe to show to both spouses.
 *  - "personal" insights use the viewer's own private data and are only
 *    ever produced for that viewer (RLS never returns the spouse's).
 * Every insight carries a plain-language explanation of its calculation.
 */
import { arabicCount, isSameMonth, lastMonths, monthStart, type ISODate } from "../dates";
import { formatMinor, formatPercent, percentOf, roundToStep, type Numerals } from "../money";
import type { BillOccurrence } from "./bills";
import { projectMonthEnd, type BudgetSummary } from "./budget";
import type { GoalProgress } from "./savings";
import type { GoalKind, RecurringBill, Visibility } from "../types";

export type InsightSeverity = "critical" | "warning" | "info" | "positive";

export interface Insight {
  id: string;
  scope: "household" | "personal";
  severity: InsightSeverity;
  title: string;
  body: string;
  explanation: string;
  href?: string;
}

export interface InsightInput {
  today: ISODate;
  month: ISODate;
  numerals?: Numerals;
  categories: { id: string; name: string; system_key: string | null }[];
  /** Household budget summary (already shared-only). */
  budget: BudgetSummary | null;
  /** Visible transactions covering at least the last 4 months. */
  transactions: { amount_minor: number; category_id: string; occurred_on: ISODate; visibility: Visibility; owner_id: string }[];
  bills: BillOccurrence<RecurringBill>[];
  goals: { name: string; kind: GoalKind; visibility: Visibility; progress: GoalProgress; monthly_contribution_minor: number }[];
  viewerId: string;
  /** Viewer's own recorded income for the month (private). */
  personalIncomeMinor?: number;
}

const SEVERITY_ORDER: Record<InsightSeverity, number> = { critical: 0, warning: 1, info: 2, positive: 3 };

export function generateInsights(input: InsightInput): Insight[] {
  const n = input.numerals ?? "latn";
  const aed = (minor: number) => `${formatMinor(minor, { numerals: n, fils: "never" })} درهم`;
  const pct = (v: number) => formatPercent(v, n);
  const catById = new Map(input.categories.map((c) => [c.id, c]));
  const keyToIds = new Map<string, string[]>();
  for (const c of input.categories) if (c.system_key) keyToIds.set(c.system_key, [...(keyToIds.get(c.system_key) ?? []), c.id]);

  const shared = input.transactions.filter((t) => t.visibility === "shared");
  const out: Insight[] = [];
  const b = input.budget;

  // --- Category budget status ------------------------------------------
  const carIds = new Set([...(keyToIds.get("car_rent") ?? []), ...(keyToIds.get("fuel") ?? [])]);
  if (b) {
    for (const c of b.categories) {
      const name = catById.get(c.categoryId)?.name ?? "تصنيف";
      if (c.status === "over") {
        out.push({
          id: `over:${c.categoryId}`,
          scope: "household",
          severity: "critical",
          title: `تجاوزتم ميزانية ${name}.`,
          body: `المصروف ${aed(c.actualMinor)} من أصل ${aed(c.plannedMinor)}، يعني زيادة ${aed(c.actualMinor - c.plannedMinor)}.`,
          explanation: `مجموع المصاريف المشتركة المسجلة في «${name}» هذا الشهر (${aed(c.actualMinor)}) أكبر من المبلغ المخطط له في الميزانية (${aed(c.plannedMinor)}).`,
          href: "/budget",
        });
      } else if (c.status === "near") {
        out.push({
          id: `near:${c.categoryId}`,
          scope: "household",
          severity: "warning",
          title: `أنت قريب من تجاوز ميزانية ${name}.`,
          body: `استهلكتم ${pct(c.pct)} والمتبقي ${aed(c.remainingMinor)} فقط.`,
          explanation: `${aed(c.actualMinor)} مصروف ÷ ${aed(c.plannedMinor)} مخطط = ${pct(c.pct)}. التنبيه يظهر عند ${pct(80)} أو أكثر.`,
          href: "/budget",
        });
      } else if (c.status === "ok" && !carIds.has(c.categoryId) && b.elapsedPct >= 20 && c.plannedMinor > 0) {
        const projected = projectMonthEnd(c.actualMinor, input.month, input.today);
        if (projected > c.plannedMinor * 1.15 && c.actualMinor >= c.plannedMinor * 0.3) {
          out.push({
            id: `pace:${c.categoryId}`,
            scope: "household",
            severity: "warning",
            title: `مصاريف ${name} ماشية أسرع من المتوقع.`,
            body: `لو استمر نفس المعدل، هتوصل تقريبًا ${aed(projected)} آخر الشهر مقابل ميزانية ${aed(c.plannedMinor)}.`,
            explanation: `مضى ${pct(b.elapsedPct)} من الشهر، والمصروف حتى الآن ${aed(c.actualMinor)}. التوقع = المصروف ÷ نسبة الأيام المنقضية. ده تقدير خطّي بسيط.`,
            href: "/budget",
          });
        }
      }
    }

    // --- Car costs vs plan -------------------------------------------------
    if (carIds.size > 0 && b.elapsedPct >= 20) {
      const carLines = b.categories.filter((c) => carIds.has(c.categoryId));
      const planned = carLines.reduce((s, c) => s + c.plannedMinor, 0);
      const actual = carLines.reduce((s, c) => s + c.actualMinor, 0);
      const anyOver = carLines.some((c) => c.status === "over" || c.status === "near");
      const projected = projectMonthEnd(actual, input.month, input.today);
      if (planned > 0 && !anyOver && projected > planned * 1.1 && actual > 0) {
        out.push({
          id: "car:pace",
          scope: "household",
          severity: "warning",
          title: "مصاريف السيارة أعلى من المتوقع.",
          body: `الإيجار والبنزين وسالك والمواقف: ${aed(actual)} حتى الآن، والمتوقع آخر الشهر ${aed(projected)} مقابل ${aed(planned)} مخطط.`,
          explanation: "مجموع تصنيفي «إيجار السيارة» و«بنزين وسالك ومواقف»، مع توقع خطّي حسب الأيام المنقضية من الشهر.",
          href: "/budget",
        });
      }
    }

    // --- Unallocated funds -------------------------------------------------
    if (b.unallocatedMinor > 0) {
      out.push({
        id: "unallocated",
        scope: "household",
        severity: "info",
        title: `عندكم ${aed(b.unallocatedMinor)} غير مخصصة في ميزانية الشهر.`,
        body: "ممكن تخصصوها لهدف ادخار أو لصندوق الطوارئ.",
        explanation: `ميزانية الشهر ${aed(b.totalAllocationMinor)} − مجموع المخطط للتصنيفات ${aed(b.plannedTotalMinor)} = ${aed(b.unallocatedMinor)}.`,
        href: "/budget",
      });
    } else if (b.unallocatedMinor < 0) {
      out.push({
        id: "overplanned",
        scope: "household",
        severity: "warning",
        title: "المخطط للتصنيفات أكبر من ميزانية الشهر.",
        body: `الفرق ${aed(-b.unallocatedMinor)}. راجعوا مبالغ التصنيفات أو زودوا الميزانية.`,
        explanation: `مجموع المخطط ${aed(b.plannedTotalMinor)} − ميزانية الشهر ${aed(b.totalAllocationMinor)}.`,
        href: "/budget",
      });
    }

    // --- Doing well --------------------------------------------------------
    if (b.elapsedPct >= 50 && b.totalAllocationMinor > 0 && b.consumedPct <= b.elapsedPct - 10 && !out.some((i) => i.severity === "critical")) {
      out.push({
        id: "on-track",
        scope: "household",
        severity: "positive",
        title: "ممتاز! صرفكم أقل من المتوقع لهذا الوقت من الشهر.",
        body: `مضى ${pct(b.elapsedPct)} من الشهر واستهلكتم ${pct(b.consumedPct)} من الميزانية.`,
        explanation: "مقارنة نسبة المصروف الفعلي المشترك من ميزانية الشهر بنسبة الأيام المنقضية.",
        href: "/analytics",
      });
    }
  }

  // --- Bills ---------------------------------------------------------------
  const visibleBills = input.bills;
  const overdue = visibleBills.filter((o) => o.status === "overdue");
  const dueWeek = visibleBills.filter((o) => (o.status === "due_soon" || o.status === "upcoming") && o.daysUntil >= 0 && o.daysUntil <= 7);
  const billScope = (list: typeof visibleBills) => (list.every((o) => o.bill.visibility === "shared") ? "household" : "personal");
  if (overdue.length > 0) {
    const total = overdue.reduce((s, o) => s + o.bill.amount_minor, 0);
    out.push({
      id: "bills:overdue",
      scope: billScope(overdue),
      severity: "critical",
      title: `عندك ${arabicCount(overdue.length, "bill", n)} متأخرة.`,
      body: `${overdue.map((o) => o.bill.name).join("، ")} — إجمالي ${aed(total)}.`,
      explanation: "فواتير تاريخ استحقاقها قبل اليوم ولم يُسجَّل لها دفع.",
      href: "/more/bills",
    });
  }
  if (dueWeek.length > 0) {
    const total = dueWeek.reduce((s, o) => s + o.bill.amount_minor, 0);
    out.push({
      id: "bills:week",
      scope: billScope(dueWeek),
      severity: "warning",
      title: `عندك ${arabicCount(dueWeek.length, "bill", n)} مستحقة خلال أسبوع.`,
      body: `${dueWeek.map((o) => o.bill.name).join("، ")} — حوالي ${aed(total)}.`,
      explanation: "الفواتير غير المدفوعة التي يحل موعدها خلال ٧ أيام. المبالغ المتغيرة (زي ديوا) تقديرية.",
      href: "/more/bills",
    });
  }

  // --- Dining scenario (household, shared only) ----------------------------
  const diningIds = new Set(keyToIds.get("dining") ?? []);
  if (diningIds.size > 0) {
    const months = lastMonths(input.month, 4).slice(0, 3); // last 3 complete months
    const monthlyTotals = months.map((m) =>
      shared.filter((t) => diningIds.has(t.category_id) && isSameMonth(t.occurred_on, m)).reduce((s, t) => s + t.amount_minor, 0),
    );
    const withData = monthlyTotals.filter((v) => v > 0);
    if (withData.length > 0) {
      const avg = Math.round(withData.reduce((s, v) => s + v, 0) / withData.length);
      if (avg >= 30000) {
        const reduction = Math.min(30000, Math.max(5000, roundToStep(avg * 0.15, 50)));
        out.push({
          id: "dining:scenario",
          scope: "household",
          severity: "info",
          title: `لو قللت الخروجات ${aed(reduction)} شهريًا، هتوفر ${aed(reduction * 12)} سنويًا.`,
          body: `متوسط مصروف المطاعم والخروجات المشترك ${aed(avg)} في الشهر.`,
          explanation: `المتوسط محسوب من ${arabicCount(withData.length, "month", n)} سابقة فيها مصاريف مسجلة. التوفير = ${aed(reduction)} × ١٢ شهر. ده سيناريو تقديري وليس وعدًا.`,
          href: "/analytics",
        });
      }
    }
  }

  // --- Emergency fund -------------------------------------------------------
  const emergency = input.goals.find((g) => g.kind === "emergency");
  if (emergency && !emergency.progress.reached) {
    const p = emergency.progress;
    if (emergency.monthly_contribution_minor === 0 || p.onTrack === false) {
      out.push({
        id: "emergency:boost",
        scope: emergency.visibility === "shared" ? "household" : "personal",
        severity: "warning",
        title: "ميزانية الطوارئ محتاجة زيادة.",
        body:
          p.requiredMonthlyMinor !== null
            ? `علشان توصلوا للهدف في موعده محتاجين حوالي ${aed(p.requiredMonthlyMinor)} شهريًا.`
            : `المتبقي ${aed(p.remainingMinor)} ولا توجد مساهمة شهرية محددة.`,
        explanation:
          p.requiredMonthlyMinor !== null
            ? `المتبقي ${aed(p.remainingMinor)} ÷ الأشهر المتبقية حتى التاريخ المستهدف. المساهمة الشهرية الحالية ${aed(emergency.monthly_contribution_minor)}.`
            : "بدون مساهمة شهرية لا يمكن تقدير موعد الوصول للهدف.",
        href: "/more/goals",
      });
    }
  }

  // --- Personal (viewer only) -----------------------------------------------
  const income = input.personalIncomeMinor ?? 0;
  if (income > 0) {
    const mine = input.transactions.filter(
      (t) => t.visibility === "private" && t.owner_id === input.viewerId && isSameMonth(t.occurred_on, monthStart(input.month)),
    );
    const spent = mine.reduce((s, t) => s + t.amount_minor, 0);
    const share = percentOf(spent, income);
    if (spent > 0) {
      out.push({
        id: "personal:share",
        scope: "personal",
        severity: share >= 50 ? "warning" : "info",
        title: `مصاريفك الخاصة هذا الشهر ${pct(share)} من دخلك المسجل.`,
        body: `${aed(spent)} من ${aed(income)}. هذه المعلومة تظهر لك وحدك.`,
        explanation: "مجموع مصاريفك الخاصة هذا الشهر ÷ دخلك الخاص المسجل لنفس الشهر. لا تدخل فيها المصاريف المشتركة.",
        href: "/more/income",
      });
    }
  }

  return out.sort((a, b2) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b2.severity]);
}
