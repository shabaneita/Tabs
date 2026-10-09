"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Camera, ChevronDown, CreditCard, FileText, Lock, Paperclip, PenLine, Trash2, Users, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { Amount, useNumerals } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { CategoryIcon } from "@/components/ui/category-icon";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Input, Select } from "@/components/ui/input";
import { Keypad } from "@/components/ui/keypad";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { SPENDING_KEYS, useAccounts, useCategories, useInvalidate } from "@/lib/data/hooks";
import { addDays, formatDate, relativeDayLabel, type ISODate } from "@/lib/dates";
import { arabicError } from "@/lib/errors";
import { applyKey, type KeypadKey } from "@/lib/keypad";
import { PAYMENT_METHODS, paymentMethodLabel } from "@/lib/labels";
import { localizeDigits, minorToInput, parseAmountToMinor } from "@/lib/money";
import { deleteReceipt, receiptUrl, uploadReceipt } from "@/lib/receipts";
import { getSupabase } from "@/lib/supabase/client";
import type { Category, PaymentMethod, Transaction, Visibility } from "@/lib/types";
import { cn, haptic } from "@/lib/utils";
import { transactionSchema } from "@/lib/validation";

export interface QuickAddPreset {
  amountMinor?: number;
  categoryId?: string | null;
  visibility?: Visibility;
  description?: string;
  occurredOn?: ISODate;
  billId?: string;
  billPeriod?: ISODate;
  lockVisibility?: boolean;
  title?: string;
}

interface QuickAddApi {
  open: (preset?: QuickAddPreset) => void;
  edit: (tx: Transaction) => void;
}

const QuickAddContext = createContext<QuickAddApi | null>(null);
export const useQuickAdd = () => {
  const ctx = useContext(QuickAddContext);
  if (!ctx) throw new Error("useQuickAdd outside provider");
  return ctx;
};

const LAST_VIS_KEY = "ournest:last-visibility";
const LAST_METHOD_KEY = "ournest:last-method";

export function QuickAddProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ open: boolean; preset?: QuickAddPreset; tx?: Transaction; key: number }>({ open: false, key: 0 });
  const api = useMemo<QuickAddApi>(
    () => ({
      open: (preset) => setState((s) => ({ open: true, preset, tx: undefined, key: s.key + 1 })),
      edit: (tx) => setState((s) => ({ open: true, tx, preset: undefined, key: s.key + 1 })),
    }),
    [],
  );
  return (
    <QuickAddContext.Provider value={api}>
      {children}
      <ExpenseSheet
        key={state.key}
        open={state.open}
        preset={state.preset}
        tx={state.tx}
        onOpenChange={(open) => setState((s) => ({ ...s, open }))}
      />
    </QuickAddContext.Provider>
  );
}

function ExpenseSheet({
  open,
  onOpenChange,
  preset,
  tx,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  preset?: QuickAddPreset;
  tx?: Transaction;
}) {
  const { me, today } = useApp();
  const numerals = useNumerals();
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  const { data: categories = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();
  const isEdit = !!tx;
  const isMine = !tx || tx.owner_id === me.user.id;

  const initialVisibility: Visibility =
    tx?.visibility ??
    preset?.visibility ??
    ((typeof window !== "undefined" && (localStorage.getItem(LAST_VIS_KEY) as Visibility | null)) || me.settings.default_visibility);

  const [amount, setAmount] = useState(() => (tx ? minorToInput(tx.amount_minor) : preset?.amountMinor ? minorToInput(preset.amountMinor) : ""));
  const [categoryId, setCategoryId] = useState<string | null>(tx?.category_id ?? preset?.categoryId ?? null);
  const [visibility, setVisibility] = useState<Visibility>(initialVisibility);
  const [occurredOn, setOccurredOn] = useState<ISODate>(tx?.occurred_on ?? preset?.occurredOn ?? today);
  const [description, setDescription] = useState(tx?.description ?? preset?.description ?? "");
  const [method, setMethod] = useState<PaymentMethod | null>(
    tx ? tx.payment_method : ((typeof window !== "undefined" && (localStorage.getItem(LAST_METHOD_KEY) as PaymentMethod | null)) || null),
  );
  const [accountId, setAccountId] = useState<string | null>(tx?.account_id ?? null);
  const [file, setFile] = useState<File | null>(null);
  const [showDetails, setShowDetails] = useState(isEdit || !!preset?.billId);
  const [saving, setSaving] = useState(false);
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [requestId] = useState(() => crypto.randomUUID());
  const fileRef = useRef<HTMLInputElement>(null);

  const amountMinor = parseAmountToMinor(amount || "0");

  // Categories valid for the chosen visibility (shared records need shared categories).
  const usable = useMemo(
    () =>
      categories.filter(
        (c) => !c.is_archived && (c.visibility === "shared" || (visibility === "private" && c.owner_id === me.user.id)),
      ),
    [categories, visibility, me.user.id],
  );

  // Order by recent usage so frequent categories are one tap away.
  const ordered = useMemo(() => {
    const counts = new Map<string, number>();
    for (const [, data] of qc.getQueriesData<Transaction[]>({ queryKey: ["transactions"] })) {
      for (const t of data ?? []) if (t.owner_id === me.user.id) counts.set(t.category_id, (counts.get(t.category_id) ?? 0) + 1);
    }
    return [...usable].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || a.sort_order - b.sort_order);
  }, [usable, qc, me.user.id]);

  useEffect(() => {
    if (categoryId && !usable.some((c) => c.id === categoryId) && categories.length) setCategoryId(null);
  }, [usable, categoryId, categories.length]);

  const accountOptions = accounts.filter((a) => !a.is_archived && (a.visibility === "shared" || (visibility === "private" && a.owner_id === me.user.id)));

  const onKey = useCallback((k: KeypadKey) => setAmount((a) => applyKey(a, k)), []);

  const findDuplicate = (): boolean => {
    if (isEdit || !amountMinor || !categoryId) return false;
    const tenMinAgo = Date.now() - 10 * 60_000;
    for (const [, data] of qc.getQueriesData<Transaction[]>({ queryKey: ["transactions"] })) {
      for (const t of data ?? []) {
        if (
          t.amount_minor === amountMinor &&
          t.category_id === categoryId &&
          t.occurred_on === occurredOn &&
          new Date(t.created_at).getTime() > tenMinAgo
        )
          return true;
      }
    }
    return false;
  };

  async function save(skipDuplicateCheck = false) {
    const payload = {
      amount_minor: amountMinor ?? 0,
      category_id: categoryId ?? "",
      visibility,
      occurred_on: occurredOn,
      description: description.trim() || null,
      payment_method: method,
      account_id: accountId,
    };
    const parsed = transactionSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "تحقق من البيانات");
      return;
    }
    if (!skipDuplicateCheck && findDuplicate()) {
      setConfirmDuplicate(true);
      return;
    }

    setSaving(true);
    const sb = getSupabase();
    try {
      let id = tx?.id;
      if (isEdit && tx) {
        const patch: Record<string, unknown> = { ...parsed.data, last_edited_by: me.user.id };
        if (!isMine) delete patch.visibility;
        const res = await sb.from("transactions").update(patch).eq("id", tx.id).select("id").single();
        if (res.error) throw res.error;
      } else {
        const res = await sb
          .from("transactions")
          .insert({
            ...parsed.data,
            household_id: me.household.id,
            owner_id: me.user.id,
            client_request_id: requestId,
            bill_id: preset?.billId ?? null,
            bill_period: preset?.billPeriod ?? null,
          })
          .select("id")
          .single();
        if (res.error) throw res.error;
        id = res.data.id as string;
        try {
          localStorage.setItem(LAST_VIS_KEY, visibility);
          if (method) localStorage.setItem(LAST_METHOD_KEY, method);
        } catch {
          /* private mode */
        }
      }

      if (file && id) {
        try {
          await uploadReceipt(me.household.id, id, file);
        } catch {
          toast.warning("تم حفظ المصروف، لكن تعذّر رفع الإيصال.");
        }
      }

      haptic(12);
      await invalidate(...SPENDING_KEYS);
      onOpenChange(false);
      const savedId = id;
      toast.success(isEdit ? "تم تحديث المصروف" : "تم حفظ المصروف", {
        description: `${localizeDigits(minorToInput(parsed.data.amount_minor), numerals)} د.إ · ${categories.find((c) => c.id === categoryId)?.name ?? ""}`,
        action:
          !isEdit && savedId
            ? {
                label: "تراجع",
                onClick: async () => {
                  const del = await sb.from("transactions").delete().eq("id", savedId);
                  if (del.error) toast.error(arabicError(del.error));
                  else {
                    await invalidate(...SPENDING_KEYS);
                    toast("تم التراجع عن المصروف");
                  }
                },
              }
            : undefined,
      });
    } catch (e) {
      toast.error(arabicError(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!tx) return;
    setSaving(true);
    const sb = getSupabase();
    try {
      for (const r of tx.receipt_attachments ?? []) await deleteReceipt(r.id, r.storage_path).catch(() => {});
      const res = await sb.from("transactions").delete().eq("id", tx.id);
      if (res.error) throw res.error;
      await invalidate(...SPENDING_KEYS);
      setConfirmDelete(false);
      onOpenChange(false);
      toast.success("تم حذف المصروف");
    } catch (e) {
      toast.error(arabicError(e));
    } finally {
      setSaving(false);
    }
  }

  const ownerName = tx ? me.members.find((m) => m.id === tx.owner_id)?.display_name : null;
  const title = preset?.title ?? (isEdit ? "تفاصيل المصروف" : "أضف مصروف");
  const canSave = !!amountMinor && !!categoryId;

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={onOpenChange}
        title={title}
        description={isEdit && ownerName ? `أضافه ${ownerName}` : undefined}
        footer={
          <div className="flex gap-2">
            {isEdit ? (
              <Button variant="danger-soft" size="lg" className="w-14 px-0" aria-label="حذف المصروف" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="size-5" />
              </Button>
            ) : null}
            <Button size="lg" block disabled={!canSave} loading={saving} onClick={() => save()} data-testid="save-expense">
              {isEdit ? "حفظ التعديلات" : "حفظ"}
              {amountMinor ? <Amount minor={amountMinor} className="opacity-90" /> : null}
            </Button>
          </div>
        }
      >
        {/* Visibility */}
        <div className="mb-3">
          <Segmented<Visibility>
            ariaLabel="لمن هذا المصروف"
            value={visibility}
            onChange={(v) => (isMine && !preset?.lockVisibility ? setVisibility(v) : null)}
            options={[
              { value: "shared", label: "مصروف البيت", icon: <Users className="size-4" /> },
              { value: "private", label: "خاص بي", icon: <Lock className="size-4" /> },
            ]}
          />
          <p className="mt-1.5 px-1 text-xs text-foreground-subtle">
            {!isMine
              ? "صاحب المصروف فقط يمكنه تغيير الخصوصية."
              : visibility === "shared"
                ? "يظهر لشريكك ويُحسب في ميزانية البيت."
                : "يظهر لك وحدك ولا يدخل في ميزانية البيت."}
          </p>
        </div>

        {/* Amount display */}
        <div className="flex items-center justify-center py-2" aria-live="polite">
          <button
            type="button"
            onClick={() => setAmount("")}
            className="flex items-baseline gap-2"
            aria-label="المبلغ — اضغط للمسح"
            data-testid="amount-display"
          >
            <span className={cn("num text-5xl font-bold tracking-tight", !amount && "text-foreground-subtle")}>
              {amount ? localizeDigits(amount, numerals).replace(".", numerals === "arab" ? "٫" : ".") : localizeDigits("0", numerals)}
            </span>
            <span className="text-lg font-medium text-foreground-muted">د.إ</span>
          </button>
        </div>

        {/* Categories */}
        <div className="-mx-5 mb-3 mt-1">
          <div className="no-scrollbar grid auto-cols-[76px] grid-flow-col grid-rows-2 gap-2 overflow-x-auto px-5 pb-1" role="radiogroup" aria-label="التصنيف">
            {ordered.map((c) => (
              <CategoryChip key={c.id} category={c} selected={c.id === categoryId} onSelect={() => setCategoryId(c.id)} />
            ))}
          </div>
          {ordered.length === 0 ? <p className="px-5 text-sm text-foreground-muted">لا توجد تصنيفات متاحة.</p> : null}
        </div>

        {/* Optional details */}
        <div className="mb-3 flex flex-wrap gap-2">
          <Chip icon={<CalendarDays className="size-4" />} active={occurredOn !== today} onClick={() => setShowDetails(true)}>
            {relativeDayLabel(occurredOn, today, numerals)}
          </Chip>
          <Chip icon={<PenLine className="size-4" />} active={!!description} onClick={() => setShowDetails(true)}>
            {description ? description.slice(0, 18) : "ملاحظة"}
          </Chip>
          <Chip icon={<CreditCard className="size-4" />} active={!!method} onClick={() => setShowDetails(true)}>
            {method ? paymentMethodLabel(method) : "طريقة الدفع"}
          </Chip>
          <Chip icon={<Paperclip className="size-4" />} active={!!file} onClick={() => fileRef.current?.click()}>
            {file ? "إيصال مرفق" : "إيصال"}
          </Chip>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              if (f && f.size > 10 * 1024 * 1024 * 3) {
                toast.error("الملف كبير جدًا");
                return;
              }
              setFile(f);
            }}
          />
        </div>

        <AnimatePresence initial={false}>
          {showDetails ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              className="overflow-hidden"
            >
              <div className="mb-4 space-y-3 rounded-2xl bg-muted/60 p-3">
                <div className="flex gap-2">
                  {[today, addDays(today, -1)].map((d) => (
                    <Chip key={d} active={occurredOn === d} onClick={() => setOccurredOn(d)}>
                      {relativeDayLabel(d, today, numerals)}
                    </Chip>
                  ))}
                  <label className="relative flex-1">
                    <span className="sr-only">تاريخ المصروف</span>
                    <Input
                      type="date"
                      value={occurredOn}
                      max={addDays(today, 31)}
                      onChange={(e) => e.target.value && setOccurredOn(e.target.value)}
                      className="h-10 rounded-xl text-sm"
                      aria-label={`التاريخ: ${formatDate(occurredOn, "full", numerals)}`}
                    />
                  </label>
                </div>
                <Input
                  placeholder="وصف اختياري (مثلًا: كارفور)"
                  value={description}
                  maxLength={200}
                  onChange={(e) => setDescription(e.target.value)}
                  className="h-11 rounded-xl"
                  aria-label="الوصف"
                />
                <div className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3">
                  {PAYMENT_METHODS.map((p) => (
                    <Chip key={p.value} active={method === p.value} onClick={() => setMethod(method === p.value ? null : p.value)}>
                      {p.label}
                    </Chip>
                  ))}
                </div>
                {accountOptions.length > 0 ? (
                  <Select value={accountId ?? ""} onChange={(e) => setAccountId(e.target.value || null)} className="h-11 rounded-xl" aria-label="الحساب">
                    <option value="">بدون حساب</option>
                    {accountOptions.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                        {a.visibility === "private" ? " (خاص)" : ""}
                      </option>
                    ))}
                  </Select>
                ) : null}
                {file ? (
                  <div className="flex items-center justify-between rounded-xl bg-card px-3 py-2 text-sm">
                    <span className="flex items-center gap-2 truncate">
                      {file.type === "application/pdf" ? <FileText className="size-4" /> : <Camera className="size-4" />}
                      <span className="truncate">{file.name}</span>
                    </span>
                    <button type="button" onClick={() => setFile(null)} aria-label="إزالة الإيصال" className="p-1">
                      <X className="size-4" />
                    </button>
                  </div>
                ) : null}
                {tx?.receipt_attachments?.length ? <ReceiptList tx={tx} /> : null}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {!showDetails ? (
          <button type="button" onClick={() => setShowDetails(true)} className="mx-auto mb-2 flex items-center gap-1 text-xs text-foreground-subtle">
            تفاصيل إضافية <ChevronDown className="size-3.5" />
          </button>
        ) : null}

        <Keypad onKey={onKey} />
      </Sheet>

      <ConfirmDialog
        open={confirmDuplicate}
        onOpenChange={setConfirmDuplicate}
        title="يبدو أنك سجلت هذا المصروف للتو"
        description="يوجد مصروف بنفس المبلغ والتصنيف والتاريخ خلال آخر ١٠ دقائق. هل تريد حفظه مرة أخرى؟"
        confirmLabel="احفظه مرة أخرى"
        cancelLabel="لا، ألغِ"
        onConfirm={() => {
          setConfirmDuplicate(false);
          save(true);
        }}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="حذف المصروف؟"
        description={visibility === "shared" ? "سيُحذف المصروف من سجل البيت لكما معًا." : "سيُحذف المصروف نهائيًا."}
        confirmLabel="حذف"
        destructive
        loading={saving}
        onConfirm={remove}
      />
    </>
  );
}

function CategoryChip({ category, selected, onSelect }: { category: Category; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => {
        haptic();
        onSelect();
      }}
      className={cn(
        "pressable flex h-[72px] flex-col items-center justify-center gap-1 rounded-2xl border px-1 text-center transition-colors",
        selected ? "border-primary bg-primary-soft" : "border-transparent bg-muted",
      )}
    >
      <CategoryIcon icon={category.icon} color={category.color} size={30} className="rounded-xl" />
      <span className="line-clamp-1 w-full text-[11px] font-medium leading-tight">{category.name}</span>
    </button>
  );
}

function Chip({ children, icon, active, onClick }: { children: React.ReactNode; icon?: React.ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "pressable inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium",
        active ? "border-primary/40 bg-primary-soft text-primary" : "border-border bg-card text-foreground-muted",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function ReceiptList({ tx }: { tx: Transaction }) {
  const invalidate = useInvalidate();
  return (
    <div className="space-y-1.5">
      <p className="px-1 text-xs font-medium text-foreground-muted">الإيصالات</p>
      {tx.receipt_attachments!.map((r) => (
        <div key={r.id} className="flex items-center justify-between rounded-xl bg-card px-3 py-2 text-sm">
          <button
            type="button"
            className="flex items-center gap-2 text-primary"
            onClick={async () => {
              try {
                window.open(await receiptUrl(r.storage_path), "_blank", "noopener");
              } catch (e) {
                toast.error(arabicError(e));
              }
            }}
          >
            {r.mime_type === "application/pdf" ? <FileText className="size-4" /> : <Camera className="size-4" />}
            عرض الإيصال
          </button>
          <button
            type="button"
            aria-label="حذف الإيصال"
            className="p-1 text-foreground-subtle"
            onClick={async () => {
              try {
                await deleteReceipt(r.id, r.storage_path);
                await invalidate(["transactions"]);
                toast.success("تم حذف الإيصال");
              } catch (e) {
                toast.error(arabicError(e));
              }
            }}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
