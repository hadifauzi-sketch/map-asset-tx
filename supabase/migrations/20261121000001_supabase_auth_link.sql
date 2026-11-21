-- ============================================================
--  SECURITY CUTOVER — PART 1 of 3: link app users to Supabase Auth
-- ============================================================
--  Purely ADDITIVE and safe to run on the live database: adds
--  app_users.auth_user_id plus identity helper functions and me().
--  Nothing is revoked or locked; the current app keeps working.
--
--  Next: part 2 (20261121000002_supabase_auth_auto_provision), deploy the
--  client with VITE_USE_SUPABASE_AUTH=1, and only THEN part 3
--  (20261121000003_supabase_auth_lockdown).
--  See MIGRATION_SUPABASE_AUTH.md. Idempotent.
-- ============================================================

create extension if not exists "pgcrypto" with schema extensions;

-- ── 1. Link app_users -> auth.users ──────────────────────────
alter table public.app_users
  add column if not exists auth_user_id uuid unique
    references auth.users(id) on delete set null;

create index if not exists idx_app_users_auth_user_id
  on public.app_users(auth_user_id);

-- ── 2. Identity helpers (all resolve the CURRENT caller) ─────
--    security definer so they can read app_users, which stays revoked
--    from anon/authenticated. search_path pinned to avoid hijacking.

create or replace function public.current_app_user_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select u.id from public.app_users u
   where u.auth_user_id = auth.uid() and u.is_active
   limit 1;
$$;

create or replace function public.current_app_role()
returns text
language sql stable security definer set search_path = public
as $$
  select u.role from public.app_users u
   where u.auth_user_id = auth.uid() and u.is_active
   limit 1;
$$;

create or replace function public.is_app_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists(
    select 1 from public.app_users u
     where u.auth_user_id = auth.uid() and u.role = 'admin' and u.is_active
  );
$$;

-- can the caller see a given transformer? admin -> all; else must hold a
-- user_asset_permissions grant for it.
create or replace function public.can_access_tx(p_tx uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_app_admin() or exists(
    select 1 from public.user_asset_permissions p
     where p.transformer_id = p_tx
       and p.user_id = public.current_app_user_id()
  );
$$;

-- for floor_plans (transformer_ids is a TEXT[] of transformer uuids): admin,
-- or any of the ids is one the caller may access. Compared as text so a
-- malformed id in the array can never raise a cast error.
-- (drop the uuid[] overload in case an earlier partial run created it)
drop function if exists public.can_access_any_tx(uuid[]);
create or replace function public.can_access_any_tx(p_txs text[])
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_app_admin() or exists(
    select 1 from public.user_asset_permissions p
     where p.user_id = public.current_app_user_id()
       and p.transformer_id::text = any(p_txs)
  );
$$;

-- caller is allowed to WRITE (create / edit) business data: admin or 'user'.
-- 'viewer' is read-only.
create or replace function public.can_write()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.current_app_role() in ('admin', 'user');
$$;

grant execute on function public.current_app_user_id()      to authenticated;
grant execute on function public.current_app_role()         to authenticated;
grant execute on function public.is_app_admin()             to authenticated;
grant execute on function public.can_access_tx(uuid)        to authenticated;
grant execute on function public.can_access_any_tx(text[])  to authenticated;
grant execute on function public.can_write()                to authenticated;

-- ── 3. Profile fetch for the logged-in user (replaces the
--       verify_app_user return the client used to store) ─────
create or replace function public.me()
returns table(id uuid, username text, full_name text, role text, is_active boolean)
language sql stable security definer set search_path = public
as $$
  select u.id, u.username, u.full_name, u.role, u.is_active
    from public.app_users u
   where u.auth_user_id = auth.uid() and u.is_active;
$$;
revoke all on function public.me() from public, anon;
grant execute on function public.me() to authenticated;
