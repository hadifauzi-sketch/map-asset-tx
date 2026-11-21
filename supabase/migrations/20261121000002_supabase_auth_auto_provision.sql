-- ============================================================
--  SECURITY CUTOVER — PART 2 of 3: automatic Supabase Auth accounts
-- ============================================================
--  Moves users into Supabase Auth WITHOUT anyone re-creating accounts or
--  handing out temporary passwords:
--
--   • Existing users are moved on their FIRST sign-in: the client calls
--     migrate_legacy_login(username, password); if the password matches the
--     legacy hash, a Supabase Auth login is created with that SAME password
--     (bcrypt) and linked via app_users.auth_user_id. Users keep their
--     usernames and passwords.
--   • Settings → Add user (admin_create_user) now also creates the login.
--   • Reset password (admin_set_password) also updates the login.
--   • Disable (admin_set_active) also bans / unbans the login.
--   • Delete (admin_delete_user) also deletes the login.
--
--  Login e-mail = <username>@asset.local (must match VITE_AUTH_EMAIL_DOMAIN).
--  Additive + backward compatible: the current legacy app keeps working.
--  Requires part 1 (20261121000001_supabase_auth_link). Idempotent.
--  Part 3 (20261121000003_supabase_auth_lockdown) comes LAST, after the
--  client is deployed with VITE_USE_SUPABASE_AUTH=1.
-- ============================================================

create extension if not exists "pgcrypto" with schema extensions;

-- ── Login e-mail for a username ──────────────────────────────
create or replace function public._auth_email(p_username text)
returns text
language sql immutable set search_path = public
as $$
  select lower(trim(p_username)) || '@asset.local';
$$;
revoke all on function public._auth_email(text) from public, anon, authenticated;

-- ── Create or update the Supabase Auth login for an app user ─
--    Internal only (never callable from the browser). Sets the login's
--    password to p_password (bcrypt) and links app_users.auth_user_id.
create or replace function public._provision_auth_user(p_app_user_id uuid, p_password text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_user  public.app_users%rowtype;
  v_email text;
  v_auth  uuid;
  v_hash  text;
begin
  select * into v_user from public.app_users where id = p_app_user_id;
  if not found then
    raise exception 'User not found';
  end if;

  v_email := public._auth_email(v_user.username);
  v_hash  := extensions.crypt(p_password, extensions.gen_salt('bf', 10));

  -- already linked and still present?
  if v_user.auth_user_id is not null
     and exists (select 1 from auth.users where id = v_user.auth_user_id) then
    v_auth := v_user.auth_user_id;
  else
    -- an unlinked login with this e-mail (e.g. from the linking script)?
    select id into v_auth from auth.users
     where lower(email) = v_email and not is_sso_user
     limit 1;
  end if;

  if v_auth is not null then
    update auth.users
       set encrypted_password = v_hash,
           email              = v_email,
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           banned_until       = case when v_user.is_active then null else 'infinity'::timestamptz end,
           updated_at         = now()
     where id = v_auth;
  else
    v_auth := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      banned_until
    ) values (
      '00000000-0000-0000-0000-000000000000', v_auth, 'authenticated', 'authenticated',
      v_email, v_hash, now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('username', v_user.username, 'app_user_id', v_user.id),
      now(), now(),
      '', '', '', '',
      case when v_user.is_active then null else 'infinity'::timestamptz end
    );
    insert into auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      v_auth::text, v_auth,
      jsonb_build_object('sub', v_auth::text, 'email', v_email, 'email_verified', true),
      'email', now(), now(), now()
    );
  end if;

  update public.app_users set auth_user_id = v_auth
   where id = v_user.id and auth_user_id is distinct from v_auth;

  return v_auth;
end;
$$;
revoke all on function public._provision_auth_user(uuid, text) from public, anon, authenticated;

-- ── First-sign-in migration (called by the login screen) ─────
--    Returns true when the legacy password is correct; the Supabase Auth
--    login then exists with that same password, so the client can sign in.
--    Reveals nothing beyond "password correct / not" — same as the old
--    verify_app_user, which it replaces for login.
create or replace function public.migrate_legacy_login(p_username text, p_password text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_user public.app_users%rowtype;
begin
  select * into v_user from public.app_users
   where username = lower(trim(p_username));
  if not found or not v_user.is_active then
    return false;
  end if;
  if public._hash_password(v_user.salt, p_password) <> v_user.password_hash then
    return false;
  end if;
  perform public._provision_auth_user(v_user.id, p_password);
  return true;
end;
$$;
revoke all on function public.migrate_legacy_login(text, text) from public;
grant execute on function public.migrate_legacy_login(text, text) to anon, authenticated;

-- ── Add user: also create the Supabase Auth login ────────────
--    Same signature / return shape as 20260424000006 (company fields).
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

  -- NEW: create the matching Supabase Auth login with the same password.
  perform public._provision_auth_user(v_row.id, p_password);

  return query
    select v_row.id, v_row.username, v_row.full_name, v_row.role, v_row.is_active,
           v_row.company_name, v_row.company_address, v_row.pic_email;
end;
$$;

-- ── Reset password: update both the legacy hash and the login ─
create or replace function public.admin_set_password(
  p_admin_id uuid, p_target_id uuid, p_new_password text
) returns void
language plpgsql security definer set search_path = public
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
  if found then
    perform public._provision_auth_user(p_target_id, p_new_password);
  end if;
end;
$$;

-- ── Disable / enable: also ban / unban the login ─────────────
create or replace function public.admin_set_active(
  p_admin_id uuid, p_target_id uuid, p_is_active boolean
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public._is_admin(p_admin_id) then
    raise exception 'Admin privileges required';
  end if;
  if (p_admin_id = p_target_id or public.current_app_user_id() = p_target_id)
     and not p_is_active then
    raise exception 'You cannot disable your own account';
  end if;
  update public.app_users set is_active = p_is_active where id = p_target_id;
  update auth.users
     set banned_until = case when p_is_active then null else 'infinity'::timestamptz end,
         updated_at   = now()
   where id = (select auth_user_id from public.app_users where id = p_target_id);
end;
$$;

-- ── Delete: also delete the login ────────────────────────────
create or replace function public.admin_delete_user(
  p_admin_id uuid, p_target_id uuid
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_auth uuid;
begin
  if not public._is_admin(p_admin_id) then
    raise exception 'Admin privileges required';
  end if;
  if p_admin_id = p_target_id or public.current_app_user_id() = p_target_id then
    raise exception 'You cannot delete your own account';
  end if;
  select auth_user_id into v_auth from public.app_users where id = p_target_id;
  delete from public.app_users where id = p_target_id;
  if v_auth is not null then
    delete from auth.users where id = v_auth;  -- identities cascade
  end if;
end;
$$;
