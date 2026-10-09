"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, formatDate, monthStart, type ISODate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { useNumerals } from "./amount";

/** Month selector. In RTL, "previous" points right and "next" points left. */
export function MonthSwitcher({
  month,
  onChange,
  max,
  className,
}: {
  month: ISODate;
  onChange: (m: ISODate) => void;
  max?: ISODate;
  className?: string;
}) {
  const numerals = useNumerals();
  const next = addMonths(monthStart(month), 1);
  const canNext = !max || next <= monthStart(max);
  return (
    <div className={cn("flex items-center justify-between rounded-2xl bg-card p-1 shadow-card ring-1 ring-border", className)}>
      <button type="button" className="pressable grid size-10 place-items-center rounded-xl hover:bg-muted" onClick={() => onChange(addMonths(monthStart(month), -1))} aria-label="الشهر السابق">
        <ChevronRight className="size-5" />
      </button>
      <span className="text-[15px] font-semibold" aria-live="polite">
        {formatDate(month, "month", numerals)}
      </span>
      <button
        type="button"
        className="pressable grid size-10 place-items-center rounded-xl hover:bg-muted disabled:opacity-30"
        onClick={() => canNext && onChange(next)}
        disabled={!canNext}
        aria-label="الشهر التالي"
      >
        <ChevronLeft className="size-5" />
      </button>
    </div>
  );
}
