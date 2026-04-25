import React, { useState } from 'react';
import { Lock, User, Loader2, AlertTriangle } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { cn } from '../../lib/utils';

/**
 * Username / password sign-in — all credential work runs server-side
 * in `verify_app_user(p_username, p_password)` (see supabase migration
 * 20260423000001_app_users_and_permissions.sql). The anon key never
 * touches password_hash / salt.
 *
 * Bootstrap: if no admin row exists yet, the first `admin / admin`
 * attempt creates the administrator inside the RPC.
 */

const SESSION_STORAGE_KEY = 'asset-tx-map-session';

export async function authenticate(username, password) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }

  const { data, error } = await supabase.rpc('verify_app_user', {
    p_username: username,
    p_password: password,
  });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('Invalid username or password.');
  return row;
}

export function persistSession(user) {
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
  } catch {
    /* ignore quota / privacy errors */
  }
}

export function readSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function SignIn({ onSuccess, onForgotPassword }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const user = await authenticate(username.trim(), password);
      persistSession(user);
      onSuccess?.(user);
    } catch (err) {
      setError(err.message || 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-[400px] rounded-2xl p-8"
        style={{
          background: 'rgba(255,255,255,0.07)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.15)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.12)',
        }}
      >
        {/* glass sheen */}
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.02) 60%, transparent 100%)',
          }}
        />

        <h1 className="relative mb-8 text-center text-2xl font-light tracking-[0.18em] text-white/95">
          Login
        </h1>

        <div
          className="relative mb-4 flex items-stretch overflow-hidden rounded-xl focus-within:ring-2 focus-within:ring-white/30"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
        >
          <span className="flex w-11 items-center justify-center text-white/60">
            <User className="h-4 w-4" />
          </span>
          <input
            type="text"
            name="username"
            autoComplete="username"
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Username"
            className="h-11 flex-1 bg-transparent px-3 text-sm text-white placeholder:text-white/40 focus:outline-none"
          />
        </div>

        <div
          className="relative mb-2 flex items-stretch overflow-hidden rounded-xl focus-within:ring-2 focus-within:ring-white/30"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
        >
          <span className="flex w-11 items-center justify-center text-white/60">
            <Lock className="h-4 w-4" />
          </span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            className="h-11 flex-1 bg-transparent px-3 text-sm text-white placeholder:text-white/40 focus:outline-none"
          />
        </div>

        {error ? (
          <div className="relative mt-3 flex items-start gap-2 rounded-lg border border-red-300/20 bg-red-900/25 px-3 py-2 text-xs text-red-200 backdrop-blur-sm">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="relative mt-6 flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold tracking-[0.18em] text-[#1a1a1a] shadow-lg transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(220,240,235,0.90) 100%)' }}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'LOGIN'}
        </button>

        <div className="relative mt-4 text-center text-xs text-white/55">
          Forgot Password?{' '}
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-white/80 underline-offset-4 hover:text-white hover:underline"
          >
            Click Here
          </button>
        </div>

        <div className="relative my-5 h-px w-full" style={{ background: 'rgba(255,255,255,0.10)' }} />

        <div
          className="relative rounded-xl px-4 py-3 text-center text-xs text-white/50"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          Accounts are created by an administrator in Settings.
        </div>
      </form>

      <style>{`
        .auth-shell {
          position: fixed;
          inset: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background:
            radial-gradient(circle at 15% 20%, rgba(52,177,155,0.22), transparent 55%),
            radial-gradient(circle at 85% 80%, rgba(120,20,60,0.32), transparent 55%),
            linear-gradient(135deg, #141614 0%, #1a2a25 55%, #2a0f1f 100%);
        }
        .auth-shell::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image:
            radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,0.25), transparent 50%),
            radial-gradient(1px 1px at 72% 18%, rgba(255,255,255,0.2), transparent 50%),
            radial-gradient(1px 1px at 40% 75%, rgba(255,255,255,0.2), transparent 50%),
            radial-gradient(1px 1px at 88% 60%, rgba(255,255,255,0.18), transparent 50%);
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}

export { SignIn };
export default SignIn;
