-- =====================================================================
-- OurNest Finance — private receipt storage
-- Object path: {household_id}/{transaction_id}/{random}.{ext}
-- Reading a file requires a receipt_attachments row the caller can see
-- (which in turn requires access to the transaction under RLS).
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts', 'receipts', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
)
on conflict (id) do update set public = false;

create or replace function public.receipt_path_writable(p_name text)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  v_household_id uuid;
  v_transaction_id uuid;
begin
  begin
    v_household_id := split_part(p_name, '/', 1)::uuid;
    v_transaction_id := split_part(p_name, '/', 2)::uuid;
  exception when others then
    return false;
  end;
  if split_part(p_name, '/', 3) = '' or split_part(p_name, '/', 4) <> '' then
    return false;
  end if;
  return exists (
    select 1 from public.transactions t
    where t.id = v_transaction_id
      and t.household_id = v_household_id
      and public.can_write_record(t.household_id, t.owner_id, t.visibility)
  );
end;
$$;

revoke all on function public.receipt_path_writable(text) from public, anon;
grant execute on function public.receipt_path_writable(text) to authenticated;

create policy "receipts_read_visible" on storage.objects for select to authenticated
  using (
    bucket_id = 'receipts'
    and exists (select 1 from public.receipt_attachments r where r.storage_path = objects.name)
  );

create policy "receipts_upload_writable" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and public.receipt_path_writable(name));

create policy "receipts_delete_writable" on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and public.receipt_path_writable(name));
