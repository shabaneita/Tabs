-- =====================================================================
-- OurNest Finance (بيتنا) — Foundation: extensions, enums, profiles,
-- households, membership, invitations and core helper functions.
--
-- Money is stored as BIGINT minor units (fils, 1 AED = 100 fils).
-- Calendar dates are stored as DATE values in Dubai local time.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type public.record_visibility as enum ('shared', 'private');
create type public.payment_method as enum ('cash', 'debit_card', 'credit_card', 'bank_transfer', 'apple_pay', 'other');
create type public.account_kind as enum ('bank', 'credit_card', 'cash', 'wallet', 'savings', 'other');
create type public.income_kind as enum ('salary', 'freelance', 'bonus', 'other');
create type public.income_frequency as enum ('monthly', 'one_time');
create type public.bill_frequency as enum ('weekly', 'monthly', 'quarterly', 'yearly');
create type public.bill_kind as enum ('rent', 'car', 'utilities', 'internet', 'mobile', 'insurance', 'subscription', 'installment', 'other');
create type public.invitation_status as enum ('pending', 'accepted', 'revoked');
create type public.goal_kind as enum ('emergency', 'home', 'travel', 'car', 'apartment', 'vacation', 'other');

-- ---------------------------------------------------------------------
-- Generic trigger: keep updated_at fresh
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Profiles: the minimal identity a spouse may see about the other.
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  avatar_color text not null default 'emerald'
    check (avatar_color in ('emerald', 'sage', 'sand', 'rose', 'sky', 'violet')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- User settings: strictly private to the owner (theme, numerals,
-- notification preferences).
-- ---------------------------------------------------------------------
create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  numerals text not null default 'latn' check (numerals in ('latn', 'arab')),
  default_visibility public.record_visibility not null default 'shared',
  notify_shared_expenses boolean not null default true,
  notify_bills boolean not null default true,
  notify_budget boolean not null default true,
  bill_reminder_days integer not null default 3 check (bill_reminder_days between 0 and 14),
  updated_at timestamptz not null default now()
);

create trigger user_settings_touch before update on public.user_settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Households & membership (max two members: a married couple)
-- ---------------------------------------------------------------------
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'بيتنا' check (char_length(name) between 1 and 60),
  currency text not null default 'AED' check (currency = 'AED'),
  timezone text not null default 'Asia/Dubai',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger households_touch before update on public.households
  for each row execute function public.touch_updated_at();

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Informational only. Both members have identical permissions.
  joined_via text not null default 'created' check (joined_via in ('created', 'invitation')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id),
  -- One household per user keeps the privacy model unambiguous.
  constraint household_members_one_household unique (user_id)
);

create index household_members_household_idx on public.household_members (household_id);

create or replace function public.enforce_household_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Serialise concurrent joins on the same household.
  perform 1 from public.households where id = new.household_id for update;
  if (select count(*) from public.household_members where household_id = new.household_id) >= 2 then
    raise exception 'household_full' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger household_members_capacity before insert on public.household_members
  for each row execute function public.enforce_household_capacity();

-- ---------------------------------------------------------------------
-- Invitations. Only a SHA-256 hash of the token is stored.
-- ---------------------------------------------------------------------
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  email text not null check (email = lower(email) and position('@' in email) > 1),
  token_hash text not null unique,
  invited_by uuid not null references auth.users (id) on delete cascade,
  status public.invitation_status not null default 'pending',
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index invitations_household_idx on public.invitations (household_id, status);

-- ---------------------------------------------------------------------
-- Helper predicates used by RLS policies. SECURITY DEFINER avoids
-- recursive policy evaluation on household_members.
-- ---------------------------------------------------------------------
create or replace function public.is_household_member(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = p_household_id
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.my_household_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.household_id from public.household_members m
  where m.user_id = (select auth.uid())
  limit 1;
$$;

create or replace function public.shares_household_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members a
    join public.household_members b on b.household_id = a.household_id
    where a.user_id = (select auth.uid())
      and b.user_id = p_user_id
  );
$$;

-- Read rule shared by every visibility-aware table:
--   shared records  -> any member of the record's household
--   private records -> the owner only
create or replace function public.can_read_record(
  p_household_id uuid,
  p_owner_id uuid,
  p_visibility public.record_visibility
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select
    (p_visibility = 'private' and p_owner_id = (select auth.uid()))
    or (p_visibility = 'shared' and public.is_household_member(p_household_id));
$$;

-- Write rule: identical to read, but the caller must still belong to the
-- household (a member who left cannot keep editing shared data).
create or replace function public.can_write_record(
  p_household_id uuid,
  p_owner_id uuid,
  p_visibility public.record_visibility
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.is_household_member(p_household_id)
    and (p_visibility = 'shared' or p_owner_id = (select auth.uid()));
$$;

-- Ownership columns are immutable after creation, and only the owner may
-- change who can see a record. This stops a spouse from "claiming" or
-- hiding the other spouse's shared records.
create or replace function public.guard_record_ownership()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'owner_immutable' using errcode = 'P0001';
  end if;
  if new.household_id is distinct from old.household_id then
    raise exception 'household_immutable' using errcode = 'P0001';
  end if;
  if new.visibility is distinct from old.visibility
     and old.owner_id is distinct from (select auth.uid())
     and (select auth.uid()) is not null then
    raise exception 'only_owner_can_change_visibility' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- New auth user -> profile + settings rows
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1), ''), 60)
  )
  on conflict (id) do nothing;

  insert into public.user_settings (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
