"use client";

import { ChevronRight, Printer } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useApp } from "@/components/app/app-context";
import { NestMark } from "@/components/brand";
import { Amount, Num, useNumerals, Pct } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { useBudget, useCategories, useTransactions } from "@/lib/data/hooks";
import { formatDate, isISODate, monthEnd, type ISODate } from "@/lib/dates";
import { filterByScope, totalsByCategory } from "@/lib/finance/analytics";
import { computeBudgetSummary } from "@/lib/finance/budget";
import { percentOf } from "@/lib/money";
import type { Scope } from "@/lib/types";

/**
 * Print-optimised Arabic report. "Save as PDF" from the browser's print
 * dialog renders Arabic shaping and RTL perfectly (no PDF font hacks).
 */
function ReportInner() {
  const { me, today } = useApp();
  const numerals = useNumerals();
  const router = useRouter();
  const params = useSearchParams();
  const scope = (["household", "mine", "all"].includes(params.get("scope") ?? "") ? params.get("scope") : "household") as Scope;
  const yearParam = params.get("year");
  const monthParam = params.get("month");
  const isYear = !!yearParam && /^\d{4}$/.test(yearParam);
  const month: ISODate = !isYear && monthParam && isISODate(`${monthParam}-01`) ? `${monthParam}-01` : `${today.slice(0, 7)}-01`;
  const from = isYear ? `${yearParam}-01-01` : month;
  const to = isYear ? `${yearParam}-12-31` : monthEnd(month);

  const { data: txs } = useTransactions(from, to);
  const { data: categories = [] } = useCategories();
  const budgetQ = useBudget(month, !isYear && scope === "household");

  if (!txs) return <Skeleton className="m-6 h-96 rounded-3xl" />;
  const rows = filterByScope(txs, scope, me.user.id);
  const total = rows.reduce((s, t) => s + t.amount_minor, 0);
  const cat = new Map(categories.map((c) => [c.id, c.name]));
  const byCat = totalsByCategory(rows);
  const summary =
    !isYear && scope === "household" && budgetQ.data
      ? computeBudgetSummary({ month, today, totalAllocationMinor: budgetQ.data.budget.total_allocation_minor, lines: budgetQ.data.items, transactions: rows })
      : null;
  const scopeLabel = { household: "مصاريف البيت المشتركة", mine: "مصاريفي الخاصة", all: "كل المصاريف المتاحة لي" }[scope];
  const periodLabel = isYear ? `سنة ${yearParam}` : formatDate(month, "month", numerals);

  return (
    <div className="force-light min-h-dvh bg-background text-foreground">
      <div className="no-print pt-safe sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ChevronRight className="size-4" /> رجوع
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="size-4" /> طباعة / حفظ PDF
        </Button>
      </div>

      <article className="mx-auto max-w-[800px] bg-white p-8 text-[13px] leading-relaxed text-[#1d2420]" data-testid="report">
        <header className="flex items-start justify-between border-b border-[#e7e1d5] pb-5">
          <div>
            <h1 className="text-2xl font-bold">تقرير {isYear ? "سنوي" : "شهري"} — {periodLabel}</h1>
            <p className="mt-1 text-[#5f6a64]">
              {me.household.name} · {scopeLabel}
            </p>
            <p className="text-xs text-[#87918b]">
              أُعدّ في {formatDate(today, "full", numerals)} بواسطة {me.profile.display_name}. يشمل فقط البيانات المسموح له برؤيتها.
            </p>
          </div>
          <NestMark size={44} />
        </header>

        <section className="print-avoid-break mt-6 grid grid-cols-3 gap-3">
          {summary ? (
            <>
              <Box label="ميزانية الشهر" value={<Amount minor={summary.totalAllocationMinor} />} />
              <Box label="المصروف الفعلي" value={<Amount minor={summary.actualTotalMinor} />} />
              <Box label={summary.remainingMinor >= 0 ? "المتبقي" : "التجاوز"} value={<Amount minor={Math.abs(summary.remainingMinor)} />} />
              <Box label="المخطط للتصنيفات" value={<Amount minor={summary.plannedTotalMinor} />} />
              <Box label="غير مخصص" value={<Amount minor={summary.unallocatedMinor} />} />
              <Box label="نسبة الاستهلاك" value={<><Pct value={summary.consumedPct} /></>} />
            </>
          ) : (
            <>
              <Box label="إجمالي المصروف" value={<Amount minor={total} />} />
              <Box label="عدد العمليات" value={<Num value={rows.length} />} />
              <Box label="عدد التصنيفات" value={<Num value={byCat.length} />} />
            </>
          )}
        </section>

        <section className="print-avoid-break mt-8">
          <h2 className="mb-3 text-base font-bold">{summary ? "الميزانية مقابل الفعلي" : "المصروف حسب التصنيف"}</h2>
          <table className="w-full border-collapse text-right">
            <thead>
              <tr className="border-b-2 border-[#d6cfbf] text-[#5f6a64]">
                <th className="py-2 font-semibold">التصنيف</th>
                {summary ? <th className="py-2 font-semibold">المخطط</th> : null}
                <th className="py-2 font-semibold">الفعلي</th>
                {summary ? <th className="py-2 font-semibold">المتبقي</th> : <th className="py-2 font-semibold">النسبة</th>}
              </tr>
            </thead>
            <tbody>
              {(summary
                ? summary.categories.map((c) => ({ id: c.categoryId, planned: c.plannedMinor, actual: c.actualMinor, rem: c.remainingMinor }))
                : byCat.map((c) => ({ id: c.categoryId, planned: 0, actual: c.totalMinor, rem: 0 }))
              ).map((r) => (
                <tr key={r.id} className="border-b border-[#efeae0]">
                  <td className="py-2">{cat.get(r.id) ?? "تصنيف"}</td>
                  {summary ? (
                    <td className="py-2">
                      <Amount minor={r.planned} />
                    </td>
                  ) : null}
                  <td className="py-2 font-semibold">
                    <Amount minor={r.actual} />
                  </td>
                  <td className={`py-2 ${summary && r.rem < 0 ? "text-[#b42318]" : ""}`}>
                    {summary ? <Amount minor={r.rem} /> : <><Pct value={percentOf(r.actual, total)} /></>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-base font-bold">العمليات</h2>
          {rows.length ? (
            <table className="w-full border-collapse text-right">
              <thead>
                <tr className="border-b-2 border-[#d6cfbf] text-[#5f6a64]">
                  <th className="py-2 font-semibold">التاريخ</th>
                  <th className="py-2 font-semibold">الوصف</th>
                  <th className="py-2 font-semibold">التصنيف</th>
                  <th className="py-2 font-semibold">النوع</th>
                  <th className="py-2 font-semibold">المبلغ</th>
                </tr>
              </thead>
              <tbody>
                {[...rows].reverse().map((t) => (
                  <tr key={t.id} className="print-avoid-break border-b border-[#efeae0]">
                    <td className="whitespace-nowrap py-1.5">{formatDate(t.occurred_on, "dayMonth", numerals)}</td>
                    <td className="py-1.5">{t.description ?? "—"}</td>
                    <td className="py-1.5">{cat.get(t.category_id) ?? ""}</td>
                    <td className="py-1.5">{t.visibility === "shared" ? "مشترك" : "خاص"}</td>
                    <td className="py-1.5 font-semibold">
                      <Amount minor={t.amount_minor} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#d6cfbf] font-bold">
                  <td className="py-2" colSpan={4}>
                    الإجمالي
                  </td>
                  <td className="py-2">
                    <Amount minor={total} />
                  </td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <p className="text-[#5f6a64]">لا توجد عمليات في هذه الفترة.</p>
          )}
        </section>

        <footer className="mt-10 border-t border-[#e7e1d5] pt-3 text-center text-[11px] text-[#87918b]">
          بيتنا — جميع المبالغ بالدرهم الإماراتي وتواريخ بتوقيت دبي. المبالغ المخططة تقديرات وليست مدفوعات.
        </footer>
      </article>
    </div>
  );
}

function Box({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#e7e1d5] p-3">
      <p className="text-[11px] text-[#5f6a64]">{label}</p>
      <p className="mt-0.5 text-base font-bold">{value}</p>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense>
      <ReportInner />
    </Suspense>
  );
}
