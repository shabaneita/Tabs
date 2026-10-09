-- =====================================================================
-- OurNest Finance — RPCs, activity feed, notifications, template seed
-- =====================================================================

-- ---------------------------------------------------------------------
-- Default budget template data (editable reference data; copied into a
-- household on creation, after which the household owns its copy).
-- ---------------------------------------------------------------------
insert into public.default_budget_settings (id, total_allocation_minor) values (true, 1400000);

insert into public.default_budget_template (system_key, name, icon, color, planned_minor, sort_order) values
  ('rent',            'إيجار الشقة',          'home',          'emerald', 550000, 10),
  ('car_rent',        'إيجار السيارة',        'car',           'sky',     180000, 20),
  ('fuel',            'بنزين وسالك ومواقف',   'fuel',          'sand',     50000, 30),
  ('utilities',       'كهرباء ومياه وتكييف',  'zap',           'sand',     65000, 40),
  ('municipality',    'رسوم بلدية السكن',     'landmark',      'sage',     27500, 50),
  ('telecom',         'إنترنت وموبايلات',     'wifi',          'violet',   45000, 60),
  ('groceries',       'أكل وسوبر ماركت',      'shopping-cart', 'emerald', 170000, 70),
  ('dining',          'مطاعم وخروجات',        'utensils',      'rose',     50000, 80),
  ('shared_personal', 'مصاريف شخصية مشتركة',  'sparkles',      'violet',   40000, 90),
  ('installments',    'أقساط والتزامات',      'credit-card',   'sky',     100000, 100),
  ('emergency',       'طوارئ ومصاريف متنوعة', 'shield',        'rose',     40000, 110);

-- ---------------------------------------------------------------------
-- Activity log (shared records only) & notifications
-- ---------------------------------------------------------------------
create table public.activity_logs (
  id bigint generated always as identity primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (action in ('created', 'updated', 'deleted', 'shared', 'paid', 'contributed', 'joined')),
  entity_type text not null,
  entity_id uuid,
  title text,
  amount_minor bigint,
  created_at timestamptz not null default now()
);
create index activity_logs_household_idx on public.activity_logs (household_id, created_at desc);
create index activity_logs_entity_idx on public.activity_logs (entity_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  household_id uuid references public.households (id) on delete cascade,
  kind text not null check (kind in (
    'shared_expense', 'bill_due', 'bill_overdue', 'budget_warning', 'budget_exceeded',
    'installment_due', 'goal_behind', 'member_joined'
  )),
  title text not null check (char_length(title) <= 120),
  body text check (char_length(body) <= 300),
  link text check (link ~ '^/[a-z0-9/_?=&-]*$'),
  amount_minor bigint,
  actor_id uuid references auth.users (id) on delete set null,
  entity_id uuid,
  dedupe_key text check (char_length(dedupe_key) <= 120),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_dedupe unique (user_id, dedupe_key)
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_entity_idx on public.notifications (entity_id);

alter table public.activity_logs enable row level security;
alter table public.notifications enable row level security;

grant select on public.activity_logs to authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant insert (user_id, household_id, kind, title, body, link, amount_minor, entity_id, dedupe_key)
  on public.notifications to authenticated;

create policy activity_select on public.activity_logs for select to authenticated
  using (public.is_household_member(household_id));

create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));
-- A user may only create reminder-type notifications for themselves (the
-- app derives them from data that user can already read).
create policy notifications_insert_self on public.notifications for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and kind in ('bill_due', 'bill_overdue', 'budget_warning', 'budget_exceeded', 'installment_due', 'goal_behind')
    and (household_id is null or public.is_household_member(household_id))
  );

-- Title used in the activity feed for a row of any tracked table.
create or replace function public.activity_title(p_table text, p_row jsonb)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_title text;
begin
  if p_table = 'transactions' then
    v_title := nullif(trim(p_row ->> 'description'), '');
    if v_title is null then
      select c.name into v_title from public.categories c where c.id = (p_row ->> 'category_id')::uuid;
    end if;
  else
    v_title := p_row ->> 'name';
  end if;
  return left(coalesce(v_title, ''), 120);
end;
$$;

-- Logs activity for shared records and notifies the other spouse about
-- new shared expenses. Private records never produce log rows or
-- notifications. When a record becomes private, every earlier trace of
-- it in the feed and in notifications is removed.
create or replace function public.log_shared_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_action text;
  v_member record;
  v_amount bigint;
begin
  if tg_op = 'INSERT' then
    if v_new ->> 'visibility' <> 'shared' then return new; end if;
    v_action := 'created';
  elsif tg_op = 'UPDATE' then
    if v_old ->> 'visibility' = 'shared' and v_new ->> 'visibility' = 'private' then
      delete from public.activity_logs where entity_id = (v_old ->> 'id')::uuid;
      delete from public.notifications where entity_id = (v_old ->> 'id')::uuid;
      return new;
    elsif v_new ->> 'visibility' <> 'shared' then
      return new;
    elsif v_old ->> 'visibility' = 'private' then
      v_action := 'shared';
    else
      -- Ignore no-op updates (only bookkeeping columns changed).
      if (v_new - 'updated_at' - 'last_edited_by') = (v_old - 'updated_at' - 'last_edited_by') then
        return new;
      end if;
      v_action := 'updated';
    end if;
  else
    if v_old ->> 'visibility' <> 'shared' then return old; end if;
    -- Cascading delete of the whole household: nothing left to log into.
    if not exists (select 1 from public.households where id = (v_old ->> 'household_id')::uuid) then
      return old;
    end if;
    v_action := 'deleted';
  end if;

  v_amount := coalesce(
    (v_row ->> 'amount_minor')::bigint,
    (v_row ->> 'target_minor')::bigint,
    (v_row ->> 'monthly_amount_minor')::bigint
  );

  insert into public.activity_logs (household_id, actor_id, action, entity_type, entity_id, title, amount_minor)
  values (
    (v_row ->> 'household_id')::uuid, v_actor, v_action, tg_table_name,
    case when tg_op = 'DELETE' then null else (v_row ->> 'id')::uuid end,
    public.activity_title(tg_table_name, v_row), v_amount
  );

  if tg_table_name = 'transactions' and v_action in ('created', 'shared') then
    for v_member in
      select m.user_id
      from public.household_members m
      join public.user_settings s on s.user_id = m.user_id
      where m.household_id = (v_row ->> 'household_id')::uuid
        and m.user_id is distinct from v_actor
        and s.notify_shared_expenses
    loop
      insert into public.notifications (user_id, household_id, kind, title, body, link, amount_minor, actor_id, entity_id, dedupe_key)
      values (
        v_member.user_id, (v_row ->> 'household_id')::uuid, 'shared_expense',
        'مصروف مشترك جديد', public.activity_title(tg_table_name, v_row), '/expenses',
        v_amount, v_actor, (v_row ->> 'id')::uuid, 'tx:' || (v_row ->> 'id') || ':' || v_action
      )
      on conflict (user_id, dedupe_key) do nothing;
    end loop;
  end if;

  if tg_op = 'DELETE' then
    -- The entity no longer exists: earlier feed rows keep their text, but
    -- notifications pointing at it are pruned.
    delete from public.notifications where entity_id = (v_old ->> 'id')::uuid;
    return old;
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['transactions', 'recurring_bills', 'installment_plans', 'savings_goals'] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.log_shared_activity()',
      t || '_activity', t
    );
  end loop;
end;
$$;

-- Child-row activity (installment payments, savings contributions):
-- logged only when the parent record is shared.
create or replace function public.log_child_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent record;
begin
  if tg_op <> 'INSERT' then return coalesce(new, old); end if;
  if tg_table_name = 'installment_payments' then
    select household_id, visibility, name into v_parent from public.installment_plans where id = new.plan_id;
    if found and v_parent.visibility = 'shared' then
      insert into public.activity_logs (household_id, actor_id, action, entity_type, entity_id, title, amount_minor)
      values (v_parent.household_id, (select auth.uid()), 'paid', 'installment_payments', new.plan_id, v_parent.name, new.amount_minor);
    end if;
  elsif tg_table_name = 'savings_contributions' then
    select household_id, visibility, name into v_parent from public.savings_goals where id = new.goal_id;
    if found and v_parent.visibility = 'shared' then
      insert into public.activity_logs (household_id, actor_id, action, entity_type, entity_id, title, amount_minor)
      values (v_parent.household_id, (select auth.uid()), 'contributed', 'savings_contributions', new.goal_id, v_parent.name, new.amount_minor);
    end if;
  end if;
  return new;
end;
$$;

create trigger installment_payments_activity after insert on public.installment_payments
  for each row execute function public.log_child_activity();
create trigger savings_contributions_activity after insert on public.savings_contributions
  for each row execute function public.log_child_activity();

-- Deleting an installment payment removes the expense it created, so the
-- budget never keeps a phantom payment (and vice versa via FK cascade).
create or replace function public.delete_payment_transaction()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.transaction_id is not null then
    delete from public.transactions where id = old.transaction_id;
  end if;
  return old;
end;
$$;

create trigger installment_payments_cleanup after delete on public.installment_payments
  for each row execute function public.delete_payment_transaction();

-- ---------------------------------------------------------------------
-- Seed a new household's categories + first month budget from template
-- ---------------------------------------------------------------------
create or replace function public.seed_household_defaults(p_household_id uuid, p_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_budget_id uuid;
  v_month date := date_trunc('month', (now() at time zone 'Asia/Dubai'))::date;
begin
  insert into public.categories (household_id, owner_id, visibility, name, icon, color, system_key, sort_order)
  select p_household_id, p_owner_id, 'shared', t.name, t.icon, t.color, t.system_key, t.sort_order
  from public.default_budget_template t;

  insert into public.budgets (household_id, month, total_allocation_minor, created_by)
  values (p_household_id, v_month, (select total_allocation_minor from public.default_budget_settings), p_owner_id)
  returning id into v_budget_id;

  insert into public.budget_items (budget_id, household_id, category_id, planned_minor)
  select v_budget_id, p_household_id, c.id, t.planned_minor
  from public.categories c
  join public.default_budget_template t on t.system_key = c.system_key
  where c.household_id = p_household_id;
end;
$$;

-- ---------------------------------------------------------------------
-- create_household(): caller becomes the first member
-- ---------------------------------------------------------------------
create or replace function public.create_household(p_name text default 'بيتنا')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_household_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.household_members where user_id = v_uid) then
    raise exception 'already_in_household' using errcode = 'P0001';
  end if;

  insert into public.households (name, created_by)
  values (coalesce(nullif(trim(p_name), ''), 'بيتنا'), v_uid)
  returning id into v_household_id;

  insert into public.household_members (household_id, user_id, joined_via)
  values (v_household_id, v_uid, 'created');

  perform public.seed_household_defaults(v_household_id, v_uid);
  return v_household_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Invitations
-- ---------------------------------------------------------------------
create or replace function public.create_invitation(p_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_household_id uuid;
  v_email text := lower(trim(p_email));
  v_token text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  v_household_id := public.my_household_id();
  if v_household_id is null then
    raise exception 'no_household' using errcode = 'P0001';
  end if;
  if (select count(*) from public.household_members where household_id = v_household_id) >= 2 then
    raise exception 'household_full' using errcode = 'P0001';
  end if;
  if v_email is null or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid_email' using errcode = 'P0001';
  end if;
  if v_email = (select lower(email) from auth.users where id = v_uid) then
    raise exception 'cannot_invite_self' using errcode = 'P0001';
  end if;

  update public.invitations set status = 'revoked'
  where household_id = v_household_id and status = 'pending';

  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.invitations (household_id, email, token_hash, invited_by)
  values (v_household_id, v_email, encode(extensions.digest(v_token, 'sha256'), 'hex'), v_uid);

  return v_token;
end;
$$;

create or replace function public.revoke_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.invitations
  set status = 'revoked'
  where id = p_invitation_id
    and status = 'pending'
    and public.is_household_member(household_id);
  if not found then
    raise exception 'invitation_not_found' using errcode = 'P0001';
  end if;
end;
$$;

-- Minimal, non-sensitive preview for the invitation landing page.
create or replace function public.get_invitation(p_token text)
returns table (household_name text, inviter_name text, email_hint text, status text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_inv public.invitations%rowtype;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{48}$' then
    return;
  end if;
  select * into v_inv from public.invitations
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
  if not found then
    return;
  end if;

  return query
  select
    h.name,
    coalesce(p.display_name, ''),
    left(split_part(v_inv.email, '@', 1), 2) || '•••@' || split_part(v_inv.email, '@', 2),
    case
      when v_inv.status = 'pending' and v_inv.expires_at < now() then 'expired'
      else v_inv.status::text
    end
  from public.households h
  left join public.profiles p on p.id = v_inv.invited_by
  where h.id = v_inv.household_id;
end;
$$;

create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text;
  v_inv public.invitations%rowtype;
  v_existing uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if p_token is null or p_token !~ '^[0-9a-f]{48}$' then
    raise exception 'invitation_not_found' using errcode = 'P0001';
  end if;

  select lower(email) into v_email from auth.users where id = v_uid;

  select * into v_inv from public.invitations
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  for update;

  if not found then
    raise exception 'invitation_not_found' using errcode = 'P0001';
  end if;

  select household_id into v_existing from public.household_members where user_id = v_uid;
  if v_existing = v_inv.household_id then
    return v_existing; -- already joined (idempotent)
  end if;

  if v_inv.status <> 'pending' then
    raise exception 'invitation_not_pending' using errcode = 'P0001';
  end if;
  if v_inv.expires_at < now() then
    raise exception 'invitation_expired' using errcode = 'P0001';
  end if;
  if v_inv.email <> v_email then
    raise exception 'invitation_email_mismatch' using errcode = 'P0001';
  end if;

  if v_existing is not null then
    -- A solo household with no financial records can be discarded so the
    -- spouse can join. Anything with data must be handled explicitly.
    if (select count(*) from public.household_members where household_id = v_existing) = 1
       and not exists (select 1 from public.transactions where household_id = v_existing)
       and not exists (select 1 from public.recurring_bills where household_id = v_existing)
       and not exists (select 1 from public.installment_plans where household_id = v_existing)
       and not exists (select 1 from public.savings_goals where household_id = v_existing)
       and not exists (select 1 from public.financial_accounts where household_id = v_existing)
       and not exists (select 1 from public.income_sources where owner_id = v_uid)
    then
      delete from public.households where id = v_existing;
    else
      raise exception 'already_in_household' using errcode = 'P0001';
    end if;
  end if;

  insert into public.household_members (household_id, user_id, joined_via)
  values (v_inv.household_id, v_uid, 'invitation');

  update public.invitations
  set status = 'accepted', accepted_by = v_uid, accepted_at = now()
  where id = v_inv.id;

  insert into public.activity_logs (household_id, actor_id, action, entity_type, entity_id, title)
  values (v_inv.household_id, v_uid, 'joined', 'household_members', v_uid,
          (select display_name from public.profiles where id = v_uid));

  insert into public.notifications (user_id, household_id, kind, title, body, link, actor_id, dedupe_key)
  values (v_inv.invited_by, v_inv.household_id, 'member_joined', 'انضم شريكك إلى البيت',
          (select display_name from public.profiles where id = v_uid), '/more/household', v_uid,
          'joined:' || v_uid::text)
  on conflict (user_id, dedupe_key) do nothing;

  return v_inv.household_id;
end;
$$;

-- ---------------------------------------------------------------------
-- ensure_month_budget(): returns the budget for a month, creating it by
-- copying the most recent budget (or the template) when missing.
-- Runs as the caller, so RLS still applies.
-- ---------------------------------------------------------------------
create or replace function public.ensure_month_budget(p_month date)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_household_id uuid := public.my_household_id();
  v_month date := date_trunc('month', p_month)::date;
  v_budget_id uuid;
  v_source record;
begin
  if v_household_id is null then
    raise exception 'no_household' using errcode = 'P0001';
  end if;

  select id into v_budget_id from public.budgets where household_id = v_household_id and month = v_month;
  if found then
    return v_budget_id;
  end if;

  select id, total_allocation_minor into v_source
  from public.budgets
  where household_id = v_household_id
  order by (month < v_month) desc, abs(month - v_month)
  limit 1;

  insert into public.budgets (household_id, month, total_allocation_minor)
  values (
    v_household_id, v_month,
    coalesce(v_source.total_allocation_minor, (select total_allocation_minor from public.default_budget_settings), 0)
  )
  on conflict (household_id, month) do nothing
  returning id into v_budget_id;

  if v_budget_id is null then
    select id into v_budget_id from public.budgets where household_id = v_household_id and month = v_month;
    return v_budget_id;
  end if;

  if v_source.id is not null then
    insert into public.budget_items (budget_id, household_id, category_id, planned_minor)
    select v_budget_id, v_household_id, bi.category_id, bi.planned_minor
    from public.budget_items bi
    join public.categories c on c.id = bi.category_id and not c.is_archived
    where bi.budget_id = v_source.id;
  end if;

  return v_budget_id;
end;
$$;

-- ---------------------------------------------------------------------
-- record_installment_payment(): payment + matching expense, atomically.
-- Runs as the caller (RLS applies).
-- ---------------------------------------------------------------------
create or replace function public.record_installment_payment(
  p_plan_id uuid,
  p_amount_minor bigint,
  p_paid_on date,
  p_period date default null,
  p_create_transaction boolean default true,
  p_payment_method public.payment_method default null,
  p_account_id uuid default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_plan public.installment_plans%rowtype;
  v_paid bigint;
  v_outstanding bigint;
  v_tx_id uuid;
  v_payment_id uuid;
begin
  select * into v_plan from public.installment_plans where id = p_plan_id;
  if not found then
    raise exception 'plan_not_found' using errcode = 'P0001';
  end if;
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;

  select coalesce(sum(amount_minor), 0) into v_paid from public.installment_payments where plan_id = p_plan_id;
  v_outstanding := v_plan.total_amount_minor - v_plan.opening_paid_minor - v_paid;
  if p_amount_minor > v_outstanding then
    raise exception 'amount_exceeds_outstanding' using errcode = 'P0001';
  end if;

  if p_create_transaction then
    if v_plan.category_id is null then
      raise exception 'plan_has_no_category' using errcode = 'P0001';
    end if;
    insert into public.transactions (
      household_id, owner_id, visibility, amount_minor, category_id, account_id,
      payment_method, description, occurred_on, installment_plan_id
    ) values (
      v_plan.household_id, (select auth.uid()), v_plan.visibility, p_amount_minor, v_plan.category_id, p_account_id,
      p_payment_method, left('قسط: ' || v_plan.name, 200), p_paid_on, v_plan.id
    ) returning id into v_tx_id;
  end if;

  insert into public.installment_payments (plan_id, amount_minor, paid_on, period, is_extra, transaction_id)
  values (p_plan_id, p_amount_minor, p_paid_on, p_period, p_period is null, v_tx_id)
  returning id into v_payment_id;

  return v_payment_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Grants for RPCs
-- ---------------------------------------------------------------------
revoke all on function
  public.activity_title(text, jsonb), public.log_shared_activity(), public.log_child_activity(),
  public.delete_payment_transaction(), public.seed_household_defaults(uuid, uuid),
  public.create_household(text), public.create_invitation(text), public.revoke_invitation(uuid),
  public.get_invitation(text), public.accept_invitation(text), public.ensure_month_budget(date),
  public.record_installment_payment(uuid, bigint, date, date, boolean, public.payment_method, uuid)
from public, anon, authenticated;

grant execute on function
  public.create_household(text), public.create_invitation(text), public.revoke_invitation(uuid),
  public.accept_invitation(text), public.ensure_month_budget(date),
  public.record_installment_payment(uuid, bigint, date, date, boolean, public.payment_method, uuid)
to authenticated;

grant execute on function public.get_invitation(text) to anon, authenticated;
