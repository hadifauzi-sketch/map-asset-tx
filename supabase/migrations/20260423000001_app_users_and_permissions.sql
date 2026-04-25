-- ============================================================
-- App users, per-user asset access, and hardened auth RPCs
-- ============================================================
--
-- Security model
--   • Client (anon key) has NO direct SELECT/INSERT/UPDATE/DELETE
--     on app_users or user_asset_permissions.
--   • All operations go through SECURITY DEFINER functions that:
--       – hash/verify passwords server-side with pgcrypto
--       – never return password_hash or salt to the client
--       – enforce admin role for management operations
--
-- If you are copy-pasting this into the Supabase SQL Editor,
-- just run it once on a fresh database. Re-running is safe
-- (create … if not exists / create or replace).
-- ============================================================

create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists "pgcrypto" with schema extensions;

-- ── app_users ────────────────────────────────────────────────
create table if not exists public.app_users (
  id            uuid        primary key default extensions.uuid_generate_v4(),
  username      text        unique not null,
  full_name     text,
  password_hash text        not null,
  salt          text        not null,
  role          text        not null default 'user',
  is_active     boolean     not null default true,
  created_at    timestamptz not null default now(),
  constraint app_users_role_check check (role in ('admin', 'user', 'viewer'))
);
create index if not exists idx_app_users_username on public.app_users(username);

-- ── user_asset_permissions ───────────────────────────────────
create table if not exists public.user_asset_permissions (
  user_id        uuid not null references public.app_users(id)    on delete cascade,
  transformer_id uuid not null references public.transformers(id) on delete cascade,
  granted_at     timestamptz not null default now(),
  primary key (user_id, transformer_id)
);
create index if not exists idx_uap_user        on public.user_asset_permissions(user_id);
create index if not exists idx_uap_transformer on public.user_asset_permissions(transformer_id);

-- ── Hard lock: RLS on, no permissive policies, no direct grants ─
alter table public.app_users                enable row level security;
alter table public.user_asset_permissions   enable row level security;

revoke all on public.app_users              from anon, authenticated;
revoke all on public.user_asset_permissions from anon, authenticated;

-- ── Private helper: salted SHA-256 ────────────────────────────
create or replace function public._hash_password(p_salt text, p_password text)
returns text
language sql
immutable
as $$
  select encode(extensions.digest(p_salt || ':' || p_password, 'sha256'), 'hex');
$$;

revoke all on function public._hash_password(text, text) from public;

-- ── Private helper: admin check ──────────────────────────────
create or replace function public._is_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.app_users u
    where u.id = p_user_id
      and u.role = 'admin'
      and u.is_active
  );
$$;

revoke all on function public._is_admin(uuid) from public;

-- ── verify_app_user (public) ─────────────────────────────────
--   Bootstraps admin/admin the first time no admin exists.
create or replace function public.verify_app_user(p_username text, p_password text)
returns table(id uuid, username text, full_name text, role text, is_active boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row  public.app_users%rowtype;
  v_salt text;
  v_hash text;
begin
  p_username := lower(trim(p_username));

  -- First-run bootstrap: "admin"/"admin" creates the initial administrator.
  if p_username = 'admin'
     and p_password = 'admin'
     and not exists (
       select 1
       from public.app_users u
       where u.role = 'admin'
     ) then
    v_salt := encode(extensions.gen_random_bytes(16), 'hex');
    v_hash := public._hash_password(v_salt, 'admin');
    insert into public.app_users (username, full_name, password_hash, salt, role, is_active)
    values ('admin', 'Administrator', v_hash, v_salt, 'admin', true)
    returning * into v_row;
    return query select v_row.id, v_row.username, v_row.full_name, v_row.role, v_row.is_active;
    return;
  end if;

  select *
    into v_row
    from public.app_users u
   where u.username = p_username;
  if not found           then return; end if;
  if not v_row.is_active then return; end if;

  if public._hash_password(v_row.salt, p_password) <> v_row.password_hash then
    return;
  end if;

  return query select v_row.id, v_row.username, v_row.full_name, v_row.role, v_row.is_active;
end;
$$;

revoke all on function public.verify_app_user(text, text) from public;

-- ── register_app_user (public, always role='user') ───────────
create or replace function public.register_app_user(
  p_username text, p_full_name text, p_password text
) returns table(id uuid, username text, full_name text, role text, is_active boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row  public.app_users%rowtype;
  v_salt text;
  v_hash text;
begin
  p_username := lower(trim(p_username));
  if p_username !~ '^[a-z0-9_.\-]{3,32}$' then
    raise exception 'Username must be 3-32 chars (letters, digits, . _ -)';
  end if;
  if length(p_password) < 6 then
    raise exception 'Password must be at least 6 characters';
  end if;
  if exists (
    select 1
    from public.app_users u
    where u.username = p_username
  ) then
    raise exception 'That username is already taken';
  end if;

  v_salt := encode(extensions.gen_random_bytes(16), 'hex');
  v_hash := public._hash_password(v_salt, p_password);
  insert into public.app_users (username, full_name, password_hash, salt, role, is_active)
  values (
    p_username,
    coalesce(nullif(trim(p_full_name), ''), p_username),
    v_hash, v_salt, 'user', true
  )
  returning * into v_row;

  return query select v_row.id, v_row.username, v_row.full_name, v_row.role, v_row.is_active;
end;
$$;

revoke all on function public.register_app_user(text, text, text) from public, anon, authenticated;

-- ── admin_list_users (admin only) ────────────────────────────
create or replace function public.admin_list_users(p_admin_id uuid)
returns table(id uuid, username text, full_name text, role text, is_active boolean, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._is_admin(p_admin_id) then
    raise exception 'Admin privileges required';
  end if;
  return query
    select u.id, u.username, u.full_name, u.role, u.is_active, u.created_at
    from public.app_users u
    order by u.created_at asc;
end;
$$;

revoke all on function public.admin_list_users(uuid) from public;

-- ── admin_create_user (admin only) ───────────────────────────
create or replace function public.admin_create_user(
  p_admin_id uuid,
  p_username text,
  p_full_name text,
  p_password text,
  p_role text
) returns table(id uuid, username text, full_name text, role text, is_active boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row  public.app_users%rowtype;
  v_salt text;
  v_hash text;
begin
  if not public._is_admin(p_admin_id) then
    raise exception 'Admin privileges required';
  end if;
  if p_role not in ('admin', 'user', 'viewer') then
    raise exception 'Invalid role';
  end if;
  p_username := lower(trim(p_username));
  if p_username !~ '^[a-z0-9_.\-]{3,32}$' then
    raise exception 'Invalid username';
  end if;
  if length(p_password) < 6 then
    raise exception 'Password must be at least 6 characters';
  end if;
  if exists (
    select 1
    from public.app_users u
    where u.username = p_username
  ) then
    raise exception 'That username is already taken';
  end if;

  v_salt := encode(extensions.gen_random_bytes(16), 'hex');
  v_hash := public._hash_password(v_salt, p_password);
  insert into public.app_users (username, full_name, password_hash, salt, role, is_active)
  values (
    p_username,
    coalesce(nullif(trim(p_full_name), ''), p_username),
    v_hash, v_salt, p_role, true
  )
  returning * into v_row;

  return query select v_row.id, v_row.username, v_row.full_name, v_row.role, v_row.is_active;
end;
$$;

revoke all on function public.admin_create_user(uuid, text, text, text, text) from public;

-- ── admin_set_password ───────────────────────────────────────
create or replace function public.admin_set_password(
  p_admin_id uuid, p_target_id uuid, p_new_password text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_salt text;
begin
  if not public._is_admin(p_admin_id) then
    raise exception 'Admin privileges required';
  end if;
  if length(p_new_password) < 6 then
    raise exception 'Password must be at least 6 characters';
  end if;
  v_salt := encode(extensions.gen_random_bytes(16), 'hex');
  update public.app_users
     set salt = v_salt,
         password_hash = public._hash_password(v_salt, p_new_password)
   where id = p_target_id;
end;
$$;

revoke all on function public.admin_set_password(uuid, uuid, text) from public;

-- ── admin_set_active ─────────────────────────────────────────
create or replace function public.admin_set_active(
  p_admin_id uuid, p_target_id uuid, p_is_active boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._is_admin(p_admin_id) then
    raise exception 'Admin privileges required';
  end if;
  if p_admin_id = p_target_id and not p_is_active then
    raise exception 'You cannot disable your own account';
  end if;
  update public.app_users set is_active = p_is_active where id = p_target_id;
end;
$$;

revoke all on function public.admin_set_active(uuid, uuid, boolean) from public;

-- ── admin_delete_user ────────────────────────────────────────
create or replace function public.admin_delete_user(
  p_admin_id uuid, p_target_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._is_admin(p_admin_id) then
    raise exception 'Admin privileges required';
  end if;
  if p_admin_id = p_target_id then
    raise exception 'You cannot delete your own account';
  end if;
  delete from public.app_users where id = p_target_id;
end;
$$;

revoke all on function public.admin_delete_user(uuid, uuid) from public;

-- ── admin_list_permissions ───────────────────────────────────
create or replace function public.admin_list_permissions(p_admin_id uuid)
returns table(user_id uuid, transformer_id uuid)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._is_admin(p_admin_id) then
    raise exception 'Admin privileges required';
  end if;
  return query
    select p.user_id, p.transformer_id from public.user_asset_permissions p;
end;
$$;

revoke all on function public.admin_list_permissions(uuid) from public;

-- ── admin_grant_access (single) ──────────────────────────────
create or replace function public.admin_grant_access(
  p_admin_id uuid, p_user_id uuid, p_transformer_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._is_admin(p_admin_id) then
    raise exception 'Admin privileges required';
  end if;
  insert into public.user_asset_permissions (user_id, transformer_id)
  values (p_user_id, p_transformer_id)
  on conflict do nothing;
end;
$$;

revoke all on function public.admin_grant_access(uuid, uuid, uuid) from public;

-- ── admin_revoke_access (single) ─────────────────────────────
create or replace function public.admin_revoke_access(
  p_admin_id uuid, p_user_id uuid, p_transformer_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._is_admin(p_admin_id) then
    raise exception 'Admin privileges required';
  end if;
  delete from public.user_asset_permissions
   where user_id = p_user_id and transformer_id = p_transformer_id;
end;
$$;

revoke all on function public.admin_revoke_access(uuid, uuid, uuid) from public;

-- ── admin_grant_many / admin_revoke_many (bulk) ──────────────
create or replace function public.admin_grant_many(
  p_admin_id uuid, p_user_id uuid, p_transformer_ids uuid[]
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._is_admin(p_admin_id) then
    raise exception 'Admin privileges required';
  end if;
  insert into public.user_asset_permissions (user_id, transformer_id)
    select p_user_id, unnest(p_transformer_ids)
    on conflict do nothing;
end;
$$;

revoke all on function public.admin_grant_many(uuid, uuid, uuid[]) from public;

create or replace function public.admin_revoke_many(
  p_admin_id uuid, p_user_id uuid, p_transformer_ids uuid[]
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._is_admin(p_admin_id) then
    raise exception 'Admin privileges required';
  end if;
  delete from public.user_asset_permissions
   where user_id = p_user_id
     and transformer_id = any(p_transformer_ids);
end;
$$;

revoke all on function public.admin_revoke_many(uuid, uuid, uuid[]) from public;

-- ── list_my_permissions (self-scope) ─────────────────────────
create or replace function public.list_my_permissions(p_user_id uuid)
returns table(transformer_id uuid)
language sql
security definer
set search_path = public
as $$
  select p.transformer_id
    from public.user_asset_permissions p
   where p.user_id = p_user_id;
$$;

revoke all on function public.list_my_permissions(uuid) from public;

-- ── grant_self_transformer_access (pilot self-add convenience) ──
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

-- ── Grants: only RPC access ──────────────────────────────────
grant execute on function public.verify_app_user(text, text)                          to anon, authenticated;
grant execute on function public.admin_list_users(uuid)                               to anon, authenticated;
grant execute on function public.admin_create_user(uuid, text, text, text, text)      to anon, authenticated;
grant execute on function public.admin_set_password(uuid, uuid, text)                 to anon, authenticated;
grant execute on function public.admin_set_active(uuid, uuid, boolean)                to anon, authenticated;
grant execute on function public.admin_delete_user(uuid, uuid)                        to anon, authenticated;
grant execute on function public.admin_list_permissions(uuid)                         to anon, authenticated;
grant execute on function public.admin_grant_access(uuid, uuid, uuid)                 to anon, authenticated;
grant execute on function public.admin_revoke_access(uuid, uuid, uuid)                to anon, authenticated;
grant execute on function public.admin_grant_many(uuid, uuid, uuid[])                 to anon, authenticated;
grant execute on function public.admin_revoke_many(uuid, uuid, uuid[])                to anon, authenticated;
grant execute on function public.list_my_permissions(uuid)                            to anon, authenticated;
grant execute on function public.grant_self_transformer_access(uuid, uuid)            to anon, authenticated;
