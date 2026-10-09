"use client";

import { useMemo } from "react";
import { useApp } from "@/components/app/app-context";
import { addDays, addMonths, monthEnd, monthStart } from "../dates";
import { billOccurrences } from "../finance/bills";
import { computeBudgetSummary } from "../finance/budget";
import { monthlyIncomeTotal } from "../finance/income";
import { generateInsights } from "../finance/insights";
import { goalProgress } from "../finance/savings";
import { useBillPayments, useBills, useBudget, useCategories, useGoals, useIncome, useTransactions } from "./hooks";

/** Loads everything the dashboard/analytics need and derives summaries. */
export function useMonthOverview() {
  const { me, today } = useApp();
  const month = monthStart(today);
  const historyFrom = addMonths(month, -3);
  const txQ = useTransactions(historyFrom, monthEnd(month));
  const budgetQ = useBudget(month);
  const catQ = useCategories();
  const billsQ = useBills();
  const payQ = useBillPayments();
  const goalsQ = useGoals();
  const incomeQ = useIncome();

  const data = useMemo(() => {
    if (!txQ.data || !budgetQ.data || !catQ.data) return null;
    const monthTx = txQ.data.filter((t) => t.occurred_on >= month);
    const summary = computeBudgetSummary({
      month,
      today,
      totalAllocationMinor: budgetQ.data.budget.total_allocation_minor,
      lines: budgetQ.data.items,
      transactions: monthTx,
    });
    const occurrences = billsQ.data && payQ.data ? billOccurrences(billsQ.data, payQ.data, today, addDays(today, -45), addDays(today, 30)) : [];
    const goals = (goalsQ.data ?? [])
      .filter((g) => !g.is_archived)
      .map((g) => ({ ...g, progress: goalProgress(g, g.savings_contributions, today) }));
    const personalIncomeMinor = incomeQ.data ? monthlyIncomeTotal(incomeQ.data, month) : 0;
    const insights = generateInsights({
      today,
      month,
      numerals: me.settings.numerals,
      categories: catQ.data,
      budget: summary,
      transactions: txQ.data,
      bills: occurrences,
      goals,
      viewerId: me.user.id,
      personalIncomeMinor,
    });
    const myPrivateMonth = monthTx.filter((t) => t.visibility === "private" && t.owner_id === me.user.id).reduce((s, t) => s + t.amount_minor, 0);
    return { month, monthTx, allTx: txQ.data, summary, occurrences, goals, insights, personalIncomeMinor, myPrivateMonth, categories: catQ.data };
  }, [txQ.data, budgetQ.data, catQ.data, billsQ.data, payQ.data, goalsQ.data, incomeQ.data, month, today, me]);

  return { data, isLoading: !data && (txQ.isLoading || budgetQ.isLoading || catQ.isLoading), error: txQ.error || budgetQ.error || catQ.error };
}
