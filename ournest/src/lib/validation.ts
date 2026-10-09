import { z } from "zod";
import { isISODate } from "./dates";
import { MAX_AMOUNT_MINOR } from "./money";

const isoDate = z.string().refine(isISODate, "التاريخ غير صحيح");
const minor = z.number().int().positive("أدخل مبلغًا أكبر من صفر").max(MAX_AMOUNT_MINOR, "المبلغ كبير جدًا");

export const transactionSchema = z.object({
  amount_minor: minor,
  category_id: z.string().uuid("اختر تصنيفًا"),
  visibility: z.enum(["shared", "private"]),
  occurred_on: isoDate,
  description: z.string().trim().max(200, "الوصف طويل جدًا").optional().nullable(),
  payment_method: z.enum(["cash", "debit_card", "credit_card", "bank_transfer", "apple_pay", "other"]).nullable().optional(),
  account_id: z.string().uuid().nullable().optional(),
});

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email("البريد الإلكتروني غير صحيح"),
  password: z.string().min(1, "أدخل كلمة المرور"),
});

export const signUpSchema = z.object({
  displayName: z.string().trim().min(2, "الاسم قصير جدًا").max(40, "الاسم طويل جدًا"),
  email: z.string().trim().toLowerCase().email("البريد الإلكتروني غير صحيح"),
  password: z.string().min(8, "كلمة المرور يجب ألا تقل عن ٨ أحرف").max(72, "كلمة المرور طويلة جدًا"),
});

export const billSchema = z.object({
  name: z.string().trim().min(1, "أدخل اسم الفاتورة").max(60),
  kind: z.enum(["rent", "car", "utilities", "internet", "mobile", "insurance", "subscription", "installment", "other"]),
  amount_minor: minor,
  is_variable: z.boolean(),
  frequency: z.enum(["weekly", "monthly", "quarterly", "yearly"]),
  interval_count: z.number().int().min(1).max(12),
  anchor_date: isoDate,
  end_date: isoDate.nullable(),
  reminder_days: z.number().int().min(0).max(14),
  category_id: z.string().uuid().nullable(),
  visibility: z.enum(["shared", "private"]),
  autopay: z.boolean(),
});

export const planSchema = z
  .object({
    name: z.string().trim().min(1, "أدخل اسم القسط").max(60),
    lender: z.string().trim().max(60).nullable(),
    total_amount_minor: minor,
    monthly_amount_minor: minor,
    opening_paid_minor: z.number().int().min(0),
    first_due_date: isoDate,
    category_id: z.string().uuid("اختر تصنيفًا").nullable(),
    visibility: z.enum(["shared", "private"]),
  })
  .refine((v) => v.monthly_amount_minor <= v.total_amount_minor, { message: "القسط الشهري أكبر من الإجمالي", path: ["monthly_amount_minor"] })
  .refine((v) => v.opening_paid_minor <= v.total_amount_minor, { message: "المدفوع سابقًا أكبر من الإجمالي", path: ["opening_paid_minor"] });

export const goalSchema = z.object({
  name: z.string().trim().min(1, "أدخل اسم الهدف").max(60),
  kind: z.enum(["emergency", "home", "travel", "car", "apartment", "vacation", "other"]),
  target_minor: minor,
  target_date: isoDate.nullable(),
  monthly_contribution_minor: z.number().int().min(0),
  visibility: z.enum(["shared", "private"]),
});

export const incomeSchema = z.object({
  name: z.string().trim().min(1, "أدخل اسم مصدر الدخل").max(60),
  kind: z.enum(["salary", "freelance", "bonus", "other"]),
  frequency: z.enum(["monthly", "one_time"]),
  amount_minor: minor,
  starts_on: isoDate,
  ends_on: isoDate.nullable(),
});
