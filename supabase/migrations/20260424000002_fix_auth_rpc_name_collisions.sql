-- Fix PL/pgSQL identifier collisions in auth/user RPCs.
--
-- In RETURNS TABLE PL/pgSQL functions, output column names are visible
-- as variables. Unqualified references like `role` or `username` can
-- therefore become ambiguous at runtime.

create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists "pgcrypto" with schema extensions;

create or replace function public._hash_password(p_salt text, p_password text)
returns text
language sql
immutable
as $$
  select encode(extensions.digest(p_salt || ':' || p_password, 'sha256'), 'hex');
$$;

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

    return query
      select v_row.id, v_row.username, v_row.full_name, v_row.role, v_row.is_active;
    return;
  end if;

  select *
    into v_row
    from public.app_users u
   where u.username = p_username;

  if not found then
    return;
  end if;

  if not v_row.is_active then
    return;
  end if;

  if public._hash_password(v_row.salt, p_password) <> v_row.password_hash then
    return;
  end if;

  return query
    select v_row.id, v_row.username, v_row.full_name, v_row.role, v_row.is_active;
end;
$$;

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

  return query
    select v_row.id, v_row.username, v_row.full_name, v_row.role, v_row.is_active;
end;
$$;

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

  return query
    select v_row.id, v_row.username, v_row.full_name, v_row.role, v_row.is_active;
end;
$$;

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
