-- ============================================================
--  EMERGENCY ROLLBACK — restore the legacy login + data access
-- ============================================================
--  Use when 20261121000003_supabase_auth_lockdown was applied before the
--  client was switched over to Supabase Auth
--  (symptom: "permission denied for function verify_app_user").
--
--  Puts the database back to exactly how the legacy app expects it:
--    • anon may call verify_app_user / admin_* / self RPCs again
--    • _is_admin, list_my_permissions, grant_self_transformer_access
--      go back to their original bodies (trust the passed user id)
--    • anon gets table access again + a permissive "anon_all" policy
--      on each data table
--  ⚠️ This RE-OPENS the security hole on purpose, to get users back in.
--     Then redo the cutover in order (MIGRATION_SUPABASE_AUTH.md):
--     link users -> deploy client with VITE_USE_SUPABASE_AUTH=1 -> lockdown.
--  Part 1 (auth_user_id column, helpers, me()) is left in place — harmless.
--  Idempotent. Lives outside migrations/ so `supabase db push` never runs it.
-- ============================================================

-- 1. Original function bodies
create or replace function public._is_admin(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists(
    select 1 from public.app_users u
     where u.id = p_user_id and u.role = 'admin' and u.is_active
  );
$$;
revoke all on function public._is_admin(uuid) from public;

create or replace function public.list_my_permissions(p_user_id uuid)
returns table(transformer_id uuid)
language sql security definer set search_path = public
as $$
  select p.transformer_id from public.user_asset_permissions p
   where p.user_id = p_user_id;
$$;

create or replace function public.grant_self_transformer_access(p_user_id uuid, p_transformer_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  insert into public.user_asset_permissions (user_id, transformer_id)
  values (p_user_id, p_transformer_id)
  on conflict do nothing;
end;
$$;

-- 2. RPC grants back to anon (signatures read from the catalog)
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and (p.proname like 'admin\_%'
            or p.proname in ('verify_app_user', 'list_my_permissions',
                             'grant_self_transformer_access'))
  loop
    execute format('grant execute on function %s to anon, authenticated;', r.sig);
  end loop;
end $$;

-- 3. Table access + permissive policy back for the legacy (anon) client
do $$
declare t text;
begin
  foreach t in array array[
    'transformers','oil_tests','documents','floor_plans',
    'company_boundaries','weather_observations','asset_interventions'
  ] loop
    execute format('grant select, insert, update, delete on public.%I to anon, authenticated;', t);
    execute format('drop policy if exists "anon_all" on public.%I;', t);
    execute format('create policy "anon_all" on public.%I for all using (true) with check (true);', t);
  end loop;
end $$;
