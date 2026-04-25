-- Allow a dedicated read-only viewer role in the custom app auth model.

alter table if exists public.app_users
  drop constraint if exists app_users_role_check;

alter table if exists public.app_users
  add constraint app_users_role_check
  check (role in ('admin', 'user', 'viewer'));

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
