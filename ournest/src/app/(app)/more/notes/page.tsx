"use client";

import { Lock, NotebookPen, Pin, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { FormError } from "@/components/forms";
import { useNumerals } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Field, Input, Textarea } from "@/components/ui/input";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Sheet } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { qk, useInvalidate, useNotes } from "@/lib/data/hooks";
import { formatDate, todayInDubai } from "@/lib/dates";
import { arabicError } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase/client";
import type { PersonalNote } from "@/lib/types";

export default function NotesPage() {
  const { data: notes, isLoading } = useNotes();
  const numerals = useNumerals();
  const [editing, setEditing] = useState<PersonalNote | "new" | null>(null);
  return (
    <div>
      <PageHeader
        title="ملاحظاتي المالية"
        back="/more"
        actions={
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="size-4" /> ملاحظة
          </Button>
        }
      />
      <p className="mb-4 flex items-center gap-1.5 px-1 text-sm text-foreground-muted">
        <Lock className="size-4" /> ملاحظاتك خاصة بك ولا يمكن مشاركتها.
      </p>
      {isLoading ? (
        <Skeleton className="h-40 rounded-3xl" />
      ) : !notes?.length ? (
        <EmptyState icon={<NotebookPen />} title="لا توجد ملاحظات" description="خطط شخصية، أفكار ادخار، تذكيرات بمواعيد — كل ما يخصك." action={<Button onClick={() => setEditing("new")}>ملاحظة جديدة</Button>} />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {notes.map((n) => (
            <button key={n.id} type="button" onClick={() => setEditing(n)} className="pressable surface-card flex min-h-32 flex-col rounded-3xl p-4 text-start">
              <p className="flex items-center gap-1.5 font-semibold">
                {n.is_pinned ? <Pin className="size-3.5 text-primary" /> : null}
                <span className="line-clamp-1">{n.title}</span>
              </p>
              <p className="mt-1 line-clamp-4 flex-1 whitespace-pre-line text-sm text-foreground-muted">{n.body}</p>
              <p className="mt-2 text-xs text-foreground-subtle">{formatDate(todayInDubai(new Date(n.updated_at)), "dayMonth", numerals)}</p>
            </button>
          ))}
        </div>
      )}
      {editing ? <NoteSheet key={editing === "new" ? "new" : editing.id} note={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function NoteSheet({ note, onClose }: { note: PersonalNote | null; onClose: () => void }) {
  const { me } = useApp();
  const invalidate = useInvalidate();
  const [open, setOpen] = useState(true);
  const [title, setTitle] = useState(note?.title ?? "");
  const [body, setBody] = useState(note?.body ?? "");
  const [pinned, setPinned] = useState(note?.is_pinned ?? false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const close = () => {
    setOpen(false);
    setTimeout(onClose, 250);
  };
  async function save() {
    if (!title.trim()) return setError("أدخل عنوانًا");
    setSaving(true);
    const sb = getSupabase();
    const data = { title: title.trim(), body, is_pinned: pinned };
    const res = note ? await sb.from("personal_notes").update(data).eq("id", note.id) : await sb.from("personal_notes").insert({ ...data, owner_id: me.user.id });
    setSaving(false);
    if (res.error) return setError(arabicError(res.error));
    await invalidate(qk.notes);
    toast.success("تم حفظ الملاحظة");
    close();
  }
  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(o) => (o ? setOpen(true) : close())}
        title={note ? "تعديل الملاحظة" : "ملاحظة جديدة"}
        footer={
          <div className="flex gap-2">
            {note ? (
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
          <Field label="العنوان" htmlFor="ntitle">
            <Input id="ntitle" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
          </Field>
          <Field label="الملاحظة" htmlFor="nbody">
            <Textarea id="nbody" value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} rows={6} />
          </Field>
          <label className="flex items-center justify-between rounded-2xl bg-muted/60 px-4 py-3">
            <span className="text-[15px] font-medium">تثبيت في الأعلى</span>
            <Switch checked={pinned} onCheckedChange={setPinned} ariaLabel="تثبيت" />
          </label>
          <FormError message={error} />
        </div>
      </Sheet>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="حذف الملاحظة؟"
        confirmLabel="حذف"
        destructive
        onConfirm={async () => {
          const { error } = await getSupabase().from("personal_notes").delete().eq("id", note!.id);
          if (error) return toast.error(arabicError(error));
          await invalidate(qk.notes);
          setConfirmDelete(false);
          close();
        }}
      />
    </>
  );
}
