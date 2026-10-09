"use client";

import { ChevronLeft, ChevronRight, FileDown, FileText, Lock, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useApp } from "@/components/app/app-context";
import { BudgetVsActual, CategoryDonut, categorySeriesColor, MonthlyBars, OTHER_COLOR, PairedBars, TrendLine } from "@/components/charts";
import { InsightCard } from "@/components/dashboard/insight-card";
import { Amount, Num, useNumerals } from "@/components/ui/amount";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardHeader, SectionTitle } from "@/components/ui/card";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { MonthSwitcher } from "@/components/ui/month-switcher";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress";
import { Segmented } from "@/components/ui/segmented";
import { useBills, useBudget, useCategories, useContributions, useGoals, useIncome, usePlans, useTransactions } from "@/lib/data/hooks";
import { useMonthOverview } from "@/lib/data/insights-hook";
import { addMonths, formatDate, lastMonths, monthEnd, monthStart, type ISODate } from "@/lib/dates";
import { averageMonthly, dailyCumulative, filterByScope, monthlyTotals, totalsByCategory } from "@/lib/finance/analytics";
import { computeBudgetSummary } from "@/lib/finance/budget";
import { monthlyEquivalent } from "@/lib/finance/bills";
import { monthlyIncomeTotal } from "@/lib/finance/income";
import { installmentSummary } from "@/lib/finance/installments";
import { goalProgress } from "@/lib/finance/savings";
import { exportTransactionsCSV } from "@/lib/export";
import { billKindMeta } from "@/lib/labels";
import type { Scope } from "@/lib/types";
import { BarChart3, PieChart } from "lucide-react";

type Period = "month" | "year";

export default function AnalyticsPage() {
  const { me, today } = useApp();
  const numerals = useNumerals();
  const [period, setPeriod] = useState<Period>("month");
  const [scope, setScope] = useState<Scope>("household");
  const [month, setMonth] = useState<ISODate>(monthStart(today));
  const [year, setYear] = useState(Number(today.slice(0, 4)));

  const rangeEnd = period === "month" ? monthEnd(month) : `${year}-12-31`;
  const rangeStart = period === "month" ? addMonths(monthStart(month), -5) : `${year}-01-01`;
  const { data: txAll, isLoading } = useTransactions(rangeStart, rangeEnd);
  const { data: categories = [] } = useCategories();
  const budgetQ = useBudget(month, period === "month");
  const { data: bills = [] } = useBills();
  const { data: plans = [] } = usePlans();
  const { data: goalsRaw = [] } = useGoals();
  const { data: income = [] } = useIncome();
  const { data: contributions = [] } = useContributions();
  const overview = useMonthOverview();

  const periodStart = period === "month" ? monthStart(month) : `${year}-01-01`;
  const scoped = useMemo(() => filterByScope(txAll ?? [], scope, me.user.id), [txAll, scope, me.user.id]);
  const inPeriod = scoped.filter((t) => t.occurred_on >= periodStart && t.occurred_on <= rangeEnd);
  const total = inPeriod.reduce((s, t) => s + t.amount_minor, 0);

  const catMap = new Map(categories.map((c) => [c.id, c]));
  const donut = (() => {
    const totals = totalsByCategory(inPeriod);
    const named = totals.map((t) => ({ id: t.categoryId, name: catMap.get(t.categoryId)?.name ?? "تصنيف", value: t.totalMinor, color: categorySeriesColor(t.categoryId, categories) }));
    // Categories without a colour slot fold into one "أخرى" slice.
    const colored = named.filter((d) => d.color !== OTHER_COLOR);
    const other = named.filter((d) => d.color === OTHER_COLOR).reduce((s, d) => s + d.value, 0);
    return other > 0 ? [...colored, { id: "other", name: "أخرى", value: other, color: OTHER_COLOR }] : colored;
  })();

  const months = period === "month" ? lastMonths(month, 6) : Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}-01`);
  const bars = monthlyTotals(scoped, months[months.length - 1], months.length).map((m) => ({
    key: m.month,
    label: formatDate(m.month, "monthShort", numerals),
    value: m.totalMinor,
  }));
  const avg = averageMonthly(bars.map((b) => b.value));
  const top = donut[0];

  const budgetSummary =
    period === "month" && budgetQ.data && txAll
      ? computeBudgetSummary({ month, today, totalAllocationMinor: budgetQ.data.budget.total_allocation_minor, lines: budgetQ.data.items, transactions: txAll })
      : null;

  // Recurring breakdown (visible bills + installment plans).
  const recurring = useMemo(() => {
    const byKind = new Map<string, number>();
    for (const b of filterByScope(bills.filter((x) => x.is_active), scope, me.user.id)) {
      byKind.set(b.kind, (byKind.get(b.kind) ?? 0) + monthlyEquivalent(b));
    }
    const rows = [...byKind.entries()].map(([kind, value]) => ({ id: kind, name: billKindMeta(kind as never).label, value }));
    const inst = filterByScope(plans.filter((p) => p.is_active), scope, me.user.id)
      .map((p) => ({ p, s: installmentSummary(p, p.installment_payments, today) }))
      .filter(({ s }) => !s.isComplete)
      .reduce((sum, { p, s }) => sum + Math.min(p.monthly_amount_minor, s.outstandingMinor), 0);
    if (inst > 0) rows.push({ id: "installments", name: "أقساط", value: inst });
    return rows.sort((a, b) => b.value - a.value);
  }, [bills, plans, scope, me.user.id, today]);
  const recurringTotal = recurring.reduce((s, r) => s + r.value, 0);

  const goals = filterByScope(goalsRaw.filter((g) => !g.is_archived), scope, me.user.id).map((g) => ({ ...g, progress: goalProgress(g, g.savings_contributions, today) }));

  // Cash flow: personal = my income vs what I paid; household = declared contributions vs shared spending.
  const cashflow = months.map((m) => {
    const monthTx = (txAll ?? []).filter((t) => t.occurred_on.slice(0, 7) === m.slice(0, 7));
    if (scope === "household") {
      const contrib = me.members.reduce((s, mem) => {
        const c = contributions.filter((x) => x.user_id === mem.id && x.effective_month <= m).sort((a, b) => (a.effective_month < b.effective_month ? 1 : -1))[0];
        return s + (c?.monthly_amount_minor ?? 0);
      }, 0);
      return { key: m, label: formatDate(m, "monthShort", numerals), a: contrib, b: monthTx.filter((t) => t.visibility === "shared").reduce((s, t) => s + t.amount_minor, 0) };
    }
    const paidByMe = monthTx.filter((t) => t.owner_id === me.user.id && (scope === "all" || t.visibility === "private")).reduce((s, t) => s + t.amount_minor, 0);
    return { key: m, label: formatDate(m, "monthShort", numerals), a: monthlyIncomeTotal(income, m), b: paidByMe };
  });
  const hasCashflow = cashflow.some((c) => c.a > 0 || c.b > 0);

  const scopeLabel = { household: "مصاريف البيت", mine: "مصاريفي الخاصة", all: "كل المتاح لي" }[scope];

  return (
    <div>
      <PageHeader title="التحليلات" subtitle="أرقامكم الحقيقية، بوضوح" />

      <div className="space-y-2.5">
        <Segmented<Period>
          ariaLabel="الفترة"
          value={period}
          onChange={setPeriod}
          size="sm"
          options={[
            { value: "month", label: "تقرير شهري" },
            { value: "year", label: "تقرير سنوي" },
          ]}
        />
        <Segmented<Scope>
          ariaLabel="النطاق"
          value={scope}
          onChange={setScope}
          size="sm"
          options={[
            { value: "household", label: "البيت", icon: <Users className="size-3.5" /> },
            { value: "mine", label: "الخاص بي", icon: <Lock className="size-3.5" /> },
            { value: "all", label: "الكل" },
          ]}
        />
        {period === "month" ? (
          <MonthSwitcher month={month} onChange={setMonth} max={today} />
        ) : (
          <div className="flex items-center justify-between rounded-2xl bg-card p-1 shadow-card ring-1 ring-border">
            <button type="button" className="pressable grid size-10 place-items-center rounded-xl" onClick={() => setYear((y) => y - 1)} aria-label="السنة السابقة">
              <ChevronRight className="size-5" />
            </button>
            <span className="font-semibold">
              <Num value={year} />
            </span>
            <button
              type="button"
              className="pressable grid size-10 place-items-center rounded-xl disabled:opacity-30"
              disabled={year >= Number(today.slice(0, 4))}
              onClick={() => setYear((y) => y + 1)}
              aria-label="السنة التالية"
            >
              <ChevronLeft className="size-5" />
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-24 rounded-3xl" />
          <Skeleton className="h-80 rounded-3xl" />
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Tile label={period === "month" ? "مصروف الشهر" : "مصروف السنة"} value={<Amount minor={total} />} />
            <Tile label="متوسط شهري" value={<Amount minor={avg} />} />
            <Tile label="أعلى تصنيف" value={top ? <span className="truncate">{top.name}</span> : "—"} />
            <Tile label="عدد العمليات" value={<Num value={inPeriod.length} />} />
          </div>
          {scope === "mine" ? (
            <p className="mt-2 flex items-center gap-1 px-1 text-xs text-foreground-subtle">
              <Lock className="size-3" /> هذه الأرقام تظهر لك وحدك.
            </p>
          ) : null}

          {/* Donut */}
          <Card className="mt-4 pb-5">
            <CardHeader title="المصروف حسب التصنيف" subtitle={scopeLabel} />
            <div className="px-5 pt-4">
              {donut.length ? <CategoryDonut data={donut} total={total} /> : <EmptyState icon={<PieChart />} title="لا توجد مصاريف في هذه الفترة" />}
            </div>
          </Card>

          {/* Monthly bars */}
          <Card className="mt-3 pb-4">
            <CardHeader title={period === "month" ? "آخر ٦ أشهر" : "المصروف الشهري خلال السنة"} subtitle={scopeLabel} />
            <div className="px-3 pt-3">{bars.some((b) => b.value > 0) ? <MonthlyBars data={bars} highlightLast={period === "month"} /> : <EmptyState icon={<BarChart3 />} title="لا توجد بيانات كافية بعد" />}</div>
          </Card>

          {/* Trend (household month) */}
          {period === "month" && scope === "household" && budgetSummary ? (
            <Card className="mt-3 pb-4">
              <CardHeader title="اتجاه الصرف هذا الشهر" subtitle="المصروف التراكمي مقارنة بوتيرة ميزانية متساوية" />
              <div className="px-3 pt-3">
                <TrendLine data={dailyCumulative(scoped, month, budgetSummary.totalAllocationMinor, today)} />
              </div>
            </Card>
          ) : null}

          {/* Budget vs actual */}
          {period === "month" && scope === "household" && budgetSummary ? (
            <Card className="mt-3 p-5">
              <h2 className="mb-4 text-[17px] font-semibold">الميزانية مقابل الفعلي</h2>
              <BudgetVsActual
                rows={budgetSummary.categories
                  .filter((c) => c.plannedMinor > 0 || c.actualMinor > 0)
                  .map((c) => ({ id: c.categoryId, name: catMap.get(c.categoryId)?.name ?? "تصنيف", planned: c.plannedMinor, actual: c.actualMinor }))}
              />
            </Card>
          ) : null}

          {/* Cash flow */}
          <Card className="mt-3 pb-4">
            <CardHeader
              title="التدفق النقدي"
              subtitle={scope === "household" ? "المساهمات المعلنة مقابل المصروف المشترك" : "دخلك المسجل مقابل ما دفعته — يظهر لك وحدك"}
            />
            <div className="px-3 pt-3">
              {hasCashflow ? (
                <PairedBars data={cashflow} aName={scope === "household" ? "المساهمات" : "دخلي"} bName={scope === "household" ? "المصروف المشترك" : "ما دفعته"} />
              ) : (
                <p className="px-2 py-6 text-center text-sm text-foreground-muted">
                  {scope === "household" ? "حددا مساهماتكما الشهرية من صفحة الميزانية لعرض التدفق النقدي." : "سجّل دخلك من «دخلي» لعرض التدفق النقدي الشخصي."}
                </p>
              )}
            </div>
          </Card>

          {/* Recurring breakdown */}
          <Card className="mt-3 p-5">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-[17px] font-semibold">المدفوعات المتكررة شهريًا</h2>
              <Amount minor={recurringTotal} className="font-semibold" />
            </div>
            {recurring.length ? (
              <div className="space-y-3">
                {recurring.map((r) => (
                  <div key={r.id}>
                    <div className="mb-1 flex justify-between text-[13px]">
                      <span>{r.name}</span>
                      <Amount minor={r.value} className="font-semibold" />
                    </div>
                    <ProgressBar label={r.name} value={(r.value / Math.max(1, recurringTotal)) * 100} tone="info" height={6} />
                  </div>
                ))}
                <p className="text-xs text-foreground-subtle">الفواتير غير الشهرية محسوبة كمتوسط شهري.</p>
              </div>
            ) : (
              <p className="text-sm text-foreground-muted">لا توجد فواتير أو أقساط في هذا النطاق.</p>
            )}
          </Card>

          {/* Goals */}
          {goals.length ? (
            <Card className="mt-3 p-5">
              <h2 className="mb-4 text-[17px] font-semibold">تقدم أهداف الادخار</h2>
              <div className="space-y-4">
                {goals.map((g) => (
                  <div key={g.id}>
                    <div className="mb-1 flex justify-between gap-2 text-[13px]">
                      <span className="truncate">{g.name}</span>
                      <span className="text-foreground-muted">
                        <Amount minor={g.progress.currentMinor} className="font-semibold text-foreground" /> / <Amount minor={g.target_minor} hideCurrency />
                      </span>
                    </div>
                    <ProgressBar label={`تقدم ${g.name}`} value={g.progress.pct} tone="primary" height={6} />
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {/* Recommendations */}
          {overview.data?.insights.length ? (
            <>
              <SectionTitle>ملخص وتوصيات الشهر</SectionTitle>
              <div className="space-y-3">
                {overview.data.insights
                  .filter((i) => scope !== "household" || i.scope === "household")
                  .map((i) => (
                    <InsightCard key={i.id} insight={i} />
                  ))}
              </div>
            </>
          ) : null}

          {/* Export */}
          <SectionTitle>التقارير والتصدير</SectionTitle>
          <Card className="space-y-3 p-5">
            <p className="text-sm text-foreground-muted">
              تصدير {scopeLabel} لـ {period === "month" ? formatDate(month, "month", numerals) : <Num value={year} />}. التصدير يشمل فقط البيانات المسموح لك برؤيتها.
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" block onClick={() => exportTransactionsCSV(inPeriod, categories, me.members, `بيتنا-${period === "month" ? month.slice(0, 7) : year}-${scope}.csv`)}>
                <FileDown className="size-4" /> CSV
              </Button>
              <Link
                href={`/report?${period === "month" ? `month=${month.slice(0, 7)}` : `year=${year}`}&scope=${scope}`}
                className={buttonVariants({ variant: "secondary", block: true })}
              >
                <FileText className="size-4" /> تقرير PDF
              </Link>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="surface-card min-w-0 rounded-3xl p-4">
      <p className="text-xs text-foreground-muted">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold">{value}</p>
    </div>
  );
}
