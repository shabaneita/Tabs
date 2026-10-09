"use client";

import { Lock, Minus, PiggyBank, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { ChipGroup, FormError, VisibilityField } from "@/components/forms";
import { Amount, Num, useNumerals, Pct } from "@/components/ui/amount";
import { AmountInput } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import { CategoryIcon } from "@/components/ui/category-icon";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Field, Input } from "@/components/ui/input";
import { Badge, EmptyState, Skeleton } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressRing } from "@/components/ui/progress";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { qk, useGoals, useInvalidate, type GoalWithContributions } from "@/lib/data/hooks";
import { arabicCount, formatDate } from "@/lib/dates";
import { arabicError } from "@/lib/errors";
import { goalProgress, type GoalProgress } from "@/lib/finance/savings";
import { GOAL_KINDS, goalKindMeta } from "@/lib/labels";
import { getSupabase } from "@/lib/supabase/client";
import type { GoalKind, Visibility } from "@/lib/types";
import { goalSchema } from "@/lib/validation";

type GoalItem = GoalWithContributions & { progress: GoalProgress };

export default function GoalsPage() {
  const { today } = useApp();
  const { data, isLoading } = useGoals();
  const [creating, setCreating] = useState<GoalKind | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const goals: GoalItem[] = (data ?? []).filter((g) => !g.is_archived).map((g) => ({ ...g, progress: goalProgress(g, g.savings_contributions, today) }));
  const shared = goals.filter((g) => g.visibility === "shared");
  const mine = goals.filter((g) => g.visibility === "private");
  const sel = goals.find((g) => g.id === selected);

  return (
    <div>
      <PageHeader
        title="أهداف الادخار"
        back="/more"
        actions={
          <Button size="sm" onClick={() => setCreating("other")}>
            <Plus className="size-4" /> هدف
          </Button>
        }
      />
      {isLoading ? (
        <Skeleton className="h-60 rounded-3xl" />
      ) : (
        <>
          {!goals.length ? (
            <EmptyState icon={<PiggyBank />} title="ابدأوا أول هدف ادخار" description="اختر هدفًا جاهزًا أو أنشئ هدفك الخاص. الأهداف الخاصة لا يراها شريكك." />
          ) : null}
          {shared.length ? <GoalSection title="أهداف البيت المشتركة" goals={shared} onSelect={setSelected} /> : null}
          {mine.length ? <GoalSection title="أهدافي الخاصة" goals={mine} onSelect={setSelected} privateSection /> : null}

          <h2 className="mb-2 mt-7 px-2 text-sm font-semibold text-foreground-muted">أفكار لأهداف جديدة</h2>
          <div className="grid grid-cols-2 gap-2">
            {GOAL_KINDS.filter((k) => k.value !== "other").map((k) => (
              <button key={k.value} type="button" onClick={() => setCreating(k.value)} className="pressable surface-card flex items-center gap-2.5 rounded-2xl p-3 text-start text-sm font-medium">
                <CategoryIcon icon={k.icon} color={k.color} size={34} />
                {k.label}
              </button>
            ))}
          </div>
        </>
      )}
      {creating ? <GoalSheet kind={creating} onClose={() => setCreating(null)} /> : null}
      {sel ? <GoalDetail key={sel.id} goal={sel} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function GoalSection({ title, goals, onSelect, privateSection }: { title: string; goals: GoalItem[]; onSelect: (id: string) => void; privateSection?: boolean }) {
  const numerals = useNumerals();
  return (
    <section className="mb-5">
      <h2 className="mb-2 flex items-center gap-1.5 px-2 text-sm font-semibold text-foreground-muted">
        {title} {privateSection ? <Lock className="size-3.5" /> : null}
      </h2>
      <div className="space-y-3">
        {goals.map((g) => {
          const meta = goalKindMeta(g.kind);
          return (
            <button key={g.id} type="button" onClick={() => onSelect(g.id)} className="pressable surface-card flex w-full items-center gap-4 rounded-3xl p-4 text-start" data-testid="goal-card">
              <ProgressRing value={g.progress.pct} size={64} stroke={6}>
                <CategoryIcon icon={meta.icon} color={meta.color} size={36} className="rounded-full" />
              </ProgressRing>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{g.name}</p>
                <p className="text-sm text-foreground-muted">
                  <Amount minor={g.progress.currentMinor} className="font-semibold text-foreground" /> من <Amount minor={g.target_minor} hideCurrency />
                  <span className="ms-1 text-foreground-subtle">
                    (<Pct value={g.progress.pct} />)
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-foreground-subtle">
                  {g.progress.reached
                    ? "تم الوصول للهدف 🎉"
                    : g.progress.estimatedCompletion
                      ? `الوصول المتوقع ${formatDate(g.progress.estimatedCompletion, "month", numerals)}`
                      : "حدد مساهمة شهرية لتقدير موعد الوصول"}
                </p>
              </div>
              {g.progress.onTrack === false ? <Badge tone="warning">متأخر</Badge> : g.progress.onTrack ? <Badge tone="primary">في الموعد</Badge> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function GoalDetail({ goal, onClose }: { goal: GoalItem; onClose: () => void }) {
  const { me, today } = useApp();
  const numerals = useNumerals();
  const invalidate = useInvalidate();
  const [open, setOpen] = useState(true);
  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState<number | null>(goal.monthly_contribution_minor || null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const canWrite = goal.visibility === "shared" || goal.owner_id === me.user.id;
  const p = goal.progress;
  const close = () => {
    setOpen(false);
    setTimeout(onClose, 250);
  };

  async function contribute() {
    if (!amount) return;
    if (mode === "withdraw" && amount > p.currentMinor) return toast.error("المبلغ أكبر من الرصيد الحالي للهدف");
    setBusy(true);
    const { error } = await getSupabase()
      .from("savings_contributions")
      .insert({ goal_id: goal.id, amount_minor: mode === "deposit" ? amount : -amount, contributed_on: today });
    setBusy(false);
    if (error) return toast.error(arabicError(error));
    await invalidate(qk.goals, qk.activity);
    toast.success(mode === "deposit" ? "تمت إضافة المبلغ للهدف" : "تم سحب المبلغ من الهدف");
    setAmount(null);
  }

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => (o ? setOpen(true) : close())} title={goal.name} description={goal.visibility === "private" ? "هدف خاص — يظهر لك وحدك" : "هدف مشترك للبيت"}>
        <div className="flex items-center gap-5">
          <ProgressRing value={p.pct} size={110} stroke={10}>
            <div>
              <p className="text-2xl font-bold">
                <Pct value={p.pct} />
              </p>
            </div>
          </ProgressRing>
          <div className="space-y-1.5 text-sm">
            <p>
              <span className="text-foreground-muted">الحالي: </span>
              <Amount minor={p.currentMinor} className="font-semibold" />
            </p>
            <p>
              <span className="text-foreground-muted">الهدف: </span>
              <Amount minor={goal.target_minor} />
            </p>
            <p>
              <span className="text-foreground-muted">المتبقي: </span>
              <Amount minor={p.remainingMinor} />
            </p>
            <p>
              <span className="text-foreground-muted">شهريًا: </span>
              <Amount minor={goal.monthly_contribution_minor} />
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-1 rounded-2xl bg-muted/60 p-3 text-sm">
          {goal.target_date ? (
            <p className="flex justify-between">
              <span className="text-foreground-muted">التاريخ المستهدف</span>
              <span>{formatDate(goal.target_date, "month", numerals)}</span>
            </p>
          ) : null}
          <p className="flex justify-between">
            <span className="text-foreground-muted">الوصول المتوقع</span>
            <span>{p.reached ? "تم 🎉" : p.estimatedCompletion ? `${formatDate(p.estimatedCompletion, "month", numerals)} (${arabicCount(p.monthsToGo ?? 0, "month", numerals)})` : "—"}</span>
          </p>
          {p.requiredMonthlyMinor !== null ? (
            <p className="flex justify-between">
              <span className="text-foreground-muted">المطلوب شهريًا للموعد</span>
              <Amount minor={p.requiredMonthlyMinor} className={p.onTrack === false ? "text-warning" : ""} />
            </p>
          ) : null}
        </div>

        {canWrite ? (
          <div className="mt-4 space-y-3">
            <Segmented
              size="sm"
              value={mode}
              onChange={setMode}
              options={[
                { value: "deposit", label: "إضافة", icon: <Plus className="size-3.5" /> },
                { value: "withdraw", label: "سحب", icon: <Minus className="size-3.5" /> },
              ]}
            />
            <AmountInput value={amount} onChange={setAmount} aria-label="المبلغ" key={mode} />
            <Button size="lg" block loading={busy} disabled={!amount} onClick={contribute}>
              {mode === "deposit" ? "إضافة للهدف" : "سحب من الهدف"}
            </Button>
            <p className="text-xs text-foreground-subtle">المبالغ المضافة للأهداف تتبُّع للادخار، ولا تُحسب كمصاريف في الميزانية.</p>
          </div>
        ) : null}

        {goal.savings_contributions.length ? (
          <div className="mt-5">
            <p className="mb-2 text-sm font-semibold">السجل</p>
            <div className="space-y-1.5">
              {[...goal.savings_contributions]
                .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
                .slice(0, 12)
                .map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2 text-sm">
                    <span className="text-foreground-muted">
                      {formatDate(c.contributed_on, "dayMonth", numerals)}
                      {c.created_by && c.created_by !== me.user.id ? ` · ${me.members.find((m) => m.id === c.created_by)?.display_name ?? ""}` : ""}
                    </span>
                    <Amount minor={c.amount_minor} signed className={c.amount_minor < 0 ? "text-danger" : "text-primary"} />
                  </div>
                ))}
            </div>
          </div>
        ) : null}

        {canWrite ? (
          <Button variant="ghost" block className="mt-4" onClick={() => setEditing(true)}>
            تعديل الهدف
          </Button>
        ) : null}
      </Sheet>
      {editing ? <GoalSheet goal={goal} onClose={() => { setEditing(false); close(); }} /> : null}
    </>
  );
}

function GoalSheet({ goal, kind: initialKind, onClose }: { goal?: GoalItem; kind?: GoalKind; onClose: () => void }) {
  const { me } = useApp();
  const invalidate = useInvalidate();
  const [open, setOpen] = useState(true);
  const isMine = !goal || goal.owner_id === me.user.id;
  const k = goal?.kind ?? initialKind ?? "other";
  const [kind, setKind] = useState<GoalKind>(k);
  const [name, setName] = useState(goal?.name ?? (k !== "other" ? goalKindMeta(k).label : ""));
  const [target, setTarget] = useState<number | null>(goal?.target_minor ?? null);
  const [targetDate, setTargetDate] = useState(goal?.target_date ?? "");
  const [monthly, setMonthly] = useState<number | null>(goal?.monthly_contribution_minor ?? 0);
  const [visibility, setVisibility] = useState<Visibility>(goal?.visibility ?? "shared");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const close = () => {
    setOpen(false);
    setTimeout(onClose, 250);
  };

  async function save() {
    setError(null);
    const parsed = goalSchema.safeParse({ name, kind, target_minor: target ?? 0, target_date: targetDate || null, monthly_contribution_minor: monthly ?? 0, visibility });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "تحقق من البيانات");
    setSaving(true);
    const sb = getSupabase();
    const data: Record<string, unknown> = { ...parsed.data };
    if (goal && !isMine) delete data.visibility;
    const res = goal ? await sb.from("savings_goals").update(data).eq("id", goal.id) : await sb.from("savings_goals").insert({ ...data, household_id: me.household.id, owner_id: me.user.id });
    setSaving(false);
    if (res.error) return setError(arabicError(res.error));
    await invalidate(qk.goals);
    toast.success(goal ? "تم تحديث الهدف" : "تم إنشاء الهدف");
    close();
  }

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(o) => (o ? setOpen(true) : close())}
        title={goal ? "تعديل الهدف" : "هدف ادخار جديد"}
        footer={
          <div className="flex gap-2">
            {goal ? (
              <Button variant="danger-soft" size="lg" className="w-14 px-0" aria-label="حذف الهدف" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="size-5" />
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
            <ChipGroup
              value={kind}
              onChange={(v) => {
                setKind(v);
                if (!name || GOAL_KINDS.some((g) => g.label === name)) setName(v === "other" ? "" : goalKindMeta(v).label);
              }}
              options={GOAL_KINDS.map((g) => ({ value: g.value, label: g.label }))}
            />
          </Field>
          <Field label="اسم الهدف" htmlFor="gname">
            <Input id="gname" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلًا: السفر لمصر" maxLength={60} />
          </Field>
          <Field label="المبلغ المستهدف" htmlFor="gtarget">
            <AmountInput id="gtarget" value={target} onChange={setTarget} />
          </Field>
          <Field label="المساهمة الشهرية المخططة" htmlFor="gmonthly">
            <AmountInput id="gmonthly" value={monthly} onChange={setMonthly} allowZero />
          </Field>
          <Field label="التاريخ المستهدف (اختياري)" htmlFor="gdate">
            <Input id="gdate" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </Field>
          <Field label="الخصوصية">
            <VisibilityField value={visibility} onChange={setVisibility} disabled={!isMine} privateHint="هدف خاص بك — لا يظهر لشريكك ولا في تحليلات البيت." />
          </Field>
          <FormError message={error} />
        </div>
      </Sheet>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="حذف الهدف؟"
        description="سيُحذف الهدف وسجل المساهمات الخاص به."
        confirmLabel="حذف"
        destructive
        onConfirm={async () => {
          const { error } = await getSupabase().from("savings_goals").delete().eq("id", goal!.id);
          if (error) return toast.error(arabicError(error));
          await invalidate(qk.goals);
          setConfirmDelete(false);
          close();
        }}
      />
    </>
  );
}
