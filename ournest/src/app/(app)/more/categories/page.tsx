"use client";

import { Archive, Lock, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { FormError, VisibilityField } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { CATEGORY_COLORS, CATEGORY_ICONS, CategoryIcon } from "@/components/ui/category-icon";
import { Field, Input, Select } from "@/components/ui/input";
import { ListGroup, Skeleton } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { qk, useCategories, useInvalidate } from "@/lib/data/hooks";
import { arabicError } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase/client";
import type { Category, Visibility } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function CategoriesPage() {
  const { me } = useApp();
  const { data: categories, isLoading } = useCategories();
  const [tab, setTab] = useState<Visibility>("shared");
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const list = (categories ?? []).filter((c) => (tab === "shared" ? c.visibility === "shared" : c.visibility === "private" && c.owner_id === me.user.id));
  const parents = list.filter((c) => !c.parent_id);

  return (
    <div>
      <PageHeader
        title="التصنيفات"
        back="/more"
        actions={
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="size-4" /> تصنيف
          </Button>
        }
      />
      <Segmented
        value={tab}
        onChange={setTab}
        size="sm"
        options={[
          { value: "shared", label: "تصنيفات البيت" },
          { value: "private", label: "تصنيفاتي الخاصة", icon: <Lock className="size-3.5" /> },
        ]}
      />
      {isLoading ? (
        <Skeleton className="mt-4 h-60 rounded-3xl" />
      ) : (
        <ListGroup className="mt-4">
          {parents.map((p) => (
            <div key={p.id}>
              <Row c={p} onClick={() => setEditing(p)} />
              {list
                .filter((s) => s.parent_id === p.id)
                .map((s) => (
                  <Row key={s.id} c={s} sub onClick={() => setEditing(s)} />
                ))}
            </div>
          ))}
          {!parents.length ? <p className="p-6 text-center text-sm text-foreground-muted">لا توجد تصنيفات هنا بعد.</p> : null}
        </ListGroup>
      )}
      <p className="mt-3 px-1 text-xs leading-relaxed text-foreground-subtle">
        التصنيفات الخاصة تظهر لك وحدك ويمكن استخدامها لمصاريفك الخاصة فقط. المصاريف المشتركة تستخدم تصنيفات البيت.
      </p>
      {editing ? <CategorySheet key={editing === "new" ? "new" : editing.id} category={editing === "new" ? null : editing} defaultVisibility={tab} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function Row({ c, sub, onClick }: { c: Category; sub?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn("pressable flex w-full items-center gap-3 border-t border-border px-4 py-3 text-start first:border-t-0 hover:bg-muted/50", sub && "ps-12")}>
      <CategoryIcon icon={c.icon} color={c.color} size={sub ? 32 : 38} />
      <span className={cn("flex-1 truncate", c.is_archived && "text-foreground-subtle line-through")}>{c.name}</span>
      {c.is_archived ? <Archive className="size-4 text-foreground-subtle" /> : null}
    </button>
  );
}

function CategorySheet({ category, defaultVisibility, onClose }: { category: Category | null; defaultVisibility: Visibility; onClose: () => void }) {
  const { me } = useApp();
  const { data: categories = [] } = useCategories();
  const invalidate = useInvalidate();
  const [open, setOpen] = useState(true);
  const isMine = !category || category.owner_id === me.user.id;
  const [name, setName] = useState(category?.name ?? "");
  const [icon, setIcon] = useState(category?.icon ?? "tag");
  const [color, setColor] = useState(category?.color ?? "emerald");
  const [visibility, setVisibility] = useState<Visibility>(category?.visibility ?? defaultVisibility);
  const [parentId, setParentId] = useState<string | null>(category?.parent_id ?? null);
  const [archived, setArchived] = useState(category?.is_archived ?? false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const close = () => {
    setOpen(false);
    setTimeout(onClose, 250);
  };
  const parentOptions = categories.filter(
    (c) => !c.parent_id && c.id !== category?.id && !c.is_archived && (c.visibility === "shared" || (visibility === "private" && c.owner_id === me.user.id)) && (visibility === "private" || c.visibility === "shared"),
  );

  async function save() {
    setError(null);
    if (!name.trim()) return setError("أدخل اسم التصنيف");
    setSaving(true);
    const sb = getSupabase();
    const data: Record<string, unknown> = { name: name.trim(), icon, color, visibility, parent_id: parentId, is_archived: archived };
    if (category && !isMine) delete data.visibility;
    const res = category ? await sb.from("categories").update(data).eq("id", category.id) : await sb.from("categories").insert({ ...data, household_id: me.household.id, owner_id: me.user.id, sort_order: 200 });
    setSaving(false);
    if (res.error) return setError(arabicError(res.error));
    await invalidate(qk.categories, ["budget"]);
    toast.success("تم حفظ التصنيف");
    close();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => (o ? setOpen(true) : close())}
      title={category ? "تعديل التصنيف" : "تصنيف جديد"}
      footer={
        <Button size="lg" block loading={saving} onClick={save}>
          حفظ
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex justify-center py-2">
          <CategoryIcon icon={icon} color={color} size={64} className="rounded-3xl" />
        </div>
        <Field label="الاسم" htmlFor="cname">
          <Input id="cname" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        </Field>
        <Field label="الأيقونة">
          <div className="grid grid-cols-7 gap-2">
            {Object.keys(CATEGORY_ICONS).map((k) => (
              <button key={k} type="button" onClick={() => setIcon(k)} aria-label={k} aria-pressed={icon === k} className={cn("pressable grid place-items-center rounded-xl p-1", icon === k ? "bg-primary-soft ring-2 ring-primary" : "")}>
                <CategoryIcon icon={k} color={color} size={34} className="rounded-xl" />
              </button>
            ))}
          </div>
        </Field>
        <Field label="اللون">
          <div className="flex gap-3">
            {CATEGORY_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={c}
                aria-pressed={color === c}
                className={cn("size-9 rounded-full ring-offset-2 ring-offset-card", color === c && "ring-2 ring-primary")}
                style={{ background: `var(--cat-${c})` }}
              />
            ))}
          </div>
        </Field>
        <Field label="الخصوصية">
          <VisibilityField value={visibility} onChange={setVisibility} disabled={!isMine || !!category} privateHint="تصنيف خاص لمصاريفك الخاصة فقط." />
        </Field>
        <Field label="تصنيف رئيسي (اختياري)" htmlFor="cparent">
          <Select id="cparent" value={parentId ?? ""} onChange={(e) => setParentId(e.target.value || null)}>
            <option value="">بدون — تصنيف رئيسي</option>
            {parentOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        {category ? (
          <label className="flex items-center justify-between rounded-2xl bg-muted/60 px-4 py-3">
            <span>
              <span className="block text-[15px] font-medium">أرشفة التصنيف</span>
              <span className="block text-xs text-foreground-subtle">يختفي من الاختيارات وتبقى المصاريف القديمة كما هي.</span>
            </span>
            <Switch checked={archived} onCheckedChange={setArchived} ariaLabel="أرشفة" />
          </label>
        ) : null}
        <FormError message={error} />
      </div>
    </Sheet>
  );
}
