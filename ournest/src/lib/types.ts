/** Row types mirroring supabase/migrations (snake_case, as returned by PostgREST). */
import type { ISODate } from "./dates";

export type Visibility = "shared" | "private";
export type PaymentMethod = "cash" | "debit_card" | "credit_card" | "bank_transfer" | "apple_pay" | "other";
export type AccountKind = "bank" | "credit_card" | "cash" | "wallet" | "savings" | "other";
export type IncomeKind = "salary" | "freelance" | "bonus" | "other";
export type IncomeFrequency = "monthly" | "one_time";
export type BillFrequency = "weekly" | "monthly" | "quarterly" | "yearly";
export type BillKind = "rent" | "car" | "utilities" | "internet" | "mobile" | "insurance" | "subscription" | "installment" | "other";
export type GoalKind = "emergency" | "home" | "travel" | "car" | "apartment" | "vacation" | "other";
export type Scope = "all" | "household" | "mine";

export interface Profile {
  id: string;
  display_name: string;
  avatar_color: string;
}

export interface UserSettings {
  user_id: string;
  theme: "system" | "light" | "dark";
  numerals: "latn" | "arab";
  default_visibility: Visibility;
  notify_shared_expenses: boolean;
  notify_bills: boolean;
  notify_budget: boolean;
  bill_reminder_days: number;
}

export interface Household {
  id: string;
  name: string;
  currency: "AED";
  timezone: string;
  created_by: string | null;
}

export interface HouseholdMember {
  household_id: string;
  user_id: string;
  joined_via: "created" | "invitation";
  joined_at: string;
}

export interface Invitation {
  id: string;
  household_id: string;
  email: string;
  invited_by: string;
  status: "pending" | "accepted" | "revoked";
  expires_at: string;
  created_at: string;
}

interface Owned {
  id: string;
  household_id: string;
  owner_id: string;
  visibility: Visibility;
  created_at: string;
  updated_at: string;
}

export interface Category extends Owned {
  parent_id: string | null;
  name: string;
  icon: string;
  color: string;
  system_key: string | null;
  sort_order: number;
  is_archived: boolean;
}

export interface FinancialAccount extends Owned {
  name: string;
  kind: AccountKind;
  institution: string | null;
  last4: string | null;
  is_archived: boolean;
}

export interface Transaction extends Owned {
  amount_minor: number;
  category_id: string;
  account_id: string | null;
  payment_method: PaymentMethod | null;
  description: string | null;
  occurred_on: ISODate;
  bill_id: string | null;
  bill_period: ISODate | null;
  installment_plan_id: string | null;
  client_request_id: string;
  last_edited_by: string | null;
  receipt_attachments?: ReceiptAttachment[];
}

export interface ReceiptAttachment {
  id: string;
  transaction_id: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string;
  created_at: string;
}

export interface Budget {
  id: string;
  household_id: string;
  month: ISODate;
  total_allocation_minor: number;
  note: string | null;
}

export interface BudgetItem {
  id: string;
  budget_id: string;
  household_id: string;
  category_id: string;
  planned_minor: number;
}

export interface HouseholdContribution {
  id: string;
  household_id: string;
  user_id: string;
  effective_month: ISODate;
  monthly_amount_minor: number;
  note: string | null;
}

export interface IncomeSource {
  id: string;
  owner_id: string;
  household_id: string | null;
  name: string;
  kind: IncomeKind;
  frequency: IncomeFrequency;
  amount_minor: number;
  starts_on: ISODate;
  ends_on: ISODate | null;
  account_id: string | null;
  note: string | null;
}

export interface RecurringBill extends Owned {
  name: string;
  kind: BillKind;
  category_id: string | null;
  amount_minor: number;
  is_variable: boolean;
  frequency: BillFrequency;
  interval_count: number;
  anchor_date: ISODate;
  end_date: ISODate | null;
  reminder_days: number;
  autopay: boolean;
  is_active: boolean;
  note: string | null;
}

export interface InstallmentPlan extends Owned {
  name: string;
  lender: string | null;
  category_id: string | null;
  total_amount_minor: number;
  monthly_amount_minor: number;
  opening_paid_minor: number;
  first_due_date: ISODate;
  is_active: boolean;
  note: string | null;
}

export interface InstallmentPayment {
  id: string;
  plan_id: string;
  amount_minor: number;
  paid_on: ISODate;
  period: ISODate | null;
  is_extra: boolean;
  transaction_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface SavingsGoal extends Owned {
  name: string;
  kind: GoalKind;
  target_minor: number;
  target_date: ISODate | null;
  monthly_contribution_minor: number;
  is_archived: boolean;
}

export interface SavingsContribution {
  id: string;
  goal_id: string;
  amount_minor: number;
  contributed_on: ISODate;
  created_by: string | null;
  note: string | null;
  created_at: string;
}

export interface ActivityLog {
  id: number;
  household_id: string;
  actor_id: string | null;
  action: "created" | "updated" | "deleted" | "shared" | "paid" | "contributed" | "joined";
  entity_type: string;
  entity_id: string | null;
  title: string | null;
  amount_minor: number | null;
  created_at: string;
}

export type NotificationKind =
  | "shared_expense" | "bill_due" | "bill_overdue" | "budget_warning" | "budget_exceeded"
  | "installment_due" | "goal_behind" | "member_joined";

export interface AppNotification {
  id: string;
  user_id: string;
  household_id: string | null;
  kind: NotificationKind;
  title: string;
  body: string | null;
  link: string | null;
  amount_minor: number | null;
  actor_id: string | null;
  entity_id: string | null;
  dedupe_key: string | null;
  read_at: string | null;
  created_at: string;
}

export interface PersonalNote {
  id: string;
  owner_id: string;
  title: string;
  body: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}
