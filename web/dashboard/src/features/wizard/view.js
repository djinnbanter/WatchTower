/**
 * First-run setup wizard — live discovery, optional baseline, actionable steps.
 */
import { html, useState, useEffect, useRef } from '../../lib/preact.js';
import { setUi, auth, reports } from '../../state/stores.js';
import { set as persistSet, get as persistGet, remove as persistRemove } from '../../state/persist.js';
import { navigate } from '../../app/router.js';
import { runReport, pollReportStatus, saveSettings } from '../../state/actions.js';
import { onboardingAudit } from '../../api/endpoints.js';
import { isEmbedded } from '../../api/index.js';
import { Button } from '../../ui/primitives/button.js';
import { Progress } from '../../ui/primitives/progress.js';
import { Combobox } from '../../ui/primitives/combobox.js';
import { Segmented } from '../../ui/primitives/segmented.js';
import { Spinner } from '../../ui/primitives/spinner.js';
import { Icon } from '../../ui/icons.js';
import { ReportStageChecklist } from '../../app/report-controls.js';

const STEPS = [
  { id: 'welcome', title: 'Welcome to WatchTower', icon: 'home' },
  { id: 'audit', title: 'Initial audit', icon: 'search' },
  { id: 'backups', title: 'Backups', icon: 'archive' },
  { id: 'schedule', title: 'Report schedule', icon: 'clock' },
  { id: 'security', title: 'Security', icon: 'shield' },
];

const SCHEDULE_OPTS = [
  { value: 'twice-daily', label: 'Twice daily (recommended)' },
  { value: '24h', label: 'Once daily' },
  { value: 'off', label: 'Off — run manually' },
  { value: 'custom', label: 'Custom interval…' },
];

const LOOKBACK_OPTS = [
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
];

function lookbackToHours(lookback) {
  if (lookback === '30d') return 720;
  if (lookback === '7d') return 168;
  return 24;
}

/** Map wizard schedule UI values to `/api/settings` POST body. */
function scheduleSettingsPayload(schedule, customMins, lookback) {
  const payload = { lookbackHours: lookbackToHours(lookback) };
  if (schedule === 'twice-daily') {
    payload.reportScheduleMode = 'wall_clock';
    payload.reportWallClockHours = '0,12';
  } else if (schedule === 'off') {
    payload.reportScheduleMode = 'off';
  } else if (schedule === '24h') {
    payload.reportScheduleMode = 'interval';
    payload.reportIntervalMinutes = 1440;
  } else if (schedule === 'custom') {
    payload.reportScheduleMode = 'interval';
    payload.reportIntervalMinutes = Math.max(5, Math.min(10080, Number(customMins) || 60));
  } else {
    payload.reportScheduleMode = 'wall_clock';
    payload.reportWallClockHours = '0,12';
  }
  return payload;
}

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

function completeWizard(extra = {}) {
  const prev = persistGet('setupWizard', {}) || {};
  persistSet('setupWizard', {
    ...prev,
    completed: true,
    completedAt: Date.now(),
    pauseReason: null,
    ...extra,
  });
  setUi({ bootPhase: 'ready' });
}

function WelcomeStep() {
  return html`
    <div class="ui-wizard__step-body">
      <p class="ui-text-mid">
        WatchTower is your ops control panel for this Minecraft server — live charts,
        crash triage, backups health, and scheduled audits. Everything stays on your host.
      </p>
      <ul class="ui-wizard__bullets">
        <li>See what needs attention first</li>
        <li>Point WatchTower at your backups (optional)</li>
        <li>Pick a report schedule that matches how you run the server</li>
      </ul>
      <p class="ui-text-low">About 2 minutes. You can skip and finish later from Docs.</p>
    </div>
  `;
}

function auditRowsFromItems(items) {
  if (!items || typeof items !== 'object') return [];
  const rows = [];
  rows.push({
    ok: true,
    label: 'Dashboard connected',
    detail: isEmbedded() ? 'Live server session' : 'Preview / fixture mode',
  });
  if (items.activity_error) {
    rows.push({ ok: false, label: 'Activity scan', detail: String(items.activity_error) });
  } else {
    rows.push({
      ok: true,
      label: 'Activity log',
      detail: `${items.activity_events ?? 0} recent events` +
        (items.activity_new ? ` (${items.activity_new} new)` : ''),
    });
  }
  if (items.crashes_error) {
    rows.push({ ok: false, label: 'Crash scan', detail: String(items.crashes_error) });
  } else {
    const unrev = items.crashes_unreviewed ?? 0;
    rows.push({
      ok: unrev === 0,
      warn: unrev > 0,
      label: 'Crash reports',
      detail: unrev > 0
        ? `${unrev} unreviewed`
        : `${items.crashes_new ?? 0} new since last check`,
    });
  }
  if (items.mods_error) {
    rows.push({ ok: false, label: 'Mods', detail: String(items.mods_error) });
  } else {
    rows.push({
      ok: true,
      label: 'Running mods',
      detail: `${items.mods_running ?? 0} mods detected`,
    });
  }
  if (items.backups_error) {
    rows.push({ ok: false, label: 'Backups', detail: String(items.backups_error) });
  } else if (items.backup_tracking_disabled === true) {
    rows.push({ ok: true, label: 'Backups', detail: 'Tracking disabled — alerts off' });
  } else if (items.backup_configured === true) {
    rows.push({ ok: true, label: 'Backups', detail: 'Folder or external signal configured' });
  } else {
    rows.push({
      ok: false,
      warn: true,
      label: 'Backups',
      detail: 'Not configured yet — set this up in the next step',
    });
  }
  if (items.has_facts_report === true) {
    rows.push({ ok: true, label: 'Health report', detail: 'A prior report is already on disk' });
  } else {
    rows.push({
      ok: true,
      warn: true,
      label: 'Health report',
      detail: 'No full report yet — optional 30-day baseline below',
    });
  }
  if (items.schedule_summary) {
    rows.push({ ok: true, label: 'Schedule', detail: String(items.schedule_summary) });
  }
  return rows;
}

function AuditStep({ onBaselineState }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [items, setItems] = useState(null);
  const [baselineStarted, setBaselineStarted] = useState(false);
  const pollRef = useRef(null);
  const run = reports.value.run ?? {};

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await onboardingAudit();
        if (cancelled) return;
        setItems(data?.items ?? data ?? {});
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Audit failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!baselineStarted || !run.running) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return undefined;
    }
    pollRef.current = setInterval(() => { pollReportStatus(); }, 1500);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [baselineStarted, run.running]);

  useEffect(() => {
    if (!onBaselineState) return;
    if (baselineStarted && run.running) onBaselineState('pending');
    else if (baselineStarted && run.success === true) onBaselineState('ok');
    else if (baselineStarted && run.success === false) onBaselineState('failed');
  }, [baselineStarted, run.running, run.success, onBaselineState]);

  async function startBaseline() {
    setBaselineStarted(true);
    onBaselineState?.('pending');
    await runReport({ lookbackHours: 720, incremental: false });
  }

  const rows = auditRowsFromItems(items);

  return html`
    <div class="ui-wizard__step-body">
      <p class="ui-text-mid">
        A quick discovery scan of this server — activity, crashes, mods, and backup setup.
        It does not replace a full health report.
      </p>

      ${loading ? html`
        <div class="ui-wizard__audit-list ui-wizard__audit-list--loading">
          <${Spinner} size=${18} />
          <span>Scanning…</span>
        </div>
      ` : null}

      ${error ? html`
        <p class="ui-wizard__error">${error}</p>
        <p class="ui-text-low">You can continue and run a report from the dashboard later.</p>
      ` : null}

      ${!loading && !error ? html`
        <div class="ui-wizard__audit-list">
          ${rows.map((r) => html`
            <div class=${'ui-wizard__audit-row' + (r.warn ? ' ui-wizard__audit-row--warn' : r.ok ? '' : ' ui-wizard__audit-row--bad')}>
              <span class="ui-wizard__audit-mark" aria-hidden="true">
                <${Icon} name=${r.ok && !r.warn ? 'check' : 'alert-triangle'} size=${16} />
              </span>
              <div>
                <strong>${r.label}</strong>
                <span class="ui-text-low">${r.detail}</span>
              </div>
            </div>
          `)}
        </div>
      ` : null}

      <div class="ui-wizard__baseline">
        <p class="ui-text-mid">
          <strong>Optional:</strong> run a 30-day baseline health report in the background.
          You can finish setup while it runs.
        </p>
        ${!baselineStarted ? html`
          <${Button}
            kind="accent"
            disabled=${loading}
            onClick=${startBaseline}
          >Run 30-day baseline</${Button}>
        ` : html`
          <${ReportStageChecklist} run=${run} />
          ${run.success === true
            ? html`<p class="ui-text-low">Baseline finished — Overview will use the new report.</p>`
            : null}
          ${run.success === false
            ? html`<p class="ui-wizard__error">${run.message || 'Baseline failed — try Run Report from the top bar later.'}</p>`
            : null}
          ${run.running
            ? html`<p class="ui-text-low">Running in the background — continue with setup.</p>`
            : null}
        `}
      </div>
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

function ScheduleStep({
  schedule, setSchedule, lookback, setLookback,
  customMins, setCustomMins, saved, saving, onSave,
}) {
  return html`
    <div class="ui-wizard__step-body">
      <p class="ui-text-mid">
        Scheduled reports keep Issues, Mods depth, and trends fresh without running
        <code>/watchtower run</code> every day. Default on a new install is <strong>twice daily</strong>
        (midnight and noon, server local time).
      </p>
      <div class="ui-wizard__field">
        <${Combobox}
          id="wiz-schedule"
          label="Schedule"
          options=${SCHEDULE_OPTS}
          value=${schedule}
          onSelect=${setSchedule}
        />
      </div>
      ${schedule === 'custom' ? html`
        <div class="ui-wizard__field">
          <label class="ui-field__label" for="wiz-custom-mins">Interval (minutes)</label>
          <input
            id="wiz-custom-mins"
            class="ui-field__input"
            type="number"
            min="5"
            max="10080"
            value=${customMins}
            onInput=${(e) => setCustomMins(Number(e.target.value) || 60)}
          />
        </div>
      ` : null}
      <div class="ui-wizard__field">
        <label class="ui-field__label">Lookback for each report</label>
        <${Segmented}
          options=${LOOKBACK_OPTS}
          value=${lookback}
          onChange=${setLookback}
        />
      </div>
      <div class="ui-wizard__actions-row">
        <${Button} kind="neutral" loading=${saving} disabled=${saving} onClick=${onSave}>
          ${saved ? 'Saved' : 'Save schedule'}
        </${Button}>
      </div>
      <p class="ui-text-low">You can change this anytime in Settings → General.</p>
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
              completeWizard({ securityDeferred: true });
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
  const [baselineState, setBaselineState] = useState(
    () => (paused && paused.baseline) || null,
  );
  const [schedule, setSchedule] = useState('twice-daily');
  const [lookback, setLookback] = useState('7d');
  const [customMins, setCustomMins] = useState(60);
  const [scheduleSaved, setScheduleSaved] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [skipConfirm, setSkipConfirm] = useState(false);

  const step = STEPS[stepIdx];
  const isFirst = stepIdx === 0;
  const isLast = stepIdx === STEPS.length - 1;
  const progress = ((stepIdx + 1) / STEPS.length) * 100;

  function finish(extra = {}) {
    completeWizard({
      baseline: baselineState || extra.baseline || null,
      backupsOpened: !!extra.backupsOpened,
      ...extra,
    });
  }

  function next() {
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
    finish({ skipped: true });
  }

  async function saveSchedule() {
    setScheduleSaving(true);
    try {
      await saveSettings(scheduleSettingsPayload(schedule, customMins, lookback));
      setScheduleSaved(true);
    } catch {
      // toast from saveSettings
    } finally {
      setScheduleSaving(false);
    }
  }

  function openBackupsWithoutCompleting() {
    persistSet('setupWizard', {
      completed: false,
      pausedAt: Date.now(),
      pauseReason: 'backups',
      stepIdx,
      baseline: baselineState,
    });
    setUi({ bootPhase: 'ready' });
    navigate('backups');
  }

  let body = null;
  if (step.id === 'welcome') body = html`<${WelcomeStep} />`;
  else if (step.id === 'audit') {
    body = html`<${AuditStep} onBaselineState=${setBaselineState} />`;
  } else if (step.id === 'backups') {
    body = html`<${BackupsStep}
      onOpenBackups=${openBackupsWithoutCompleting}
      onLater=${next}
    />`;
  } else if (step.id === 'schedule') {
    body = html`<${ScheduleStep}
      schedule=${schedule}
      setSchedule=${(v) => { setSchedule(v); setScheduleSaved(false); }}
      lookback=${lookback}
      setLookback=${(v) => { setLookback(v); setScheduleSaved(false); }}
      customMins=${customMins}
      setCustomMins=${(v) => { setCustomMins(v); setScheduleSaved(false); }}
      saved=${scheduleSaved}
      saving=${scheduleSaving}
      onSave=${saveSchedule}
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
          <${Button} kind="primary" onClick=${next}>
            ${isLast ? 'Finish and open dashboard' : step.id === 'backups' ? 'Continue' : 'Next'}
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
              You can re-open this wizard anytime from <strong>Docs → Run setup wizard again</strong>.
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
