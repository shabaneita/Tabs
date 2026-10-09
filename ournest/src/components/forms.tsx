"use client";

import { Lock, Users } from "lucide-react";
import { useApp } from "@/components/app/app-context";
import { Select } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { useCategories } from "@/lib/data/hooks";
import type { Visibility } from "@/lib/types";

export function VisibilityField({
  value,
  onChange,
  disabled,
  sharedHint = "يظهر لشريكك وله نفس صلاحياتك عليه.",
  privateHint = "يظهر لك وحدك.",
}: {
  value: Visibility;
  onChange: (v: Visibility) => void;
  disabled?: boolean;
  sharedHint?: string;
  privateHint?: string;
}) {
  return (
    <div>
      <Segmented<Visibility>
        ariaLabel="الخصوصية"
        value={value}
        onChange={(v) => !disabled && onChange(v)}
        options={[
          { value: "shared", label: "مشترك", icon: <Users className="size-4" /> },
          { value: "private", label: "خاص", icon: <Lock className="size-4" /> },
        ]}
      />
      <p className="mt-1.5 px-1 text-xs text-foreground-subtle">{disabled ? "صاحب السجل فقط يمكنه تغيير الخصوصية." : value === "shared" ? sharedHint : privateHint}</p>
    </div>
  );
}

/** Category picker limited to what the record's visibility allows. */
export function CategorySelect({
  value,
  onChange,
  visibility,
  id,
  allowNone,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  visibility: Visibility;
  id?: string;
  allowNone?: boolean;
}) {
  const { me } = useApp();
  const { data: categories = [] } = useCategories();
  const usable = categories.filter((c) => !c.is_archived && (c.visibility === "shared" || (visibility === "private" && c.owner_id === me.user.id)));
  return (
    <Select id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
      {allowNone || !value ? <option value="">{allowNone ? "بدون تصنيف" : "اختر تصنيفًا"}</option> : null}
      {usable.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
          {c.visibility === "private" ? " (خاص)" : ""}
        </option>
      ))}
    </Select>
  );
}

export function ChipGroup<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`pressable h-9 rounded-full border px-3.5 text-[13px] font-medium ${value === o.value ? "border-primary/40 bg-primary-soft text-primary" : "border-border bg-card text-foreground-muted"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
      {message}
    </p>
  );
}
