-- ============================================================
--  SECURITY CUTOVER — PART 3 of 3: lock the database down
-- ============================================================
--  WHY: every data table was readable/writable by anyone holding the public
--  anon key (shipped in the browser bundle), and the admin_* RPCs trusted a
--  client-supplied admin id. This replaces all of that with RLS keyed to
--  auth.uid() + user_asset_permissions.
--
--  ⚠️  APPLY LAST — only after parts 1 + 2 are applied AND the client is
--      deployed with VITE_USE_SUPABASE_AUTH=1 (check you can sign in).
--      Users not yet moved are still moved on their next sign-in
--      (migrate_legacy_login stays available). Applied while the deployed
--      client still uses the legacy login, it locks everyone out — fix with
--      supabase/rollback/20261121_restore_legacy_login.sql. Idempotent.
-- ============================================================

-- ── 4. Table grants: lock anon out, let authenticated through
--       (RLS below still decides which rows) ─────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'transformers','oil_tests','documents','floor_plans',
    'company_boundaries','weather_observations','asset_interventions'
  ] loop
    execute format('revoke all on public.%I from anon;', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated;', t);
  end loop;
end $$;

-- ── 5. Replace the wide-open policies ────────────────────────
-- Drop EVERY existing policy on these tables, whatever its name. Production
-- carries dashboard-created ones ("Enable read access for all users",
-- "Allow all for anon", ...) besides "anon_all"; permissive policies are
-- OR'ed together, so leaving any of them would keep the tables wide open.
do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
     where schemaname = 'public'
       and tablename in ('transformers','oil_tests','documents','floor_plans',
                         'company_boundaries','weather_observations','asset_interventions')
  loop
    execute format('drop policy if exists %I on public.%I;', r.policyname, r.tablename);
  end loop;
end $$;

-- transformers -------------------------------------------------
drop policy if exists tx_select on public.transformers;
drop policy if exists tx_insert on public.transformers;
drop policy if exists tx_update on public.transformers;
drop policy if exists tx_delete on public.transformers;
create policy tx_select on public.transformers for select to authenticated
  using (public.can_access_tx(id));
create policy tx_insert on public.transformers for insert to authenticated
  with check (public.can_write());
create policy tx_update on public.transformers for update to authenticated
  using (public.is_app_admin() or (public.can_write() and public.can_access_tx(id)))
  with check (public.is_app_admin() or (public.can_write() and public.can_access_tx(id)));
create policy tx_delete on public.transformers for delete to authenticated
  using (public.is_app_admin() or (public.can_write() and public.can_access_tx(id)));

-- child tables keyed by transformer_id (oil_tests, documents,
-- asset_interventions) share the same shape ------------------
do $$
declare t text;
begin
  foreach t in array array['oil_tests','documents','asset_interventions'] loop
    execute format('drop policy if exists %I on public.%I;', t||'_select', t);
    execute format('drop policy if exists %I on public.%I;', t||'_insert', t);
    execute format('drop policy if exists %I on public.%I;', t||'_update', t);
    execute format('drop policy if exists %I on public.%I;', t||'_delete', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.can_access_tx(transformer_id));',
      t||'_select', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.can_write() and public.can_access_tx(transformer_id));',
      t||'_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.can_write() and public.can_access_tx(transformer_id)) with check (public.can_write() and public.can_access_tx(transformer_id));',
      t||'_update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.can_write() and public.can_access_tx(transformer_id));',
      t||'_delete', t);
  end loop;
end $$;

-- floor_plans (transformer_ids uuid[]) ------------------------
drop policy if exists fp_select on public.floor_plans;
drop policy if exists fp_write  on public.floor_plans;
drop policy if exists fp_update on public.floor_plans;
drop policy if exists fp_delete on public.floor_plans;
create policy fp_select on public.floor_plans for select to authenticated
  using (public.can_access_any_tx(transformer_ids));
create policy fp_write on public.floor_plans for insert to authenticated
  with check (public.can_write() and public.can_access_any_tx(transformer_ids));
create policy fp_update on public.floor_plans for update to authenticated
  using (public.can_write() and public.can_access_any_tx(transformer_ids))
  with check (public.can_write() and public.can_access_any_tx(transformer_ids));
create policy fp_delete on public.floor_plans for delete to authenticated
  using (public.can_write() and public.can_access_any_tx(transformer_ids));

-- company_boundaries & weather_observations are map-overlay /
-- reference data: any signed-in user may read.
--   • company_boundaries: drawn/edited from the normal UI -> admin + 'user'
--     may write; 'viewer' read-only.
--   • weather_observations: the weather tool caches API results (upsert)
--     whenever ANY signed-in user opens it, so any signed-in user may
--     insert/update; only admins delete.
do $$
declare t text;
begin
  foreach t in array array['company_boundaries','weather_observations'] loop
    execute format('drop policy if exists %I on public.%I;', t||'_select', t);
    execute format('drop policy if exists %I on public.%I;', t||'_write',  t);
    execute format('drop policy if exists %I on public.%I;', t||'_update', t);
    execute format('drop policy if exists %I on public.%I;', t||'_delete', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (true);',
      t||'_select', t);
  end loop;
end $$;

create policy company_boundaries_write on public.company_boundaries
  for insert to authenticated with check (public.can_write());
create policy company_boundaries_update on public.company_boundaries
  for update to authenticated using (public.can_write()) with check (public.can_write());
create policy company_boundaries_delete on public.company_boundaries
  for delete to authenticated using (public.can_write());

create policy weather_observations_write on public.weather_observations
  for insert to authenticated with check (public.current_app_user_id() is not null);
create policy weather_observations_update on public.weather_observations
  for update to authenticated
  using (public.current_app_user_id() is not null)
  with check (public.current_app_user_id() is not null);
create policy weather_observations_delete on public.weather_observations
  for delete to authenticated using (public.is_app_admin());

-- ── 6. Harden the RPCs: authorize by auth.uid(), not by a
--       client-supplied id. ──────────────────────────────────
-- Every admin_* RPC (including later versions with company fields and
-- admin_update_user) gates on public._is_admin(p_admin_id). Re-pointing that
-- ONE helper at auth.uid() secures all of them without touching their
-- signatures or bodies. The p_user_id argument is now ignored.
create or replace function public._is_admin(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_app_admin();
$$;
revoke all on function public._is_admin(uuid) from public, anon, authenticated;

-- self-scope RPCs trusted a client-supplied p_user_id; make them use the
-- caller's own identity instead (signatures unchanged).
create or replace function public.list_my_permissions(p_user_id uuid)
returns table(transformer_id uuid)
language sql stable security definer set search_path = public as $$
  select p.transformer_id from public.user_asset_permissions p
   where p.user_id = public.current_app_user_id();
$$;

create or replace function public.grant_self_transformer_access(p_user_id uuid, p_transformer_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.current_app_user_id() is null then raise exception 'Not authenticated'; end if;
  if not public.can_write() then raise exception 'Read-only role'; end if;
  insert into public.user_asset_permissions (user_id, transformer_id)
  values (public.current_app_user_id(), p_transformer_id) on conflict do nothing;
end; $$;

-- ── 7. Re-point grants: authenticated only, anon removed ─────
-- Signatures are looked up from the catalog so this keeps working no matter
-- how many times an RPC's argument list has changed across migrations.
do $$
declare r record;
begin
  -- legacy login / self-registration: no longer callable by anon
  for r in
    select p.oid::regprocedure as sig, p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('verify_app_user', 'register_app_user')
  loop
    execute format('revoke all on function %s from anon, public;', r.sig);
    if r.proname = 'register_app_user' then
      execute format('revoke all on function %s from authenticated;', r.sig);
    end if;
  end loop;

  -- admin + self-scope RPCs: signed-in users only (RPC body checks role)
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and (p.proname like 'admin\_%'
            or p.proname in ('list_my_permissions', 'grant_self_transformer_access'))
  loop
    execute format('revoke all on function %s from anon, public;', r.sig);
    execute format('grant execute on function %s to authenticated;', r.sig);
  end loop;
end $$;

-- ============================================================
--  End. Verify with the queries in MIGRATION_SUPABASE_AUTH.md
--  (pg_policies should show NO policy with qual = 'true' except
--   the two map-overlay SELECTs, and anon should have no table
--   privileges).
-- ============================================================
