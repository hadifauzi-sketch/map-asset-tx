# Supabase Setup Guide for Transformer Asset Management

## 📋 Step 1: Create Supabase Account

1. Go to https://supabase.com
2. Click "Start your project"
3. Sign up with GitHub/Email
4. Create a new project:
   - **Project name**: `transformer-assets`
   - **Database password**: (save this!)
   - **Region**: Choose closest to Malaysia (Singapore recommended)
   - Click "Create new project"
   - Wait 2-3 minutes for setup

## 🗄️ Step 2: Create Database Tables

Go to **SQL Editor** in Supabase dashboard and run this SQL:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create transformers table
CREATE TABLE transformers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_name TEXT NOT NULL,
    state TEXT,
    tx_name TEXT NOT NULL,
    mnemonic TEXT,
    serial_number TEXT,
    voltage TEXT NOT NULL,
    load_mva TEXT,
    maker TEXT,
    year_built TEXT,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create oil_tests table
CREATE TABLE oil_tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transformer_id UUID REFERENCES transformers(id) ON DELETE CASCADE,
    test_date DATE NOT NULL,
    test_type TEXT NOT NULL,
    breakdown DECIMAL(10, 2),
    acidity DECIMAL(10, 4),
    water_content DECIMAL(10, 2),
    interfacial_tension DECIMAL(10, 2),
    color TEXT,
    flash_point DECIMAL(10, 2),
    dielectric_strength DECIMAL(10, 2),
    power_factor DECIMAL(10, 4),
    h2 INTEGER,
    ch4 INTEGER,
    c2h6 INTEGER,
    c2h4 INTEGER,
    c2h2 INTEGER,
    co INTEGER,
    co2 INTEGER,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create documents table (storing metadata only)
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transformer_id UUID REFERENCES transformers(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    image_category TEXT,
    CONSTRAINT documents_image_category_check CHECK (
      image_category IN (
        'name-plate',
        'transformer-design',
        'oil-level-design',
        'oltc-design',
        'buchholz-design',
        'other'
      )
    ),
    storage_path TEXT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_transformers_site ON transformers(site_name);
CREATE INDEX idx_transformers_state ON transformers(state);
CREATE INDEX idx_transformers_tx_name ON transformers(tx_name);
CREATE INDEX idx_oil_tests_transformer ON oil_tests(transformer_id);
CREATE INDEX idx_oil_tests_date ON oil_tests(test_date);
CREATE INDEX idx_documents_transformer ON documents(transformer_id);
CREATE INDEX idx_documents_image_category ON documents(image_category);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for transformers
CREATE TRIGGER update_transformers_updated_at
    BEFORE UPDATE ON transformers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE transformers ENABLE ROW LEVEL SECURITY;
ALTER TABLE oil_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for now - you can restrict later)
CREATE POLICY "Enable read access for all users" ON transformers FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON transformers FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON transformers FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON transformers FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON oil_tests FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON oil_tests FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON oil_tests FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON oil_tests FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON documents FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON documents FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON documents FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON documents FOR DELETE USING (true);
```

## 📦 Step 3: Create Storage Bucket for Documents

1. Go to **Storage** in Supabase dashboard
2. Click "Create a new bucket"
3. **Name**: `transformer-documents`
4. **Public bucket**: ✅ Check this (so you can view documents)
5. Click "Create bucket"

### Set Storage Policies:

Click on the bucket → Policies → "New Policy" → Choose "For full customization":

```sql
-- Allow all operations on transformer-documents bucket
CREATE POLICY "Public Access"
ON storage.objects FOR ALL
USING (bucket_id = 'transformer-documents');
```

Or use the UI:
- Policy name: "Public Access"
- Allowed operations: SELECT, INSERT, UPDATE, DELETE
- Target roles: public
- USING expression: `bucket_id = 'transformer-documents'`

## 🔑 Step 4: Get Your API Credentials

1. Go to **Project Settings** (⚙️ icon)
2. Go to **API** section
3. Copy these values:

```
Project URL: https://xxxxxxxxxxxxx.supabase.co
anon public key: eyJhbGc....(very long key)
```

## 💻 Step 5: Configure Your App

Create a file `.env.local` in your project root:

```env
VITE_SUPABASE_URL=your_project_url_here
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

**IMPORTANT**: 
- Replace with YOUR actual values from Step 4
- Don't share these keys publicly
- Add `.env.local` to `.gitignore` (already done)

## ✅ Step 6: Install Dependencies

```bash
npm install @supabase/supabase-js
```

## 🚀 Step 7: Run Your App

```bash
npm run dev
```

## 🧪 Test the Database

After setup, you can verify in Supabase:

1. Go to **Table Editor**
2. You should see:
   - `transformers` table
   - `oil_tests` table
   - `documents` table

3. Go to **Storage**
4. You should see:
   - `transformer-documents` bucket

## 📊 Sample Data (Optional)

You can insert test data via SQL Editor:

```sql
-- Insert a sample transformer
INSERT INTO transformers (site_name, state, tx_name, mnemonic, serial_number, voltage, load_mva, maker, year_built, latitude, longitude)
VALUES 
('Substation Alpha', 'Selangor', 'TX-001', 'TXALP01', 'SN-2024-001', '132/33 kV', '60', 'ABB', '2020', 3.1390, 101.6869);

-- Get the transformer ID and insert sample oil test
-- (Replace 'transformer-id' with actual ID from above)
INSERT INTO oil_tests (transformer_id, test_date, test_type, breakdown, acidity, water_content, h2, ch4)
VALUES 
('transformer-id', '2024-02-01', 'Routine', 55.5, 0.12, 20, 45, 25);
```

## State Grouping Migration

If your `transformers` table already exists, run this once before saving manual state assignments from the app:

```sql
ALTER TABLE transformers
ADD COLUMN IF NOT EXISTS state TEXT;

CREATE INDEX IF NOT EXISTS idx_transformers_state ON transformers(state);
```

## DGA Workspace Preference Migration

If you want to persist each transformer's DGA workspace selections (insulating liquid, gas limit standard, and method view), run this once:

```sql
ALTER TABLE transformers
ADD COLUMN IF NOT EXISTS dga_oil_type TEXT,
ADD COLUMN IF NOT EXISTS dga_gas_limit_standard TEXT,
ADD COLUMN IF NOT EXISTS dga_method_view TEXT;
```

## Image Category Migration (Legacy Databases Only)

> **Note:** The main schema in Step 2 already includes the `image_category` column. This migration is **only for databases created before 2026-04-22** that are missing the column. If you just followed Step 2 on a fresh project, you can skip this section.

**Symptom you need this migration:**
If the app shows an error like `Could not find the 'image_category' column of 'documents' in the schema cache` (PostgREST error code `PGRST204`), run this SQL in the Supabase **SQL Editor**:

```sql
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS image_category TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'documents_image_category_check'
  ) THEN
    ALTER TABLE documents
    ADD CONSTRAINT documents_image_category_check
    CHECK (
      image_category IN (
        'name-plate',
        'transformer-design',
        'oil-level-design',
        'oltc-design',
        'buchholz-design',
        'other'
      )
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_documents_image_category
ON documents(image_category);
```

**After running:** If the error persists, reload the PostgREST schema cache at **Settings → API → Reload schema cache**, or wait ~30 seconds.

**Optional — backfill categories from older file names:**
Early uploads encoded the category in the file name as `imgcat-<category>--filename`. To migrate those into the new column, run:

```sql
UPDATE documents
SET image_category = lower(substring(file_name FROM '^imgcat-([a-z0-9-]+)--'))
WHERE image_category IS NULL
  AND file_name ~* '^imgcat-([a-z0-9-]+)--'
  AND lower(substring(file_name FROM '^imgcat-([a-z0-9-]+)--')) IN (
    'name-plate',
    'transformer-design',
    'oil-level-design',
    'oltc-design',
    'buchholz-design',
    'other'
  );
```

## 👤 Step 8: User Authentication & Asset-Access Control

> Added 2026-04-23. This adds username/password login (not Supabase Auth —
> kept as a custom flow so it stays consistent with the app's current
> anon-key usage) plus admin-managed per-user asset visibility.
>
> **Security model:** the anon key has **no direct read/write** on
> `app_users` or `user_asset_permissions`. All sensitive work runs inside
> `SECURITY DEFINER` RPCs that hash with `pgcrypto` server-side and never
> return `password_hash` / `salt` to the client.

### 8A. One-shot SQL to run in Supabase SQL Editor

Copy-paste this whole block once. It is idempotent — safe to re-run.

```sql
-- ──────────────────────────────────────────────────────────────
-- App users + asset permissions + hardened auth RPCs
-- (matches supabase/migrations/20260423000001_app_users_and_permissions.sql)
-- ──────────────────────────────────────────────────────────────

create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists "pgcrypto" with schema extensions;

-- Tables
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

create table if not exists public.user_asset_permissions (
  user_id        uuid not null references public.app_users(id)    on delete cascade,
  transformer_id uuid not null references public.transformers(id) on delete cascade,
  granted_at     timestamptz not null default now(),
  primary key (user_id, transformer_id)
);
create index if not exists idx_uap_user        on public.user_asset_permissions(user_id);
create index if not exists idx_uap_transformer on public.user_asset_permissions(transformer_id);

-- RLS ON, NO permissive policies → anon/authenticated have zero direct access
alter table public.app_users                enable row level security;
alter table public.user_asset_permissions   enable row level security;
revoke all on public.app_users              from anon, authenticated;
revoke all on public.user_asset_permissions from anon, authenticated;

-- Private helpers
create or replace function public._hash_password(p_salt text, p_password text)
returns text language sql immutable as $$
  select encode(extensions.digest(p_salt || ':' || p_password, 'sha256'), 'hex');
$$;
revoke all on function public._hash_password(text, text) from public;

create or replace function public._is_admin(p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1
    from public.app_users u
    where u.id = p_user_id
      and u.role = 'admin'
      and u.is_active
  );
$$;
revoke all on function public._is_admin(uuid) from public;

-- Public RPCs: sign-in & register
create or replace function public.verify_app_user(p_username text, p_password text)
returns table(id uuid, username text, full_name text, role text, is_active boolean)
language plpgsql security definer set search_path = public as $$
declare v_row public.app_users%rowtype; v_salt text; v_hash text;
begin
  p_username := lower(trim(p_username));
  -- First-run bootstrap: admin/admin creates the initial admin
  if p_username = 'admin' and p_password = 'admin'
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
  select * into v_row from public.app_users u where u.username = p_username;
  if not found or not v_row.is_active then return; end if;
  if public._hash_password(v_row.salt, p_password) <> v_row.password_hash then return; end if;
  return query select v_row.id, v_row.username, v_row.full_name, v_row.role, v_row.is_active;
end; $$;
revoke all on function public.verify_app_user(text, text) from public;

create or replace function public.register_app_user(
  p_username text, p_full_name text, p_password text
) returns table(id uuid, username text, full_name text, role text, is_active boolean)
language plpgsql security definer set search_path = public as $$
declare v_row public.app_users%rowtype; v_salt text; v_hash text;
begin
  p_username := lower(trim(p_username));
  if p_username !~ '^[a-z0-9_.\-]{3,32}$' then
    raise exception 'Username must be 3-32 chars (letters, digits, . _ -)'; end if;
  if length(p_password) < 6 then
    raise exception 'Password must be at least 6 characters'; end if;
  if exists (select 1 from public.app_users u where u.username = p_username) then
    raise exception 'That username is already taken'; end if;
  v_salt := encode(extensions.gen_random_bytes(16), 'hex');
  v_hash := public._hash_password(v_salt, p_password);
  insert into public.app_users (username, full_name, password_hash, salt, role, is_active)
  values (p_username, coalesce(nullif(trim(p_full_name), ''), p_username),
          v_hash, v_salt, 'user', true)
  returning * into v_row;
  return query select v_row.id, v_row.username, v_row.full_name, v_row.role, v_row.is_active;
end; $$;
revoke all on function public.register_app_user(text, text, text) from public, anon, authenticated;

-- Admin RPCs: user management
create or replace function public.admin_list_users(p_admin_id uuid)
returns table(id uuid, username text, full_name text, role text, is_active boolean, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public._is_admin(p_admin_id) then raise exception 'Admin privileges required'; end if;
  return query select u.id, u.username, u.full_name, u.role, u.is_active, u.created_at
               from public.app_users u order by u.created_at asc;
end; $$;
revoke all on function public.admin_list_users(uuid) from public;

create or replace function public.admin_create_user(
  p_admin_id uuid, p_username text, p_full_name text, p_password text, p_role text
) returns table(id uuid, username text, full_name text, role text, is_active boolean)
language plpgsql security definer set search_path = public as $$
declare v_row public.app_users%rowtype; v_salt text; v_hash text;
begin
  if not public._is_admin(p_admin_id) then raise exception 'Admin privileges required'; end if;
  if p_role not in ('admin','user','viewer') then raise exception 'Invalid role'; end if;
  p_username := lower(trim(p_username));
  if p_username !~ '^[a-z0-9_.\-]{3,32}$' then raise exception 'Invalid username'; end if;
  if length(p_password) < 6 then raise exception 'Password must be at least 6 characters'; end if;
  if exists (select 1 from public.app_users u where u.username = p_username) then
    raise exception 'That username is already taken'; end if;
  v_salt := encode(extensions.gen_random_bytes(16), 'hex');
  v_hash := public._hash_password(v_salt, p_password);
  insert into public.app_users (username, full_name, password_hash, salt, role, is_active)
  values (p_username, coalesce(nullif(trim(p_full_name), ''), p_username),
          v_hash, v_salt, p_role, true)
  returning * into v_row;
  return query select v_row.id, v_row.username, v_row.full_name, v_row.role, v_row.is_active;
end; $$;
revoke all on function public.admin_create_user(uuid, text, text, text, text) from public;

create or replace function public.admin_set_password(
  p_admin_id uuid, p_target_id uuid, p_new_password text
) returns void language plpgsql security definer set search_path = public as $$
declare v_salt text;
begin
  if not public._is_admin(p_admin_id) then raise exception 'Admin privileges required'; end if;
  if length(p_new_password) < 6 then raise exception 'Password must be at least 6 characters'; end if;
  v_salt := encode(extensions.gen_random_bytes(16), 'hex');
  update public.app_users
     set salt = v_salt, password_hash = public._hash_password(v_salt, p_new_password)
   where id = p_target_id;
end; $$;
revoke all on function public.admin_set_password(uuid, uuid, text) from public;

create or replace function public.admin_set_active(
  p_admin_id uuid, p_target_id uuid, p_is_active boolean
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public._is_admin(p_admin_id) then raise exception 'Admin privileges required'; end if;
  if p_admin_id = p_target_id and not p_is_active then
    raise exception 'You cannot disable your own account'; end if;
  update public.app_users set is_active = p_is_active where id = p_target_id;
end; $$;
revoke all on function public.admin_set_active(uuid, uuid, boolean) from public;

create or replace function public.admin_delete_user(
  p_admin_id uuid, p_target_id uuid
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public._is_admin(p_admin_id) then raise exception 'Admin privileges required'; end if;
  if p_admin_id = p_target_id then raise exception 'You cannot delete your own account'; end if;
  delete from public.app_users where id = p_target_id;
end; $$;
revoke all on function public.admin_delete_user(uuid, uuid) from public;

-- Admin RPCs: asset access
create or replace function public.admin_list_permissions(p_admin_id uuid)
returns table(user_id uuid, transformer_id uuid)
language plpgsql security definer set search_path = public as $$
begin
  if not public._is_admin(p_admin_id) then raise exception 'Admin privileges required'; end if;
  return query select p.user_id, p.transformer_id from public.user_asset_permissions p;
end; $$;
revoke all on function public.admin_list_permissions(uuid) from public;

create or replace function public.admin_grant_access(
  p_admin_id uuid, p_user_id uuid, p_transformer_id uuid
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public._is_admin(p_admin_id) then raise exception 'Admin privileges required'; end if;
  insert into public.user_asset_permissions (user_id, transformer_id)
  values (p_user_id, p_transformer_id) on conflict do nothing;
end; $$;
revoke all on function public.admin_grant_access(uuid, uuid, uuid) from public;

create or replace function public.admin_revoke_access(
  p_admin_id uuid, p_user_id uuid, p_transformer_id uuid
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public._is_admin(p_admin_id) then raise exception 'Admin privileges required'; end if;
  delete from public.user_asset_permissions
   where user_id = p_user_id and transformer_id = p_transformer_id;
end; $$;
revoke all on function public.admin_revoke_access(uuid, uuid, uuid) from public;

create or replace function public.admin_grant_many(
  p_admin_id uuid, p_user_id uuid, p_transformer_ids uuid[]
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public._is_admin(p_admin_id) then raise exception 'Admin privileges required'; end if;
  insert into public.user_asset_permissions (user_id, transformer_id)
    select p_user_id, unnest(p_transformer_ids) on conflict do nothing;
end; $$;
revoke all on function public.admin_grant_many(uuid, uuid, uuid[]) from public;

create or replace function public.admin_revoke_many(
  p_admin_id uuid, p_user_id uuid, p_transformer_ids uuid[]
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public._is_admin(p_admin_id) then raise exception 'Admin privileges required'; end if;
  delete from public.user_asset_permissions
   where user_id = p_user_id and transformer_id = any(p_transformer_ids);
end; $$;
revoke all on function public.admin_revoke_many(uuid, uuid, uuid[]) from public;

-- Self-service: a user reads their own accessible transformer IDs
create or replace function public.list_my_permissions(p_user_id uuid)
returns table(transformer_id uuid)
language sql security definer set search_path = public as $$
  select p.transformer_id from public.user_asset_permissions p where p.user_id = p_user_id;
$$;
revoke all on function public.list_my_permissions(uuid) from public;

create or replace function public.grant_self_transformer_access(
  p_user_id uuid, p_transformer_id uuid
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_asset_permissions (user_id, transformer_id)
  values (p_user_id, p_transformer_id)
  on conflict do nothing;
end; $$;
revoke all on function public.grant_self_transformer_access(uuid, uuid) from public;

-- Grants (only RPC calls are exposed to the client)
grant execute on function public.verify_app_user(text, text)                      to anon, authenticated;
grant execute on function public.admin_list_users(uuid)                           to anon, authenticated;
grant execute on function public.admin_create_user(uuid, text, text, text, text)  to anon, authenticated;
grant execute on function public.admin_set_password(uuid, uuid, text)             to anon, authenticated;
grant execute on function public.admin_set_active(uuid, uuid, boolean)            to anon, authenticated;
grant execute on function public.admin_delete_user(uuid, uuid)                    to anon, authenticated;
grant execute on function public.admin_list_permissions(uuid)                     to anon, authenticated;
grant execute on function public.admin_grant_access(uuid, uuid, uuid)             to anon, authenticated;
grant execute on function public.admin_revoke_access(uuid, uuid, uuid)            to anon, authenticated;
grant execute on function public.admin_grant_many(uuid, uuid, uuid[])             to anon, authenticated;
grant execute on function public.admin_revoke_many(uuid, uuid, uuid[])            to anon, authenticated;
grant execute on function public.list_my_permissions(uuid)                        to anon, authenticated;
grant execute on function public.grant_self_transformer_access(uuid, uuid)        to anon, authenticated;
```

### 8B. Alternative — apply via Supabase CLI

If you have the Supabase CLI linked (`npm run db:link` was used in this repo), the same SQL is already committed at:

```
supabase/migrations/20260423000001_app_users_and_permissions.sql
```

Push it to your remote project with:

```bash
npm run db:push
```

### 8C. First login

1. Start the dev server: `npm run dev`
2. On the login screen, enter **`admin`** / **`admin`**.
   The `verify_app_user` RPC detects no admin exists and creates the initial administrator inside the function.
3. Open **Settings → Users** and click the key icon to change the admin password immediately.
4. Create all pilot accounts from **Settings → Users**. Public self-registration is disabled.
5. Still in **Settings**, switch to **Asset Access** to tick which transformers each user can see.

### 8D. How to verify the lock is working

> ⚠️ **Do NOT run these in the Supabase SQL Editor.** The SQL Editor
> runs as the `postgres` superuser, which bypasses RLS and grants —
> these queries will succeed there and give you a false result (and
> can actually insert/delete rows in the table).
>
> To verify the lock you need to run them **as the anon role** —
> either from the app's DevTools console, or from `psql` with the
> anon JWT. Using the app's console:

```js
// Paste into the browser DevTools console while the app is running.
// All four should throw "permission denied for table app_users".
await window.__supabase__?.from('app_users').select('*');
await window.__supabase__?.from('app_users').select('password_hash');
await window.__supabase__?.from('app_users').insert({ username: 'x', password_hash: 'x', salt: 'x' });
await window.__supabase__?.from('app_users').delete().eq('username', 'x');
```

(If `window.__supabase__` isn't exposed, import the client in a quick
test component or use the Supabase REST URL with your anon key in `curl`.)

Only the RPC surface is exposed to the `anon` role — table access is denied.

### 8E. Resetting the admin password if you forget it

If you lose the admin password, run this once in the SQL Editor (replace the literal `'new-password-here'`):

```sql
update public.app_users
   set salt = encode(extensions.gen_random_bytes(16), 'hex')
 where username = 'admin'
returning id, username;

update public.app_users
   set password_hash = public._hash_password(salt, 'new-password-here')
 where username = 'admin';
```

### 8F. Table & RPC cheat-sheet

| Object                              | Purpose                                              |
| ----------------------------------- | ---------------------------------------------------- |
| `app_users`                         | credentials + role + active flag                     |
| `user_asset_permissions`            | which transformers a user can see                    |
| `verify_app_user(u,p)`              | sign-in; bootstraps `admin/admin` once               |
| `register_app_user(u,n,p)`          | available in SQL only; public execute is revoked     |
| `admin_list_users(a)`               | list all users (admin only)                          |
| `admin_create_user(a,u,n,p,r)`      | create user with role                                |
| `admin_set_password(a,t,p)`         | reset a user's password                              |
| `admin_set_active(a,t,b)`           | enable / disable a user                              |
| `admin_delete_user(a,t)`            | hard-delete user                                     |
| `admin_list_permissions(a)`         | list all (user → transformer) pairs                  |
| `admin_grant_access(a,u,t)`         | grant one transformer to a user                      |
| `admin_revoke_access(a,u,t)`        | revoke one transformer from a user                   |
| `admin_grant_many(a,u,ids[])`       | bulk grant                                           |
| `admin_revoke_many(a,u,ids[])`      | bulk revoke                                          |
| `list_my_permissions(u)`            | a signed-in user fetches their own visible assets    |
| `grant_self_transformer_access(u,t)`| after self-create, make the new asset visible to user|

---

## 🔒 Security Notes (Production)

For production use, you should:

1. **Restrict RLS policies** to authenticated users only
2. **Add authentication** (Supabase has built-in auth)
3. **Secure storage bucket** with proper policies
4. **Use service role key** only on backend
5. **Never commit** .env.local to Git

## 🆘 Troubleshooting

### Issue: "relation does not exist"
**Fix**: Make sure you ran all SQL in Step 2

### Issue: "Storage bucket not found"
**Fix**: Create the bucket in Step 3

### Issue: "Row Level Security" errors
**Fix**: Check if policies are enabled in SQL (Step 2)

### Issue: Can't upload files
**Fix**: Check storage bucket policies are set correctly

### Issue: CORS errors
**Fix**: Supabase handles CORS automatically, check your API keys

### Issue: `Could not find the '<column>' column of '<table>' in the schema cache` (PGRST204)
**Fix**: Your database is missing a column the app expects. Run the matching migration section above (e.g. **Image Category Migration**, **State Grouping Migration**, or **DGA Workspace Preference Migration**), then reload the schema at **Settings → API → Reload schema cache**.

## 📚 Useful Supabase Dashboard Links

- **Table Editor**: View/edit data directly
- **SQL Editor**: Run custom queries
- **Storage**: Manage uploaded files
- **API Docs**: Auto-generated API documentation
- **Logs**: Debug errors and monitor usage

## 🎉 You're Ready!

Your app is now connected to PostgreSQL via Supabase. All data will be stored in the cloud and accessible from anywhere!

---

**Next Steps**: Follow the INTEGRATION_GUIDE.md to understand how the app uses Supabase.
