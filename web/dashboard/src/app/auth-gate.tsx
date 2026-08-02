import { useState, type FormEvent } from 'react';
import { api } from '@/api/client';
import { useSessionStore } from '@/app/session-store';
import { Button } from '@/ui/patterns';

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-wt-bg0 px-4 py-10 text-wt-text">
      <div className="w-full max-w-md rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1 p-6 shadow-[var(--wt-shadow)]">
        <div className="mb-5 flex items-center gap-3">
          <img src="./assets/watchtower-icon-simple.png" alt="" width={36} height={36} className="rounded-lg" />
          <div>
            <div className="font-semibold tracking-tight">WatchTower</div>
            <div className="text-xs text-wt-text-low">Server ops dashboard</div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function fieldClass() {
  return 'mt-1 w-full rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg2 px-3 py-2 text-sm outline-none focus-visible:border-wt-accent focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--wt-accent)_35%,transparent)]';
}

export function AuthGate() {
  const gate = useSessionStore((s) => s.gate);
  const applyAuthResult = useSessionStore((s) => s.applyAuthResult);
  const resumeAfterAuth = useSessionStore((s) => s.resumeAfterAuth);
  const bootError = useSessionStore((s) => s.bootError);

  async function continueAfter(result: Record<string, unknown>) {
    const next = applyAuthResult(result);
    if (next === 'none') {
      await resumeAfterAuth();
    }
  }

  if (gate === 'totp') return <TotpFrame onDone={continueAfter} />;
  if (gate === 'password-change') return <PasswordChangeFrame onDone={continueAfter} />;
  return <LoginFrame onDone={continueAfter} bootError={bootError} />;
}

function LoginFrame({
  onDone,
  bootError,
}: {
  onDone: (r: Record<string, unknown>) => Promise<void>;
  bootError: string | null;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(bootError);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await api.login(username, password, remember);
      await onDone(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (/429|rate|lock|too many|try again later/i.test(msg)) {
        setError('Too many sign-in attempts. Wait about 15 minutes, then try again.');
      } else {
        setError(msg || 'Sign-in failed. Check your username and password.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <form className="grid gap-3" onSubmit={handleSubmit} noValidate>
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="text-sm text-wt-text-mid">WatchTower dashboard</p>
        <p className="text-xs text-wt-text-low">
          Default login: <code className="rounded bg-wt-bg2 px-1">watchtower</code> /{' '}
          <code className="rounded bg-wt-bg2 px-1">password</code> — change after first sign-in
        </p>
        <label className="text-sm">
          Username
          <input
            className={fieldClass()}
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            spellCheck={false}
            required
          />
        </label>
        <label className="text-sm">
          Password
          <input
            type="password"
            className={fieldClass()}
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-wt-text-mid">
          <input
            type="checkbox"
            name="remember"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          Remember me
        </label>
        {error ? (
          <p className="text-sm text-wt-danger" role="alert">
            {error}
          </p>
        ) : null}
        <Button kind="primary" type="submit" disabled={loading || !username || !password}>
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthShell>
  );
}

function TotpFrame({ onDone }: { onDone: (r: Record<string, unknown>) => Promise<void> }) {
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await api.totp(code.trim(), recovery);
      await onDone(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <form className="grid gap-3" onSubmit={handleSubmit} noValidate>
        <h1 className="text-xl font-semibold">Two-factor authentication</h1>
        <p className="text-sm text-wt-text-mid">
          {recovery
            ? 'Enter a recovery code.'
            : 'Enter the 6-digit code from your authenticator app.'}
        </p>
        <label className="text-sm">
          {recovery ? 'Recovery code' : 'Authenticator code'}
          <input
            className={fieldClass()}
            name={recovery ? 'recovery' : 'totp'}
            value={code}
            onChange={(e) => {
              const raw = e.target.value || '';
              setCode(recovery ? raw.trim() : raw.replace(/\s+/g, ''));
            }}
            autoComplete="one-time-code"
            inputMode={recovery ? 'text' : 'numeric'}
            maxLength={recovery ? 32 : 8}
            placeholder={recovery ? 'Paste a recovery code' : '000000'}
            required
          />
        </label>
        <button
          type="button"
          className="justify-self-start text-sm text-wt-accent hover:underline"
          onClick={() => {
            setRecovery((v) => !v);
            setCode('');
          }}
        >
          {recovery ? 'Use authenticator code' : 'Use a recovery code'}
        </button>
        {error ? (
          <p className="text-sm text-wt-danger" role="alert">
            {error}
          </p>
        ) : null}
        <Button kind="primary" type="submit" disabled={loading || !code}>
          {loading ? 'Verifying…' : 'Continue'}
        </Button>
      </form>
    </AuthShell>
  );
}

function PasswordChangeFrame({
  onDone,
}: {
  onDone: (r: Record<string, unknown>) => Promise<void>;
}) {
  const [username, setUsername] = useState('');
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usernameTrim = username.trim();
  const usernameOk =
    usernameTrim.length >= 3 &&
    usernameTrim.length <= 32 &&
    /^[a-zA-Z0-9_-]+$/.test(usernameTrim) &&
    usernameTrim.toLowerCase() !== 'watchtower';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (!usernameOk) {
      setError('Choose a new username (3–32 chars, letters/numbers/_/-, not “watchtower”).');
      return;
    }
    setLoading(true);
    try {
      const result = await api.changePassword(current, password, usernameTrim);
      await onDone({
        ...result,
        authenticated: true,
        username: result?.username || usernameTrim,
        must_change_password: false,
        fully_authenticated: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Account update failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <form className="grid gap-3" onSubmit={handleSubmit} noValidate>
        <h1 className="text-xl font-semibold">Set up your account</h1>
        <p className="text-sm text-wt-text-mid">
          Choose a new username and password before continuing. Default login is only for first
          access.
        </p>
        <label className="text-sm">
          New username
          <input
            className={fieldClass()}
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            spellCheck={false}
            required
          />
        </label>
        <label className="text-sm">
          Current password
          <input
            type="password"
            className={fieldClass()}
            name="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <label className="text-sm">
          New password
          <input
            type="password"
            className={fieldClass()}
            name="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
        <label className="text-sm">
          Confirm password
          <input
            type="password"
            className={fieldClass()}
            name="confirm-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
        {error ? (
          <p className="text-sm text-wt-danger" role="alert">
            {error}
          </p>
        ) : null}
        <Button
          kind="primary"
          type="submit"
          disabled={loading || !usernameOk || !current || password.length < 8 || !confirm}
        >
          {loading ? 'Saving…' : 'Save and continue'}
        </Button>
      </form>
    </AuthShell>
  );
}
