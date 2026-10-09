-- =====================================================================
-- OurNest Finance (بيتنا) — Self-heal missing profile/settings rows.
--
-- Complements 20261009000600_backfill_profiles.sql: if an account still
-- has no profiles / user_settings row at login, the app calls this RPC
-- instead of failing with "تعذّر تحميل البيانات". Idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Self-heal on login: creates the caller's missing rows, if any.
-- The app calls this when either row is absent.
-- ---------------------------------------------------------------------
create or replace function public.ensure_my_profile()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  insert into public.profiles (id, display_name)
  select
    u.id,
    left(coalesce(nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''), split_part(u.email, '@', 1), ''), 60)
  from auth.users u
  where u.id = v_uid
  on conflict (id) do nothing;

  insert into public.user_settings (user_id) values (v_uid)
  on conflict (user_id) do nothing;
end;
$$;

revoke all on function public.ensure_my_profile() from public, anon;
grant execute on function public.ensure_my_profile() to authenticated;
