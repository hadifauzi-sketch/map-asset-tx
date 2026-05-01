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
export const SESSION_IDLE_TIMEOUT_MS = 8 * 60 * 60 * 1000;
const SESSION_ACTIVITY_WRITE_INTERVAL_MS = 60 * 1000;

function writeSessionRecord(user, lastActivityAt = Date.now()) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        user,
        lastActivityAt,
      })
    );
  } catch {
    /* ignore quota / privacy errors */
  }
}

function readSessionRecord() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    if (
      Object.prototype.hasOwnProperty.call(parsed, 'user') &&
      Object.prototype.hasOwnProperty.call(parsed, 'lastActivityAt')
    ) {
      return {
        user: parsed.user,
        lastActivityAt: Number(parsed.lastActivityAt),
        isLegacy: false,
      };
    }

    return {
      user: parsed,
      lastActivityAt: Date.now(),
      isLegacy: true,
    };
  } catch {
    return null;
  }
}

export function hasSessionExpired(lastActivityAt, now = Date.now()) {
  if (!Number.isFinite(lastActivityAt)) {
    return true;
  }

  return now - lastActivityAt >= SESSION_IDLE_TIMEOUT_MS;
}

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
  writeSessionRecord(user);
}

export function readSession() {
  const sessionRecord = readSessionRecord();
  if (!sessionRecord) {
    return null;
  }

  if (hasSessionExpired(sessionRecord.lastActivityAt)) {
    clearSession();
    return null;
  }

  if (sessionRecord.isLegacy) {
    writeSessionRecord(sessionRecord.user);
  }

  return sessionRecord.user;
}

export function touchSessionActivity(force = false) {
  const sessionRecord = readSessionRecord();
  if (!sessionRecord) {
    return false;
  }

  const now = Date.now();
  if (hasSessionExpired(sessionRecord.lastActivityAt, now)) {
    clearSession();
    return false;
  }

  if (!force && now - sessionRecord.lastActivityAt < SESSION_ACTIVITY_WRITE_INTERVAL_MS) {
    return true;
  }

  writeSessionRecord(sessionRecord.user, now);
  return true;
}

export function getSessionIdleRemainingMs() {
  const sessionRecord = readSessionRecord();
  if (!sessionRecord) {
    return null;
  }

  const now = Date.now();
  if (hasSessionExpired(sessionRecord.lastActivityAt, now)) {
    clearSession();
    return 0;
  }

  return SESSION_IDLE_TIMEOUT_MS - (now - sessionRecord.lastActivityAt);
}

export function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function SignIn({ onSuccess, onForgotPassword, infoMessage }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [isTermsOpen, setIsTermsOpen] = useState(false);

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

        {infoMessage ? (
          <div className="relative mt-3 flex items-start gap-2 rounded-lg border border-amber-300/20 bg-amber-900/25 px-3 py-2 text-xs text-amber-100 backdrop-blur-sm">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>{infoMessage}</span>
          </div>
        ) : null}

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

        <div className="relative mt-4 space-y-2 text-center text-xs text-white/55">
          <p>
            Developed by{' '}
            <a
              href="https://www.linkedin.com/in/chm-hadi-fauzi/"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-white/85 underline-offset-4 hover:text-white hover:underline"
            >
              ChM. Ts. Hadi Fauzi, MRSC
            </a>
          </p>
          <button
            type="button"
            onClick={() => setIsTermsOpen(true)}
            className="text-white/75 underline-offset-4 hover:text-white hover:underline"
          >
            Terms & Conditions
          </button>
        </div>
      </form>

      {isTermsOpen ? (
        <div className="auth-terms-overlay" role="presentation" onClick={() => setIsTermsOpen(false)}>
          <div
            className="auth-terms-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-terms-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="auth-terms-header">
              <div>
                <p className="auth-terms-eyebrow">Beta notice</p>
                <h2 id="auth-terms-title">Terms & Conditions</h2>
              </div>
              <button
                type="button"
                className="auth-terms-close"
                onClick={() => setIsTermsOpen(false)}
                aria-label="Close terms and conditions"
              >
                x
              </button>
            </div>

            <div className="auth-terms-body">
              <p>
                This app is a beta/trial version and is still under testing. If you find any issue or
                bug, please contact the developer.
              </p>
              <p>
                This app is built with open-source technologies, including JavaScript, TypeScript, SQL
                databases, OpenStreetMap, and Leaflet. IEC, IEEE, and journal-based methods remain
                subject to their original licensed or paid sources.
              </p>
              <p>
                The app design and workflow were developed by{' '}
                <a
                  href="https://www.linkedin.com/in/chm-hadi-fauzi/"
                  target="_blank"
                  rel="noreferrer"
                >
                  ChM. Ts. Hadi Fauzi, MRSC
                </a>
                .
              </p>
              <p>
                This app is still being verified and tested by engineers, chemists, and technical
                experts before release.
              </p>
            </div>
          </div>
        </div>
      ) : null}

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
            radial-gradient(circle at 85% 80%, rgba(0,94,166,0.34), transparent 55%),
            linear-gradient(135deg, #101715 0%, #15342a 52%, #062a4b 100%);
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
        .auth-terms-overlay {
          position: fixed;
          inset: 0;
          z-index: 70;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: rgba(0,0,0,0.56);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }
        .auth-terms-modal {
          position: relative;
          width: min(92vw, 560px);
          border: 1px solid rgba(255,255,255,0.16);
          border-radius: 18px;
          background: rgba(20,28,25,0.92);
          box-shadow: 0 24px 80px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.86);
          overflow: hidden;
        }
        .auth-terms-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          border-bottom: 1px solid rgba(255,255,255,0.10);
          padding: 20px 22px 16px;
        }
        .auth-terms-eyebrow {
          margin: 0 0 6px;
          color: rgba(255,255,255,0.50);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }
        .auth-terms-header h2 {
          margin: 0;
          color: rgba(255,255,255,0.95);
          font-size: 20px;
          font-weight: 700;
        }
        .auth-terms-close {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 10px;
          background: rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.82);
          cursor: pointer;
          font-size: 18px;
          line-height: 1;
        }
        .auth-terms-close:hover {
          background: rgba(255,255,255,0.14);
          color: #fff;
        }
        .auth-terms-body {
          display: grid;
          gap: 12px;
          padding: 18px 22px 22px;
          font-size: 13px;
          line-height: 1.65;
        }
        .auth-terms-body p {
          margin: 0;
        }
        .auth-terms-body a {
          color: rgba(255,255,255,0.95);
          font-weight: 600;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
      `}</style>
    </div>
  );
}

export { SignIn };
export default SignIn;
