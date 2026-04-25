-- ── admin_update_user ────────────────────────────────────────
-- Allows an admin to update a user's full_name, role, and org fields.
drop function if exists public.admin_update_user(uuid, uuid, text, text);

create or replace function public.admin_update_user(
  p_admin_id        uuid,
  p_target_id       uuid,
  p_full_name       text,
  p_role            text,
  p_company_name    text default null,
  p_company_address text default null,
  p_pic_email       text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email_clean text;
begin
  if not public._is_admin(p_admin_id) then
    raise exception 'Forbidden';
  end if;
  if p_role not in ('admin', 'user', 'viewer') then
    raise exception 'Invalid role: must be admin, user, or viewer';
  end if;
  v_email_clean := nullif(trim(p_pic_email), '');
  if v_email_clean is not null
     and v_email_clean !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Invalid PIC email address';
  end if;
  update public.app_users
  set full_name       = p_full_name,
      role            = p_role,
      company_name    = nullif(trim(p_company_name), ''),
      company_address = nullif(trim(p_company_address), ''),
      pic_email       = v_email_clean
  where id = p_target_id;
end;
$$;

revoke all on function public.admin_update_user(uuid, uuid, text, text, text, text, text) from public;
grant execute on function public.admin_update_user(uuid, uuid, text, text, text, text, text) to anon, authenticated;
