"use client";

import { Clock, Pencil, ShieldCheck, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { FormError } from "@/components/forms";
import { InviteShare } from "@/components/invite-share";
import { useNumerals } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Field, Input } from "@/components/ui/input";
import { Avatar, Badge, ListGroup } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Sheet } from "@/components/ui/sheet";
import { qk, useInvalidate, useInvitations } from "@/lib/data/hooks";
import { formatDate, todayInDubai } from "@/lib/dates";
import { arabicError } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase/client";

export default function HouseholdPage() {
  const { me } = useApp();
  const numerals = useNumerals();
  const { data: invitations = [] } = useInvitations();
  const invalidate = useInvalidate();
  const [renaming, setRenaming] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [revoke, setRevoke] = useState<string | null>(null);
  const full = me.members.length >= 2;
  const pending = invitations.filter((i) => i.status === "pending" && new Date(i.expires_at) > new Date());

  return (
    <div>
      <PageHeader title="إدارة البيت" back="/more" />
      <Card className="flex items-center justify-between p-5">
        <div>
          <p className="text-sm text-foreground-muted">اسم البيت</p>
          <p className="text-xl font-bold">{me.household.name}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setRenaming(true)}>
          <Pencil className="size-4" /> تعديل
        </Button>
      </Card>

      <h2 className="mb-2 mt-6 px-2 text-sm font-semibold text-foreground-muted">الأعضاء</h2>
      <ListGroup>
        {me.members.map((m) => (
          <div key={m.id} className="flex items-center gap-3 px-4 py-3.5">
            <Avatar name={m.display_name} color={m.avatar_color} size={42} />
            <div className="flex-1">
              <p className="font-medium">
                {m.display_name} {m.id === me.user.id ? <span className="text-foreground-subtle">(أنت)</span> : null}
              </p>
              <p className="text-xs text-foreground-muted">{m.joined_via === "created" ? "أنشأ البيت" : "انضم بدعوة"} · صلاحيات كاملة على مالية البيت</p>
            </div>
          </div>
        ))}
      </ListGroup>

      {!full ? (
        <>
          <h2 className="mb-2 mt-6 px-2 text-sm font-semibold text-foreground-muted">الدعوات</h2>
          {pending.length ? (
            <ListGroup className="mb-3">
              {pending.map((i) => (
                <div key={i.id} className="flex items-center gap-3 px-4 py-3.5">
                  <Clock className="size-5 text-warning" />
                  <div className="min-w-0 flex-1">
                    <p className="ltr-isolate truncate text-left font-medium" dir="ltr">
                      {i.email}
                    </p>
                    <p className="text-xs text-foreground-muted">تنتهي {formatDate(todayInDubai(new Date(i.expires_at)), "dayMonth", numerals)}</p>
                  </div>
                  <Badge tone="warning">بانتظار القبول</Badge>
                  <button type="button" aria-label="إلغاء الدعوة" className="p-1 text-foreground-subtle" onClick={() => setRevoke(i.id)}>
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </ListGroup>
          ) : null}
          <Button block size="lg" onClick={() => setInviteOpen(true)}>
            <UserPlus className="size-5" /> {pending.length ? "إرسال دعوة جديدة" : "دعوة شريكك"}
          </Button>
          <p className="mt-2 px-1 text-xs text-foreground-subtle">الدعوة الجديدة تلغي أي دعوة سابقة لم تُقبل.</p>
        </>
      ) : null}

      <div className="mt-6 flex gap-3 rounded-3xl bg-sage p-4 text-sm leading-relaxed">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
        <p>للزوجين صلاحيات متساوية على كل ما هو مشترك. ما يسجله كل منكما كخاص يبقى له وحده — ويُطبَّق ذلك داخل قاعدة البيانات.</p>
      </div>

      {renaming ? <RenameSheet onClose={() => setRenaming(false)} /> : null}
      {inviteOpen ? <InviteSheet onClose={() => { setInviteOpen(false); invalidate(qk.invitations); }} /> : null}
      <ConfirmDialog
        open={!!revoke}
        onOpenChange={(o) => !o && setRevoke(null)}
        title="إلغاء الدعوة؟"
        description="لن يعمل الرابط بعد الإلغاء."
        confirmLabel="إلغاء الدعوة"
        destructive
        onConfirm={async () => {
          const { error } = await getSupabase().rpc("revoke_invitation", { p_invitation_id: revoke });
          if (error) return toast.error(arabicError(error));
          await invalidate(qk.invitations);
          setRevoke(null);
        }}
      />
    </div>
  );
}

function RenameSheet({ onClose }: { onClose: () => void }) {
  const { me } = useApp();
  const invalidate = useInvalidate();
  const [open, setOpen] = useState(true);
  const [name, setName] = useState(me.household.name);
  const [saving, setSaving] = useState(false);
  const close = () => {
    setOpen(false);
    setTimeout(onClose, 250);
  };
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => (o ? setOpen(true) : close())}
      title="اسم البيت"
      footer={
        <Button
          size="lg"
          block
          loading={saving}
          disabled={!name.trim()}
          onClick={async () => {
            setSaving(true);
            const { error } = await getSupabase().from("households").update({ name: name.trim() }).eq("id", me.household.id);
            setSaving(false);
            if (error) return toast.error(arabicError(error));
            await invalidate(qk.me);
            close();
          }}
        >
          حفظ
        </Button>
      }
    >
      <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} aria-label="اسم البيت" />
    </Sheet>
  );
}

function InviteSheet({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(true);
  const [email, setEmail] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const close = () => {
    setOpen(false);
    setTimeout(onClose, 250);
  };
  return (
    <Sheet open={open} onOpenChange={(o) => (o ? setOpen(true) : close())} title="دعوة شريكك" description="سيحتاج شريكك لتسجيل الدخول بنفس البريد لقبول الدعوة.">
      {link ? (
        <InviteShare link={link} partnerHint={email.trim().toLowerCase()} />
      ) : (
        <div className="space-y-4">
          <Field label="البريد الإلكتروني" htmlFor="invemail">
            <Input id="invemail" type="email" inputMode="email" dir="ltr" className="text-left" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <FormError message={error} />
          <Button
            size="lg"
            block
            loading={busy}
            disabled={!email.includes("@")}
            onClick={async () => {
              setBusy(true);
              setError(null);
              const { data, error } = await getSupabase().rpc("create_invitation", { p_email: email.trim() });
              setBusy(false);
              if (error) return setError(arabicError(error));
              setLink(`${window.location.origin}/invite/${data as string}`);
            }}
          >
            إنشاء رابط الدعوة
          </Button>
        </div>
      )}
    </Sheet>
  );
}
