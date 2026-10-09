"use client";

import { Amount, Num } from "@/components/ui/amount";
import { CategoryIcon } from "@/components/ui/category-icon";
import { ProgressBar } from "@/components/ui/progress";
import type { CategoryBudget } from "@/lib/finance/budget";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CategorySpendingRow({ line, category, onClick }: { line: CategoryBudget; category?: Category; onClick?: () => void }) {
  const over = line.status === "over";
  const content = (
    <>
      <CategoryIcon icon={category?.icon ?? "tag"} color={category?.color ?? "sage"} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[15px] font-medium">{category?.name ?? "تصنيف"}</span>
          <span className="shrink-0 text-[13px] text-foreground-muted">
            <Amount minor={line.actualMinor} className="font-semibold text-foreground" />
            {line.plannedMinor > 0 ? (
              <>
                {" "}
                / <Amount minor={line.plannedMinor} hideCurrency />
              </>
            ) : null}
          </span>
        </div>
        <ProgressBar value={line.plannedMinor > 0 ? line.pct : line.actualMinor > 0 ? 100 : 0} className="mt-2" height={6} tone={line.status === "unplanned" ? "info" : undefined} />
        <div className="mt-1.5 flex justify-between text-xs">
          <span className={cn(over ? "text-danger" : line.status === "near" ? "text-warning" : "text-foreground-subtle")}>
            {line.status === "unplanned"
              ? "غير مخطط في الميزانية"
              : over
                ? <>تجاوز بـ <Amount minor={-line.remainingMinor} /></>
                : <>متبقي <Amount minor={line.remainingMinor} /></>}
          </span>
          {line.plannedMinor > 0 ? (
            <span className="text-foreground-subtle">
              <Num value={line.pct} />٪
            </span>
          ) : null}
        </div>
      </div>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="pressable flex w-full items-start gap-3 px-4 py-3.5 text-start hover:bg-muted/50">
      {content}
    </button>
  ) : (
    <div className="flex items-start gap-3 px-4 py-3.5">{content}</div>
  );
}
