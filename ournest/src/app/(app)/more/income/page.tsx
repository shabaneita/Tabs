"use client";

import { Lock, Plus, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { ChipGroup, FormError } from "@/components/forms";
import { Amount, useNumerals } from "@/components/ui/amount";
import { AmountInput } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Field, Input } from "@/components/ui/input";
import { EmptyState, ListGroup, Skeleton } from "@/components/ui/misc";
import { MonthSwitcher } from "@/components/ui/month-switcher";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { qk, useIncome, useInvalidate } from "@/lib/data/hooks";
import { formatDate, monthStart } from "@/lib/dates";
import { arabicError } from "@/lib/errors";
import { isIncomeInMonth, monthlyIncomeTotal } from "@/lib/finance/income";
import { INCOME_KINDS, incomeKindLabel } from "@/lib/labels";
import { getSupabase } from "@/lib/supabase/client";
import type { IncomeFrequency, IncomeKind, IncomeSource } from "@/lib/types";
import { incomeSchema } from "@/lib/validation";

export default function IncomePage() {
  const { today } = useApp();
  const numerals = useNumerals();
  const { data: income, isLoading } = useIncome();
  const [month, setMonth] = useState(monthStart(today));
  const [editing, setEditing] = useState<IncomeSource | "new" | null>(null);
  const inMonth = (income ?? []).filter((s) => isIncomeInMonth(s, month));
  const others = (income ?? []).filter((s) => !isIncomeInMonth(s, month));

  return (
    <div>
      <PageHeader
        title="دخلي"
        back="/more"
        actions={
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="size-4" /> دخل
          </Button>
        }
      />
      <div className="mb-4 flex gap-3 rounded-3xl bg-sage p-4 text-sm leading-relaxed">
        <Lock className="mt-0.5 size-5 shrink-0 text-primary" />
        <p>دخلك خاص تمامًا: لا يظهر لشريكك، ولا يدخل في ميزانية البيت أو تحليلاته أو إشعاراته. مساهمتك في البيت تحددها بنفسك من صفحة الميزانية.</p>
      </div>
      <MonthSwitcher month={month} onChange={setMonth} />
      {isLoading ? (
        <Skeleton className="mt-4 h-40 rounded-3xl" />
      ) : (
        <>
          <Card className="mt-4 p-5">
            <p className="text-sm text-foreground-muted">دخلي المسجل في {formatDate(month, "month", numerals)}</p>
            <Amount minor={monthlyIncomeTotal(income ?? [], month)} className="text-[30px] font-bold" />
          </Card>
          {!income?.length ? (
            <EmptyState icon={<Wallet />} title="لم تسجل دخلًا بعد" description="راتب، عمل حر، مكافآت أو دخل إضافي — للمتابعة الشخصية فقط." action={<Button onClick={() => setEditing("new")}>إضافة دخل</Button>} />
          ) : (
            <>
              {inMonth.length ? <IncomeList title="هذا الشهر" items={inMonth} onSelect={setEditing} /> : null}
              {others.length ? <IncomeList title="مصادر أخرى" items={others} onSelect={setEditing} /> : null}
            </>
          )}
        </>
      )}
      {editing ? <IncomeSheet key={editing === "new" ? "new" : editing.id} source={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function IncomeList({ title, items, onSelect }: { title: string; items: IncomeSource[]; onSelect: (s: IncomeSource) => void }) {
  const numerals = useNumerals();
  return (
    <section className="mt-5">
      <h2 className="mb-2 px-2 text-sm font-semibold text-foreground-muted">{title}</h2>
      <ListGroup>
        {items.map((s) => (
          <button key={s.id} type="button" onClick={() => onSelect(s)} className="pressable flex w-full items-center justify-between gap-3 px-4 py-3.5 text-start hover:bg-muted/50">
            <div className="min-w-0">
              <p className="truncate font-medium">{s.name}</p>
              <p className="text-xs text-foreground-muted">
                {incomeKindLabel(s.kind)} · {s.frequency === "monthly" ? `شهري منذ ${formatDate(s.starts_on, "month", numerals)}` : formatDate(s.starts_on, "dayMonth", numerals)}
                {s.ends_on ? ` · حتى ${formatDate(s.ends_on, "month", numerals)}` : ""}
              </p>
            </div>
            <Amount minor={s.amount_minor} className="font-semibold" />
          </button>
        ))}
      </ListGroup>
    </section>
  );
}

function IncomeSheet({ source, onClose }: { source: IncomeSource | null; onClose: () => void }) {
  const { me, today } = useApp();
  const invalidate = useInvalidate();
  const [open, setOpen] = useState(true);
  const [name, setName] = useState(source?.name ?? "الراتب");
  const [kind, setKind] = useState<IncomeKind>(source?.kind ?? "salary");
  const [frequency, setFrequency] = useState<IncomeFrequency>(source?.frequency ?? "monthly");
  const [amount, setAmount] = useState<number | null>(source?.amount_minor ?? null);
  const [startsOn, setStartsOn] = useState(source?.starts_on ?? today);
  const [endsOn, setEndsOn] = useState(source?.ends_on ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const close = () => {
    setOpen(false);
    setTimeout(onClose, 250);
  };

  async function save() {
    setError(null);
    const parsed = incomeSchema.safeParse({ name, kind, frequency, amount_minor: amount ?? 0, starts_on: startsOn, ends_on: frequency === "monthly" && endsOn ? endsOn : null });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "تحقق من البيانات");
    setSaving(true);
    const sb = getSupabase();
    const res = source
      ? await sb.from("income_sources").update(parsed.data).eq("id", source.id)
      : await sb.from("income_sources").insert({ ...parsed.data, owner_id: me.user.id, household_id: me.household.id });
    setSaving(false);
    if (res.error) return setError(arabicError(res.error));
    await invalidate(qk.income);
    toast.success("تم الحفظ");
    close();
  }

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(o) => (o ? setOpen(true) : close())}
        title={source ? "تعديل الدخل" : "دخل جديد"}
        description="خاص بك وحدك"
        footer={
          <div className="flex gap-2">
            {source ? (
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
            <ChipGroup value={kind} onChange={setKind} options={INCOME_KINDS} />
          </Field>
          <Field label="الاسم" htmlFor="iname">
            <Input id="iname" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          </Field>
          <Field label="المبلغ" htmlFor="iamount">
            <AmountInput id="iamount" value={amount} onChange={setAmount} />
          </Field>
          <Segmented
            value={frequency}
            onChange={setFrequency}
            size="sm"
            options={[
              { value: "monthly", label: "شهري متكرر" },
              { value: "one_time", label: "مرة واحدة" },
            ]}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label={frequency === "monthly" ? "يبدأ من" : "تاريخ الاستلام"} htmlFor="istart">
              <Input id="istart" type="date" value={startsOn} onChange={(e) => e.target.value && setStartsOn(e.target.value)} />
            </Field>
            {frequency === "monthly" ? (
              <Field label="ينتهي (اختياري)" htmlFor="iend">
                <Input id="iend" type="date" value={endsOn} min={startsOn} onChange={(e) => setEndsOn(e.target.value)} />
              </Field>
            ) : null}
          </div>
          <FormError message={error} />
        </div>
      </Sheet>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="حذف مصدر الدخل؟"
        confirmLabel="حذف"
        destructive
        onConfirm={async () => {
          const { error } = await getSupabase().from("income_sources").delete().eq("id", source!.id);
          if (error) return toast.error(arabicError(error));
          await invalidate(qk.income);
          setConfirmDelete(false);
          close();
        }}
      />
    </>
  );
}
