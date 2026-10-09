-- =====================================================================
-- OurNest Finance — financial data model
-- Every visibility-aware table carries (household_id, owner_id, visibility).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Financial accounts (labels for where money moves; no balances are
-- inferred so nothing is ever fabricated).
-- ---------------------------------------------------------------------
create table public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  visibility public.record_visibility not null default 'private',
  name text not null check (char_length(name) between 1 and 60),
  kind public.account_kind not null default 'bank',
  institution text check (char_length(institution) <= 60),
  last4 text check (last4 ~ '^[0-9]{4}$'),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index financial_accounts_household_idx on public.financial_accounts (household_id, visibility);
create index financial_accounts_owner_idx on public.financial_accounts (owner_id);

-- ---------------------------------------------------------------------
-- Categories (shared household categories + private custom ones)
-- ---------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  visibility public.record_visibility not null default 'shared',
  parent_id uuid references public.categories (id) on delete restrict,
  name text not null check (char_length(name) between 1 and 40),
  icon text not null default 'tag' check (char_length(icon) <= 30),
  color text not null default 'emerald' check (char_length(color) <= 20),
  -- Stable semantic key used by transparent insight rules (e.g. 'dining').
  system_key text check (system_key ~ '^[a-z_]{2,30}$'),
  sort_order integer not null default 100,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_no_self_parent check (parent_id is null or parent_id <> id)
);
create index categories_household_idx on public.categories (household_id, visibility, is_archived);
create unique index categories_unique_name on public.categories
  (household_id, visibility, (case when visibility = 'private' then owner_id end), parent_id, name)
  nulls not distinct;

-- ---------------------------------------------------------------------
-- Default budget template (data, not logic). Copied into each new
-- household where it becomes fully editable household data.
-- ---------------------------------------------------------------------
create table public.default_budget_template (
  system_key text primary key,
  name text not null,
  icon text not null,
  color text not null,
  planned_minor bigint not null check (planned_minor >= 0),
  sort_order integer not null
);

create table public.default_budget_settings (
  id boolean primary key default true check (id),
  total_allocation_minor bigint not null check (total_allocation_minor >= 0)
);

-- ---------------------------------------------------------------------
-- Monthly household budgets (always shared — it's an allocation,
-- never a representation of anyone's income).
-- ---------------------------------------------------------------------
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  total_allocation_minor bigint not null default 0 check (total_allocation_minor >= 0),
  note text check (char_length(note) <= 300),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budgets_one_per_month unique (household_id, month)
);

create table public.budget_items (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.budgets (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  planned_minor bigint not null default 0 check (planned_minor >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budget_items_unique_category unique (budget_id, category_id)
);
create index budget_items_household_idx on public.budget_items (household_id);

-- ---------------------------------------------------------------------
-- Household contributions: what each spouse chooses to put into the
-- household pot. Independent from (and never derived from) income.
-- ---------------------------------------------------------------------
create table public.household_contributions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  effective_month date not null check (extract(day from effective_month) = 1),
  monthly_amount_minor bigint not null check (monthly_amount_minor >= 0),
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint household_contributions_unique unique (household_id, user_id, effective_month)
);

-- ---------------------------------------------------------------------
-- Private income — has no visibility column on purpose: it can never be
-- shared through the data model.
-- ---------------------------------------------------------------------
create table public.income_sources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  name text not null check (char_length(name) between 1 and 60),
  kind public.income_kind not null default 'salary',
  frequency public.income_frequency not null default 'monthly',
  amount_minor bigint not null check (amount_minor > 0),
  -- Monthly: first month it applies. One-time: the date it was received.
  starts_on date not null,
  ends_on date,
  account_id uuid references public.financial_accounts (id) on delete set null,
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint income_dates check (ends_on is null or ends_on >= starts_on)
);
create index income_sources_owner_idx on public.income_sources (owner_id, starts_on);

-- ---------------------------------------------------------------------
-- Recurring bills
-- ---------------------------------------------------------------------
create table public.recurring_bills (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  visibility public.record_visibility not null default 'shared',
  name text not null check (char_length(name) between 1 and 60),
  kind public.bill_kind not null default 'other',
  category_id uuid references public.categories (id) on delete set null,
  amount_minor bigint not null check (amount_minor > 0),
  is_variable boolean not null default false,
  frequency public.bill_frequency not null default 'monthly',
  interval_count integer not null default 1 check (interval_count between 1 and 12),
  -- First due date. Later due dates are computed from this anchor.
  anchor_date date not null,
  end_date date,
  reminder_days integer not null default 3 check (reminder_days between 0 and 14),
  autopay boolean not null default false,
  is_active boolean not null default true,
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bill_dates check (end_date is null or end_date >= anchor_date)
);
create index recurring_bills_household_idx on public.recurring_bills (household_id, visibility, is_active);

-- ---------------------------------------------------------------------
-- Installment plans & payments
-- ---------------------------------------------------------------------
create table public.installment_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  visibility public.record_visibility not null default 'shared',
  name text not null check (char_length(name) between 1 and 60),
  lender text check (char_length(lender) <= 60),
  category_id uuid references public.categories (id) on delete set null,
  -- Total amount payable over the plan (including any fees/interest).
  total_amount_minor bigint not null check (total_amount_minor > 0),
  monthly_amount_minor bigint not null check (monthly_amount_minor > 0),
  -- Amount already paid before tracking started in the app.
  opening_paid_minor bigint not null default 0 check (opening_paid_minor >= 0),
  first_due_date date not null,
  is_active boolean not null default true,
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint installment_amounts check (monthly_amount_minor <= total_amount_minor and opening_paid_minor <= total_amount_minor)
);
create index installment_plans_household_idx on public.installment_plans (household_id, visibility, is_active);

-- ---------------------------------------------------------------------
-- Transactions (expenses)
-- ---------------------------------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  visibility public.record_visibility not null default 'shared',
  amount_minor bigint not null check (amount_minor > 0 and amount_minor <= 100000000000),
  category_id uuid not null references public.categories (id) on delete restrict,
  account_id uuid references public.financial_accounts (id) on delete set null,
  payment_method public.payment_method,
  description text check (char_length(description) <= 200),
  occurred_on date not null,
  -- Paying a scheduled bill links the transaction to that occurrence; the
  -- unique index below makes double-counting a bill period impossible.
  bill_id uuid references public.recurring_bills (id) on delete set null,
  bill_period date,
  installment_plan_id uuid references public.installment_plans (id) on delete set null,
  -- Idempotency key generated when the entry sheet opens (double-tap safe).
  client_request_id uuid not null default gen_random_uuid(),
  last_edited_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactions_client_request_unique unique (client_request_id),
  constraint transactions_bill_period_pair check (bill_id is null or bill_period is not null)
);
create index transactions_household_date_idx on public.transactions (household_id, visibility, occurred_on desc);
create index transactions_owner_date_idx on public.transactions (owner_id, occurred_on desc);
create index transactions_category_idx on public.transactions (category_id);
create unique index transactions_one_payment_per_bill_period
  on public.transactions (bill_id, bill_period) where bill_id is not null;

create table public.installment_payments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.installment_plans (id) on delete cascade,
  amount_minor bigint not null check (amount_minor > 0),
  paid_on date not null,
  -- Scheduled due date this payment settles (null for an extra payment).
  period date,
  is_extra boolean not null default false,
  transaction_id uuid references public.transactions (id) on delete cascade,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  constraint installment_payment_period check (is_extra or period is not null)
);
create unique index installment_payments_one_per_period
  on public.installment_payments (plan_id, period) where period is not null;
create index installment_payments_plan_idx on public.installment_payments (plan_id, paid_on);

-- ---------------------------------------------------------------------
-- Savings goals & contributions
-- ---------------------------------------------------------------------
create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  visibility public.record_visibility not null default 'shared',
  name text not null check (char_length(name) between 1 and 60),
  kind public.goal_kind not null default 'other',
  target_minor bigint not null check (target_minor > 0),
  target_date date,
  monthly_contribution_minor bigint not null default 0 check (monthly_contribution_minor >= 0),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index savings_goals_household_idx on public.savings_goals (household_id, visibility);

create table public.savings_contributions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.savings_goals (id) on delete cascade,
  -- Negative amounts are withdrawals.
  amount_minor bigint not null check (amount_minor <> 0),
  contributed_on date not null,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now()
);
create index savings_contributions_goal_idx on public.savings_contributions (goal_id, contributed_on);

-- ---------------------------------------------------------------------
-- Receipts (files live in the private "receipts" storage bucket)
-- ---------------------------------------------------------------------
create table public.receipt_attachments (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  uploaded_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index receipt_attachments_tx_idx on public.receipt_attachments (transaction_id);

-- ---------------------------------------------------------------------
-- Personal notes (owner only, never shareable)
-- ---------------------------------------------------------------------
create table public.personal_notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  body text not null default '' check (char_length(body) <= 4000),
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index personal_notes_owner_idx on public.personal_notes (owner_id, updated_at desc);

-- ---------------------------------------------------------------------
-- updated_at triggers + ownership guards
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'financial_accounts', 'categories', 'budgets', 'budget_items', 'household_contributions',
    'income_sources', 'recurring_bills', 'installment_plans', 'transactions', 'savings_goals', 'personal_notes'
  ] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()', t || '_touch', t);
  end loop;

  foreach t in array array[
    'financial_accounts', 'categories', 'recurring_bills', 'installment_plans', 'transactions', 'savings_goals'
  ] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.guard_record_ownership()', t || '_guard', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Referential privacy: a shared record may only reference shared
-- categories/accounts in the same household, so the other spouse never
-- receives a pointer to (or a join through) a private record.
-- ---------------------------------------------------------------------
create or replace function public.check_reference_privacy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cat record;
  v_acc record;
  v_parent record;
  v_bill record;
  v_plan record;
begin
  -- (PL/pgSQL does not short-circuit, so column access is nested.)
  if tg_table_name in ('transactions', 'recurring_bills', 'installment_plans') then
    if new.category_id is not null then
      select household_id, owner_id, visibility into v_cat from public.categories where id = new.category_id;
      if not found or v_cat.household_id <> new.household_id then
        raise exception 'category_not_in_household' using errcode = 'P0001';
      end if;
      if v_cat.visibility = 'private' and (new.visibility = 'shared' or v_cat.owner_id <> new.owner_id) then
        raise exception 'shared_record_needs_shared_category' using errcode = 'P0001';
      end if;
    end if;
  end if;

  if tg_table_name = 'transactions' then
    if new.account_id is not null then
      select household_id, owner_id, visibility into v_acc from public.financial_accounts where id = new.account_id;
      if not found or v_acc.household_id <> new.household_id then
        raise exception 'account_not_in_household' using errcode = 'P0001';
      end if;
      if v_acc.visibility = 'private' and (new.visibility = 'shared' or v_acc.owner_id <> new.owner_id) then
        raise exception 'shared_record_needs_shared_account' using errcode = 'P0001';
      end if;
    end if;
    if new.bill_id is not null then
      select household_id, owner_id, visibility into v_bill from public.recurring_bills where id = new.bill_id;
      if not found or v_bill.household_id <> new.household_id
         or (v_bill.visibility = 'private' and (new.visibility = 'shared' or v_bill.owner_id <> new.owner_id)) then
        raise exception 'bill_reference_not_allowed' using errcode = 'P0001';
      end if;
    end if;
    if new.installment_plan_id is not null then
      select household_id, owner_id, visibility into v_plan from public.installment_plans where id = new.installment_plan_id;
      if not found or v_plan.household_id <> new.household_id
         or (v_plan.visibility = 'private' and (new.visibility = 'shared' or v_plan.owner_id <> new.owner_id)) then
        raise exception 'installment_reference_not_allowed' using errcode = 'P0001';
      end if;
    end if;
  end if;

  if tg_table_name = 'categories' then
   if new.parent_id is not null then
    select household_id, owner_id, visibility, parent_id into v_parent from public.categories where id = new.parent_id;
    if not found or v_parent.household_id <> new.household_id or v_parent.parent_id is not null then
      raise exception 'invalid_parent_category' using errcode = 'P0001';
    end if;
    if v_parent.visibility = 'private' and (new.visibility = 'shared' or v_parent.owner_id <> new.owner_id) then
      raise exception 'shared_category_needs_shared_parent' using errcode = 'P0001';
    end if;
   end if;
  end if;

  -- Making a category private while shared records still use it would
  -- leak; block it.
  if tg_table_name = 'categories' and tg_op = 'UPDATE' then
   if old.visibility = 'shared' and new.visibility = 'private' then
    if exists (select 1 from public.transactions where category_id = new.id and visibility = 'shared')
       or exists (select 1 from public.budget_items where category_id = new.id)
       or exists (select 1 from public.categories where parent_id = new.id and visibility = 'shared') then
      raise exception 'category_in_shared_use' using errcode = 'P0001';
    end if;
   end if;
  end if;

  if tg_table_name = 'financial_accounts' and tg_op = 'UPDATE' then
    if old.visibility = 'shared' and new.visibility = 'private' then
      if exists (select 1 from public.transactions where account_id = new.id and visibility = 'shared') then
        raise exception 'account_in_shared_use' using errcode = 'P0001';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger transactions_reference_privacy before insert or update on public.transactions
  for each row execute function public.check_reference_privacy();
create trigger bills_reference_privacy before insert or update on public.recurring_bills
  for each row execute function public.check_reference_privacy();
create trigger plans_reference_privacy before insert or update on public.installment_plans
  for each row execute function public.check_reference_privacy();
create trigger categories_reference_privacy before insert or update on public.categories
  for each row execute function public.check_reference_privacy();
create trigger accounts_reference_privacy before update on public.financial_accounts
  for each row execute function public.check_reference_privacy();

-- Budget items may only point at shared categories of the same household.
create or replace function public.check_budget_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_budget_household uuid;
begin
  select household_id into v_budget_household from public.budgets where id = new.budget_id;
  if v_budget_household is null or v_budget_household <> new.household_id then
    raise exception 'budget_household_mismatch' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.categories c
    where c.id = new.category_id and c.household_id = new.household_id and c.visibility = 'shared'
  ) then
    raise exception 'budget_item_needs_shared_category' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger budget_items_check before insert or update on public.budget_items
  for each row execute function public.check_budget_item();

-- Income account must belong to the same owner.
create or replace function public.check_income_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.account_id is not null and not exists (
    select 1 from public.financial_accounts a where a.id = new.account_id and a.owner_id = new.owner_id
  ) then
    raise exception 'income_account_not_owned' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' then
    if new.owner_id is distinct from old.owner_id then
      raise exception 'owner_immutable' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger income_sources_check before insert or update on public.income_sources
  for each row execute function public.check_income_account();
