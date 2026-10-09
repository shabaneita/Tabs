"use client";

import { Lock, ReceiptText, Search, Users, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { useApp } from "@/components/app/app-context";
import { TransactionGroups } from "@/components/expense/transaction-list";
import { useQuickAdd } from "@/components/expense/quick-add";
import { Amount, useNumerals } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { MonthSwitcher } from "@/components/ui/month-switcher";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { useCategories, useTransactions } from "@/lib/data/hooks";
import { addMonths, arabicCount, monthEnd, monthStart } from "@/lib/dates";
import { filterByScope } from "@/lib/finance/analytics";
import { normalizeDigits, parseAmountToMinor } from "@/lib/money";
import type { Scope } from "@/lib/types";
import { cn } from "@/lib/utils";

function ExpensesInner() {
  const { me, today } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const { open } = useQuickAdd();
  const numerals = useNumerals();
  const scope = (["all", "household", "mine"].includes(params.get("scope") ?? "") ? params.get("scope") : "all") as Scope;
  const [month, setMonth] = useState(monthStart(today));
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [owner, setOwner] = useState<"any" | "me" | "partner">("any");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searching = query.trim().length > 0;

  // Search spans the last 12 months; browsing shows one month.
  const from = searching ? addMonths(monthStart(today), -11) : month;
  const to = searching ? monthEnd(today) : monthEnd(month);
  const { data: txs, isLoading } = useTransactions(from, to);
  const { data: categories = [] } = useCategories();

  const setScope = (s: Scope) => {
    const sp = new URLSearchParams(params);
    if (s === "all") sp.delete("scope");
    else sp.set("scope", s);
    router.replace(`/expenses${sp.size ? `?${sp}` : ""}`, { scroll: false });
  };

  const filtered = useMemo(() => {
    let list = filterByScope(txs ?? [], scope, me.user.id);
    if (categoryId) list = list.filter((t) => t.category_id === categoryId);
    if (owner === "me") list = list.filter((t) => t.owner_id === me.user.id);
    if (owner === "partner") list = list.filter((t) => t.owner_id !== me.user.id);
    if (searching) {
      const q = normalizeDigits(query.trim()).toLowerCase();
      const asAmount = parseAmountToMinor(q);
      const catNames = new Map(categories.map((c) => [c.id, c.name.toLowerCase()]));
      list = list.filter(
        (t) =>
          (t.description ?? "").toLowerCase().includes(q) ||
          (catNames.get(t.category_id) ?? "").includes(q) ||
          (asAmount !== null && t.amount_minor === asAmount),
      );
    }
    return list;
  }, [txs, scope, me.user.id, categoryId, owner, searching, query, categories]);

  const total = filtered.reduce((s, t) => s + t.amount_minor, 0);
  const usedCategories = categories.filter((c) => (txs ?? []).some((t) => t.category_id === c.id));

  return (
    <div>
      <PageHeader
        title="المصاريف"
        actions={
          <Button variant="ghost" size="icon" aria-label="بحث" onClick={() => setSearchOpen((o) => !o)}>
            {searchOpen ? <X className="size-5" /> : <Search className="size-5" />}
          </Button>
        }
      />

      {searchOpen ? (
        <div className="mb-3">
          <Input autoFocus type="search" placeholder="ابحث بالوصف أو التصنيف أو المبلغ" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="بحث في المصاريف" />
          <p className="mt-1 px-1 text-xs text-foreground-subtle">البحث يشمل آخر ١٢ شهرًا من المصاريف المتاحة لك.</p>
        </div>
      ) : null}

      <Segmented<Scope>
        ariaLabel="نطاق المصاريف"
        value={scope}
        onChange={setScope}
        size="sm"
        options={[
          { value: "all", label: "كل المتاح لي" },
          { value: "household", label: "مصاريف البيت", icon: <Users className="size-3.5" /> },
          { value: "mine", label: "مصاريفي الخاصة", icon: <Lock className="size-3.5" /> },
        ]}
      />

      {!searching ? <MonthSwitcher month={month} onChange={setMonth} max={today} className="mt-3" /> : null}

      <div className="mt-4 flex items-end justify-between px-1">
        <div>
          <p className="text-sm text-foreground-muted">{searching ? "نتائج البحث" : "الإجمالي"}</p>
          <Amount minor={total} className="text-[28px] font-bold" testId="expenses-total" />
        </div>
        <p className="pb-1.5 text-sm text-foreground-subtle">
          {arabicCount(filtered.length, "transaction", numerals)}
        </p>
      </div>

      {/* Filters */}
      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {scope !== "mine" && me.partner ? (
          <select
            value={owner}
            onChange={(e) => setOwner(e.target.value as typeof owner)}
            className={cn("h-9 shrink-0 rounded-full border px-3 text-[13px] font-medium", owner !== "any" ? "border-primary/40 bg-primary-soft text-primary" : "border-border bg-card text-foreground-muted")}
            aria-label="أضافها"
          >
            <option value="any">أضافها: الجميع</option>
            <option value="me">أضفتها أنا</option>
            <option value="partner">أضافها {me.partner.display_name}</option>
          </select>
        ) : null}
        <FilterChip active={!categoryId} onClick={() => setCategoryId(null)}>
          كل التصنيفات
        </FilterChip>
        {usedCategories.map((c) => (
          <FilterChip key={c.id} active={categoryId === c.id} onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}>
            {c.name}
          </FilterChip>
        ))}
      </div>

      <div className="mt-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-40 rounded-3xl" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-28 rounded-3xl" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<ReceiptText />}
            title={searching ? "لا توجد نتائج" : "لا توجد مصاريف في هذه الفترة"}
            description={scope === "mine" ? "مصاريفك الخاصة تظهر لك وحدك." : "سجّل المصروف في ثوانٍ: المبلغ، التصنيف، حفظ."}
            action={!searching ? <Button onClick={() => open()}>أضف مصروف</Button> : undefined}
          />
        ) : (
          <TransactionGroups transactions={filtered} categories={categories} />
        )}
      </div>
    </div>
  );
}

function FilterChip({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "pressable h-9 shrink-0 rounded-full border px-3.5 text-[13px] font-medium",
        active ? "border-primary/40 bg-primary-soft text-primary" : "border-border bg-card text-foreground-muted",
      )}
    >
      {children}
    </button>
  );
}

export default function ExpensesPage() {
  return (
    <Suspense>
      <ExpensesInner />
    </Suspense>
  );
}
