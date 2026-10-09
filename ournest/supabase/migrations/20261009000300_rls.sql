-- =====================================================================
-- OurNest Finance — Row Level Security
-- The database is the security boundary. The UI never is.
-- =====================================================================

-- Lock everything down first, then grant only what the app needs.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke execute on functions from public, anon;

grant usage on schema public to authenticated, anon;

grant select, insert, update, delete on
  public.financial_accounts, public.categories, public.budgets, public.budget_items,
  public.household_contributions, public.income_sources, public.recurring_bills,
  public.installment_plans, public.installment_payments, public.transactions,
  public.savings_goals, public.savings_contributions, public.receipt_attachments,
  public.personal_notes
to authenticated;

grant select, update on public.profiles, public.user_settings to authenticated;
grant select, update on public.households to authenticated;
grant select on public.household_members, public.invitations to authenticated;
grant select on public.default_budget_template, public.default_budget_settings to authenticated;

-- Helper predicates are needed inside policies.
grant execute on function
  public.is_household_member(uuid), public.my_household_id(), public.shares_household_with(uuid),
  public.can_read_record(uuid, uuid, public.record_visibility),
  public.can_write_record(uuid, uuid, public.record_visibility)
to authenticated;

-- Enable RLS on every table.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'user_settings', 'households', 'household_members', 'invitations',
    'financial_accounts', 'categories', 'default_budget_template', 'default_budget_settings',
    'budgets', 'budget_items', 'household_contributions', 'income_sources', 'recurring_bills',
    'installment_plans', 'installment_payments', 'transactions', 'savings_goals',
    'savings_contributions', 'receipt_attachments', 'personal_notes'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Profiles: yourself + your spouse (display name & avatar colour only)
-- ---------------------------------------------------------------------
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_household_with(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- User settings: owner only
create policy user_settings_select on public.user_settings for select to authenticated
  using (user_id = (select auth.uid()));
create policy user_settings_update on public.user_settings for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Households: members only. Creation goes through create_household().
create policy households_select on public.households for select to authenticated
  using (public.is_household_member(id));
create policy households_update on public.households for update to authenticated
  using (public.is_household_member(id)) with check (public.is_household_member(id));

create policy household_members_select on public.household_members for select to authenticated
  using (public.is_household_member(household_id));

-- Invitations: visible to household members (token hash is never
-- selected by the app; the column is revoked below).
create policy invitations_select on public.invitations for select to authenticated
  using (public.is_household_member(household_id));
revoke select on public.invitations from authenticated;
grant select (id, household_id, email, invited_by, status, expires_at, accepted_by, accepted_at, created_at)
  on public.invitations to authenticated;

-- Template: readable reference data
create policy template_select on public.default_budget_template for select to authenticated using (true);
create policy template_settings_select on public.default_budget_settings for select to authenticated using (true);

-- ---------------------------------------------------------------------
-- Visibility-aware tables
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'financial_accounts', 'categories', 'recurring_bills', 'installment_plans', 'transactions', 'savings_goals'
  ] loop
    execute format($f$
      create policy %1$s_select on public.%1$I for select to authenticated
        using (public.can_read_record(household_id, owner_id, visibility))
    $f$, t);
    execute format($f$
      create policy %1$s_insert on public.%1$I for insert to authenticated
        with check (owner_id = (select auth.uid()) and public.is_household_member(household_id))
    $f$, t);
    execute format($f$
      create policy %1$s_update on public.%1$I for update to authenticated
        using (public.can_write_record(household_id, owner_id, visibility))
        with check (public.can_write_record(household_id, owner_id, visibility))
    $f$, t);
    execute format($f$
      create policy %1$s_delete on public.%1$I for delete to authenticated
        using (public.can_write_record(household_id, owner_id, visibility))
    $f$, t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Budgets (shared allocation — both spouses have equal rights)
-- ---------------------------------------------------------------------
create policy budgets_select on public.budgets for select to authenticated
  using (public.is_household_member(household_id));
create policy budgets_insert on public.budgets for insert to authenticated
  with check (public.is_household_member(household_id));
create policy budgets_update on public.budgets for update to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy budgets_delete on public.budgets for delete to authenticated
  using (public.is_household_member(household_id));

create policy budget_items_select on public.budget_items for select to authenticated
  using (public.is_household_member(household_id));
create policy budget_items_insert on public.budget_items for insert to authenticated
  with check (public.is_household_member(household_id));
create policy budget_items_update on public.budget_items for update to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy budget_items_delete on public.budget_items for delete to authenticated
  using (public.is_household_member(household_id));

-- ---------------------------------------------------------------------
-- Contributions: both can see; each spouse manages only their own.
-- ---------------------------------------------------------------------
create policy contributions_select on public.household_contributions for select to authenticated
  using (public.is_household_member(household_id));
create policy contributions_insert on public.household_contributions for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_household_member(household_id));
create policy contributions_update on public.household_contributions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.is_household_member(household_id));
create policy contributions_delete on public.household_contributions for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- Owner-only tables: income & personal notes
-- ---------------------------------------------------------------------
create policy income_select on public.income_sources for select to authenticated
  using (owner_id = (select auth.uid()));
create policy income_insert on public.income_sources for insert to authenticated
  with check (owner_id = (select auth.uid()) and (household_id is null or public.is_household_member(household_id)));
create policy income_update on public.income_sources for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy income_delete on public.income_sources for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy notes_select on public.personal_notes for select to authenticated
  using (owner_id = (select auth.uid()));
create policy notes_insert on public.personal_notes for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy notes_update on public.personal_notes for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy notes_delete on public.personal_notes for delete to authenticated
  using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- Child tables inherit access from their parent. Sub-selects inside a
-- policy are themselves subject to the parent's RLS.
-- ---------------------------------------------------------------------
create policy installment_payments_select on public.installment_payments for select to authenticated
  using (exists (select 1 from public.installment_plans p where p.id = plan_id));
create policy installment_payments_insert on public.installment_payments for insert to authenticated
  with check (exists (
    select 1 from public.installment_plans p
    where p.id = plan_id and public.can_write_record(p.household_id, p.owner_id, p.visibility)
  ));
create policy installment_payments_update on public.installment_payments for update to authenticated
  using (exists (
    select 1 from public.installment_plans p
    where p.id = plan_id and public.can_write_record(p.household_id, p.owner_id, p.visibility)
  ))
  with check (exists (
    select 1 from public.installment_plans p
    where p.id = plan_id and public.can_write_record(p.household_id, p.owner_id, p.visibility)
  ));
create policy installment_payments_delete on public.installment_payments for delete to authenticated
  using (exists (
    select 1 from public.installment_plans p
    where p.id = plan_id and public.can_write_record(p.household_id, p.owner_id, p.visibility)
  ));

create policy savings_contributions_select on public.savings_contributions for select to authenticated
  using (exists (select 1 from public.savings_goals g where g.id = goal_id));
create policy savings_contributions_insert on public.savings_contributions for insert to authenticated
  with check (exists (
    select 1 from public.savings_goals g
    where g.id = goal_id and public.can_write_record(g.household_id, g.owner_id, g.visibility)
  ));
create policy savings_contributions_update on public.savings_contributions for update to authenticated
  using (exists (
    select 1 from public.savings_goals g
    where g.id = goal_id and public.can_write_record(g.household_id, g.owner_id, g.visibility)
  ))
  with check (exists (
    select 1 from public.savings_goals g
    where g.id = goal_id and public.can_write_record(g.household_id, g.owner_id, g.visibility)
  ));
create policy savings_contributions_delete on public.savings_contributions for delete to authenticated
  using (exists (
    select 1 from public.savings_goals g
    where g.id = goal_id and public.can_write_record(g.household_id, g.owner_id, g.visibility)
  ));

create policy receipts_select on public.receipt_attachments for select to authenticated
  using (exists (select 1 from public.transactions t where t.id = transaction_id));
create policy receipts_insert on public.receipt_attachments for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and exists (
      select 1 from public.transactions t
      where t.id = transaction_id
        and public.can_write_record(t.household_id, t.owner_id, t.visibility)
        and storage_path like t.household_id::text || '/' || t.id::text || '/%'
    )
  );
create policy receipts_delete on public.receipt_attachments for delete to authenticated
  using (exists (
    select 1 from public.transactions t
    where t.id = transaction_id and public.can_write_record(t.household_id, t.owner_id, t.visibility)
  ));
