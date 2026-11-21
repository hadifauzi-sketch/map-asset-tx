#!/usr/bin/env node
/**
 * One-time migration helper: create a Supabase Auth user (auth.users) for
 * every existing row in public.app_users, and back-fill app_users.auth_user_id
 * so RLS (which keys off auth.uid()) can match them.
 *
 * Existing passwords CANNOT be carried over — the old scheme stored only a
 * fast salted SHA-256, which is not reversible and is not the format Supabase
 * Auth expects. Each user therefore gets a fresh random temporary password,
 * printed ONCE by this script. Distribute them securely and have users change
 * their password (or wire up password reset). Admins can also reset any
 * password from Settings after the cutover.
 *
 * Usage (PowerShell):
 *   $env:SUPABASE_URL="https://<ref>.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY="<service-role key — keep secret, never commit>"
 *   $env:AUTH_EMAIL_DOMAIN="asset.local"   # optional, default below
 *   node scripts/link-supabase-auth-users.mjs            # dry run (lists plan)
 *   node scripts/link-supabase-auth-users.mjs --apply    # actually create
 *
 * Run this against a Supabase BRANCH first. The service-role key bypasses RLS,
 * so run it only from your own machine and never ship it to the browser.
 */
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';

const URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DOMAIN = (process.env.AUTH_EMAIL_DOMAIN || 'asset.local').replace(/^@/, '');
const APPLY = process.argv.includes('--apply');

if (!URL || !SERVICE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment first.');
  process.exit(1);
}

// username -> synthetic email. Supabase Auth is email-based; usernames become
// <username>@<domain>. Keep the domain stable across runs.
const emailFor = (username) => `${String(username).toLowerCase().trim()}@${DOMAIN}`;
const tempPassword = () => randomBytes(12).toString('base64url'); // ~16 chars

const admin = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: users, error } = await admin
    .from('app_users')
    .select('id, username, full_name, role, is_active, auth_user_id')
    .order('created_at', { ascending: true });
  if (error) throw error;

  console.log(`Found ${users.length} app_users. Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}  Domain: @${DOMAIN}\n`);
  const created = [];

  for (const u of users) {
    if (u.auth_user_id) {
      console.log(`skip  ${u.username.padEnd(20)} already linked (${u.auth_user_id})`);
      continue;
    }
    const email = emailFor(u.username);
    if (!APPLY) {
      console.log(`plan  ${u.username.padEnd(20)} -> ${email}  role=${u.role}`);
      continue;
    }

    const pw = tempPassword();
    const { data: authUser, error: cErr } = await admin.auth.admin.createUser({
      email,
      password: pw,
      email_confirm: true,
      user_metadata: { username: u.username, app_user_id: u.id },
    });
    if (cErr) {
      console.error(`FAIL  ${u.username}: ${cErr.message}`);
      continue;
    }
    const { error: uErr } = await admin
      .from('app_users')
      .update({ auth_user_id: authUser.user.id })
      .eq('id', u.id);
    if (uErr) {
      console.error(`FAIL  linking ${u.username}: ${uErr.message}`);
      continue;
    }
    created.push({ username: u.username, email, tempPassword: pw });
    console.log(`ok    ${u.username.padEnd(20)} -> ${email}`);
  }

  if (APPLY && created.length) {
    console.log('\n=== TEMPORARY PASSWORDS (store securely, then rotate) ===');
    for (const c of created) {
      console.log(`${c.username.padEnd(20)} ${c.email.padEnd(32)} ${c.tempPassword}`);
    }
    console.log('========================================================');
  }
  if (!APPLY) console.log('\nDry run only. Re-run with --apply to create the auth users.');
}

main().catch((e) => { console.error(e); process.exit(1); });
