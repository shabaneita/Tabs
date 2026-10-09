"use client";

import { Lock } from "lucide-react";
import { Amount, Num, useNumerals } from "@/components/ui/amount";
import { CategoryIcon } from "@/components/ui/category-icon";
import { ProgressRing } from "@/components/ui/progress";
import { formatDate } from "@/lib/dates";
import type { GoalWithContributions } from "@/lib/data/hooks";
import type { GoalProgress } from "@/lib/finance/savings";
import { goalKindMeta } from "@/lib/labels";

export function GoalMiniCard({ goal, onClick }: { goal: GoalWithContributions & { progress: GoalProgress }; onClick?: () => void }) {
  const meta = goalKindMeta(goal.kind);
  const numerals = useNumerals();
  return (
    <button type="button" onClick={onClick} className="pressable surface-card flex w-44 shrink-0 flex-col rounded-3xl p-4 text-start">
      <div className="flex items-center justify-between">
        <CategoryIcon icon={meta.icon} color={meta.color} size={36} />
        <ProgressRing value={goal.progress.pct} size={44} stroke={5}>
          <span className="text-[11px] font-semibold">
            <Num value={goal.progress.pct} />٪
          </span>
        </ProgressRing>
      </div>
      <p className="mt-3 flex items-center gap-1 truncate text-[15px] font-semibold">
        {goal.visibility === "private" ? <Lock className="size-3.5 shrink-0 text-foreground-subtle" /> : null}
        <span className="truncate">{goal.name}</span>
      </p>
      <p className="mt-0.5 text-[13px] text-foreground-muted">
        <Amount minor={goal.progress.currentMinor} className="font-semibold text-foreground" /> من <Amount minor={goal.target_minor} hideCurrency />
      </p>
      <p className="mt-1 text-xs text-foreground-subtle">
        {goal.progress.reached
          ? "تم الوصول للهدف 🎉"
          : goal.progress.estimatedCompletion
            ? `متوقع ${formatDate(goal.progress.estimatedCompletion, "month", numerals)}`
            : "حدد مساهمة شهرية للتقدير"}
      </p>
    </button>
  );
}
