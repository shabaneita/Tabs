"use client";

import { Lock, Paperclip, Repeat } from "lucide-react";
import { motion } from "motion/react";
import { useApp } from "@/components/app/app-context";
import { Amount, useNumerals } from "@/components/ui/amount";
import { CategoryIcon } from "@/components/ui/category-icon";
import { Avatar } from "@/components/ui/misc";
import { formatDate, relativeDayLabel } from "@/lib/dates";
import type { Category, Transaction } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useQuickAdd } from "./quick-add";

export function TransactionRow({ tx, category, compact }: { tx: Transaction; category?: Category; compact?: boolean }) {
  const { me } = useApp();
  const { edit } = useQuickAdd();
  const owner = me.members.find((m) => m.id === tx.owner_id);
  const mine = tx.owner_id === me.user.id;
  return (
    <button
      type="button"
      onClick={() => edit(tx)}
      className="pressable flex w-full items-center gap-3 px-4 py-3 text-start hover:bg-muted/50"
      data-testid="transaction-row"
    >
      <span className="relative">
        <CategoryIcon icon={category?.icon ?? "tag"} color={category?.color ?? "sage"} size={compact ? 38 : 42} />
        {!mine && owner ? (
          <span className="absolute -bottom-1 -start-1">
            <Avatar name={owner.display_name} color={owner.avatar_color} size={18} />
          </span>
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[15px] font-medium">{tx.description || category?.name || "مصروف"}</span>
          {tx.visibility === "private" ? <Lock className="size-3.5 shrink-0 text-foreground-subtle" aria-label="خاص" /> : null}
          {tx.bill_id || tx.installment_plan_id ? <Repeat className="size-3.5 shrink-0 text-foreground-subtle" aria-label="دفعة مجدولة" /> : null}
          {tx.receipt_attachments?.length ? <Paperclip className="size-3.5 shrink-0 text-foreground-subtle" aria-label="إيصال" /> : null}
        </span>
        <span className="block truncate text-[13px] text-foreground-muted">
          {tx.description ? category?.name : null}
          {tx.description && !mine && owner ? " · " : null}
          {!mine && owner ? owner.display_name : null}
          {!tx.description && mine ? (tx.visibility === "shared" ? "مصروف البيت" : "خاص بي") : null}
        </span>
      </span>
      <Amount minor={tx.amount_minor} className="shrink-0 text-[15px] font-semibold" />
    </button>
  );
}

/** Transactions grouped by day with sticky Arabic day headers. */
export function TransactionGroups({ transactions, categories }: { transactions: Transaction[]; categories: Category[] }) {
  const { today } = useApp();
  const numerals = useNumerals();
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const groups = new Map<string, Transaction[]>();
  for (const t of transactions) groups.set(t.occurred_on, [...(groups.get(t.occurred_on) ?? []), t]);

  return (
    <div className="space-y-4">
      {[...groups.entries()].map(([day, list], gi) => {
        const total = list.reduce((s, t) => s + t.amount_minor, 0);
        return (
          <motion.section
            key={day}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(gi * 0.03, 0.2), duration: 0.3 }}
          >
            <div className="mb-1.5 flex items-baseline justify-between px-2">
              <h3 className="text-sm font-semibold text-foreground-muted">
                {relativeDayLabel(day, today, numerals)}
                {relativeDayLabel(day, today, numerals) !== formatDate(day, "dayMonth", numerals) ? (
                  <span className="ms-2 font-normal text-foreground-subtle">{formatDate(day, "dayMonth", numerals)}</span>
                ) : null}
              </h3>
              <Amount minor={total} className="text-xs text-foreground-subtle" />
            </div>
            <div className={cn("surface-card divide-y divide-border overflow-hidden rounded-3xl")}>
              {list.map((t) => (
                <TransactionRow key={t.id} tx={t} category={catMap.get(t.category_id)} />
              ))}
            </div>
          </motion.section>
        );
      })}
    </div>
  );
}
