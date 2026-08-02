/**
 * First-run setup wizard — options, blocking Initial discovery, backups, security.
 */
import { html, useState, useEffect } from '../../lib/preact.js';
import { setUi, auth, discovery, settings } from '../../state/stores.js';
import { set as persistSet, get as persistGet, remove as persistRemove } from '../../state/persist.js';
import { navigate } from '../../app/router.js';
import {
  startDiscovery,
  pollDiscoveryStatus,
  hydrateAfterDiscovery,
  saveSettings,
  loadSettings,
} from '../../state/actions.js';
import { kickTask } from '../../state/scheduler.js';
import { Button } from '../../ui/primitives/button.js';
import { Progress } from '../../ui/primitives/progress.js';
import { Spinner } from '../../ui/primitives/spinner.js';
import { Toggle } from '../../ui/primitives/toggle.js';
import { Icon } from '../../ui/icons.js';
import { now } from '../../state/clock.js';
import { isEmbedded } from '../../api/index.js';

const STEPS = [
  { id: 'welcome', title: 'Welcome to WatchTower', icon: 'home' },
  { id: 'options', title: 'Options', icon: 'sliders' },
  { id: 'audit', title: 'Initial discovery', icon: 'search' },
  { id: 'backups', title: 'Backups', icon: 'archive' },
  { id: 'security', title: 'Security', icon: 'shield' },
];

/** Mirrors ReportEngine stages for the first-run deep audit baseline. */
const DISCOVERY_STAGES = [
  { id: 'window', label: 'Computing time window' },
  { id: 'collect', label: 'Collecting logs, crashes, mods, host metrics' },
  { id: 'analyze', label: 'Analyzing health and crashes' },
  { id: 'enrich', label: 'Enriching incidents and scorecard' },
  { id: 'write', label: 'Writing facts and brief' },
  { id: 'finalize', label: 'Saving state and ops cache' },
  { id: 'done', label: 'Done' },
];

/** True when the browser has finished (or skipped) the first-run wizard. */
export function isSetupWizardComplete(wiz = persistGet('setupWizard', null)) {
  if (wiz == null) return false;
  if (typeof wiz === 'boolean') return wiz;
  return wiz.completed === true;
}

/** Full-screen wizard only when never started (or after relaunch cleared storage). */
export function shouldShowSetupWizard(wiz = persistGet('setupWizard', null)) {
  return wiz == null;
}

async function completeWizard(extra = {}) {
  const prev = persistGet('setupWizard', {}) || {};
  persistSet('setupWizard', {
    ...prev,
    completed: true,
    completedAt: Date.now(),
    pauseReason: null,
    ...extra,
  });
  setUi({ bootPhase: 'ready' });
  try {
    await hydrateAfterDiscovery();
  } catch (err) {
    console.warn('[WatchTower] Post-wizard hydrate failed:', err);
  }
  kickTask('live');
  kickTask('samples');
  kickTask('meta');
}

function stageIndex(stageId) {
  if (!stageId) return -1;
  return DISCOVERY_STAGES.findIndex((s) => s.id === stageId);
}

function stageStatus(stageId, activeId, running, success) {
  const idx = stageIndex(stageId);
  const activeIdx = stageIndex(activeId);
  if (!running && success === true) return 'done';
  if (!running && success === false && idx <= activeIdx) return 'done';
  if (!running && success === false && idx > activeIdx) return 'pending';
  if (idx < activeIdx) return 'done';
  if (idx === activeIdx) return 'active';
  return 'pending';
}

function formatElapsed(startedAt, nowMs) {
  if (startedAt == null) return null;
  const sec = Math.max(0, Math.floor((nowMs - Number(startedAt)) / 1000));
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

function WelcomeStep() {
  return html`
    <div class="ui-wizard__step-body">
      <p class="ui-text-mid">
        WatchTower is your ops control panel for this Minecraft server — live charts,
        crash triage, and backups health. Everything stays on your host.
      </p>
      <ul class="ui-wizard__bullets">
        <li>Change the default username/password <strong>before</strong> discovery (sign-in gate)</li>
        <li>Optionally enable Modrinth lookups, then run the <strong>deep audit baseline</strong></li>
        <li>After that, Watching + Scanning keep day-to-day tabs current with deltas</li>
        <li>Need help later? Use the rail <strong>Support</strong> button for a shareable zip</li>
      </ul>
      <p class="ui-text-low">The baseline can take a few minutes on large packs. Live charts still start from now.</p>
    </div>
  `;
}

function OptionsStep() {
  const data = settings.value?.data ?? {};
  const [modrinthLookup, setModrinthLookup] = useState(!!data.modrinth_lookup);
  const [modrinthAutoScan, setModrinthAutoScan] = useState(!!data.modrinth_auto_scan_on_mod_changes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isEmbedded()) return undefined;
    let cancelled = false;
    (async () => {
      try {
        await loadSettings();
      } catch {
        /* ignore — toggles still work locally until save */
      }
      if (cancelled) return;
      const next = settings.value?.data ?? {};
      setModrinthLookup(!!next.modrinth_lookup);
      setModrinthAutoScan(!!next.modrinth_auto_scan_on_mod_changes);
    })();
    return () => { cancelled = true; };
  }, []);

  async function applyModrinth(lookup, autoScan) {
    setError(null);
    setSaving(true);
    setModrinthLookup(lookup);
    const nextAuto = lookup ? autoScan : false;
    setModrinthAutoScan(nextAuto);
    try {
      if (!isEmbedded()) {
        const prev = JSON.parse(localStorage.getItem('wt.previewSettings') || '{}');
        localStorage.setItem('wt.previewSettings', JSON.stringify({
          ...prev,
          modrinth_lookup: lookup,
          modrinth_auto_scan_on_mod_changes: nextAuto,
        }));
        return;
      }
      const payload = { modrinthLookup: lookup };
      if (!lookup) payload.modrinthAutoScanOnModChanges = false;
      else payload.modrinthAutoScanOnModChanges = nextAuto;
      await saveSettings(payload, { quiet: true });
    } catch (err) {
      setError(err?.message || 'Could not save Modrinth setting.');
    } finally {
      setSaving(false);
    }
  }

  return html`
    <div class="ui-wizard__step-body">
      <p class="ui-text-mid">
        Optional network lookups help identify mods on Modrinth during and after Initial discovery.
        Leave off if this host should never call out.
      </p>
      <div class="ui-wizard__audit-list">
        <div class="ui-wizard__audit-row">
          <div>
            <${Toggle}
              label=${saving ? 'Saving…' : 'Enable Modrinth lookup'}
              checked=${modrinthLookup}
              disabled=${saving}
              onChange=${(v) => applyModrinth(v, modrinthAutoScan)}
            />
            <p class="ui-text-low">Sends jar SHA-512 hashes to api.modrinth.com (no world, logs, or player data).</p>
          </div>
        </div>
        <div class="ui-wizard__audit-row">
          <div>
            <${Toggle}
              label=${saving ? 'Saving…' : 'Auto-scan when mods change'}
              checked=${modrinthAutoScan}
              disabled=${saving || !modrinthLookup}
              onChange=${(v) => applyModrinth(modrinthLookup, v)}
            />
            <p class="ui-text-low">After discovery, re-check Modrinth when jars are added or updated.</p>
          </div>
        </div>
      </div>
      ${error ? html`<p class="ui-wizard__error">${error}</p>` : null}
      <p class="ui-text-low">You can change this later in Settings → Monitoring.</p>
    </div>
  `;
}

function DiscoveryStageChecklist({ status }) {
  const activeId = status.stage || DISCOVERY_STAGES[0].id;
  const activeLabel = status.stage_label
    || DISCOVERY_STAGES.find((s) => s.id === activeId)?.label;
  const detail = status.stage_detail || null;
  const startedMs = status.last_run?.started_at
    ? Date.parse(status.last_run.started_at)
    : status.startedAt;
  const elapsed = status.running ? formatElapsed(startedMs, now.value) : null;
  const stepNum = Math.max(1, stageIndex(activeId) + 1);
  const progress = status.progress || {};
  const done = Number(progress.done) || 0;
  const total = Number(progress.total) || 0;
  const pctDone = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const counts = status.counts || {};
  const countBits = [];
  if (counts.logs != null) countBits.push(`${counts.logs} logs`);
  if (counts.crashes != null) countBits.push(`${counts.crashes} crashes`);
  if (counts.jars != null) countBits.push(`${counts.jars} mods`);
  if (counts.active_issues != null) countBits.push(`${counts.active_issues} active issues`);
  const unitLabel = total > 0
    ? (activeId === 'collect'
      ? `Processing ${done}/${total}`
      : `Step progress ${done}/${total}`)
    : null;

  return html`
    <div class="ui-report-stages feat-modrinth-stages" role="status" aria-live="polite">
      ${status.running ? html`
        <div class="ui-report-stages__meta">
          <span>Stage ${stepNum} of ${DISCOVERY_STAGES.length}</span>
          ${elapsed ? html`<span class="ui-report-stages__elapsed">Elapsed ${elapsed}</span>` : null}
        </div>
      ` : null}
      <ol class="ui-report-stages__list">
        ${DISCOVERY_STAGES.map((stage) => {
          const st = stageStatus(stage.id, activeId, status.running, status.success);
          return html`
            <li
              key=${stage.id}
              class=${`ui-report-stages__item ui-report-stages__item--${st}`}
            >
              <span class="ui-report-stages__marker" aria-hidden="true">
                ${st === 'done'
                  ? html`<${Icon} name="check" size=${14} />`
                  : st === 'active'
                    ? html`<${Spinner} size=${14} />`
                    : html`<span class="ui-report-stages__dot"></span>`}
              </span>
              <span class="ui-report-stages__label">${stage.label}</span>
            </li>
          `;
        })}
      </ol>
      ${status.running ? html`
        <div class="feat-modrinth-progress">
          <div class="feat-modrinth-progress__bar" role="progressbar"
            aria-valuemin="0" aria-valuemax=${total || 100} aria-valuenow=${done}>
            <span style=${`width:${pctDone}%`}></span>
          </div>
          <p class="feat-modrinth-progress__meta">
            ${unitLabel ? html`<span>${unitLabel}</span>` : null}
            ${countBits.map((bit) => html`<span key=${bit}>${bit}</span>`)}
          </p>
        </div>
        <div class="ui-report-stages__live">
          <p class="ui-report-stages__current">
            <${Spinner} size=${14} />
            <span>Currently: ${activeLabel}</span>
          </p>
          ${detail
            ? html`<p class="ui-report-stages__detail">${detail}</p>`
            : html`<p class="ui-report-stages__detail ui-report-stages__detail--muted">
                Large packs can take a few minutes — please wait until discovery finishes.
              </p>`}
        </div>
      ` : null}
    </div>
  `;
}

function DiscoveryStep({ onCompleteChange }) {
  const status = discovery.value?.status ?? {};
  const startedAt = discovery.value?.startedAt;
  const [starting, setStarting] = useState(false);
  const prev = persistGet('setupWizard', {}) || {};
  const alreadyOk = prev.discovery === 'ok' || status.success === true;

  useEffect(() => {
    onCompleteChange?.(!!(status.success === true || alreadyOk) && !status.running);
  }, [status.success, status.running, alreadyOk, onCompleteChange]);

  useEffect(() => {
    if (alreadyOk && !status.running) return undefined;
    let cancelled = false;
    (async () => {
      setStarting(true);
      try {
        await startDiscovery();
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();
    const id = setInterval(() => { pollDiscoveryStatus(); }, 1200);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  async function handleRetry() {
    setStarting(true);
    try {
      persistSet('setupWizard', { ...(persistGet('setupWizard', {}) || {}), discovery: 'pending' });
      await startDiscovery();
    } finally {
      setStarting(false);
    }
  }

  const counts = status.counts || {};
  const liveStatus = {
    ...status,
    startedAt,
    running: !!status.running || starting,
  };

  return html`
    <div class="ui-wizard__step-body">
      <p class="ui-text-mid">
        Watchtower is running a <strong>full deep audit</strong> to build your first baseline —
        logs, crashes, mods, host metrics, Issues, and a facts file the dashboard can open.
        This can take a few minutes on large packs.
        <strong> Live charts still start from now</strong> (Watchtower cannot invent past TPS samples).
      </p>
      <p class="ui-text-low">
        Next stays locked until the baseline finishes so Overview and every tab open with real data.
        After this, continuous Watching + Scanning keep things current without another manual audit.
      </p>

      <${DiscoveryStageChecklist} status=${liveStatus} />

      ${status.success === true || (alreadyOk && !status.running) ? html`
        <div class="ui-wizard__audit-list" style="margin-top:16px">
          <div class="ui-wizard__audit-row">
            <span class="ui-wizard__audit-mark"><${Icon} name="check" size=${16} /></span>
            <div>
              <strong>Baseline ready</strong>
              <span class="ui-text-low">
                ${counts.logs != null ? `${counts.logs} logs · ` : ''}
                ${counts.crashes != null ? `${counts.crashes} crashes · ` : ''}
                ${counts.jars != null ? `${counts.jars} mods · ` : ''}
                ${counts.active_issues != null ? `${counts.active_issues} active issues · ` : ''}
                deep audit complete
              </span>
            </div>
          </div>
        </div>
      ` : null}

      ${status.success === false ? html`
        <p class="ui-wizard__error">${status.error || status.message || 'Discovery failed'}</p>
        <div class="ui-wizard__actions-row">
          <${Button} kind="primary" loading=${starting} onClick=${handleRetry}>Retry deep audit</${Button}>
        </div>
      ` : null}
    </div>
  `;
}

function BackupsStep({ onOpenBackups, onLater }) {
  return html`
    <div class="ui-wizard__step-body">
      <p class="ui-text-mid">
        WatchTower does <strong>not</strong> guess where your backups live and never enables
        silent defaults. Configure a local folder, a panel/cloud heartbeat, or both on the
        <strong> Backups</strong> tab.
      </p>
      <p class="ui-text-low">
        Opening Backups leaves setup incomplete so you can finish folder setup there, then
        resume from Overview or Docs.
      </p>
      <div class="ui-wizard__actions-row">
        <${Button} kind="accent" onClick=${onOpenBackups}>Open Backups tab</${Button}>
        <${Button} kind="neutral" onClick=${onLater}>I’ll do this later</${Button}>
      </div>
    </div>
  `;
}

function SecurityStep() {
  const session = auth.value?.session ?? {};
  const totpOn = !!(session.totp_enabled || session.totpEnabled);
  const mustChange = !!(session.must_change_password || session.mustChangePassword);

  return html`
    <div class="ui-wizard__step-body">
      <p class="ui-text-mid">
        Dashboard access uses a signed session cookie. Passwords are stored with bcrypt.
        Two-factor authentication is strongly recommended if this port is reachable beyond localhost.
      </p>
      <div class="ui-wizard__audit-list">
        <div class=${'ui-wizard__audit-row' + (mustChange ? ' ui-wizard__audit-row--warn' : '')}>
          <span class="ui-wizard__audit-mark"><${Icon} name=${mustChange ? 'alert-triangle' : 'check'} size=${16} /></span>
          <div>
            <strong>Password</strong>
            <span class="ui-text-low">${mustChange
              ? 'Change still required — finish the password gate if you see it again'
              : 'Password gate cleared for this account'}</span>
          </div>
        </div>
        <div class=${'ui-wizard__audit-row' + (totpOn ? '' : ' ui-wizard__audit-row--warn')}>
          <span class="ui-wizard__audit-mark"><${Icon} name=${totpOn ? 'check' : 'alert-triangle'} size=${16} /></span>
          <div>
            <strong>Two-factor authentication</strong>
            <span class="ui-text-low">${totpOn ? 'Enabled' : 'Not enabled yet'}</span>
          </div>
        </div>
      </div>
      ${!totpOn ? html`
        <div class="ui-wizard__actions-row">
          <${Button}
            kind="accent"
            onClick=${() => {
              void completeWizard({ securityDeferred: true });
              navigate('settings', { panel: 'security' });
            }}
          >Enable 2FA in Settings</${Button}>
        </div>
        <p class="ui-text-low">Opens Security settings after finishing this wizard.</p>
      ` : html`
        <p class="ui-text-low">You are set — finish setup to open the dashboard.</p>
      `}
    </div>
  `;
}

export function WizardView() {
  const paused = persistGet('setupWizard', null);
  const [stepIdx, setStepIdx] = useState(() => {
    if (paused && paused.completed !== true && typeof paused.stepIdx === 'number') {
      return Math.min(Math.max(0, paused.stepIdx), STEPS.length - 1);
    }
    return 0;
  });
  const [skipConfirm, setSkipConfirm] = useState(false);
  const [discoveryReady, setDiscoveryReady] = useState(
    () => (paused && paused.discovery === 'ok') || false,
  );

  const step = STEPS[stepIdx];
  const isFirst = stepIdx === 0;
  const isLast = stepIdx === STEPS.length - 1;
  const progress = ((stepIdx + 1) / STEPS.length) * 100;
  const discoveryBlocked = step.id === 'audit' && !discoveryReady;

  function finish(extra = {}) {
    void completeWizard(extra);
  }

  function next() {
    if (discoveryBlocked) return;
    if (isLast) {
      finish();
      return;
    }
    setStepIdx(stepIdx + 1);
  }

  function back() {
    if (!isFirst) setStepIdx(stepIdx - 1);
  }

  function requestSkip() {
    setSkipConfirm(true);
  }

  function confirmSkip() {
    finish({ skipped: true, discovery: discoveryReady ? 'ok' : 'skipped' });
  }

  function openBackupsWithoutCompleting() {
    persistSet('setupWizard', {
      completed: false,
      pausedAt: Date.now(),
      pauseReason: 'backups',
      stepIdx,
      discovery: discoveryReady ? 'ok' : 'pending',
    });
    setUi({ bootPhase: 'ready' });
    if (discoveryReady) {
      void hydrateAfterDiscovery().then(() => {
        kickTask('live');
        kickTask('meta');
      });
    }
    navigate('backups');
  }

  let body = null;
  if (step.id === 'welcome') body = html`<${WelcomeStep} />`;
  else if (step.id === 'options') body = html`<${OptionsStep} />`;
  else if (step.id === 'audit') {
    body = html`<${DiscoveryStep} onCompleteChange=${setDiscoveryReady} />`;
  } else if (step.id === 'backups') {
    body = html`<${BackupsStep}
      onOpenBackups=${openBackupsWithoutCompleting}
      onLater=${next}
    />`;
  } else if (step.id === 'security') {
    body = html`<${SecurityStep} />`;
  }

  return html`
    <div class="ui-wizard" role="main">
      <div class="ui-wizard__bg" aria-hidden="true"></div>

      <div class="ui-wizard__panel">
        <div class="ui-wizard__header">
          <div class="ui-wizard__logo">
            <span class="ui-wizard__logo-icon"><${Icon} name="activity" size=${20} /></span>
            <span class="ui-wizard__wordmark">WatchTower Setup</span>
          </div>
          <button
            class="ui-wizard__skip"
            onClick=${requestSkip}
            type="button"
            aria-label="Skip setup wizard"
          >
            Skip setup
          </button>
        </div>

        <div class="ui-wizard__progress-row">
          <span class="ui-wizard__step-label">Step ${stepIdx + 1} of ${STEPS.length}</span>
          <${Progress} value=${progress} max=${100} />
        </div>

        <div class="ui-wizard__body">
          <div class="ui-wizard__step-icon" aria-hidden="true">
            <${Icon} name=${step.icon} size=${28} />
          </div>
          <h1 class="ui-wizard__step-title">${step.title}</h1>
          ${body}
        </div>

        <div class="ui-wizard__footer">
          <${Button} kind="neutral" disabled=${isFirst} onClick=${back}>Back</${Button}>
          <${Button}
            kind="primary"
            disabled=${discoveryBlocked}
            onClick=${next}
            title=${discoveryBlocked ? 'Wait for Initial discovery to finish' : undefined}
          >
            ${isLast ? 'Finish and open dashboard'
              : step.id === 'backups' ? 'Continue'
                : discoveryBlocked ? 'Waiting for discovery…'
                  : 'Next'}
          </${Button}>
        </div>
      </div>

      <div class="ui-wizard__dots" role="tablist" aria-label="Wizard steps">
        ${STEPS.map((s, i) => html`
          <button
            key=${s.id}
            type="button"
            class=${'ui-wizard__dot' + (i === stepIdx ? ' ui-wizard__dot--active' : i < stepIdx ? ' ui-wizard__dot--done' : '')}
            onClick=${() => setStepIdx(i)}
            aria-label=${'Step ' + (i + 1) + ': ' + s.title}
            role="tab"
            aria-selected=${i === stepIdx}
          ></button>
        `)}
      </div>

      ${skipConfirm ? html`
        <div class="ui-wizard__confirm" role="dialog" aria-modal="true" aria-labelledby="wiz-skip-title">
          <div class="ui-wizard__confirm-card">
            <h2 id="wiz-skip-title">Skip setup?</h2>
            <p class="ui-text-mid">
              ${discoveryBlocked
                ? html`Initial discovery is still running. If you skip, Watching and Scanning will keep warming the dashboard in the background.`
                : html`You can re-open this wizard anytime from <strong>Docs → Run setup wizard again</strong>.`}
            </p>
            <div class="ui-wizard__actions-row">
              <${Button} kind="neutral" onClick=${() => setSkipConfirm(false)}>Keep going</${Button}>
              <${Button} kind="primary" onClick=${confirmSkip}>Skip for now</${Button}>
            </div>
          </div>
        </div>
      ` : null}
    </div>
  `;
}

/** Force full-screen wizard (Docs relaunch / ?setup=1). */
export function relaunchSetupWizard() {
  persistRemove('setupWizard');
  try { localStorage.removeItem('wt.setupWizardComplete'); } catch { /* legacy */ }
  setUi({ bootPhase: 'wizard' });
}

/** Resume a paused wizard, or relaunch from the start if already completed. */
export function resumeSetupWizard() {
  const wiz = persistGet('setupWizard', null);
  if (wiz && wiz.completed !== true) {
    setUi({ bootPhase: 'wizard' });
    return;
  }
  relaunchSetupWizard();
}

export default WizardView;
