-- Disable public self-registration for the pilot rollout.
--
-- Accounts must be created by an administrator through
-- public.admin_create_user(...). Public login remains enabled via
-- public.verify_app_user(...).

revoke all on function public.verify_app_user(text, text) from public;
revoke all on function public.register_app_user(text, text, text) from public, anon, authenticated;
revoke all on function public.admin_list_users(uuid) from public;
revoke all on function public.admin_create_user(uuid, text, text, text, text) from public;
revoke all on function public.admin_set_password(uuid, uuid, text) from public;
revoke all on function public.admin_set_active(uuid, uuid, boolean) from public;
revoke all on function public.admin_delete_user(uuid, uuid) from public;
revoke all on function public.admin_list_permissions(uuid) from public;
revoke all on function public.admin_grant_access(uuid, uuid, uuid) from public;
revoke all on function public.admin_revoke_access(uuid, uuid, uuid) from public;
revoke all on function public.admin_grant_many(uuid, uuid, uuid[]) from public;
revoke all on function public.admin_revoke_many(uuid, uuid, uuid[]) from public;
revoke all on function public.list_my_permissions(uuid) from public;

grant execute on function public.verify_app_user(text, text)                     to anon, authenticated;
grant execute on function public.admin_list_users(uuid)                          to anon, authenticated;
grant execute on function public.admin_create_user(uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.admin_set_password(uuid, uuid, text)            to anon, authenticated;
grant execute on function public.admin_set_active(uuid, uuid, boolean)           to anon, authenticated;
grant execute on function public.admin_delete_user(uuid, uuid)                   to anon, authenticated;
grant execute on function public.admin_list_permissions(uuid)                    to anon, authenticated;
grant execute on function public.admin_grant_access(uuid, uuid, uuid)            to anon, authenticated;
grant execute on function public.admin_revoke_access(uuid, uuid, uuid)           to anon, authenticated;
grant execute on function public.admin_grant_many(uuid, uuid, uuid[])            to anon, authenticated;
grant execute on function public.admin_revoke_many(uuid, uuid, uuid[])           to anon, authenticated;
grant execute on function public.list_my_permissions(uuid)                       to anon, authenticated;
