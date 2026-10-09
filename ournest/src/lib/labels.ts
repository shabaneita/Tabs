/** Arabic labels for enums. */
import type { AccountKind, BillFrequency, BillKind, GoalKind, IncomeKind, PaymentMethod } from "./types";

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "debit_card", label: "بطاقة خصم" },
  { value: "credit_card", label: "بطاقة ائتمان" },
  { value: "apple_pay", label: "Apple Pay" },
  { value: "cash", label: "كاش" },
  { value: "bank_transfer", label: "تحويل بنكي" },
  { value: "other", label: "أخرى" },
];
export const paymentMethodLabel = (m: PaymentMethod | null | undefined) => PAYMENT_METHODS.find((p) => p.value === m)?.label ?? "";

export const BILL_KINDS: { value: BillKind; label: string; icon: string }[] = [
  { value: "rent", label: "إيجار", icon: "home" },
  { value: "car", label: "سيارة", icon: "car" },
  { value: "utilities", label: "كهرباء ومياه (ديوا)", icon: "zap" },
  { value: "internet", label: "إنترنت", icon: "wifi" },
  { value: "mobile", label: "موبايل", icon: "smartphone" },
  { value: "insurance", label: "تأمين", icon: "shield" },
  { value: "subscription", label: "اشتراك", icon: "tv" },
  { value: "installment", label: "قسط", icon: "credit-card" },
  { value: "other", label: "أخرى", icon: "receipt" },
];
export const billKindMeta = (k: BillKind) => BILL_KINDS.find((b) => b.value === k) ?? BILL_KINDS[BILL_KINDS.length - 1];

export const FREQUENCIES: { value: BillFrequency; label: string }[] = [
  { value: "monthly", label: "شهري" },
  { value: "quarterly", label: "كل ٣ أشهر" },
  { value: "yearly", label: "سنوي" },
  { value: "weekly", label: "أسبوعي" },
];
export const frequencyLabel = (f: BillFrequency, n = 1) => {
  if (n === 1) return FREQUENCIES.find((x) => x.value === f)?.label ?? "";
  const unit = { weekly: "أسابيع", monthly: "أشهر", quarterly: "أرباع", yearly: "سنوات" }[f];
  return `كل ${n} ${unit}`;
};

export const GOAL_KINDS: { value: GoalKind; label: string; icon: string; color: string }[] = [
  { value: "emergency", label: "صندوق الطوارئ", icon: "shield", color: "rose" },
  { value: "home", label: "تجهيزات البيت", icon: "home", color: "sand" },
  { value: "travel", label: "سفر", icon: "plane", color: "sky" },
  { value: "car", label: "شراء سيارة", icon: "car", color: "violet" },
  { value: "apartment", label: "شراء شقة", icon: "landmark", color: "emerald" },
  { value: "vacation", label: "الإجازة السنوية", icon: "sparkles", color: "sage" },
  { value: "other", label: "هدف آخر", icon: "gift", color: "emerald" },
];
export const goalKindMeta = (k: GoalKind) => GOAL_KINDS.find((g) => g.value === k) ?? GOAL_KINDS[GOAL_KINDS.length - 1];

export const INCOME_KINDS: { value: IncomeKind; label: string }[] = [
  { value: "salary", label: "راتب" },
  { value: "freelance", label: "عمل حر" },
  { value: "bonus", label: "مكافأة" },
  { value: "other", label: "دخل إضافي" },
];
export const incomeKindLabel = (k: IncomeKind) => INCOME_KINDS.find((i) => i.value === k)?.label ?? "";

export const ACCOUNT_KINDS: { value: AccountKind; label: string }[] = [
  { value: "bank", label: "حساب بنكي" },
  { value: "credit_card", label: "بطاقة ائتمان" },
  { value: "cash", label: "كاش" },
  { value: "wallet", label: "محفظة إلكترونية" },
  { value: "savings", label: "حساب توفير" },
  { value: "other", label: "أخرى" },
];
export const accountKindLabel = (k: AccountKind) => ACCOUNT_KINDS.find((a) => a.value === k)?.label ?? "";

export const VISIBILITY_LABEL = { shared: "مشترك", private: "خاص" } as const;
