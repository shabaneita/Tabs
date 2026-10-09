"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/components/app/app-context";
import { BillOccurrenceRow } from "@/components/dashboard/upcoming-bills";
import { TransactionRow } from "@/components/expense/transaction-list";
import { Amount, useNumerals } from "@/components/ui/amount";
import { ListGroup } from "@/components/ui/misc";
import { MonthSwitcher } from "@/components/ui/month-switcher";
import { PageHeader } from "@/components/ui/page-header";
import { useBillPayments, useBills, useCategories, useMonthTransactions, usePlans } from "@/lib/data/hooks";
import { addDays, daysInMonth, formatDate, monthEnd, monthStart } from "@/lib/dates";
import { localizeDigits } from "@/lib/money";
import { billOccurrences } from "@/lib/finance/bills";
import { installmentSummary } from "@/lib/finance/installments";
import { cn } from "@/lib/utils";

const WEEKDAYS = [
  { short: "ن", full: "الإثنين" },
  { short: "ث", full: "الثلاثاء" },
  { short: "ر", full: "الأربعاء" },
  { short: "خ", full: "الخميس" },
  { short: "ج", full: "الجمعة" },
  { short: "س", full: "السبت" },
  { short: "ح", full: "الأحد" },
];

export default function CalendarPage() {
  const { today } = useApp();
  const numerals = useNumerals();
  const [month, setMonth] = useState(monthStart(today));
  const [selected, setSelected] = useState(today);
  const { data: txs = [] } = useMonthTransactions(month);
  const { data: bills = [] } = useBills();
  const { data: payments = [] } = useBillPayments();
  const { data: plans = [] } = usePlans();
  const { data: categories = [] } = useCategories();

  const occ = useMemo(() => billOccurrences(bills, payments, today, monthStart(month), monthEnd(month)), [bills, payments, today, month]);
  const instDue = useMemo(
    () =>
      plans.flatMap((p) =>
        installmentSummary(p, p.installment_payments, today)
          .schedule.filter((s) => s.period.slice(0, 7) === month.slice(0, 7) && s.status !== "covered")
          .map((s) => ({ plan: p, date: s.period, status: s.status })),
      ),
    [plans, today, month],
  );

  const first = monthStart(month);
  // Week starts on Monday (UAE work week). JS: 0=Sun..6=Sat.
  const offset = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
  const cells: (string | null)[] = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth(first) }, (_, i) => addDays(first, i))];

  const spentOn = (d: string) => txs.filter((t) => t.occurred_on === d).reduce((s, t) => s + t.amount_minor, 0);
  const dayOcc = occ.filter((o) => o.dueDate === selected);
  const dayInst = instDue.filter((i) => i.date === selected);
  const dayTx = txs.filter((t) => t.occurred_on === selected);

  return (
    <div>
      <PageHeader title="التقويم المالي" back="/more" />
      <MonthSwitcher month={month} onChange={(m) => { setMonth(m); setSelected(m.slice(0, 7) === today.slice(0, 7) ? today : m); }} />
      <div className="surface-card mt-4 rounded-3xl p-3">
        <div className="grid grid-cols-7 gap-1 pb-2 text-center text-[11px] text-foreground-subtle">
          {WEEKDAYS.map((w) => (
            <abbr key={w.full} title={w.full} className="font-medium no-underline">
              {w.short}
            </abbr>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <span key={`e${i}`} />;
            const hasBill = occ.some((o) => o.dueDate === d);
            const overdue = occ.some((o) => o.dueDate === d && o.status === "overdue");
            const hasInst = instDue.some((x) => x.date === d);
            const spent = spentOn(d);
            const isSel = d === selected;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setSelected(d)}
                aria-pressed={isSel}
                aria-label={formatDate(d, "full", numerals)}
                className={cn("pressable flex aspect-square flex-col items-center justify-center rounded-xl text-sm", isSel ? "bg-primary text-primary-foreground" : d === today ? "bg-primary-soft text-primary" : "hover:bg-muted")}
              >
                <span className="font-semibold">{localizeDigits(String(Number(d.slice(8))), numerals)}</span>
                <span className="mt-0.5 flex h-1.5 gap-0.5">
                  {hasBill ? <span className={cn("size-1.5 rounded-full", overdue ? "bg-danger" : isSel ? "bg-white" : "bg-warning")} /> : null}
                  {hasInst ? <span className={cn("size-1.5 rounded-full", isSel ? "bg-white" : "bg-info")} /> : null}
                  {spent > 0 ? <span className={cn("size-1.5 rounded-full", isSel ? "bg-white/70" : "bg-primary/60")} /> : null}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-foreground-muted">
          <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-warning" /> فاتورة</span>
          <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-danger" /> متأخرة</span>
          <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-info" /> قسط</span>
          <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-primary/60" /> مصاريف</span>
        </div>
      </div>

      <h2 className="mb-2 mt-6 px-2 font-semibold">{formatDate(selected, "full", numerals)}</h2>
      {!dayOcc.length && !dayInst.length && !dayTx.length ? <p className="px-2 text-sm text-foreground-muted">لا يوجد شيء في هذا اليوم.</p> : null}
      {dayOcc.length ? (
        <ListGroup className="mb-3">
          {dayOcc.map((o) => (
            <BillOccurrenceRow key={o.bill.id} occ={o} />
          ))}
        </ListGroup>
      ) : null}
      {dayInst.length ? (
        <ListGroup className="mb-3">
          {dayInst.map((x) => (
            <div key={x.plan.id} className="flex items-center justify-between px-4 py-3">
              <span>
                <span className="block font-medium">قسط: {x.plan.name}</span>
                <span className="text-xs text-foreground-muted">{x.status === "paid" ? "مدفوع" : x.status === "overdue" ? "متأخر" : "مستحق"}</span>
              </span>
              <Amount minor={x.plan.monthly_amount_minor} className="font-semibold" />
            </div>
          ))}
        </ListGroup>
      ) : null}
      {dayTx.length ? (
        <ListGroup>
          {dayTx.map((t) => (
            <TransactionRow key={t.id} tx={t} category={categories.find((c) => c.id === t.category_id)} compact />
          ))}
        </ListGroup>
      ) : null}
    </div>
  );
}
