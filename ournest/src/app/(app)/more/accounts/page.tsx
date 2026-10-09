"use client";

import { Landmark, Lock, Plus, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { ChipGroup, FormError, VisibilityField } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Field, Input } from "@/components/ui/input";
import { EmptyState, ListGroup, Skeleton } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Sheet } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { qk, useAccounts, useInvalidate } from "@/lib/data/hooks";
import { arabicError } from "@/lib/errors";
import { ACCOUNT_KINDS, accountKindLabel } from "@/lib/labels";
import { getSupabase } from "@/lib/supabase/client";
import type { AccountKind, FinancialAccount, Visibility } from "@/lib/types";

export default function AccountsPage() {
  const { me } = useApp();
  const { data: accounts, isLoading } = useAccounts();
  const [editing, setEditing] = useState<FinancialAccount | "new" | null>(null);
  return (
    <div>
      <PageHeader
        title="الحسابات"
        back="/more"
        actions={
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="size-4" /> حساب
          </Button>
        }
      />
      <p className="mb-4 px-1 text-sm leading-relaxed text-foreground-muted">
        الحسابات وسوم لمعرفة من أين خرجت المصاريف. الحساب الخاص لا يظهر لشريكك ولا يمكن ربطه بمصروف مشترك. لا نعرض أرصدة تقديرية.
      </p>
      {isLoading ? (
        <Skeleton className="h-40 rounded-3xl" />
      ) : !accounts?.length ? (
        <EmptyState icon={<Landmark />} title="لا توجد حسابات" action={<Button onClick={() => setEditing("new")}>إضافة حساب</Button>} />
      ) : (
        <ListGroup>
          {accounts.map((a) => (
            <button key={a.id} type="button" onClick={() => setEditing(a)} className="pressable flex w-full items-center gap-3 px-4 py-3.5 text-start hover:bg-muted/50">
              <span className="grid size-10 place-items-center rounded-2xl bg-sage text-primary">
                {a.visibility === "private" ? <Lock className="size-4" /> : <Users className="size-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {a.name}
                  {a.last4 ? <span className="ltr-isolate ms-2 text-foreground-subtle">•••• {a.last4}</span> : null}
                </span>
                <span className="block text-xs text-foreground-muted">
                  {accountKindLabel(a.kind)}
                  {a.institution ? ` · ${a.institution}` : ""}
                  {a.owner_id !== me.user.id ? ` · ${me.partner?.display_name ?? ""}` : ""}
                  {a.is_archived ? " · مؤرشف" : ""}
                </span>
              </span>
            </button>
          ))}
        </ListGroup>
      )}
      {editing ? <AccountSheet key={editing === "new" ? "new" : editing.id} account={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function AccountSheet({ account, onClose }: { account: FinancialAccount | null; onClose: () => void }) {
  const { me } = useApp();
  const invalidate = useInvalidate();
  const [open, setOpen] = useState(true);
  const isMine = !account || account.owner_id === me.user.id;
  const [name, setName] = useState(account?.name ?? "");
  const [kind, setKind] = useState<AccountKind>(account?.kind ?? "bank");
  const [institution, setInstitution] = useState(account?.institution ?? "");
  const [last4, setLast4] = useState(account?.last4 ?? "");
  const [visibility, setVisibility] = useState<Visibility>(account?.visibility ?? "private");
  const [archived, setArchived] = useState(account?.is_archived ?? false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const close = () => {
    setOpen(false);
    setTimeout(onClose, 250);
  };
  async function save() {
    setError(null);
    if (!name.trim()) return setError("أدخل اسم الحساب");
    if (last4 && !/^\d{4}$/.test(last4)) return setError("آخر ٤ أرقام يجب أن تكون ٤ أرقام");
    setSaving(true);
    const sb = getSupabase();
    const data: Record<string, unknown> = { name: name.trim(), kind, institution: institution.trim() || null, last4: last4 || null, visibility, is_archived: archived };
    if (account && !isMine) delete data.visibility;
    const res = account ? await sb.from("financial_accounts").update(data).eq("id", account.id) : await sb.from("financial_accounts").insert({ ...data, household_id: me.household.id, owner_id: me.user.id });
    setSaving(false);
    if (res.error) return setError(arabicError(res.error));
    await invalidate(qk.accounts);
    toast.success("تم الحفظ");
    close();
  }
  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(o) => (o ? setOpen(true) : close())}
        title={account ? "تعديل الحساب" : "حساب جديد"}
        footer={
          <div className="flex gap-2">
            {account ? (
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
            <ChipGroup value={kind} onChange={setKind} options={ACCOUNT_KINDS} />
          </Field>
          <Field label="الاسم" htmlFor="aname">
            <Input id="aname" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلًا: حساب الراتب" maxLength={60} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="البنك (اختياري)" htmlFor="ainst">
              <Input id="ainst" value={institution} onChange={(e) => setInstitution(e.target.value)} maxLength={60} />
            </Field>
            <Field label="آخر ٤ أرقام" htmlFor="alast4">
              <Input id="alast4" inputMode="numeric" dir="ltr" className="text-left" value={last4} maxLength={4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, ""))} />
            </Field>
          </div>
          <Field label="الخصوصية">
            <VisibilityField value={visibility} onChange={setVisibility} disabled={!isMine} sharedHint="حساب مشترك يمكن ربطه بمصاريف البيت." />
          </Field>
          {account ? (
            <label className="flex items-center justify-between rounded-2xl bg-muted/60 px-4 py-3">
              <span className="text-[15px] font-medium">أرشفة الحساب</span>
              <Switch checked={archived} onCheckedChange={setArchived} ariaLabel="أرشفة" />
            </label>
          ) : null}
          <FormError message={error} />
        </div>
      </Sheet>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="حذف الحساب؟"
        description="المصاريف المرتبطة به ستبقى بدون حساب."
        confirmLabel="حذف"
        destructive
        onConfirm={async () => {
          const { error } = await getSupabase().from("financial_accounts").delete().eq("id", account!.id);
          if (error) return toast.error(arabicError(error));
          await invalidate(qk.accounts, ["transactions"]);
          setConfirmDelete(false);
          close();
        }}
      />
    </>
  );
}
