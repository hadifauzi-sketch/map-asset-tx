import React, { useState } from 'react';
import { User, Lock, IdCard, Loader2, AlertTriangle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { cn } from '../../lib/utils';

/**
 * Register a new account via the `register_app_user` RPC. Hashing and
 * validation happen server-side; the anon client never touches
 * password_hash / salt. New accounts are always created with role='user'
 * and require an admin to grant asset access afterwards.
 */

export async function registerAccount({ username, fullName, password }) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
  const { data, error } = await supabase.rpc('register_app_user', {
    p_username: username,
    p_full_name: fullName,
    p_password: password,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

function Register({ onSuccess, onNavigateSignIn }) {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setError(null);

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const user = await registerAccount({ username, fullName, password });
      setDone(true);
      onSuccess?.(user);
    } catch (err) {
      setError(err.message || 'Unable to register.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <form
        onSubmit={handleSubmit}
        className={cn(
          'relative w-full max-w-[460px] rounded-2xl border border-white/10 p-8 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl',
          'bg-[linear-gradient(160deg,rgba(52,177,155,0.42),rgba(15,118,110,0.55))]'
        )}
      >
        <button
          type="button"
          onClick={onNavigateSignIn}
          className="mb-5 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 transition hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Login
        </button>

        <h1 className="mb-8 text-center text-lg font-semibold uppercase tracking-[0.32em] text-white/95">
          Create Account
        </h1>

        <Field icon={IdCard} placeholder="Full Name" value={fullName} onChange={setFullName} autoComplete="name" required />
        <Field icon={User} placeholder="Username" value={username} onChange={setUsername} autoComplete="username" required />
        <Field icon={Lock} placeholder="Password" type="password" value={password} onChange={setPassword} autoComplete="new-password" required />
        <Field icon={Lock} placeholder="Confirm Password" type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" required />

        {error ? (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-red-300/30 bg-red-900/30 px-3 py-2 text-xs text-red-100">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {done ? (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-emerald-300/30 bg-emerald-900/30 px-3 py-2 text-xs text-emerald-100">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>Account created. An administrator must assign asset access before you can see data.</span>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={submitting || done}
          className="mt-5 flex h-12 w-full items-center justify-center rounded-md bg-[#34b19b] text-sm font-semibold uppercase tracking-[0.32em] text-[#0b2a25] shadow-sm transition hover:bg-[#2f9f8b] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : done ? 'Registered' : 'Create Account'}
        </button>

        <div className="mt-4 text-center text-xs text-white/80">
          Already a member?{' '}
          <button type="button" onClick={onNavigateSignIn} className="font-semibold text-white underline-offset-4 hover:underline">
            Sign In
          </button>
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
      `}</style>
    </div>
  );
}

function Field({ icon: Icon, value, onChange, type = 'text', ...props }) {
  return (
    <div className="mb-3 flex items-stretch overflow-hidden rounded-lg border border-white/10 bg-black/30 focus-within:ring-2 focus-within:ring-white/40">
      <span className="flex w-11 items-center justify-center bg-black/30 text-white/80">
        <Icon className="h-4 w-4" />
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 flex-1 bg-transparent px-3 text-sm text-white placeholder:text-white/55 focus:outline-none"
        {...props}
      />
    </div>
  );
}

export { Register };
export default Register;
