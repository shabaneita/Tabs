"use client";

import { Plus } from "lucide-react";
import { motion } from "motion/react";
import { Amount, Num, Pct } from "@/components/ui/amount";
import { ProgressRing, toneForPct } from "@/components/ui/progress";
import { useQuickAdd } from "@/components/expense/quick-add";
import type { BudgetSummary } from "@/lib/finance/budget";

/** The hero: month budget, actual, remaining and % consumed. */
export function HeroCard({ summary }: { summary: BudgetSummary }) {
  const { open } = useQuickAdd();
  const over = summary.remainingMinor < 0;
  const tone = toneForPct(summary.consumedPct);
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
      className="hero-gradient relative overflow-hidden rounded-[28px] p-5 text-hero-foreground shadow-float"
      aria-label="ملخص ميزانية الشهر"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm opacity-80">ميزانية الشهر</p>
          <Amount minor={summary.totalAllocationMinor} className="mt-0.5 text-lg font-semibold" />
          <p className="mt-4 text-sm opacity-80">{over ? "تجاوزتم الميزانية بـ" : "المتبقي من الميزانية"}</p>
          <Amount minor={Math.abs(summary.remainingMinor)} className="text-[38px] font-bold leading-tight tracking-tight" testId="hero-remaining" />
        </div>
        <ProgressRing
          value={summary.consumedPct}
          size={104}
          stroke={10}
          tone={tone === "primary" ? "hero" : tone}
          track="rgb(255 255 255 / 0.14)"
          label={`تم استهلاك ${summary.consumedPct}٪ من الميزانية`}
        >
          <div>
            <p className="text-2xl font-bold leading-none">
              <Pct value={summary.consumedPct} />
            </p>
            <p className="mt-1 text-[11px] opacity-75">مستهلك</p>
          </div>
        </ProgressRing>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl bg-white/10 p-3 backdrop-blur-sm">
        <div>
          <p className="text-xs opacity-75">المصروف الفعلي</p>
          <Amount minor={summary.actualTotalMinor} className="text-base font-semibold" />
        </div>
        <div>
          <p className="text-xs opacity-75">{summary.unallocatedMinor >= 0 ? "غير مخصص" : "مخطط زيادة"}</p>
          <Amount minor={Math.abs(summary.unallocatedMinor)} className="text-base font-semibold" />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs opacity-80">
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
          <span className="block h-full rounded-full bg-white/70" style={{ width: `${summary.elapsedPct}%` }} />
        </span>
        <span>
          مضى <Pct value={summary.elapsedPct} /> من الشهر
        </span>
      </div>

      <button
        type="button"
        onClick={() => open()}
        className="pressable mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white text-[15px] font-semibold text-[#0a4f3a] dark:bg-[#e9f6ef]"
      >
        <Plus className="size-5" strokeWidth={2.4} /> أضف مصروف
      </button>
    </motion.section>
  );
}
