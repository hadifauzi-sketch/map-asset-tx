-- When a non-admin user creates a transformer from the pilot UI, grant
-- that same user access to the new transformer so it remains visible.

create or replace function public.grant_self_transformer_access(
  p_user_id uuid, p_transformer_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_asset_permissions (user_id, transformer_id)
  values (p_user_id, p_transformer_id)
  on conflict do nothing;
end;
$$;

revoke all on function public.grant_self_transformer_access(uuid, uuid) from public;
grant execute on function public.grant_self_transformer_access(uuid, uuid) to anon, authenticated;
