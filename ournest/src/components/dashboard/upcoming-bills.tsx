"use client";

import { CheckCircle2 } from "lucide-react";
import { useApp } from "@/components/app/app-context";
import { useQuickAdd } from "@/components/expense/quick-add";
import { Amount, useNumerals } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { CategoryIcon } from "@/components/ui/category-icon";
import { Badge } from "@/components/ui/misc";
import { formatDate, relativeDayLabel } from "@/lib/dates";
import type { BillOccurrence } from "@/lib/finance/bills";
import { billKindMeta } from "@/lib/labels";
import type { RecurringBill } from "@/lib/types";

export function BillOccurrenceRow({ occ, showPay = true }: { occ: BillOccurrence<RecurringBill>; showPay?: boolean }) {
  const { today } = useApp();
  const numerals = useNumerals();
  const { open } = useQuickAdd();
  const meta = billKindMeta(occ.bill.kind);
  const tone = occ.status === "overdue" ? "danger" : occ.status === "due_soon" ? "warning" : occ.status === "paid" ? "primary" : "muted";
  const label =
    occ.status === "paid" ? "مدفوعة" : occ.status === "overdue" ? `متأخرة · ${formatDate(occ.dueDate, "dayMonth", numerals)}` : relativeDayLabel(occ.dueDate, today, numerals);
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <CategoryIcon icon={meta.icon} color={occ.status === "overdue" ? "rose" : "sage"} size={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium">{occ.bill.name}</p>
        <div className="mt-0.5 flex items-center gap-2">
          <Badge tone={tone}>{label}</Badge>
          {occ.bill.is_variable ? <span className="text-xs text-foreground-subtle">مبلغ تقديري</span> : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Amount minor={occ.bill.amount_minor} className="text-[15px] font-semibold" />
        {showPay && occ.status !== "paid" ? (
          <Button
            size="sm"
            variant="secondary"
            className="h-8 rounded-lg px-3 text-xs"
            onClick={() =>
              open({
                title: `دفع ${occ.bill.name}`,
                amountMinor: occ.bill.amount_minor,
                categoryId: occ.bill.category_id,
                visibility: occ.bill.visibility,
                lockVisibility: true,
                description: occ.bill.name,
                billId: occ.bill.id,
                billPeriod: occ.dueDate,
                occurredOn: today,
              })
            }
          >
            تسجيل الدفع
          </Button>
        ) : occ.status === "paid" ? (
          <CheckCircle2 className="size-5 text-primary" aria-label="مدفوعة" />
        ) : null}
      </div>
    </div>
  );
}
