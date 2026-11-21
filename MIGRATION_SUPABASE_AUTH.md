# Security cutover — move authorization into Supabase Auth + RLS

## Why

Every data table used to have an RLS policy of `USING (true)`, and the Supabase **anon**
key is shipped in the browser bundle — so anyone could read, change or delete the whole
asset database directly, bypassing the login. The `admin_*` RPCs also trusted a
client-supplied admin id. This cutover makes the **database** enforce access: users sign
in through Supabase Auth, every request carries a real JWT, and RLS keyed to
`auth.uid()` + `user_asset_permissions` decides what each user can see and change.

## No accounts to re-create, no temporary passwords

- **Existing users are moved automatically on their first sign-in**, keeping their
  username and password. The login screen calls `migrate_legacy_login`; if the password
  matches the legacy account, the database creates the Supabase Auth login with that same
  password (bcrypt) and links it. Login e-mail is `<username>@asset.local` (internal).
- **Settings → Add user** creates the Supabase Auth login at the same time.
- **Reset password / Disable / Delete** keep the Supabase Auth login in sync.

`scripts/link-supabase-auth-users.mjs` is no longer needed (optional fallback only).

## Files

| File | What it does |
|------|--------------|
| `supabase/migrations/20261121000001_supabase_auth_link.sql` | **Part 1** — `auth_user_id` column, identity helpers, `me()`. Additive. |
| `supabase/migrations/20261121000002_supabase_auth_auto_provision.sql` | **Part 2** — automatic Supabase Auth logins (first sign-in, Add user, reset, disable, delete). Additive. |
| `supabase/migrations/20261121000003_supabase_auth_lockdown.sql` | **Part 3** — the actual lockdown. Drops **all** policies on the 7 data tables, adds per-user RLS, re-points `_is_admin()` at `auth.uid()`, revokes `anon`. **Apply last.** |
| `supabase/rollback/20261121_restore_legacy_login.sql` | Emergency rollback if Part 3 is applied too early. |
| `lib/supabaseClient.js`, `components/Authentic/sign-in.jsx` | `VITE_USE_SUPABASE_AUTH` flag; login with automatic first-sign-in move. |

## Order (zero downtime)

1. **SQL editor → run Part 1**, then **Part 2**. The current app keeps working.
2. **Deploy this code** (flag still off). From now on, every normal sign-in quietly
   creates that user's Supabase Auth login in the background, and *Add user* creates
   one immediately.
3. **Vercel → Environment Variables:** `VITE_USE_SUPABASE_AUTH=1`
   (`VITE_AUTH_EMAIL_DOMAIN=asset.local` is the default). Redeploy, then sign in and
   check data loads. Users who were not moved yet are moved on this sign-in.
4. **SQL editor → run Part 3** (lockdown). Then run the checks below.

> ⚠️ Part 3 **before** step 3 locks everyone out ("permission denied for function
> verify_app_user"). Fix: run `supabase/rollback/20261121_restore_legacy_login.sql`.
> Nothing is deleted by Part 3 or the rollback — only grants and policies change.

## Checks after Part 3

- [ ] Admin signs in and sees all transformers.
- [ ] A `user` sees **only** granted transformers and can edit them.
- [ ] A `viewer` can read but not change anything.
- [ ] Settings → Add user → the new user can sign in straight away.
- [ ] Signed out, the public key returns nothing:
      ```bash
      curl "$VITE_SUPABASE_URL/rest/v1/transformers?select=id" \
        -H "apikey: $VITE_SUPABASE_ANON_KEY"      # expect [] or permission error
      ```
- [ ] In the SQL editor:
      ```sql
      -- only the two map-overlay read policies should be wide open
      select tablename, policyname from pg_policies
       where schemaname = 'public' and qual = 'true';
      -- anon must have no table privileges on the data tables (expect 0 rows)
      select table_name, privilege_type from information_schema.role_table_grants
       where grantee = 'anon' and table_schema = 'public'
         and table_name in ('transformers','oil_tests','documents','floor_plans',
                            'company_boundaries','weather_observations','asset_interventions');
      -- who has been moved so far
      select username, auth_user_id is not null as moved from public.app_users order by 1;
      ```

## Also do

- **Rotate the leaked token** `transformer_asset_map_api_key.txt` — it is in the public
  GitHub history (commits `8b63828`, `d0843e1`); gitignoring does not remove it.
- The `qc_*` tables in this project are open to the public and are not used by this app.

## Follow-ups (not blocking)

- Once every user shows `moved = true`, the legacy `password_hash` / `salt` columns and
  `verify_app_user` are only kept for the admin "verify current password" step — they
  can be retired in a later migration.
- `migrate_legacy_login` has no rate limit (same as the old `verify_app_user`); consider
  removing it once all users are moved.
