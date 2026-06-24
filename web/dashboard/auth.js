/**
 * Dashboard session auth (1.0.0) — login, 2FA, password change.
 */
const WatchtowerAuth = (function () {
  const EXPOSURE_KEY = 'watchtower-exposure-dismissed';
  const SECURITY_UPDATE_KEY = 'watchtower-security-update-seen';

  let session = null;
  let authGate = null;

  function isEmbedded() {
    return typeof WatchtowerApi !== 'undefined' && WatchtowerApi.isEmbedded();
  }

  async function apiFetch(url, options = {}) {
    const opts = {
      credentials: 'include',
      ...options,
      headers: {
        ...(options.headers || {}),
      },
    };
    const r = await fetch(url, opts);
    return r;
  }

  async function fetchSession() {
    const r = await apiFetch('/api/auth/session');
    if (!r.ok) throw new Error('session unavailable');
    session = await r.json();
    return session;
  }

  async function login(username, password, remember) {
    const r = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, remember: !!remember }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw new Error(data.message || data.error || 'Login failed');
    }
    await fetchSession();
    return data;
  }

  async function verifyTotp(code, recovery) {
    const r = await apiFetch('/api/auth/totp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, recovery: !!recovery }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.message || 'Invalid code');
    await fetchSession();
    return data;
  }

  async function logout() {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    session = null;
  }

  async function changePassword(currentPassword, newPassword) {
    const r = await apiFetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.message || 'Password change failed');
    await fetchSession();
    return data;
  }

  async function changeUsername(username) {
    const r = await apiFetch('/api/auth/change-username', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.message || 'Username change failed');
    await fetchSession();
    return data;
  }

  async function totpSetup() {
    const r = await apiFetch('/api/auth/totp/setup', { method: 'POST' });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.message || '2FA setup failed');
    return data;
  }

  async function totpConfirm(code) {
    const r = await apiFetch('/api/auth/totp/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.message || 'Invalid code');
    await fetchSession();
    return data;
  }

  async function totpDisable(password, code) {
    const r = await apiFetch('/api/auth/totp/disable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, code }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.message || 'Disable failed');
    await fetchSession();
    return data;
  }

  async function regenerateRecovery(password, code) {
    const r = await apiFetch('/api/auth/recovery/regenerate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, code }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.message || 'Regenerate failed');
    return data;
  }

  function ensureGateDom() {
    if (authGate) return authGate;
    authGate = document.createElement('div');
    authGate.id = 'dashboard-auth-gate';
    authGate.className = 'wt-fullscreen wt-auth is-hidden';
    authGate.setAttribute('aria-live', 'polite');
    const shell = document.querySelector('.wt-shell') || document.body;
    shell.prepend(authGate);
    return authGate;
  }

  function showGate(html) {
    const gate = ensureGateDom();
    const bootEl = document.getElementById('tower-boot');
    if (bootEl && !bootEl.classList.contains('is-hidden')) {
      bootEl.classList.add('is-hidden');
    }
    gate.innerHTML = `<div class="wt-auth__card wt-panel--glass">${html}</div>`;
    gate.classList.remove('is-hidden');
    document.querySelector('.wt-rail')?.classList.add('nav-disabled');
    document.querySelector('.wt-cmdbar')?.classList.add('hidden');
    document.getElementById('main-content')?.classList.add('hidden');
    if (window.lucide) lucide.createIcons({ root: gate });
  }

  function hideGate() {
    authGate?.classList.add('is-hidden');
    document.querySelector('.wt-rail')?.classList.remove('nav-disabled');
    document.querySelector('.wt-cmdbar')?.classList.remove('hidden');
    document.getElementById('main-content')?.classList.remove('hidden');
  }

  function waitForLogin() {
    return new Promise((resolve) => {
      showGate(`
        <img src="assets/watchtower-wordmark.png?v=4" alt="Watchtower" class="wt-auth__logo wt-wordmark" width="80" height="80">
        <h2 class="wt-auth__title">Sign in to Watchtower</h2>
        <p class="wt-auth__desc">First-time default: username <code>watchtower</code>, password <code>password</code>. You must set a new password after signing in.</p>
        <form id="auth-login-form" class="wt-auth__form">
          <div class="wt-input-group">
            <input type="text" id="auth-username" value="watchtower" autocomplete="username" placeholder=" " required>
            <label for="auth-username">Username</label>
          </div>
          <div class="wt-input-group">
            <input type="password" id="auth-password" placeholder=" " autocomplete="current-password" required>
            <label for="auth-password">Password</label>
          </div>
          <div style="text-align: left; margin-bottom: 8px;">
            <label class="wt-text-body"><input type="checkbox" id="auth-remember"> Remember this device for 7 days</label>
          </div>
          <p class="wt-text-caption wt-text-danger hidden" id="auth-login-error"></p>
          <button type="submit" class="wt-btn wt-btn--primary wt-auth__submit">Sign in</button>
        </form>
        <p class="wt-text-caption" style="margin-top: 16px;"><button type="button" class="wt-btn wt-btn--ghost wt-btn--sm" id="auth-forgot-btn">Forgot password?</button></p>
      `);
      document.getElementById('auth-forgot-btn')?.addEventListener('click', () => {
        if (typeof WatchtowerSettings !== 'undefined') {
          WatchtowerSettings.open('security');
        }
      });
      document.getElementById('auth-login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errEl = document.getElementById('auth-login-error');
        errEl?.classList.add('hidden');
        const btn = e.target.querySelector('button[type=submit]');
        btn.disabled = true;
        try {
          await login(
            document.getElementById('auth-username')?.value,
            document.getElementById('auth-password')?.value,
            document.getElementById('auth-remember')?.checked
          );
          hideGate();
          resolve(await ensureAuthenticated());
        } catch (err) {
          if (errEl) {
            errEl.textContent = err.message;
            errEl.classList.remove('hidden');
          }
        } finally {
          btn.disabled = false;
        }
      });
    });
  }

  function waitForPasswordChange() {
    return new Promise((resolve) => {
      showGate(`
        <h2 class="wt-auth__title">Set a new password</h2>
        <p class="wt-auth__desc">You must choose a new password before using the dashboard.</p>
        <form id="auth-change-form" class="wt-auth__form">
          <div class="wt-input-group">
            <input type="text" id="auth-new-username" value="${session?.username || ''}" autocomplete="username" placeholder=" ">
            <label for="auth-new-username">Username (optional)</label>
          </div>
          <div class="wt-input-group">
            <input type="password" id="auth-current-password" autocomplete="current-password" placeholder=" " required>
            <label for="auth-current-password">Current password</label>
          </div>
          <div class="wt-input-group">
            <input type="password" id="auth-new-password" autocomplete="new-password" minlength="8" placeholder=" " required>
            <label for="auth-new-password">New password</label>
          </div>
          <p class="wt-text-caption wt-text-danger hidden" id="auth-change-error"></p>
          <button type="submit" class="wt-btn wt-btn--primary wt-auth__submit">Save and continue</button>
        </form>
      `);
      document.getElementById('auth-change-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errEl = document.getElementById('auth-change-error');
        errEl?.classList.add('hidden');
        const btn = e.target.querySelector('button[type=submit]');
        btn.disabled = true;
        try {
          await changePassword(
            document.getElementById('auth-current-password')?.value,
            document.getElementById('auth-new-password')?.value
          );
          const newUser = document.getElementById('auth-new-username')?.value?.trim();
          if (newUser && newUser !== session?.username) {
            await changeUsername(newUser);
          }
          hideGate();
          resolve(await ensureAuthenticated());
        } catch (err) {
          if (errEl) {
            errEl.textContent = err.message;
            errEl.classList.remove('hidden');
          }
        } finally {
          btn.disabled = false;
        }
      });
    });
  }

  function waitForTotp() {
    return new Promise((resolve) => {
      let useRecovery = false;
      const render = () => {
        showGate(`
          <h2 class="wt-auth__title">${useRecovery ? 'Recovery code' : 'Authenticator code'}</h2>
          <p class="wt-auth__desc">${useRecovery ? 'Enter a single-use recovery code.' : 'Enter the 6-digit code from your authenticator app.'}</p>
          <form id="auth-totp-form" class="wt-auth__form">
            <div class="wt-input-group">
              <input type="text" id="auth-totp-code" inputmode="${useRecovery ? 'text' : 'numeric'}" autocomplete="one-time-code" placeholder=" " required>
              <label for="auth-totp-code">${useRecovery ? 'Recovery code' : '6-digit code'}</label>
            </div>
            <p class="wt-text-caption wt-text-danger hidden" id="auth-totp-error"></p>
            <button type="submit" class="wt-btn wt-btn--primary wt-auth__submit">Verify</button>
          </form>
          <p class="wt-text-caption" style="margin-top: 16px;">
            <button type="button" class="wt-btn wt-btn--ghost wt-btn--sm" id="auth-totp-toggle">${useRecovery ? 'Use authenticator code' : 'Use recovery code'}</button>
          </p>
        `);
        document.getElementById('auth-totp-toggle')?.addEventListener('click', () => {
          useRecovery = !useRecovery;
          render();
        });
        document.getElementById('auth-totp-form')?.addEventListener('submit', async (e) => {
          e.preventDefault();
          const errEl = document.getElementById('auth-totp-error');
          errEl?.classList.add('hidden');
          const btn = e.target.querySelector('button[type=submit]');
          btn.disabled = true;
          try {
            await verifyTotp(document.getElementById('auth-totp-code')?.value, useRecovery);
            hideGate();
            resolve(await ensureAuthenticated());
          } catch (err) {
            if (errEl) {
              errEl.textContent = err.message;
              errEl.classList.remove('hidden');
            }
          } finally {
            btn.disabled = false;
          }
        });
      };
      render();
    });
  }

  async function ensureAuthenticated() {
    if (!isEmbedded()) return { authenticated: true, fully_authenticated: true };
    session = await fetchSession();
    if (!session.authenticated) {
      await waitForLogin();
      return ensureAuthenticated();
    }
    if (session.must_change_password) {
      await waitForPasswordChange();
      return ensureAuthenticated();
    }
    if (session.totp_required) {
      await waitForTotp();
      return ensureAuthenticated();
    }
    return session;
  }

  function renderExposureBanner() {
    if (!session?.bind_exposed || localStorage.getItem(EXPOSURE_KEY)) return '';
    return `
      <div class="wt-banner wt-banner--warn" id="exposure-banner">
        <span><i data-lucide="alert-triangle" width="16" height="16"></i>
        Port 8787 is reachable on all interfaces. Consider <code>dashboardBindHost = "127.0.0.1"</code> + SSH tunnel.</span>
        <button type="button" class="wt-btn wt-btn--ghost wt-btn--sm" id="exposure-dismiss">Dismiss</button>
      </div>`;
  }

  function renderSecurityUpdateBanner() {
    if (!session?.security_update || localStorage.getItem(SECURITY_UPDATE_KEY)) return '';
    return `
      <div class="wt-banner wt-banner--info" id="security-update-banner">
        <span><i data-lucide="shield" width="16" height="16"></i>
        Security update: dashboard now requires login. Default credentials are <code>watchtower</code> / <code>password</code> (change on first login).</span>
        <button type="button" class="wt-btn wt-btn--ghost wt-btn--sm" id="security-update-dismiss">Got it</button>
      </div>`;
  }

  function bindBanners() {
    document.getElementById('exposure-dismiss')?.addEventListener('click', () => {
      localStorage.setItem(EXPOSURE_KEY, '1');
      document.getElementById('exposure-banner')?.remove();
    });
    document.getElementById('security-update-dismiss')?.addEventListener('click', () => {
      localStorage.setItem(SECURITY_UPDATE_KEY, '1');
      document.getElementById('security-update-banner')?.remove();
    });
  }

  function getSession() {
    return session;
  }

  return {
    apiFetch,
    fetchSession,
    login,
    logout,
    changePassword,
    changeUsername,
    totpSetup,
    totpConfirm,
    totpDisable,
    regenerateRecovery,
    ensureAuthenticated,
    renderExposureBanner,
    renderSecurityUpdateBanner,
    bindBanners,
    getSession,
    isEmbedded,
  };
})();
