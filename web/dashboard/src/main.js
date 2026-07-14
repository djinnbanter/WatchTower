/**
 * WatchTower Lantern UI — application entry point.
 * Boot sequence: migrate → theme → source → auth → wizard → shell.
 */

// Signals Preact integration (side effect: patches Preact reconciler)
import './lib/signals.js';

import { render } from './lib/preact.js';
import { html } from './lib/preact.js';

import { migrateLegacy } from './state/persist.js';
import { initTheme } from './theme/theme.js';
import { createSource, isEmbedded } from './api/index.js';
import { initActions } from './state/actions.js';
import { startClock } from './state/clock.js';
import { auth, ui, setUi } from './state/stores.js';
import { AppShell } from './app/shell.js';
import { AuthGate } from './app/auth-gate.js';
import { WizardView } from './features/wizard/view.js';
import { BootScreen } from './app/boot.js';
import { setBootSource, resumeAfterAuth, ensureRouter } from './app/session-boot.js';

// Register all feature pages (side effects)
import './app/pages.js';

// ── Root component — reactive to auth + bootPhase ─────────────────────────────

function App() {
  const { bootPhase } = ui.value;
  const { gate } = auth.value;

  if (bootPhase === 'boot') {
    return html`<${BootScreen} phase="boot" message="Starting WatchTower…" />`;
  }
  if (gate !== 'none') {
    return html`<${AuthGate} />`;
  }
  // Authenticated but still hydrating session/reports — do not mount shell empty
  if (bootPhase === 'auth' || bootPhase === 'loading') {
    return html`<${BootScreen} phase="boot" message="Loading saved reports…" />`;
  }
  if (bootPhase === 'wizard') {
    return html`<${WizardView} />`;
  }
  return html`<${AppShell} />`;
}

// ── Boot sequence ─────────────────────────────────────────────────────────────

async function boot() {
  migrateLegacy();
  initTheme();

  const source = createSource();
  initActions(source);
  setBootSource(source);

  const embedded = isEmbedded();

  const appEl = document.getElementById('app');
  render(html`<${App} />`, appEl);

  if (embedded) {
    setUi({ bootPhase: 'auth' });
    try {
      const session = await source.fetchSession?.();
      if (!session?.authenticated) {
        auth.value = { ...auth.value, gate: 'login' };
        startClock();
        ensureRouter();
        return;
      }
      if (!session?.fully_authenticated) {
        auth.value = {
          ...auth.value,
          gate: (session.requires_totp || session.totp_required) ? 'totp' : 'password-change',
          session,
        };
        startClock();
        ensureRouter();
        return;
      }
      auth.value = { ...auth.value, gate: 'none', session };
    } catch {
      auth.value = { ...auth.value, gate: 'login' };
      startClock();
      ensureRouter();
      return;
    }
  } else {
    auth.value = { ...auth.value, gate: 'none' };
    try {
      await source.boot();
    } catch (err) {
      console.warn('[WatchTower] Fixture boot error:', err);
    }
  }

  await resumeAfterAuth();
}

boot().catch((err) => {
  console.error('[WatchTower] Fatal boot error:', err);
  const appEl = document.getElementById('app');
  if (appEl) {
    appEl.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui;color:#e6ebf0;background:#0b0d10;flex-direction:column;gap:16px">
        <p style="font-size:1.1rem">WatchTower failed to start.</p>
        <pre style="font-size:.8rem;color:#5f6b78;max-width:40ch;white-space:pre-wrap">${err?.message || String(err)}</pre>
        <button onclick="location.reload()" style="padding:8px 16px;background:#4c9eea;color:#fff;border:none;border-radius:6px;cursor:pointer">Reload</button>
      </div>
    `;
  }
});
