import { html } from '../lib/preact.js';
import { useState } from '../lib/preact.js';
import { auth, setUi } from '../state/stores.js';
import { login, totp, changePassword } from '../api/endpoints.js';
import { resumeAfterAuth } from './session-boot.js';
import { Button } from '../ui/primitives/button.js';
import { TextField } from '../ui/primitives/text-field.js';
import { PasswordField } from '../ui/primitives/password-field.js';
import { Toggle } from '../ui/primitives/toggle.js';
import { Card } from '../ui/primitives/card.js';
import { Stack } from '../ui/primitives/stack.js';

// ── Login frame ────────────────────────────────────────────────────────────────

function LoginFrame() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await login(username, password, remember);
      if (result?.gate) {
        auth.value = { ...auth.value, gate: result.gate, session: result };
      } else {
        auth.value = { ...auth.value, gate: 'none', session: result };
        setUi({ bootPhase: 'loading' });
        await resumeAfterAuth();
      }
    } catch (err) {
      setError(err?.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  return html`
    <form class="ui-auth-frame" onSubmit=${handleSubmit} novalidate>
      <h1 class="ui-auth-frame__title">Sign in</h1>
      <p class="ui-auth-frame__sub">WatchTower dashboard</p>
      <p class="ui-auth-frame__hint">
        Default login: <code>watchtower</code> / <code>password</code>
        <span class="ui-auth-frame__hint-note"> — change this after first sign-in</span>
      </p>

      <${Stack} gap="12">
        <${TextField}
          label="Username"
          value=${username}
          onInput=${(e) => setUsername(e.target.value)}
          autocomplete="username"
          required
        />
        <${PasswordField}
          label="Password"
          value=${password}
          onInput=${(e) => setPassword(e.target.value)}
          autocomplete="current-password"
          required
        />
        <${Toggle}
          label="Remember me"
          checked=${remember}
          onChange=${setRemember}
        />
        ${error ? html`<p class="ui-auth-frame__error" role="alert">${error}</p>` : null}
        <${Button}
          kind="primary"
          type="submit"
          loading=${loading}
          disabled=${!username || !password}
        >
          Sign in
        </${Button}>
      </${Stack}>
    </form>
  `;
}

// ── TOTP frame ────────────────────────────────────────────────────────────────

function TotpFrame() {
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await totp(code.trim(), recovery);
      if (result?.gate) {
        auth.value = { ...auth.value, gate: result.gate, session: result };
      } else {
        auth.value = { ...auth.value, gate: 'none', session: result };
        setUi({ bootPhase: 'loading' });
        await resumeAfterAuth();
      }
    } catch (err) {
      setError(err?.message || 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return html`
    <form class="ui-auth-frame" onSubmit=${handleSubmit} novalidate>
      <h1 class="ui-auth-frame__title">Two-factor authentication</h1>
      <p class="ui-auth-frame__sub">
        ${recovery
          ? 'Enter a recovery code.'
          : 'Enter the 6-digit code from your authenticator app.'}
      </p>

      <${Stack} gap="12">
        <${TextField}
          label=${recovery ? 'Recovery code' : 'Authenticator code'}
          value=${code}
          onInput=${(e) => setCode(e.target.value)}
          autocomplete="one-time-code"
          inputmode="numeric"
          pattern="[0-9]*"
          maxlength=${recovery ? 32 : 6}
          required
        />
        ${error ? html`<p class="ui-auth-frame__error" role="alert">${error}</p>` : null}
        <${Button}
          kind="primary"
          type="submit"
          loading=${loading}
          disabled=${!code.trim()}
        >
          Verify
        </${Button}>
        <button
          type="button"
          class="ui-auth-frame__link"
          onClick=${() => { setRecovery(!recovery); setCode(''); setError(null); }}
        >
          ${recovery ? 'Use authenticator app instead' : 'Use recovery code'}
        </button>
      </${Stack}>
    </form>
  `;
}

// ── Password change frame ─────────────────────────────────────────────────────

function PasswordChangeFrame() {
  const session = auth.value.session || {};
  const [username, setUsername] = useState('');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const mismatch = next && confirm && next !== confirm;
  const usernameTrim = username.trim();
  const usernameOk = usernameTrim.length >= 3
    && usernameTrim.length <= 32
    && /^[a-zA-Z0-9_-]+$/.test(usernameTrim)
    && usernameTrim.toLowerCase() !== 'watchtower';

  async function handleSubmit(e) {
    e.preventDefault();
    if (mismatch || !usernameOk) return;
    setError(null);
    setLoading(true);
    try {
      const result = await changePassword(current, next, usernameTrim);
      auth.value = {
        ...auth.value,
        gate: 'none',
        session: {
          ...session,
          username: result?.username || usernameTrim,
          must_change_password: false,
          fully_authenticated: true,
        },
      };
      setUi({ bootPhase: 'loading' });
      await resumeAfterAuth();
    } catch (err) {
      setError(err?.message || 'Account update failed.');
    } finally {
      setLoading(false);
    }
  }

  return html`
    <form class="ui-auth-frame" onSubmit=${handleSubmit} novalidate>
      <h1 class="ui-auth-frame__title">Set up your account</h1>
      <p class="ui-auth-frame__sub">
        Choose a new username and password before continuing. Default login is only for first access.
      </p>

      <${Stack} gap="12">
        <${TextField}
          label="New username"
          value=${username}
          onInput=${(e) => setUsername(e.target.value)}
          autocomplete="username"
          required
          error=${usernameTrim && !usernameOk
            ? (usernameTrim.toLowerCase() === 'watchtower'
              ? 'Pick something other than the default username.'
              : '3-32 characters: letters, numbers, _ or -.')
            : null}
        />
        <${PasswordField}
          label="Current password"
          value=${current}
          onInput=${(e) => setCurrent(e.target.value)}
          autocomplete="current-password"
          required
        />
        <${PasswordField}
          label="New password"
          value=${next}
          onInput=${(e) => setNext(e.target.value)}
          autocomplete="new-password"
          required
        />
        <${PasswordField}
          label="Confirm new password"
          value=${confirm}
          onInput=${(e) => setConfirm(e.target.value)}
          autocomplete="new-password"
          error=${mismatch ? 'Passwords do not match.' : null}
          required
        />
        ${error ? html`<p class="ui-auth-frame__error" role="alert">${error}</p>` : null}
        <${Button}
          kind="primary"
          type="submit"
          loading=${loading}
          disabled=${!usernameOk || !current || !next || !confirm || mismatch}
        >
          Save and continue
        </${Button}>
      </${Stack}>
    </form>
  `;
}

// ── AuthGate root ─────────────────────────────────────────────────────────────

const GATE_FRAMES = {
  login: LoginFrame,
  totp: TotpFrame,
  'password-change': PasswordChangeFrame,
};

/**
 * Full-screen auth gate. Reads auth.gate to decide which frame to render.
 * In fixture/preview mode, auth.gate is always 'none' so this never mounts.
 */
export function AuthGate() {
  const { gate } = auth.value;
  const Frame = GATE_FRAMES[gate];

  if (!Frame) return null;

  return html`
    <div class="ui-auth-gate">
      <div class="ui-auth-gate__bg" aria-hidden="true"></div>
      <main class="ui-auth-gate__main">
        <div class="ui-auth-gate__logo">
          <svg viewBox="0 0 32 32" width="32" height="32" fill="none" aria-hidden="true">
            <rect width="32" height="32" rx="8" fill="var(--ui-accent)" opacity="0.15"/>
            <path d="M9 11h14M9 16h10M9 21h6" stroke="var(--ui-accent)" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <span class="ui-auth-gate__wordmark">WatchTower</span>
        </div>
        <${Card} padding="0">
          <${Frame} />
        </${Card}>
      </main>
    </div>
  `;
}

export default AuthGate;
