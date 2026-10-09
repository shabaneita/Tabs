"use client";

import { Lock, Plus, Receipt } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { BillOccurrenceRow } from "@/components/dashboard/upcoming-bills";
import { CategorySelect, ChipGroup, FormError, VisibilityField } from "@/components/forms";
import { Amount, useNumerals } from "@/components/ui/amount";
import { AmountInput } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CategoryIcon } from "@/components/ui/category-icon";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Field, Input, Select } from "@/components/ui/input";
import { EmptyState, ListGroup, Skeleton } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { SPENDING_KEYS, qk, useBillPayments, useBills, useCategories, useInvalidate } from "@/lib/data/hooks";
import { addDays, formatDate } from "@/lib/dates";
import { arabicError } from "@/lib/errors";
import { billOccurrences, monthlyEquivalent } from "@/lib/finance/bills";
import { BILL_KINDS, FREQUENCIES, billKindMeta, frequencyLabel } from "@/lib/labels";
import { getSupabase } from "@/lib/supabase/client";
import type { BillFrequency, BillKind, RecurringBill, Visibility } from "@/lib/types";
import { billSchema } from "@/lib/validation";

const KIND_TO_SYSTEM_KEY: Partial<Record<BillKind, string>> = {
  rent: "rent",
  car: "car_rent",
  utilities: "utilities",
  internet: "telecom",
  mobile: "telecom",
  installment: "installments",
};

export default function BillsPage() {
  const { today } = useApp();
  const numerals = useNumerals();
  const { data: bills, isLoading } = useBills();
  const { data: payments = [] } = useBillPayments();
  const [tab, setTab] = useState<"upcoming" | "all">("upcoming");
  const [editing, setEditing] = useState<RecurringBill | "new" | null>(null);

  const occ = useMemo(() => (bills ? billOccurrences(bills, payments, today, addDays(today, -60), addDays(today, 45)) : []), [bills, payments, today]);
  const overdue = occ.filter((o) => o.status === "overdue");
  const week = occ.filter((o) => o.status !== "paid" && o.status !== "overdue" && o.daysUntil <= 7);
  const later = occ.filter((o) => o.status !== "paid" && o.daysUntil > 7);
  const paidRecent = occ.filter((o) => o.status === "paid" && o.daysUntil >= -31).reverse();
  const monthlyTotal = (bills ?? []).filter((b) => b.is_active).reduce((s, b) => s + monthlyEquivalent(b), 0);

  return (
    <div>
      <PageHeader
        title="الفواتير"
        back="/more"
        actions={
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="size-4" /> فاتورة
          </Button>
        }
      />
      <Segmented
        value={tab}
        onChange={setTab}
        size="sm"
        options={[
          { value: "upcoming", label: "المواعيد" },
          { value: "all", label: "كل الفواتير" },
        ]}
      />

      {isLoading ? (
        <Skeleton className="mt-4 h-60 rounded-3xl" />
      ) : !bills?.length ? (
        <EmptyState
          className="mt-6"
          icon={<Receipt />}
          title="أضف فواتيركم المتكررة"
          description="الإيجار، إيجار السيارة، ديوا، الإنترنت، الموبايلات، التأمين والاشتراكات — وستصلكم تذكيرات قبل كل موعد."
          action={<Button onClick={() => setEditing("new")}>إضافة فاتورة</Button>}
        />
      ) : tab === "upcoming" ? (
        <div className="mt-4 space-y-5">
          <Group title="متأخرة" tone="danger" items={overdue} />
          <Group title="خلال أسبوع" items={week} />
          <Group title="لاحقًا" items={later} />
          <Group title="مدفوعة مؤخرًا" items={paidRecent} />
          {!overdue.length && !week.length && !later.length ? <p className="text-center text-sm text-foreground-muted">لا توجد مواعيد قادمة خلال ٤٥ يومًا.</p> : null}
        </div>
      ) : (
        <>
          <Card className="mt-4 flex items-center justify-between p-4">
            <span className="text-sm text-foreground-muted">متوسط الفواتير شهريًا</span>
            <Amount minor={monthlyTotal} className="text-lg font-semibold" />
          </Card>
          <ListGroup className="mt-3">
            {bills.map((b) => {
              const meta = billKindMeta(b.kind);
              const next = occ.find((o) => o.bill.id === b.id && o.status !== "paid");
              return (
                <button key={b.id} type="button" onClick={() => setEditing(b)} className="pressable flex w-full items-center gap-3 px-4 py-3 text-start hover:bg-muted/50">
                  <CategoryIcon icon={meta.icon} color={b.is_active ? "emerald" : "sage"} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate font-medium">
                      {b.name}
                      {b.visibility === "private" ? <Lock className="size-3.5 text-foreground-subtle" /> : null}
                    </p>
                    <p className="truncate text-xs text-foreground-muted">
                      {frequencyLabel(b.frequency, b.interval_count)}
                      {next ? ` · التالية ${formatDate(next.dueDate, "dayMonth", numerals)}` : ""}
                      {!b.is_active ? " · متوقفة" : ""}
                    </p>
                  </div>
                  <Amount minor={b.amount_minor} className="font-semibold" />
                </button>
              );
            })}
          </ListGroup>
        </>
      )}

      {editing ? <BillSheet key={editing === "new" ? "new" : editing.id} bill={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function Group({ title, items, tone }: { title: string; items: ReturnType<typeof billOccurrences<RecurringBill>>; tone?: "danger" }) {
  if (!items.length) return null;
  return (
    <section>
      <h2 className={`mb-2 px-2 text-sm font-semibold ${tone === "danger" ? "text-danger" : "text-foreground-muted"}`}>{title}</h2>
      <ListGroup>
        {items.map((o) => (
          <BillOccurrenceRow key={`${o.bill.id}:${o.dueDate}`} occ={o} />
        ))}
      </ListGroup>
    </section>
  );
}

function BillSheet({ bill, onClose }: { bill: RecurringBill | null; onClose: () => void }) {
  const { me, today } = useApp();
  const { data: categories = [] } = useCategories();
  const invalidate = useInvalidate();
  const [open, setOpen] = useState(true);
  const isMine = !bill || bill.owner_id === me.user.id;
  const [name, setName] = useState(bill?.name ?? "");
  const [kind, setKind] = useState<BillKind>(bill?.kind ?? "rent");
  const [amount, setAmount] = useState<number | null>(bill?.amount_minor ?? null);
  const [variable, setVariable] = useState(bill?.is_variable ?? false);
  const [frequency, setFrequency] = useState<BillFrequency>(bill?.frequency ?? "monthly");
  const [interval, setIntervalCount] = useState(bill?.interval_count ?? 1);
  const [anchor, setAnchor] = useState(bill?.anchor_date ?? today);
  const [endDate, setEndDate] = useState<string>(bill?.end_date ?? "");
  const [reminder, setReminder] = useState(bill?.reminder_days ?? 3);
  const [visibility, setVisibility] = useState<Visibility>(bill?.visibility ?? "shared");
  const [categoryId, setCategoryId] = useState<string | null>(bill?.category_id ?? null);
  const [autopay, setAutopay] = useState(bill?.autopay ?? false);
  const [active, setActive] = useState(bill?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const close = () => {
    setOpen(false);
    setTimeout(onClose, 250);
  };

  const pickKind = (k: BillKind) => {
    setKind(k);
    if (!name || BILL_KINDS.some((b) => b.label === name)) setName(BILL_KINDS.find((b) => b.value === k)?.label ?? "");
    const key = KIND_TO_SYSTEM_KEY[k];
    const cat = key ? categories.find((c) => c.system_key === key && c.visibility === "shared") : null;
    if (cat && !bill) setCategoryId(cat.id);
  };

  async function save() {
    setError(null);
    const payload = {
      name,
      kind,
      amount_minor: amount ?? 0,
      is_variable: variable,
      frequency,
      interval_count: interval,
      anchor_date: anchor,
      end_date: endDate || null,
      reminder_days: reminder,
      category_id: categoryId,
      visibility,
      autopay,
    };
    const parsed = billSchema.safeParse(payload);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "تحقق من البيانات");
    setSaving(true);
    const sb = getSupabase();
    const data: Record<string, unknown> = { ...parsed.data, is_active: active };
    if (bill && !isMine) delete data.visibility;
    const res = bill ? await sb.from("recurring_bills").update(data).eq("id", bill.id) : await sb.from("recurring_bills").insert({ ...data, household_id: me.household.id, owner_id: me.user.id });
    setSaving(false);
    if (res.error) return setError(arabicError(res.error));
    await invalidate(qk.bills, ...SPENDING_KEYS);
    toast.success(bill ? "تم تحديث الفاتورة" : "تمت إضافة الفاتورة");
    close();
  }

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(o) => (o ? setOpen(true) : close())}
        title={bill ? "تعديل الفاتورة" : "فاتورة جديدة"}
        footer={
          <div className="flex gap-2">
            {bill ? (
              <Button variant="danger-soft" size="lg" onClick={() => setConfirmDelete(true)}>
                حذف
              </Button>
            ) : null}
            <Button size="lg" block loading={saving} onClick={save}>
              حفظ
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="النوع">
            <ChipGroup value={kind} onChange={pickKind} options={BILL_KINDS.map((b) => ({ value: b.value, label: b.label }))} />
          </Field>
          <Field label="الاسم" htmlFor="bname">
            <Input id="bname" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلًا: إيجار الشقة" maxLength={60} />
          </Field>
          <Field label={variable ? "المبلغ التقريبي" : "المبلغ"} htmlFor="bamount">
            <AmountInput id="bamount" value={amount} onChange={setAmount} />
          </Field>
          <label className="flex items-center justify-between gap-3 rounded-2xl bg-muted/60 px-4 py-3">
            <span>
              <span className="block text-[15px] font-medium">المبلغ متغير</span>
              <span className="block text-xs text-foreground-subtle">مثل ديوا — تعدّل المبلغ عند الدفع</span>
            </span>
            <Switch checked={variable} onCheckedChange={setVariable} ariaLabel="المبلغ متغير" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Field label="التكرار" htmlFor="bfreq">
              <Select id="bfreq" value={frequency} onChange={(e) => setFrequency(e.target.value as BillFrequency)}>
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="كل" htmlFor="binterval">
              <Select id="binterval" value={interval} onChange={(e) => setIntervalCount(Number(e.target.value))}>
                {[1, 2, 3, 4, 6, 12].map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? "مرة واحدة" : `${n} ${frequency === "weekly" ? "أسابيع" : frequency === "yearly" ? "سنوات" : "فترات"}`}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="أول استحقاق" htmlFor="banchor">
              <Input id="banchor" type="date" value={anchor} onChange={(e) => e.target.value && setAnchor(e.target.value)} />
            </Field>
            <Field label="ينتهي في (اختياري)" htmlFor="bend">
              <Input id="bend" type="date" value={endDate} min={anchor} onChange={(e) => setEndDate(e.target.value)} />
            </Field>
          </div>
          <Field label="التذكير قبل الموعد" htmlFor="brem">
            <Select id="brem" value={reminder} onChange={(e) => setReminder(Number(e.target.value))}>
              {[0, 1, 2, 3, 5, 7, 10, 14].map((n) => (
                <option key={n} value={n}>
                  {n === 0 ? "يوم الاستحقاق" : n === 1 ? "قبلها بيوم" : n === 2 ? "قبلها بيومين" : `قبلها بـ ${n} أيام`}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="الخصوصية">
            <VisibilityField value={visibility} onChange={setVisibility} disabled={!isMine} />
          </Field>
          <Field label="التصنيف عند الدفع" htmlFor="bcat" hint="الدفع يُسجَّل كمصروف في هذا التصنيف — مرة واحدة فقط لكل موعد.">
            <CategorySelect id="bcat" value={categoryId} onChange={setCategoryId} visibility={visibility} allowNone />
          </Field>
          <label className="flex items-center justify-between rounded-2xl bg-muted/60 px-4 py-3">
            <span className="text-[15px] font-medium">دفع تلقائي من البنك</span>
            <Switch checked={autopay} onCheckedChange={setAutopay} ariaLabel="دفع تلقائي" />
          </label>
          {bill ? (
            <label className="flex items-center justify-between rounded-2xl bg-muted/60 px-4 py-3">
              <span className="text-[15px] font-medium">الفاتورة فعالة</span>
              <Switch checked={active} onCheckedChange={setActive} ariaLabel="فعالة" />
            </label>
          ) : null}
          <FormError message={error} />
        </div>
      </Sheet>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="حذف الفاتورة؟"
        description="المصاريف المسجلة سابقًا لهذه الفاتورة ستبقى كما هي."
        confirmLabel="حذف"
        destructive
        onConfirm={async () => {
          const { error } = await getSupabase().from("recurring_bills").delete().eq("id", bill!.id);
          if (error) return toast.error(arabicError(error));
          await invalidate(qk.bills, ...SPENDING_KEYS);
          setConfirmDelete(false);
          close();
        }}
      />
    </>
  );
}
