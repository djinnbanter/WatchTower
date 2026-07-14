import { html } from '../lib/preact.js';
import { useState, useCallback, useEffect } from '../lib/preact.js';
import { ui, setUi, issuesPeek, opsCache } from '../state/stores.js';
import { set as persistSet } from '../state/persist.js';
import { getPage } from './registry.js';
import { isEmbedded } from '../api/index.js';
import { ensureReportsPresent } from './session-boot.js';
import { Rail } from './rail.js';
import { TopBar } from './topbar.js';
import { CommandPalette } from './palette.js';
import { RunReportModal } from './report-controls.js';
import { getActiveBanners } from './shell-banners.js';
import { ScrollRegion, CopyButton } from '../ui/primitives/index.js';
import { formatTps, formatMspt } from '../domain/formats.js';

// ── Banner host ────────────────────────────────────────────────────────────────

function BannerHost() {
  const [dismissed, setDismissed] = useState(new Set());
  const banners = getActiveBanners(dismissed);

  function dismiss(key) {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    if (key) persistSet(key, true);
  }

  if (!banners.length) return null;

  return html`
    <div class="ui-banner-host" role="region" aria-label="Notifications">
      ${banners.map((b) => html`
        <div key=${b.id} class=${'ui-banner ui-banner--' + b.tone} role="alert">
          <span class="ui-banner__text">${b.text}</span>
          ${b.dismissKey
            ? html`
              <button
                class="ui-banner__dismiss"
                onClick=${() => dismiss(b.dismissKey)}
                aria-label="Dismiss"
              >✕</button>
            `
            : null}
        </div>
      `)}
    </div>
  `;
}

// ── Toast host ─────────────────────────────────────────────────────────────────

function ToastHost() {
  const { toasts } = ui.value;
  if (!toasts.length) return null;

  return html`
    <div class="ui-toast-stack" role="status" aria-live="polite" aria-atomic="false">
      ${toasts.map((t) => html`
        <div
          key=${t.id}
          class=${'ui-toast ui-toast--' + (t.tone || 'info')}
        >
          <span class="ui-toast__text">${t.message}</span>
          <button
            class="ui-toast__close"
            onClick=${() => import('../state/actions.js').then((m) => m.removeToast(t.id))}
            aria-label="Dismiss notification"
          >✕</button>
        </div>
      `)}
    </div>
  `;
}

// ── Modal renderers ────────────────────────────────────────────────────────────

function CrashLogModal({ file }) {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import('../state/actions.js').then(({ fetchCrashReport }) =>
      fetchCrashReport(file)
    ).then((text) => {
      setContent(text ?? '(No content available)');
      setLoading(false);
    }).catch(() => {
      setContent('(Failed to load crash report)');
      setLoading(false);
    });
  }, [file]);

  return html`
    <div class="ui-modal-crash-log">
      <div class="ui-modal-crash-log__header">
        <h2 class="ui-modal__title">Crash Log</h2>
        <code class="ui-modal-crash-log__file">${file}</code>
      </div>
      ${loading
        ? html`<p class="ui-modal-crash-log__loading">Loading…</p>`
        : html`
          <${ScrollRegion} maxHeight="60vh" label="Crash log content" className="ui-modal-crash-log__scroll">
            <pre class="ui-modal-crash-log__pre">${content}</pre>
          </${ScrollRegion}>
          <div class="ui-modal-crash-log__actions">
            <${CopyButton} text=${content ?? ''} label="Copy crash log" />
          </div>
        `}
    </div>
  `;
}

function LagIncidentModal({ id, entry: passedEntry }) {
  // Find the entry if not passed directly
  const peek = issuesPeek.value.data;
  const ops = opsCache.value.data;

  const entry = passedEntry
    ?? peek?.lag_issues?.find((e) => e.id === id || e.incident_id === id)
    ?? ops?.lag_issues?.entries?.find((e) => e.id === id || e.incident_id === id)
    ?? null;

  if (!entry) {
    return html`
      <div class="ui-modal-lag">
        <h2 class="ui-modal__title">Lag Incident</h2>
        <p>Incident <code>${id}</code> not found.</p>
      </div>
    `;
  }

  const { title, narrative, metrics, players, findings, hints, primary_suspect, time, severity } = entry;

  return html`
    <div class="ui-modal-lag">
      <h2 class="ui-modal__title">${title}</h2>
      ${time ? html`<p class="ui-modal-lag__time">${new Date(time).toLocaleString()}</p>` : null}
      ${narrative ? html`<p class="ui-modal-lag__narrative">${narrative}</p>` : null}

      ${primary_suspect ? html`
        <div class="ui-modal-lag__suspect">
          <strong>Primary suspect:</strong> ${primary_suspect}
        </div>
      ` : null}

      ${metrics ? html`
        <div class="ui-modal-lag__metrics">
          <span>TPS ${formatTps(metrics.tps)}</span>
          <span class="ui-modal-lag__sep">·</span>
          <span>MSPT ${formatMspt(metrics.mspt)}</span>
          <span class="ui-modal-lag__sep">·</span>
          <span>${metrics.players_online ?? 0} player${metrics.players_online !== 1 ? 's' : ''}</span>
        </div>
      ` : null}

      ${findings?.length ? html`
        <div class="ui-modal-lag__section">
          <h3 class="ui-modal-lag__section-title">Findings</h3>
          <ul>
            ${findings.map((f, i) => html`<li key=${i}>${f.text ?? JSON.stringify(f)}</li>`)}
          </ul>
        </div>
      ` : null}

      ${hints?.length ? html`
        <div class="ui-modal-lag__section">
          <h3 class="ui-modal-lag__section-title">Hints</h3>
          <ul>
            ${hints.map((h, i) => html`<li key=${i}>${h}</li>`)}
          </ul>
        </div>
      ` : null}

      ${players?.length ? html`
        <p class="ui-modal-lag__players">
          Players online: ${players.join(', ')}
        </p>
      ` : null}
    </div>
  `;
}

// ── Modal host ─────────────────────────────────────────────────────────────────

function ModalContent({ type, props }) {
  if (type === 'run-report') return html`<${RunReportModal} />`;
  if (type === 'crash-log') return html`<${CrashLogModal} file=${props?.file} />`;
  if (type === 'lag-incident') return html`<${LagIncidentModal} id=${props?.id} entry=${props?.entry} />`;
  return html`<div class="ui-modal__stub"><p>Modal: ${type}</p></div>`;
}

function ModalHost() {
  const { modal } = ui.value;
  if (!modal) return null;

  function closeModal() {
    setUi({ modal: null });
  }

  return html`
    <div class="ui-modal-scrim" onClick=${closeModal} role="dialog" aria-modal="true">
      <div
        class="ui-modal-box"
        onClick=${(e) => e.stopPropagation()}
        role="document"
      >
        <${ModalContent} type=${modal.type} props=${modal.props} />
        <button
          type="button"
          class="ui-modal-box__close"
          onClick=${(e) => { e.stopPropagation(); closeModal(); }}
          aria-label="Close modal"
        >
          <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M4 4l8 8M12 4l-8 8"/>
          </svg>
        </button>
      </div>
    </div>
  `;
}

// ── Mobile rail drawer ─────────────────────────────────────────────────────────

function MobileDrawer({ onClose }) {
  return html`
    <div class="ui-rail-drawer" aria-label="Mobile navigation">
      <div class="ui-rail-drawer__scrim" onClick=${onClose}></div>
      <div class="ui-rail-drawer__panel">
        <${Rail} />
      </div>
    </div>
  `;
}

// ── Main page outlet ───────────────────────────────────────────────────────────

function PageOutlet({ tab }) {
  const page = getPage(tab);

  if (!page) {
    return html`
      <div class="ui-page ui-page--404">
        <div class="ui-page__header">
          <div class="ui-page__title-group">
            <h1 class="ui-page__title">Page not found</h1>
            <p class="ui-page__subtitle">No page registered for tab "${tab}".</p>
          </div>
        </div>
      </div>
    `;
  }

  const PageComponent = page.render;
  return html`<${PageComponent} />`;
}

// ── AppShell ───────────────────────────────────────────────────────────────────

/**
 * Root application shell: rail + topbar + page outlet + overlays.
 * Only mounted after auth and (if needed) wizard are complete.
 */
export function AppShell() {
  const { route, mobileNavOpen, railExpanded } = ui.value;
  const tab = route?.tab || 'overview';

  // Safety net: if hydrate raced or /latest failed, retry once when shell mounts
  useEffect(() => {
    ensureReportsPresent();
  }, []);

  function closeMobileNav() {
    setUi({ mobileNavOpen: false });
  }

  return html`
    <div class=${'ui-shell' + (railExpanded ? ' ui-shell--expanded' : ' ui-shell--collapsed')}>
      <!-- Skip link -->
      <a href="#main" class="ui-skip-link">Skip to content</a>

      <!-- Navigation rail -->
      <${Rail} />

      <!-- Main column -->
      <div class="ui-shell-content">
        <${TopBar} />
        <${BannerHost} />
        <main id="main" class="ui-shell-main" tabIndex=${-1}>
          <${PageOutlet} tab=${tab} />
        </main>
      </div>

      <!-- Overlays -->
      ${mobileNavOpen
        ? html`<${MobileDrawer} onClose=${closeMobileNav} />`
        : null}
      <${ModalHost} />
      <${ToastHost} />
      <${CommandPalette} />
    </div>
  `;
}

export default AppShell;
