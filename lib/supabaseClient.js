import { createClient } from '@supabase/supabase-js';

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Feature flag for the security cutover. When '1', the app authenticates
// through Supabase Auth so that every PostgREST request carries a real user
// JWT and the database RLS (keyed to auth.uid()) enforces access. Leave it
// OFF until migrations 20261121000001 (link) and 20261121000002
// (auto-provision) have been applied — see
// MIGRATION_SUPABASE_AUTH.md. With the flag off, the legacy verify_app_user
// login is used (unchanged behaviour).
export const USE_SUPABASE_AUTH = import.meta.env.VITE_USE_SUPABASE_AUTH === '1';

// Synthetic-email domain for username-based login under Supabase Auth. Must
// match public._auth_email() in migration 20261121000002 ('asset.local'),
// which creates the logins automatically on first sign-in / Add user.
export const AUTH_EMAIL_DOMAIN = (import.meta.env.VITE_AUTH_EMAIL_DOMAIN || 'asset.local').replace(/^@/, '');
export const usernameToEmail = (username) =>
  `${String(username || '').toLowerCase().trim()}@${AUTH_EMAIL_DOMAIN}`;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables!');
  console.error('Please create .env.local file with:');
  console.error('VITE_SUPABASE_URL=your_project_url');
  console.error('VITE_SUPABASE_ANON_KEY=your_anon_key');
}

// Create Supabase client. Under Supabase Auth we must persist and auto-refresh
// the session so the JWT stays valid; otherwise sessions are not kept.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: USE_SUPABASE_AUTH,
    autoRefreshToken: USE_SUPABASE_AUTH,
    detectSessionInUrl: false,
    storageKey: 'asset-tx-auth',
  },
});

// Export for debugging
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);
