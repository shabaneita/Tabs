"use client";

import { useEffect, useRef } from "react";
import { addDays, monthStart } from "@/lib/dates";
import { billOccurrences } from "@/lib/finance/bills";
import { computeBudgetSummary } from "@/lib/finance/budget";
import { installmentSummary } from "@/lib/finance/installments";
import { useBillPayments, useBills, useBudget, useCategories, useInvalidate, useMonthTransactions, usePlans, qk } from "@/lib/data/hooks";
import { getSupabase } from "@/lib/supabase/client";
import { useApp } from "./app-context";

/**
 * Derives reminder notifications (bills due/overdue, budget warnings,
 * installments due) from data the signed-in user can already read, and
 * stores them for that user only. Dedupe keys make this idempotent.
 */
export function AlertSync() {
  const { me, today } = useApp();
  const month = monthStart(today);
  const bills = useBills();
  const payments = useBillPayments();
  const budget = useBudget(month);
  const txs = useMonthTransactions(month);
  const cats = useCategories();
  const plans = usePlans();
  const invalidate = useInvalidate();
  const lastRun = useRef<string>("");

  useEffect(() => {
    if (!bills.data || !payments.data || !budget.data || !txs.data || !cats.data || !plans.data) return;
    const runKey = `${today}:${bills.dataUpdatedAt}:${budget.dataUpdatedAt}:${txs.dataUpdatedAt}:${plans.dataUpdatedAt}`;
    if (lastRun.current === runKey) return;
    lastRun.current = runKey;

    const s = me.settings;
    const rows: Record<string, unknown>[] = [];
    const base = { user_id: me.user.id, household_id: me.household.id };

    if (s.notify_bills) {
      const occ = billOccurrences(bills.data, payments.data, today, addDays(today, -45), addDays(today, 14));
      for (const o of occ) {
        if (o.status === "overdue") {
          rows.push({ ...base, kind: "bill_overdue", title: `فاتورة متأخرة: ${o.bill.name}`, body: null, link: "/more/bills", amount_minor: o.bill.amount_minor, entity_id: o.bill.id, dedupe_key: `bill:${o.bill.id}:${o.dueDate}:overdue` });
        } else if (o.status === "due_soon" && o.daysUntil <= Math.min(o.bill.reminder_days, s.bill_reminder_days)) {
          rows.push({ ...base, kind: "bill_due", title: `فاتورة قريبة: ${o.bill.name}`, body: o.daysUntil === 0 ? "مستحقة اليوم" : null, link: "/more/bills", amount_minor: o.bill.amount_minor, entity_id: o.bill.id, dedupe_key: `bill:${o.bill.id}:${o.dueDate}:due` });
        }
      }
      for (const p of plans.data) {
        if (!p.is_active) continue;
        const sum = installmentSummary(p, p.installment_payments, today);
        if (sum.nextDueDate && sum.nextDueDate >= today && sum.nextDueDate <= addDays(today, s.bill_reminder_days)) {
          rows.push({ ...base, kind: "installment_due", title: `قسط قريب: ${p.name}`, body: null, link: "/more/installments", amount_minor: sum.nextDueMinor, entity_id: p.id, dedupe_key: `inst:${p.id}:${sum.nextDueDate}` });
        }
      }
    }

    if (s.notify_budget) {
      const summary = computeBudgetSummary({
        month,
        today,
        totalAllocationMinor: budget.data.budget.total_allocation_minor,
        lines: budget.data.items,
        transactions: txs.data,
      });
      for (const c of summary.categories) {
        const name = cats.data.find((x) => x.id === c.categoryId)?.name ?? "";
        if (c.status === "over") {
          rows.push({ ...base, kind: "budget_exceeded", title: `تجاوزتم ميزانية ${name}`, body: null, link: "/budget", amount_minor: c.actualMinor - c.plannedMinor, entity_id: c.categoryId, dedupe_key: `budget:${month}:${c.categoryId}:over` });
        } else if (c.status === "near") {
          rows.push({ ...base, kind: "budget_warning", title: `اقتربتم من حد ميزانية ${name}`, body: `استهلاك ${c.pct}٪`, link: "/budget", amount_minor: c.remainingMinor, entity_id: c.categoryId, dedupe_key: `budget:${month}:${c.categoryId}:near` });
        }
      }
    }

    if (rows.length === 0) return;
    getSupabase()
      .from("notifications")
      .upsert(rows, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true })
      .then(({ error }) => {
        if (!error) invalidate(qk.notifications);
      });
  }, [bills.data, payments.data, budget.data, txs.data, cats.data, plans.data, bills.dataUpdatedAt, budget.dataUpdatedAt, txs.dataUpdatedAt, plans.dataUpdatedAt, today, month, me, invalidate]);

  return null;
}
