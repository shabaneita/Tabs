"use client";

import { CalendarClock, CreditCard, HandCoins, Info, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { CategorySpendingRow } from "@/components/dashboard/category-spending";
import { TransactionRow } from "@/components/expense/transaction-list";
import { Amount, Num } from "@/components/ui/amount";
import { AmountInput } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { CategoryIcon } from "@/components/ui/category-icon";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Field } from "@/components/ui/input";
import { Avatar, ListGroup, Skeleton } from "@/components/ui/misc";
import { MonthSwitcher } from "@/components/ui/month-switcher";
import { PageHeader } from "@/components/ui/page-header";
import { Sheet } from "@/components/ui/sheet";
import {
  SPENDING_KEYS, qk, useBillPayments, useBills, useBudget, useCategories, useContributions, useInvalidate, useMonthTransactions, usePlans,
} from "@/lib/data/hooks";
import { addMonths, monthEnd, monthStart, type ISODate } from "@/lib/dates";
import { arabicError } from "@/lib/errors";
import { billOccurrences } from "@/lib/finance/bills";
import { computeBudgetSummary, type CategoryBudget } from "@/lib/finance/budget";
import { installmentSummary, monthlyInstallmentCommitment } from "@/lib/finance/installments";
import { getSupabase } from "@/lib/supabase/client";
import type { BudgetItem, Category, HouseholdContribution } from "@/lib/types";

export default function BudgetPage() {
  const { me, today } = useApp();
  const [month, setMonth] = useState<ISODate>(monthStart(today));
  const budgetQ = useBudget(month);
  const txQ = useMonthTransactions(month);
  const { data: categories = [] } = useCategories();
  const { data: contributions = [] } = useContributions();
  const { data: plans = [] } = usePlans();
  const { data: bills = [] } = useBills();
  const { data: payments = [] } = useBillPayments();
  const [editTotal, setEditTotal] = useState(false);
  const [editLine, setEditLine] = useState<{ line: CategoryBudget; item?: BudgetItem } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [contribOpen, setContribOpen] = useState(false);

  const summary = useMemo(() => {
    if (!budgetQ.data || !txQ.data) return null;
    return computeBudgetSummary({
      month,
      today,
      totalAllocationMinor: budgetQ.data.budget.total_allocation_minor,
      lines: budgetQ.data.items,
      transactions: txQ.data,
    });
  }, [budgetQ.data, txQ.data, month, today]);

  const catMap = new Map(categories.map((c) => [c.id, c]));
  const sharedPlans = plans.filter((p) => p.visibility === "shared");
  const installmentImpact = monthlyInstallmentCommitment(sharedPlans.map((p) => ({ ...p, summary: installmentSummary(p, p.installment_payments, today) })));
  const remainingBills = billOccurrences(bills.filter((b) => b.visibility === "shared"), payments, today, monthStart(month), monthEnd(month)).filter((o) => o.status !== "paid");
  const remainingBillsTotal = remainingBills.reduce((s, o) => s + o.bill.amount_minor, 0);

  // Latest contribution per member effective for this month.
  const contribFor = (userId: string): HouseholdContribution | undefined =>
    contributions.filter((c) => c.user_id === userId && c.effective_month <= monthStart(month)).sort((a, b) => (a.effective_month < b.effective_month ? 1 : -1))[0];
  const totalContrib = me.members.reduce((s, m) => s + (contribFor(m.id)?.monthly_amount_minor ?? 0), 0);

  const budgetCategoryIds = new Set(budgetQ.data?.items.map((i) => i.category_id));
  const addable = categories.filter((c) => c.visibility === "shared" && !c.is_archived && !budgetCategoryIds.has(c.id));

  return (
    <div>
      <PageHeader title="الميزانية" subtitle="ميزانية البيت المشتركة" />
      <MonthSwitcher month={month} onChange={setMonth} max={addMonths(monthStart(today), 1)} />

      {!summary ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-56 rounded-3xl" />
          <Skeleton className="h-80 rounded-3xl" />
        </div>
      ) : (
        <>
          <Card className="mt-4 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-foreground-muted">ميزانية الشهر</p>
                <Amount minor={summary.totalAllocationMinor} className="text-[30px] font-bold" testId="budget-total" />
              </div>
              <Button variant="secondary" size="sm" onClick={() => setEditTotal(true)}>
                <Pencil className="size-4" /> تعديل
              </Button>
            </div>

            {/* Allocation bar: planned vs unallocated */}
            <div className="mt-4">
              <div className="flex h-3 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div className="h-full bg-primary" style={{ width: `${Math.min(100, (summary.actualTotalMinor / Math.max(1, summary.totalAllocationMinor)) * 100)}%` }} />
                <div
                  className="h-full bg-primary/25"
                  style={{ width: `${Math.max(0, Math.min(100, ((summary.plannedTotalMinor - summary.actualTotalMinor) / Math.max(1, summary.totalAllocationMinor)) * 100))}%` }}
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground-muted">
                <Legend className="bg-primary">مصروف فعلي</Legend>
                <Legend className="bg-primary/25">مخطط لم يُصرف بعد</Legend>
                <Legend className="bg-muted ring-1 ring-border">غير مخصص</Legend>
              </div>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-3">
              <Stat label="المخطط للتصنيفات" value={<Amount minor={summary.plannedTotalMinor} />} />
              <Stat
                label={summary.unallocatedMinor >= 0 ? "غير مخصص" : "مخطط أكثر من الميزانية"}
                value={<Amount minor={Math.abs(summary.unallocatedMinor)} className={summary.unallocatedMinor < 0 ? "text-danger" : ""} />}
                testId="budget-unallocated"
              />
              <Stat label="المصروف الفعلي" value={<Amount minor={summary.actualTotalMinor} />} />
              <Stat
                label={summary.remainingMinor >= 0 ? "المتبقي من الميزانية" : "تجاوز الميزانية"}
                value={<Amount minor={Math.abs(summary.remainingMinor)} className={summary.remainingMinor < 0 ? "text-danger" : "text-primary"} />}
              />
            </dl>
            <p className="mt-4 flex gap-2 rounded-2xl bg-sage p-3 text-xs leading-relaxed text-foreground-muted">
              <Info className="mt-0.5 size-4 shrink-0 text-primary" />
              المبالغ المخططة تقديرات وليست مدفوعات. المصروف الفعلي يُحسب فقط من المصاريف المشتركة المسجلة — المصاريف الخاصة لا تدخل في ميزانية البيت.
            </p>
          </Card>

          {/* Commitments */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Link href="/more/installments" className="pressable surface-card rounded-3xl p-4">
              <CreditCard className="size-5 text-primary" />
              <p className="mt-2 text-xs text-foreground-muted">الأقساط والالتزامات شهريًا</p>
              <Amount minor={installmentImpact} className="text-base font-semibold" />
            </Link>
            <Link href="/more/bills" className="pressable surface-card rounded-3xl p-4">
              <CalendarClock className="size-5 text-primary" />
              <p className="mt-2 text-xs text-foreground-muted">فواتير متبقية هذا الشهر</p>
              <Amount minor={remainingBillsTotal} className="text-base font-semibold" />
            </Link>
          </div>

          <SectionTitle
            action={
              addable.length ? (
                <Button variant="ghost" size="sm" onClick={() => setAddOpen(true)}>
                  <Plus className="size-4" /> تصنيف
                </Button>
              ) : null
            }
          >
            التصنيفات
          </SectionTitle>
          <ListGroup>
            {summary.categories.map((line) => (
              <CategorySpendingRow
                key={line.categoryId}
                line={line}
                category={catMap.get(line.categoryId)}
                onClick={() => setEditLine({ line, item: budgetQ.data?.items.find((i) => i.category_id === line.categoryId) })}
              />
            ))}
          </ListGroup>

          {/* Contributions */}
          <SectionTitle
            action={
              <Button variant="ghost" size="sm" onClick={() => setContribOpen(true)}>
                <HandCoins className="size-4" /> مساهمتي
              </Button>
            }
          >
            مساهمات البيت
          </SectionTitle>
          <ListGroup>
            {me.members.map((m) => {
              const c = contribFor(m.id);
              return (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3.5">
                  <Avatar name={m.display_name} color={m.avatar_color} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{m.id === me.user.id ? "مساهمتي" : `مساهمة ${m.display_name}`}</p>
                    <p className="text-xs text-foreground-subtle">{c ? "مبلغ شهري معلن للبيت" : "لم تُحدَّد بعد"}</p>
                  </div>
                  {c ? <Amount minor={c.monthly_amount_minor} className="font-semibold" /> : <span className="text-sm text-foreground-subtle">—</span>}
                </div>
              );
            })}
            <div className="flex items-center justify-between bg-muted/50 px-4 py-3 text-sm">
              <span className="text-foreground-muted">إجمالي المساهمات مقابل الميزانية</span>
              <span className="font-semibold">
                <Amount minor={totalContrib} /> / <Amount minor={summary.totalAllocationMinor} hideCurrency />
              </span>
            </div>
          </ListGroup>
          <p className="mt-2 px-1 text-xs leading-relaxed text-foreground-subtle">
            المساهمة هي ما يختار كل منكما وضعه في البيت، وليست الراتب. الدخل الشخصي يبقى خاصًا ولا يظهر هنا.
          </p>

          <TotalSheet open={editTotal} onOpenChange={setEditTotal} budgetId={budgetQ.data!.budget.id} current={summary.totalAllocationMinor} month={month} />
          {editLine ? (
            <LineSheet
              key={editLine.line.categoryId}
              onClose={() => setEditLine(null)}
              line={editLine.line}
              item={editLine.item}
              category={catMap.get(editLine.line.categoryId)}
              budgetId={budgetQ.data!.budget.id}
              month={month}
            />
          ) : null}
          <AddCategorySheet open={addOpen} onOpenChange={setAddOpen} categories={addable} budgetId={budgetQ.data!.budget.id} householdId={me.household.id} month={month} />
          <ContributionSheet open={contribOpen} onOpenChange={setContribOpen} current={contribFor(me.user.id)} month={month} />
        </>
      )}
    </div>
  );
}

function Legend({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-2.5 rounded-full ${className}`} />
      {children}
    </span>
  );
}

function Stat({ label, value, testId }: { label: string; value: React.ReactNode; testId?: string }) {
  return (
    <div className="rounded-2xl bg-muted/60 p-3" data-testid={testId}>
      <dt className="text-xs text-foreground-muted">{label}</dt>
      <dd className="mt-0.5 text-base font-semibold">{value}</dd>
    </div>
  );
}

function TotalSheet({ open, onOpenChange, budgetId, current, month }: { open: boolean; onOpenChange: (o: boolean) => void; budgetId: string; current: number; month: ISODate }) {
  const [value, setValue] = useState<number | null>(current);
  const [saving, setSaving] = useState(false);
  const invalidate = useInvalidate();
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="ميزانية الشهر"
      description="المبلغ المخصص لمصاريف البيت هذا الشهر."
      footer={
        <Button
          size="lg"
          block
          loading={saving}
          disabled={value === null}
          onClick={async () => {
            setSaving(true);
            const { error } = await getSupabase().from("budgets").update({ total_allocation_minor: value }).eq("id", budgetId);
            setSaving(false);
            if (error) return toast.error(arabicError(error));
            await invalidate(qk.budget(month));
            toast.success("تم تحديث الميزانية");
            onOpenChange(false);
          }}
        >
          حفظ
        </Button>
      }
    >
      <Field label="المبلغ الشهري" htmlFor="total">
        <AmountInput id="total" value={value} onChange={setValue} allowZero />
      </Field>
      <p className="mt-3 text-xs leading-relaxed text-foreground-subtle">الميزانية تخصيص للبيت وليست تعبيرًا عن دخل أي منكما. التغيير يسري على هذا الشهر، والأشهر الجديدة تنسخ آخر ميزانية.</p>
    </Sheet>
  );
}

function LineSheet({
  onClose,
  line,
  item,
  category,
  budgetId,
  month,
}: {
  onClose: () => void;
  line: CategoryBudget;
  item?: BudgetItem;
  category?: Category;
  budgetId: string;
  month: ISODate;
}) {
  const { me } = useApp();
  const [open, setOpen] = useState(true);
  const [value, setValue] = useState<number | null>(item?.planned_minor ?? 0);
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const invalidate = useInvalidate();
  const txQ = useMonthTransactions(month);
  const txs = (txQ.data ?? []).filter((t) => t.category_id === line.categoryId && t.visibility === "shared");
  const close = () => {
    setOpen(false);
    setTimeout(onClose, 250);
  };

  async function save() {
    if (value === null) return;
    setSaving(true);
    const sb = getSupabase();
    const res = item
      ? await sb.from("budget_items").update({ planned_minor: value }).eq("id", item.id)
      : await sb.from("budget_items").insert({ budget_id: budgetId, household_id: me.household.id, category_id: line.categoryId, planned_minor: value });
    setSaving(false);
    if (res.error) return toast.error(arabicError(res.error));
    await invalidate(qk.budget(month));
    toast.success("تم تحديث المخطط");
    close();
  }

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(o) => (o ? setOpen(true) : close())}
        title={
          <span className="flex items-center gap-3">
            <CategoryIcon icon={category?.icon ?? "tag"} color={category?.color ?? "sage"} size={36} />
            {category?.name ?? "تصنيف"}
          </span>
        }
        footer={
          <div className="flex gap-2">
            {item ? (
              <Button variant="danger-soft" size="lg" className="w-14 px-0" aria-label="إزالة من الميزانية" onClick={() => setConfirmRemove(true)}>
                <Trash2 className="size-5" />
              </Button>
            ) : null}
            <Button size="lg" block loading={saving} disabled={value === null} onClick={save}>
              حفظ المخطط
            </Button>
          </div>
        }
      >
        <div className="mb-4 grid grid-cols-3 gap-2 text-center">
          <MiniStat label="المخطط" value={<Amount minor={line.plannedMinor} />} />
          <MiniStat label="الفعلي" value={<Amount minor={line.actualMinor} />} />
          <MiniStat label={line.remainingMinor >= 0 ? "المتبقي" : "تجاوز"} value={<Amount minor={Math.abs(line.remainingMinor)} className={line.remainingMinor < 0 ? "text-danger" : ""} />} />
        </div>
        <Field label="المبلغ المخطط شهريًا" htmlFor="planned">
          <AmountInput id="planned" value={value} onChange={setValue} allowZero />
        </Field>
        <p className="mb-2 mt-5 text-sm font-semibold">
          مصاريف هذا الشهر (<Num value={txs.length} />)
        </p>
        {txs.length ? (
          <div className="-mx-4 divide-y divide-border">
            {txs.map((t) => (
              <TransactionRow key={t.id} tx={t} category={category} compact />
            ))}
          </div>
        ) : (
          <p className="text-sm text-foreground-subtle">لا توجد مصاريف مشتركة في هذا التصنيف هذا الشهر.</p>
        )}
      </Sheet>
      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="إزالة التصنيف من ميزانية الشهر؟"
        description="لن تُحذف أي مصاريف. فقط المبلغ المخطط سيُزال من هذا الشهر."
        confirmLabel="إزالة"
        destructive
        onConfirm={async () => {
          const { error } = await getSupabase().from("budget_items").delete().eq("id", item!.id);
          if (error) return toast.error(arabicError(error));
          await invalidate(qk.budget(month));
          setConfirmRemove(false);
          close();
        }}
      />
    </>
  );
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-muted p-2.5">
      <p className="text-[11px] text-foreground-muted">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}

function AddCategorySheet({
  open,
  onOpenChange,
  categories,
  budgetId,
  householdId,
  month,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  categories: Category[];
  budgetId: string;
  householdId: string;
  month: ISODate;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [value, setValue] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const invalidate = useInvalidate();
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="إضافة تصنيف للميزانية"
      footer={
        <Button
          size="lg"
          block
          loading={saving}
          disabled={!selected || value === null}
          onClick={async () => {
            setSaving(true);
            const { error } = await getSupabase().from("budget_items").insert({ budget_id: budgetId, household_id: householdId, category_id: selected, planned_minor: value });
            setSaving(false);
            if (error) return toast.error(arabicError(error));
            await invalidate(qk.budget(month), ...SPENDING_KEYS);
            setSelected(null);
            setValue(null);
            onOpenChange(false);
          }}
        >
          إضافة
        </Button>
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-2">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelected(c.id)}
            className={`pressable flex items-center gap-2 rounded-2xl border p-2.5 text-start text-sm ${selected === c.id ? "border-primary bg-primary-soft" : "border-border"}`}
          >
            <CategoryIcon icon={c.icon} color={c.color} size={32} />
            <span className="truncate">{c.name}</span>
          </button>
        ))}
      </div>
      <Field label="المبلغ المخطط" htmlFor="newplanned">
        <AmountInput id="newplanned" value={value} onChange={setValue} allowZero />
      </Field>
      <Link href="/more/categories" className="mt-3 block text-sm font-medium text-primary">
        إدارة التصنيفات وإضافة تصنيف جديد
      </Link>
    </Sheet>
  );
}

function ContributionSheet({ open, onOpenChange, current, month }: { open: boolean; onOpenChange: (o: boolean) => void; current?: HouseholdContribution; month: ISODate }) {
  const { me } = useApp();
  const [value, setValue] = useState<number | null>(current?.monthly_amount_minor ?? null);
  const [saving, setSaving] = useState(false);
  const invalidate = useInvalidate();
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="مساهمتي الشهرية في البيت"
      description="ما تختار وضعه في ميزانية البيت كل شهر."
      footer={
        <Button
          size="lg"
          block
          loading={saving}
          disabled={value === null}
          onClick={async () => {
            setSaving(true);
            const { error } = await getSupabase()
              .from("household_contributions")
              .upsert(
                { household_id: me.household.id, user_id: me.user.id, effective_month: monthStart(month), monthly_amount_minor: value },
                { onConflict: "household_id,user_id,effective_month" },
              );
            setSaving(false);
            if (error) return toast.error(arabicError(error));
            await invalidate(qk.contributions);
            toast.success("تم حفظ مساهمتك");
            onOpenChange(false);
          }}
        >
          حفظ
        </Button>
      }
    >
      <Field label="المبلغ الشهري" htmlFor="contrib" hint="يسري من هذا الشهر وما بعده حتى تغيّره.">
        <AmountInput id="contrib" value={value} onChange={setValue} allowZero />
      </Field>
      <p className="mt-4 rounded-2xl bg-sage p-3 text-xs leading-relaxed text-foreground-muted">
        شريكك يرى مبلغ المساهمة فقط، ولا يرى دخلك أو راتبك. لن نعرض المساهمة أبدًا على أنها راتب.
      </p>
    </Sheet>
  );
}
