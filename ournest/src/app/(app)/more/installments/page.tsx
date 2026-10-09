"use client";

import { CalendarCheck, CreditCard, Lock, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { CategorySelect, FormError, VisibilityField } from "@/components/forms";
import { Amount, Num, useNumerals, Pct } from "@/components/ui/amount";
import { AmountInput } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Field, Input } from "@/components/ui/input";
import { Badge, EmptyState, Skeleton } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { SPENDING_KEYS, qk, useBudget, useCategories, useInvalidate, usePlans, type PlanWithPayments } from "@/lib/data/hooks";
import { arabicCount, formatDate, monthStart } from "@/lib/dates";
import { arabicError } from "@/lib/errors";
import { installmentSummary, monthlyInstallmentCommitment, simulateEarlyPayoff, type InstallmentSummary } from "@/lib/finance/installments";
import { percentOf } from "@/lib/money";
import { getSupabase } from "@/lib/supabase/client";
import type { Visibility } from "@/lib/types";
import { planSchema } from "@/lib/validation";

export default function InstallmentsPage() {
  const { today } = useApp();
  const numerals = useNumerals();
  const { data: plans, isLoading } = usePlans();
  const budgetQ = useBudget(monthStart(today));
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const items = (plans ?? []).map((p) => ({ ...p, summary: installmentSummary(p, p.installment_payments, today) }));
  const sharedCommitment = monthlyInstallmentCommitment(items.filter((i) => i.visibility === "shared"));
  const privateCommitment = monthlyInstallmentCommitment(items.filter((i) => i.visibility === "private"));
  const outstanding = items.filter((i) => i.is_active).reduce((s, i) => s + i.summary.outstandingMinor, 0);
  const allocation = budgetQ.data?.budget.total_allocation_minor ?? 0;
  const selectedPlan = items.find((i) => i.id === selected);

  return (
    <div>
      <PageHeader
        title="الأقساط والالتزامات"
        back="/more"
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> قسط
          </Button>
        }
      />
      {isLoading ? (
        <Skeleton className="h-60 rounded-3xl" />
      ) : !items.length ? (
        <EmptyState
          icon={<CreditCard />}
          title="لا توجد أقساط مسجلة"
          description="تابع الرصيد المتبقي وعدد الأقساط وموعد الانتهاء، وجرّب محاكاة السداد المبكر."
          action={<Button onClick={() => setCreating(true)}>إضافة قسط</Button>}
        />
      ) : (
        <>
          <Card className="p-5">
            <p className="text-sm text-foreground-muted">الالتزام الشهري على ميزانية البيت</p>
            <Amount minor={sharedCommitment} className="text-[28px] font-bold" />
            {allocation > 0 ? (
              <>
                <ProgressBar label="نسبة الأقساط من ميزانية الشهر" value={percentOf(sharedCommitment, allocation)} tone="info" className="mt-3" />
                <p className="mt-2 text-xs text-foreground-muted">
                  <Pct value={percentOf(sharedCommitment, allocation)} /> من ميزانية الشهر (<Amount minor={allocation} />)
                </p>
              </>
            ) : null}
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-muted/60 p-3">
                <p className="text-xs text-foreground-muted">إجمالي المتبقي</p>
                <Amount minor={outstanding} className="font-semibold" />
              </div>
              <div className="rounded-2xl bg-muted/60 p-3">
                <p className="flex items-center gap-1 text-xs text-foreground-muted">
                  أقساطي الخاصة <Lock className="size-3" />
                </p>
                <Amount minor={privateCommitment} className="font-semibold" />
              </div>
            </div>
          </Card>

          <div className="mt-4 space-y-3">
            {items.map((p) => (
              <button key={p.id} type="button" onClick={() => setSelected(p.id)} className="pressable surface-card w-full rounded-3xl p-4 text-start">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate font-semibold">
                      {p.name}
                      {p.visibility === "private" ? <Lock className="size-3.5 text-foreground-subtle" /> : null}
                    </p>
                    <p className="truncate text-xs text-foreground-muted">{p.lender || "بدون جهة"}</p>
                  </div>
                  {p.summary.isComplete ? (
                    <Badge tone="primary">مكتمل</Badge>
                  ) : p.summary.overduePeriods.length ? (
                    <Badge tone="danger">{arabicCount(p.summary.overduePeriods.length, "installment", numerals)} متأخرة</Badge>
                  ) : (
                    <Amount minor={p.monthly_amount_minor} className="font-semibold" />
                  )}
                </div>
                <ProgressBar label={`نسبة سداد ${p.name}`} value={p.summary.progressPct} tone="primary" className="mt-3" height={6} />
                <div className="mt-2 flex justify-between text-xs text-foreground-muted">
                  <span>
                    متبقي <Amount minor={p.summary.outstandingMinor} className="font-semibold text-foreground" />
                  </span>
                  <span>{p.summary.remainingInstallments ? arabicCount(p.summary.remainingInstallments, "installment", numerals) : "—"}</span>
                </div>
                {p.summary.expectedCompletion ? (
                  <p className="mt-1 text-xs text-foreground-subtle">الانتهاء المتوقع: {formatDate(p.summary.expectedCompletion, "month", numerals)}</p>
                ) : null}
              </button>
            ))}
          </div>
        </>
      )}

      {creating ? <PlanSheet onClose={() => setCreating(false)} /> : null}
      {selectedPlan ? <PlanDetail key={selectedPlan.id} plan={selectedPlan} summary={selectedPlan.summary} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function PlanDetail({ plan, summary, onClose }: { plan: PlanWithPayments; summary: InstallmentSummary; onClose: () => void }) {
  const { me, today } = useApp();
  const numerals = useNumerals();
  const invalidate = useInvalidate();
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<"pay" | "simulate" | "history">("pay");
  const [payAmount, setPayAmount] = useState<number | null>(summary.nextDueMinor || null);
  const [payMode, setPayMode] = useState<"scheduled" | "extra">("scheduled");
  const [paidOn, setPaidOn] = useState(today);
  const [busy, setBusy] = useState(false);
  const [extra, setExtra] = useState<number | null>(null);
  const [lump, setLump] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const canWrite = plan.visibility === "shared" || plan.owner_id === me.user.id;
  const close = () => {
    setOpen(false);
    setTimeout(onClose, 250);
  };
  const sim = simulateEarlyPayoff({
    outstandingMinor: summary.outstandingMinor,
    monthlyMinor: plan.monthly_amount_minor,
    extraMonthlyMinor: extra ?? 0,
    lumpSumMinor: lump ?? 0,
    nextDueDate: summary.nextDueDate,
  });

  async function pay() {
    if (!payAmount) return;
    setBusy(true);
    const { error } = await getSupabase().rpc("record_installment_payment", {
      p_plan_id: plan.id,
      p_amount_minor: payAmount,
      p_paid_on: paidOn,
      p_period: payMode === "scheduled" ? summary.nextDueDate : null,
      p_create_transaction: true,
    });
    setBusy(false);
    if (error) return toast.error(arabicError(error));
    await invalidate(qk.plans, ...SPENDING_KEYS);
    toast.success("تم تسجيل الدفعة وإضافتها للمصاريف");
    close();
  }

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => (o ? setOpen(true) : close())} title={plan.name} description={plan.lender ?? undefined}>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Mini label="المدفوع" value={<Amount minor={summary.paidMinor} />} />
          <Mini label="المتبقي" value={<Amount minor={summary.outstandingMinor} />} />
          <Mini label="الأقساط المتبقية" value={<Num value={summary.remainingInstallments} />} />
        </div>
        <div className="mt-3 rounded-2xl bg-muted/60 p-3 text-sm">
          <p className="flex justify-between">
            <span className="text-foreground-muted">القسط التالي</span>
            <span>{summary.nextDueDate ? formatDate(summary.nextDueDate, "dayMonth", numerals) : "—"}</span>
          </p>
          <p className="mt-1 flex justify-between">
            <span className="text-foreground-muted">الانتهاء المتوقع</span>
            <span>{summary.expectedCompletion ? formatDate(summary.expectedCompletion, "month", numerals) : "مكتمل"}</span>
          </p>
          {summary.lastInstallmentMinor && summary.lastInstallmentMinor !== plan.monthly_amount_minor ? (
            <p className="mt-1 flex justify-between">
              <span className="text-foreground-muted">القسط الأخير</span>
              <Amount minor={summary.lastInstallmentMinor} />
            </p>
          ) : null}
        </div>

        <Segmented
          className="mt-4"
          size="sm"
          value={tab}
          onChange={setTab}
          options={[
            { value: "pay", label: "تسجيل دفعة" },
            { value: "simulate", label: "سداد مبكر" },
            { value: "history", label: "السجل" },
          ]}
        />

        {tab === "pay" ? (
          summary.isComplete ? (
            <p className="mt-4 text-center text-sm text-foreground-muted">تم سداد هذا القسط بالكامل 🎉</p>
          ) : !canWrite ? (
            <p className="mt-4 text-sm text-foreground-muted">هذا قسط خاص بشريكك.</p>
          ) : (
            <div className="mt-4 space-y-3">
              <Segmented
                size="sm"
                value={payMode}
                onChange={(v) => {
                  setPayMode(v);
                  if (v === "scheduled") setPayAmount(summary.nextDueMinor);
                }}
                options={[
                  { value: "scheduled", label: `قسط ${summary.nextDueDate ? formatDate(summary.nextDueDate, "dayMonth", numerals) : ""}` },
                  { value: "extra", label: "دفعة إضافية" },
                ]}
              />
              <Field label="المبلغ" htmlFor="payamt">
                <AmountInput id="payamt" value={payAmount} onChange={setPayAmount} key={payMode} />
              </Field>
              <Field label="تاريخ الدفع" htmlFor="paidon">
                <Input id="paidon" type="date" value={paidOn} onChange={(e) => e.target.value && setPaidOn(e.target.value)} />
              </Field>
              <p className="text-xs leading-relaxed text-foreground-subtle">
                الدفعة تُسجَّل تلقائيًا كمصروف {plan.visibility === "shared" ? "مشترك" : "خاص"} في تصنيف القسط مرة واحدة فقط، فلا يُحسب القسط مرتين.
              </p>
              <Button size="lg" block loading={busy} disabled={!payAmount} onClick={pay}>
                <CalendarCheck className="size-5" /> تسجيل الدفعة
              </Button>
            </div>
          )
        ) : null}

        {tab === "simulate" ? (
          <div className="mt-4 space-y-3">
            <Field label="مبلغ إضافي شهريًا" htmlFor="extra">
              <AmountInput id="extra" value={extra} onChange={setExtra} allowZero />
            </Field>
            <Field label="دفعة واحدة الآن" htmlFor="lump">
              <AmountInput id="lump" value={lump} onChange={setLump} allowZero />
            </Field>
            <Card className="p-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-foreground-muted">بدون تغيير</p>
                  <p className="font-semibold">{arabicCount(sim.monthsBefore, "month", numerals)}</p>
                  <p className="text-xs text-foreground-subtle">{sim.completionBefore ? formatDate(sim.completionBefore, "month", numerals) : "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-foreground-muted">مع السداد المبكر</p>
                  <p className="font-semibold text-primary">{sim.monthsAfter ? arabicCount(sim.monthsAfter, "month", numerals) : "سداد كامل الآن"}</p>
                  <p className="text-xs text-foreground-subtle">{sim.completionAfter ? formatDate(sim.completionAfter, "month", numerals) : "—"}</p>
                </div>
              </div>
              {sim.monthsSaved > 0 ? <p className="mt-3 rounded-xl bg-primary-soft p-2.5 text-center text-sm font-semibold text-primary">توفّر {arabicCount(sim.monthsSaved, "month", numerals)} من الالتزام</p> : null}
            </Card>
            <p className="text-xs leading-relaxed text-foreground-subtle">
              المحاكاة تفترض أن المبلغ الإجمالي ثابت (شامل أي فوائد أو رسوم أدخلتها). السداد المبكر يقلل المدة؛ توفير الفوائد يعتمد على شروط الجهة المقرضة.
            </p>
          </div>
        ) : null}

        {tab === "history" ? (
          <div className="mt-4 space-y-2">
            {plan.opening_paid_minor > 0 ? (
              <div className="flex justify-between rounded-2xl bg-muted/60 px-4 py-3 text-sm">
                <span className="text-foreground-muted">مدفوع قبل بدء المتابعة</span>
                <Amount minor={plan.opening_paid_minor} />
              </div>
            ) : null}
            {[...plan.installment_payments]
              .sort((a, b) => (a.paid_on < b.paid_on ? 1 : -1))
              .map((p) => (
                <PaymentRow key={p.id} payment={p} canWrite={canWrite} />
              ))}
            {!plan.installment_payments.length ? <p className="text-center text-sm text-foreground-muted">لا توجد دفعات مسجلة بعد.</p> : null}
          </div>
        ) : null}

        {canWrite ? (
          <Button variant="ghost" block className="mt-5" onClick={() => setEditing(true)}>
            تعديل بيانات القسط
          </Button>
        ) : null}
      </Sheet>
      {editing ? <PlanSheet plan={plan} onClose={() => { setEditing(false); close(); }} /> : null}
    </>
  );
}

function PaymentRow({ payment, canWrite }: { payment: PlanWithPayments["installment_payments"][number]; canWrite: boolean }) {
  const numerals = useNumerals();
  const invalidate = useInvalidate();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="flex items-center justify-between rounded-2xl bg-muted/60 px-4 py-3 text-sm">
      <div>
        <Amount minor={payment.amount_minor} className="font-semibold" />
        <p className="text-xs text-foreground-muted">
          {formatDate(payment.paid_on, "dayMonth", numerals)} · {payment.is_extra ? "دفعة إضافية" : `قسط ${payment.period ? formatDate(payment.period, "month", numerals) : ""}`}
        </p>
      </div>
      {canWrite ? (
        <button type="button" aria-label="حذف الدفعة" className="p-2 text-foreground-subtle" onClick={() => setConfirm(true)}>
          <Trash2 className="size-4" />
        </button>
      ) : null}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="حذف الدفعة؟"
        description="سيُحذف المصروف المرتبط بها أيضًا حتى لا يبقى في الميزانية."
        confirmLabel="حذف"
        destructive
        onConfirm={async () => {
          const { error } = await getSupabase().from("installment_payments").delete().eq("id", payment.id);
          if (error) return toast.error(arabicError(error));
          await invalidate(qk.plans, ...SPENDING_KEYS);
          setConfirm(false);
        }}
      />
    </div>
  );
}

function Mini({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-muted p-2.5">
      <p className="text-[11px] text-foreground-muted">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}

function PlanSheet({ plan, onClose }: { plan?: PlanWithPayments; onClose: () => void }) {
  const { me, today } = useApp();
  const { data: categories = [] } = useCategories();
  const invalidate = useInvalidate();
  const [open, setOpen] = useState(true);
  const isMine = !plan || plan.owner_id === me.user.id;
  const defaultCat = categories.find((c) => c.system_key === "installments" && c.visibility === "shared")?.id ?? null;
  const [name, setName] = useState(plan?.name ?? "");
  const [lender, setLender] = useState(plan?.lender ?? "");
  const [total, setTotal] = useState<number | null>(plan?.total_amount_minor ?? null);
  const [monthly, setMonthly] = useState<number | null>(plan?.monthly_amount_minor ?? null);
  const [opening, setOpening] = useState<number | null>(plan?.opening_paid_minor ?? 0);
  const [firstDue, setFirstDue] = useState(plan?.first_due_date ?? today);
  const [visibility, setVisibility] = useState<Visibility>(plan?.visibility ?? "shared");
  const [categoryId, setCategoryId] = useState<string | null>(plan?.category_id ?? defaultCat);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const close = () => {
    setOpen(false);
    setTimeout(onClose, 250);
  };

  async function save() {
    setError(null);
    const parsed = planSchema.safeParse({
      name,
      lender: lender.trim() || null,
      total_amount_minor: total ?? 0,
      monthly_amount_minor: monthly ?? 0,
      opening_paid_minor: opening ?? 0,
      first_due_date: firstDue,
      category_id: categoryId,
      visibility,
    });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "تحقق من البيانات");
    setSaving(true);
    const sb = getSupabase();
    const data: Record<string, unknown> = { ...parsed.data };
    if (plan && !isMine) delete data.visibility;
    const res = plan ? await sb.from("installment_plans").update(data).eq("id", plan.id) : await sb.from("installment_plans").insert({ ...data, household_id: me.household.id, owner_id: me.user.id });
    setSaving(false);
    if (res.error) return setError(arabicError(res.error));
    await invalidate(qk.plans);
    toast.success(plan ? "تم تحديث القسط" : "تمت إضافة القسط");
    close();
  }

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(o) => (o ? setOpen(true) : close())}
        title={plan ? "تعديل القسط" : "قسط جديد"}
        footer={
          <div className="flex gap-2">
            {plan ? (
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
          <Field label="الاسم" htmlFor="pname">
            <Input id="pname" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلًا: تقسيط الأثاث" maxLength={60} />
          </Field>
          <Field label="الجهة (اختياري)" htmlFor="plender">
            <Input id="plender" value={lender} onChange={(e) => setLender(e.target.value)} placeholder="بنك، متجر، تابي…" maxLength={60} />
          </Field>
          <Field label="المبلغ الإجمالي المستحق" htmlFor="ptotal" hint="شامل أي رسوم أو فوائد.">
            <AmountInput id="ptotal" value={total} onChange={setTotal} />
          </Field>
          <Field label="القسط الشهري" htmlFor="pmonthly">
            <AmountInput id="pmonthly" value={monthly} onChange={setMonthly} />
          </Field>
          <Field label="مدفوع قبل بدء المتابعة" htmlFor="popening" hint="إذا كنت بدأت السداد قبل استخدام التطبيق.">
            <AmountInput id="popening" value={opening} onChange={setOpening} allowZero />
          </Field>
          <Field label="تاريخ أول قسط" htmlFor="pfirst">
            <Input id="pfirst" type="date" value={firstDue} onChange={(e) => e.target.value && setFirstDue(e.target.value)} />
          </Field>
          <Field label="الخصوصية">
            <VisibilityField value={visibility} onChange={setVisibility} disabled={!isMine} />
          </Field>
          <Field label="تصنيف الدفعات" htmlFor="pcat">
            <CategorySelect id="pcat" value={categoryId} onChange={setCategoryId} visibility={visibility} />
          </Field>
          <FormError message={error} />
        </div>
      </Sheet>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="حذف القسط؟"
        description="سيُحذف سجل الدفعات. المصاريف المسجلة سابقًا ستبقى في سجل المصاريف."
        confirmLabel="حذف"
        destructive
        onConfirm={async () => {
          const sb = getSupabase();
          // Keep historical expenses: detach payments from their transactions first.
          await sb.from("installment_payments").update({ transaction_id: null }).eq("plan_id", plan!.id);
          const { error } = await sb.from("installment_plans").delete().eq("id", plan!.id);
          if (error) return toast.error(arabicError(error));
          await invalidate(qk.plans, ...SPENDING_KEYS);
          setConfirmDelete(false);
          close();
        }}
      />
    </>
  );
}
