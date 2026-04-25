-- ============================================================
-- Add company / PIC contact fields to app_users
-- ============================================================
-- Extends the user profile with organization metadata captured
-- during admin-driven account creation:
--   • company_name     — employing organization
--   • company_address  — postal / site address
--   • pic_email        — email of the person in charge
--
-- Updates the admin RPCs so the new fields flow through the
-- create + list paths. All existing callers continue to work:
-- the new create parameters default to NULL.
-- ============================================================

alter table public.app_users
  add column if not exists company_name    text,
  add column if not exists company_address text,
  add column if not exists pic_email       text;

-- ── admin_create_user (extended signature) ───────────────────
drop function if exists public.admin_create_user(uuid, text, text, text, text);

create or replace function public.admin_create_user(
  p_admin_id        uuid,
  p_username        text,
  p_full_name       text,
  p_password        text,
  p_role            text,
  p_company_name    text default null,
  p_company_address text default null,
  p_pic_email       text default null
) returns table(
  id              uuid,
  username        text,
  full_name       text,
  role            text,
  is_active       boolean,
  company_name    text,
  company_address text,
  pic_email       text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row  public.app_users%rowtype;
  v_salt text;
  v_hash text;
  v_email_clean text;
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
    select 1 from public.app_users u where u.username = p_username
  ) then
    raise exception 'That username is already taken';
  end if;

  v_email_clean := nullif(trim(p_pic_email), '');
  if v_email_clean is not null
     and v_email_clean !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Invalid PIC email address';
  end if;

  v_salt := encode(extensions.gen_random_bytes(16), 'hex');
  v_hash := public._hash_password(v_salt, p_password);

  insert into public.app_users (
    username, full_name, password_hash, salt, role, is_active,
    company_name, company_address, pic_email
  )
  values (
    p_username,
    coalesce(nullif(trim(p_full_name), ''), p_username),
    v_hash, v_salt, p_role, true,
    nullif(trim(p_company_name), ''),
    nullif(trim(p_company_address), ''),
    v_email_clean
  )
  returning * into v_row;

  return query
    select v_row.id, v_row.username, v_row.full_name, v_row.role, v_row.is_active,
           v_row.company_name, v_row.company_address, v_row.pic_email;
end;
$$;

revoke all on function public.admin_create_user(
  uuid, text, text, text, text, text, text, text
) from public;

grant execute on function public.admin_create_user(
  uuid, text, text, text, text, text, text, text
) to anon, authenticated;

-- ── admin_list_users (include company fields) ────────────────
drop function if exists public.admin_list_users(uuid);

create or replace function public.admin_list_users(p_admin_id uuid)
returns table(
  id              uuid,
  username        text,
  full_name       text,
  role            text,
  is_active       boolean,
  created_at      timestamptz,
  company_name    text,
  company_address text,
  pic_email       text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._is_admin(p_admin_id) then
    raise exception 'Admin privileges required';
  end if;
  return query
    select u.id, u.username, u.full_name, u.role, u.is_active, u.created_at,
           u.company_name, u.company_address, u.pic_email
      from public.app_users u
     order by u.created_at asc;
end;
$$;

revoke all on function public.admin_list_users(uuid) from public;
grant execute on function public.admin_list_users(uuid) to anon, authenticated;
