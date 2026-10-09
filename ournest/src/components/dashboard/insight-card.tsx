"use client";

import { AlertTriangle, ChevronDown, Info, Lightbulb, Lock, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import type { Insight } from "@/lib/finance/insights";
import { cn } from "@/lib/utils";

const STYLES = {
  critical: { icon: AlertTriangle, cls: "bg-danger-soft text-danger" },
  warning: { icon: AlertTriangle, cls: "bg-warning-soft text-warning" },
  info: { icon: Lightbulb, cls: "bg-info-soft text-info" },
  positive: { icon: Sparkles, cls: "bg-primary-soft text-primary" },
} as const;

export function InsightCard({ insight }: { insight: Insight }) {
  const [open, setOpen] = useState(false);
  const s = STYLES[insight.severity];
  const Icon = s.icon;
  return (
    <div className="surface-card rounded-3xl p-4" data-testid="insight">
      <div className="flex gap-3">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-2xl", s.cls)}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-snug">{insight.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-foreground-muted">{insight.body}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 text-xs font-medium text-foreground-subtle" aria-expanded={open}>
              <Info className="size-3.5" /> كيف حسبناها؟
              <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
            </button>
            {insight.href ? (
              <Link href={insight.href} className="text-xs font-semibold text-primary">
                التفاصيل
              </Link>
            ) : null}
            {insight.scope === "personal" ? (
              <span className="flex items-center gap-1 text-xs text-foreground-subtle">
                <Lock className="size-3" /> يظهر لك وحدك
              </span>
            ) : null}
          </div>
          <AnimatePresence initial={false}>
            {open ? (
              <motion.p
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden text-[13px] leading-relaxed text-foreground-muted"
              >
                <span className="mt-2 block rounded-2xl bg-muted p-3">{insight.explanation}</span>
              </motion.p>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
