-- =====================================================================
-- Backfill profile + settings rows for accounts created before the
-- schema existed (e.g. signing up right after deployment, before
-- setup.sql was run). Idempotent: safe to run any number of times.
-- =====================================================================
insert into public.profiles (id, display_name)
select u.id,
       left(coalesce(nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''), split_part(u.email, '@', 1), ''), 60)
from auth.users u
on conflict (id) do nothing;

insert into public.user_settings (user_id)
select u.id from auth.users u
on conflict (user_id) do nothing;
