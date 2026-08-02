import { html } from '../../lib/preact.js';
import { useState, useCallback, useEffect } from '../../lib/preact.js';
import { ui, settings, auth, updateCheck, reports, noReportYet } from '../../state/stores.js';
import { saveSettings, addToast, loadSettings } from '../../state/actions.js';
import { downloadSupportBundle } from '../../app/report-controls.js';
import { openSupportBuilder } from '../support/bundle-builder-modal.js';
import { navigate } from '../../app/router.js';
import { isEmbedded } from '../../api/index.js';
import { Page } from '../../ui/patterns/index.js';
import { Button, NumberField, Toggle, Segmented, PasswordField } from '../../ui/primitives/index.js';
import { KeyValue } from '../../ui/patterns/index.js';
import { Icon } from '../../ui/icons.js';
import { listCrashRules, validateCrashRules } from '../../api/endpoints.js';
import { LocalFolderStep, ExternalCloudStep, parseBackupDirs } from '../backups/setup-steps.js';

// ── Panel definitions ──────────────────────────────────────────────────────────

const PANELS = [
  { id: 'general',    label: 'General',    icon: 'sliders' },
  { id: 'monitoring', label: 'Monitoring', icon: 'activity' },
  { id: 'backups',    label: 'Backups',    icon: 'database' },
  { id: 'rules',      label: 'Rules',      icon: 'package' },
  { id: 'security',   label: 'Security',   icon: 'shield' },
  { id: 'advanced',   label: 'Advanced',   icon: 'wrench' },
  { id: 'about',      label: 'About',      icon: 'info' },
];

// ── General panel ─────────────────────────────────────────────────────────────

function GeneralPanel() {
  const data = settings.value.data ?? {};
  const [msptWarn, setMsptWarn] = useState(data.mspt_warn ?? 50);
  const [tpsWarn, setTpsWarn] = useState(data.tps_warn ?? 18);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data.mspt_warn != null) setMsptWarn(data.mspt_warn);
    if (data.tps_warn != null) setTpsWarn(data.tps_warn);
  }, [data.mspt_warn, data.tps_warn]);

  const mark = useCallback((setter) => (v) => { setter(v); setDirty(true); }, []);

  const envRows = Object.entries(data.environment ?? {}).map(([key, value]) => ({ key, value }));

  async function handleSave() {
    setSaving(true);
    try {
      const payload = { msptWarn, tpsWarn };
      if (!isEmbedded()) {
        const prev = JSON.parse(localStorage.getItem('wt.previewSettings') || '{}');
        localStorage.setItem('wt.previewSettings', JSON.stringify({
          ...prev,
          ...payload,
          mspt_warn: msptWarn,
          tps_warn: tpsWarn,
        }));
        addToast('Settings saved (preview)', 'success');
      } else {
        await saveSettings(payload);
      }
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  return html`
    <div class="settings-form">
      <div class="settings-form__section">
        <h2 class="settings-form__heading">Alert thresholds</h2>
        <div class="settings-form__row">
          <${NumberField}
            id="sched-mspt"
            label="MSPT warn (ms)"
            value=${msptWarn}
            min=${1}
            max=${500}
            onChange=${mark(setMsptWarn)}
          />
          <${NumberField}
            id="sched-tps"
            label="TPS warn"
            value=${tpsWarn}
            min=${1}
            max=${20}
            onChange=${mark(setTpsWarn)}
          />
        </div>
      </div>

      ${envRows.length > 0 ? html`
        <div class="settings-form__section">
          <h2 class="settings-form__heading">Environment</h2>
          <${KeyValue} items=${envRows} />
        </div>
      ` : null}

      <div class="settings-form__actions">
        <${Button}
          kind="accent"
          disabled=${!dirty || saving}
          loading=${saving}
          onClick=${handleSave}
        >Save changes</${Button}>
        ${dirty ? html`<span class="settings-form__dirty-hint">Unsaved changes</span>` : null}
      </div>
    </div>
  `;
}

// ── Monitoring panel ──────────────────────────────────────────────────────────

function MonitoringPanel() {
  const data = settings.value.data ?? {};
  const [modrinthLookup, setModrinthLookup] = useState(!!data.modrinth_lookup);
  const [modrinthAutoScan, setModrinthAutoScan] = useState(!!data.modrinth_auto_scan_on_mod_changes);
  const [sparkAutoCapture, setSparkAutoCapture] = useState(!!data.spark_auto_capture_on_lag);
  const [baselineAutoCapture, setBaselineAutoCapture] = useState(data.baseline_auto_capture !== false);
  const [baselineThreshold, setBaselineThreshold] = useState(
    data.baseline_regression_threshold_pct != null ? Number(data.baseline_regression_threshold_pct) : 10,
  );
  const [saving, setSaving] = useState(false);
  const [savingAuto, setSavingAuto] = useState(false);
  const [savingSpark, setSavingSpark] = useState(false);
  const [savingBaseline, setSavingBaseline] = useState(false);
  const [savingThreshold, setSavingThreshold] = useState(false);

  const sparkModLoaded = data.spark_mod_loaded == null ? true : !!data.spark_mod_loaded;

  useEffect(() => {
    setModrinthLookup(!!data.modrinth_lookup);
    setModrinthAutoScan(!!data.modrinth_auto_scan_on_mod_changes);
    setSparkAutoCapture(!!data.spark_auto_capture_on_lag);
    setBaselineAutoCapture(data.baseline_auto_capture !== false);
    setBaselineThreshold(
      data.baseline_regression_threshold_pct != null ? Number(data.baseline_regression_threshold_pct) : 10,
    );
  }, [
    data.modrinth_lookup,
    data.modrinth_auto_scan_on_mod_changes,
    data.spark_auto_capture_on_lag,
    data.baseline_auto_capture,
    data.baseline_regression_threshold_pct,
  ]);

  const rows = [
    { key: 'Live poll interval', value: data.live_poll_sec != null ? `${data.live_poll_sec}s` : '5s' },
    { key: 'Ops cache TTL', value: data.ops_cache_ttl != null ? `${data.ops_cache_ttl}s` : '60s' },
    { key: 'Report retention', value: data.report_retention_days != null ? `${data.report_retention_days} days` : '—' },
    { key: 'Disk warn %', value: data.disk_warn_pct != null ? `${data.disk_warn_pct}%` : '85%' },
    { key: 'Disk fill warn', value: data.disk_fill_warn_days != null ? `${data.disk_fill_warn_days} days` : '14 days' },
    { key: 'Disk write latency warn', value: data.disk_io_latency_warn_ms != null ? `${data.disk_io_latency_warn_ms} ms` : '50 ms' },
    { key: 'Spark enabled', value: data.spark_enabled === false ? 'No' : 'Yes' },
    { key: 'Spark mod installed', value: sparkModLoaded ? 'Yes' : 'No' },
    { key: 'Crash scan', value: data.crash_scan_enabled === false ? 'Disabled' : 'Enabled' },
  ];

  async function handleModrinthToggle(v) {
    setModrinthLookup(v);
    setSaving(true);
    try {
      const payload = { modrinthLookup: v };
      if (!v && modrinthAutoScan) {
        payload.modrinthAutoScanOnModChanges = false;
        setModrinthAutoScan(false);
      }
      await saveSettings(payload, { quiet: true });
      addToast(v
        ? 'Modrinth lookup enabled — run a scan from Mods → Modrinth'
        : 'Modrinth lookup disabled',
        'success');
    } catch (err) {
      setModrinthLookup(!v);
      addToast(`Could not save: ${err.message ?? err}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleAutoScanToggle(v) {
    setModrinthAutoScan(v);
    setSavingAuto(true);
    try {
      await saveSettings({ modrinthAutoScanOnModChanges: v }, { quiet: true });
      addToast(v
        ? 'Auto-scan after mod changes enabled (not tied to deep audit)'
        : 'Auto-scan after mod changes disabled',
        'success');
    } catch (err) {
      setModrinthAutoScan(!v);
      addToast(`Could not save: ${err.message ?? err}`, 'error');
    } finally {
      setSavingAuto(false);
    }
  }

  async function handleSparkAutoCaptureToggle(v) {
    setSparkAutoCapture(v);
    setSavingSpark(true);
    try {
      await saveSettings({ sparkAutoCaptureOnLag: v }, { quiet: true });
      addToast(v
        ? 'Auto-capture Spark on critical lag enabled'
        : 'Auto-capture Spark on critical lag disabled',
        'success');
    } catch (err) {
      setSparkAutoCapture(!v);
      addToast(`Could not save: ${err.message ?? err}`, 'error');
    } finally {
      setSavingSpark(false);
    }
  }

  async function handleBaselineAutoCaptureToggle(v) {
    setBaselineAutoCapture(v);
    setSavingBaseline(true);
    try {
      await saveSettings({ baselineAutoCapture: v }, { quiet: true });
      addToast(v
        ? 'Auto-capture performance baseline enabled'
        : 'Auto-capture performance baseline disabled',
        'success');
    } catch (err) {
      setBaselineAutoCapture(!v);
      addToast(`Could not save: ${err.message ?? err}`, 'error');
    } finally {
      setSavingBaseline(false);
    }
  }

  async function handleBaselineThresholdSave() {
    const thr = Math.max(1, Math.min(100, Number(baselineThreshold) || 10));
    setBaselineThreshold(thr);
    setSavingThreshold(true);
    try {
      await saveSettings({ baselineRegressionThresholdPct: thr }, { quiet: true });
      addToast(`Regression threshold set to ${thr}%`, 'success');
    } catch (err) {
      addToast(`Could not save: ${err.message ?? err}`, 'error');
    } finally {
      setSavingThreshold(false);
    }
  }

  return html`
    <div class="settings-form">
      <div class="settings-form__section">
        <h2 class="settings-form__heading">Data sources</h2>
        <p class="settings-form__hint">
          Monitoring settings are configured server-side.
          See <a class="ui-link" onClick=${() => navigate('docs', { wiki: 'Understanding-Data-Sources' })} href="#">Understanding Data Sources</a> for details.
        </p>
        <${KeyValue} items=${rows} />
      </div>
      <div class="settings-form__section">
        <h2 class="settings-form__heading">Lag &amp; Spark</h2>
        <p class="settings-form__hint">
          When critical sustained lag is detected, optionally run Spark for a short window and attach top mod attribution to the lag incident. Profiles stay on disk — nothing is uploaded.
        </p>
        <${Toggle}
          checked=${sparkAutoCapture}
          onChange=${handleSparkAutoCaptureToggle}
          label=${savingSpark ? 'Saving…' : 'Auto-capture Spark on critical lag'}
          disabled=${savingSpark || !sparkModLoaded || data.spark_enabled === false}
        />
        ${!sparkModLoaded ? html`
          <p class="settings-form__hint settings-form__hint--warn">
            Install <strong>Spark</strong> on this server to enable auto-capture.
          </p>
        ` : html`
          <ul class="settings-form__bullets ui-text-low">
            <li><strong>Default:</strong> off — you must opt in here or set <code>SPARK_AUTO_CAPTURE_ON_LAG=true</code>.</li>
            <li><strong>When:</strong> critical lag only (not warning-level blips), about ${data.spark_auto_capture_window_sec ?? 45}s capture, ~${Math.round((data.spark_auto_capture_cooldown_sec ?? 900) / 60)} min cooldown (failed starts still burn cooldown).</li>
            <li><strong>Where:</strong> Issues chip + Spark tab “Auto-captured” profiles under <code>watchtower/spark-upload/auto-…</code>.</li>
            <li><strong>Note:</strong> if you are already running a manual Spark profile, auto-capture may stop it early — leave this off while profiling by hand.</li>
          </ul>
        `}
      </div>
      <div class="settings-form__section">
        <h2 class="settings-form__heading">Performance baseline</h2>
        <p class="settings-form__hint">
          Freeze a known-good window and flag when the last 7 days look slower. Auto-capture runs once when healthy; only <em>Set new baseline</em> on Insights refreshes it.
        </p>
        <${Toggle}
          checked=${baselineAutoCapture}
          onChange=${handleBaselineAutoCaptureToggle}
          label=${savingBaseline ? 'Saving…' : 'Auto-capture baseline when healthy'}
          disabled=${savingBaseline}
        />
        <div class="settings-form__field settings-form__field--inline">
          <${NumberField}
            id="baseline-threshold"
            label="Regression threshold (%)"
            value=${baselineThreshold}
            min=${1}
            max=${100}
            onChange=${setBaselineThreshold}
          />
          <${Button}
            kind="neutral"
            size="sm"
            disabled=${savingThreshold}
            loading=${savingThreshold}
            onClick=${handleBaselineThresholdSave}
          >Save threshold</${Button}>
        </div>
        <ul class="settings-form__bullets ui-text-low">
          <li><strong>Default:</strong> auto-capture on; flag when MSPT/heap rise or TPS drops by ≥${data.baseline_regression_threshold_pct ?? 10}% vs baseline.</li>
          <li><strong>Never auto-overwrites</strong> — use Insights → Patterns → <em>Set new baseline</em> after a good week.</li>
        </ul>
      </div>
      <div class="settings-form__section">
        <h2 class="settings-form__heading">Mod intelligence</h2>
        <p class="settings-form__hint">
          Optional second opinion for ambiguous mods. Local scoring always runs; Modrinth is only used when you turn this on.
        </p>
        <${Toggle}
          checked=${modrinthLookup}
          onChange=${handleModrinthToggle}
          label=${saving ? 'Saving…' : 'Modrinth lookup (opt-in)'}
          disabled=${saving || savingAuto}
        />
        <${Toggle}
          checked=${modrinthAutoScan}
          onChange=${handleAutoScanToggle}
          label=${savingAuto ? 'Saving…' : 'Auto-scan after mod changes'}
          disabled=${saving || savingAuto || !modrinthLookup}
        />
        <ul class="settings-form__bullets ui-text-low">
          <li><strong>When:</strong> run a scan from <em>Mods → Modrinth</em> (not during a deep audit). Optional auto-scan runs when the ops poll sees jars added/removed/updated — still not tied to deep audit. Reports only apply already-cached Modrinth identity.</li>
          <li><strong>What is sent:</strong> SHA-512 hashes of jar files to <code>api.modrinth.com</code> (no world, logs, or player data). No API key required.</li>
          <li><strong>Coverage:</strong> looks up jars on each dedicated scan (capped, cached, batched with ETA) — not only ambiguous or crash suspects.</li>
          <li><strong>What you see:</strong> icons, project links (Modrinth / wiki / source / issues / Discord), Client/server callouts and Modrinth-checked signal chips on Mods → Overview, Crashes CTAs, and optional “update available” hints after a successful scan patches the latest report.</li>
          <li><strong>Never downloads jars</strong> — links open Modrinth in your browser; you update mods yourself.</li>
          <li><strong>Cache:</strong> answers are stored in <code>watchtower/modrinth-cache.json</code> so the same jars are not re-queried every time.</li>
          ${!isEmbedded() ? html`
            <li><strong>Preview:</strong> this toggle is saved in the browser only — fixture scores do not change until you use a live server scan.</li>
          ` : null}
        </ul>
      </div>
    </div>
  `;
}

// ── Backups panel ─────────────────────────────────────────────────────────────

function formatTrackingLabel(mode) {
  if (mode === 'both' || mode === 'webhook' || mode === 'marker') return 'Panel / cloud signal';
  if (mode === 'off' || !mode) return 'Not configured';
  return mode;
}

function BackupsPanel() {
  const data = settings.value.data ?? {};
  const dirs = parseBackupDirs(data);
  const tracking = data.backup_tracking_mode ?? 'off';
  const trackingEnabled = data.backup_tracking_enabled !== false;
  const externalOn = tracking !== 'off' || data.backup_external_configured;

  useEffect(() => {
    loadSettings();
  }, []);

  return html`
    <div class="settings-form">
      <div class="settings-form__section">
        <h2 class="settings-form__heading">Backup tracking</h2>
        <p class="settings-form__hint">
          Choose where backups live — a folder on this server, a panel heartbeat, or both.
          The <strong>Backups</strong> tab shows status and inventory once configured.
        </p>
        <${KeyValue} items=${[
          {
            key: 'Tracking',
            value: trackingEnabled ? 'On' : 'Not tracking (alerts off)',
          },
          {
            key: 'Local folder',
            value: dirs.length ? dirs.join(', ') : 'Not set',
          },
          {
            key: 'Panel / cloud',
            value: !trackingEnabled ? 'Off' : (externalOn ? formatTrackingLabel(tracking) : 'Not set'),
          },
          {
            key: 'Webhook',
            value: !trackingEnabled ? 'Off' : (data.backup_webhook_enabled ? 'Enabled' : 'Off'),
          },
        ]} />
      </div>

      <div class="settings-form__section">
        <h2 class="settings-form__heading">Set up backups</h2>
        <div class="feat-backup-setup">
          <${LocalFolderStep} settingsData=${data} />
          <div class="feat-backup-setup__divider" role="separator"></div>
          <${ExternalCloudStep} settingsData=${data} />
        </div>
      </div>

      <div class="settings-form__section">
        <${Button} kind="neutral" onClick=${() => navigate('backups')}>
          Open Backups tab
        </${Button}>
        <p class="settings-form__hint ui-sp-top-8">
          View backup age, archive inventory, and rescan after setup is saved here.
        </p>
      </div>
    </div>
  `;
}

// ── Security panel ─────────────────────────────────────────────────────────────

function TotpSetupFlow({ onDone }) {
  const [step, setStep] = useState('idle'); // idle | qr | codes
  const [qrData, setQrData] = useState(null);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function startSetup() {
    setLoading(true);
    setError('');
    try {
      const res = await import('../../api/endpoints.js').then((m) => m.totpSetup());
      setQrData(res);
      setStep('qr');
    } catch (err) {
      setError(err.message || 'Setup failed');
    } finally {
      setLoading(false);
    }
  }

  async function confirmTotp() {
    setLoading(true);
    setError('');
    try {
      const res = await import('../../api/endpoints.js').then((m) => m.totpConfirm(code));
      setRecoveryCodes(res?.recovery_codes ?? []);
      setStep('codes');
    } catch (err) {
      setError(err.message || 'Confirmation failed');
    } finally {
      setLoading(false);
    }
  }

  if (step === 'idle') {
    return html`
      <${Button} kind="neutral" loading=${loading} onClick=${startSetup}>
        Set up two-factor authentication
      </${Button}>
      ${error ? html`<p class="settings-error">${error}</p>` : null}
    `;
  }

  if (step === 'qr') {
    return html`
      <div class="settings-totp-setup">
        ${qrData?.qr_image_url
          ? html`<img class="settings-totp-qr" src=${qrData.qr_image_url} alt="TOTP QR code" width="180" height="180" />`
          : null}
        ${qrData?.secret
          ? html`<p class="settings-form__hint">Manual key: <code>${qrData.secret}</code></p>`
          : null}
        <label class="settings-form__label" for="totp-code">Authenticator code</label>
        <input
          id="totp-code"
          type="text"
          class="ui-text-field"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="8"
          value=${code}
          onInput=${(e) => setCode(e.target.value.replace(/\D/g, ''))}
          placeholder="000000"
        />
        ${error ? html`<p class="settings-error">${error}</p>` : null}
        <${Button} kind="accent" loading=${loading} disabled=${code.length < 6} onClick=${confirmTotp}>
          Verify and enable
        </${Button}>
      </div>
    `;
  }

  if (step === 'codes') {
    return html`
      <div class="settings-recovery-codes">
        <p class="settings-form__hint">2FA enabled. Save these recovery codes in a safe place:</p>
        <ul class="settings-recovery-list">
          ${recoveryCodes.map((c) => html`<li key=${c}><code>${c}</code></li>`)}
        </ul>
        <${Button} kind="accent" onClick=${() => { setStep('idle'); onDone?.(); }}>Done</${Button}>
      </div>
    `;
  }

  return null;
}

function SecurityPanel() {
  const inPreview = !isEmbedded(); // preview/fixture mode — no real auth endpoints

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [unError, setUnError] = useState('');
  const [unSuccess, setUnSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleChangePw() {
    setSaving(true);
    setPwError('');
    setPwSuccess(false);
    try {
      await import('../../api/endpoints.js').then((m) => m.changePassword(currentPw, newPw));
      setCurrentPw(''); setNewPw('');
      setPwSuccess(true);
      addToast('Password changed', 'success');
    } catch (err) {
      setPwError(err.message || 'Password change failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleChangeUsername() {
    setSaving(true);
    setUnError('');
    setUnSuccess(false);
    try {
      await import('../../api/endpoints.js').then((m) => m.changeUsername(newUsername));
      setUnSuccess(true);
      addToast('Username changed', 'success');
    } catch (err) {
      setUnError(err.message || 'Username change failed');
    } finally {
      setSaving(false);
    }
  }

  if (inPreview) {
    return html`
      <div class="settings-form">
        <div class="settings-security-preview">
          <${Icon} name="shield" size=${32} />
          <p>Security settings are only available on a live server.</p>
          <p class="settings-form__hint">Start Watchtower and open the dashboard from your server to manage passwords, usernames, and two-factor authentication.</p>
        </div>
      </div>
    `;
  }

  return html`
    <div class="settings-form">
      <div class="settings-form__section">
        <h2 class="settings-form__heading">Change password</h2>
        <${PasswordField} id="pw-current" label="Current password" value=${currentPw} onInput=${(e) => setCurrentPw(e.target.value)} />
        <${PasswordField} id="pw-new" label="New password" value=${newPw} onInput=${(e) => setNewPw(e.target.value)} />
        ${pwError ? html`<p class="settings-error">${pwError}</p>` : null}
        ${pwSuccess ? html`<p class="settings-success">Password updated.</p>` : null}
        <${Button} kind="accent" loading=${saving} disabled=${!currentPw || !newPw || saving} onClick=${handleChangePw}>
          Update password
        </${Button}>
      </div>

      <div class="settings-form__section">
        <h2 class="settings-form__heading">Change username</h2>
        <div class="settings-form__field">
          <label class="settings-form__label" for="username-new">New username</label>
          <input id="username-new" type="text" class="ui-text-field" value=${newUsername} onInput=${(e) => setNewUsername(e.target.value)} autocomplete="username" />
        </div>
        ${unError ? html`<p class="settings-error">${unError}</p>` : null}
        ${unSuccess ? html`<p class="settings-success">Username updated.</p>` : null}
        <${Button} kind="accent" loading=${saving} disabled=${!newUsername || saving} onClick=${handleChangeUsername}>
          Update username
        </${Button}>
      </div>

      <div class="settings-form__section">
        <h2 class="settings-form__heading">Two-factor authentication</h2>
        <${TotpSetupFlow} />
      </div>
    </div>
  `;
}

// ── Advanced panel ────────────────────────────────────────────────────────────

function AdvancedPanel() {
  const [bundleLoading, setBundleLoading] = useState(false);

  async function handleQuick() {
    setBundleLoading(true);
    try {
      await downloadSupportBundle();
    } finally {
      setBundleLoading(false);
    }
  }

  return html`
    <div class="settings-form">
      <div class="settings-form__section">
        <h2 class="settings-form__heading">Support pack</h2>
        <p class="settings-form__hint">
          Build a redacted zip from continuous Watching + Scanning data to send for help.
          Prefer the builder so you can choose logs and crashes. Console:
          <code>/watchtower run</code> (Quick preset).
        </p>
        <div class="settings-about-actions">
          <${Button}
            kind="accent"
            onClick=${() => openSupportBuilder()}
          >
            <${Icon} name="package" size=${16} />
            Open builder
          </${Button}>
          <${Button} kind="neutral" loading=${bundleLoading} onClick=${handleQuick}>
            <${Icon} name="download" size=${16} />
            Quick download
          </${Button}>
        </div>
      </div>
    </div>
  `;
}

// ── About panel ───────────────────────────────────────────────────────────────

function AboutPanel() {
  const upd = updateCheck.value.data;

  function startTour() {
    import('../../app/tour.js').then((m) => m.startTour());
  }

  return html`
    <div class="settings-form">
      <div class="settings-form__section">
        <h2 class="settings-form__heading">Version</h2>
        <${KeyValue} items=${[
          { key: 'Version', value: upd?.current_version ?? 'Unknown' },
          { key: 'Update available', value: upd?.update_available ? `Yes — ${upd.latest_version}` : 'No' },
          { key: 'Release channel', value: upd?.channel ?? 'stable' },
        ]} />
        ${upd?.update_available ? html`
          <a class="ui-link settings-update-link" href=${upd.release_url ?? '#'} target="_blank" rel="noopener noreferrer">
            View release notes ↗
          </a>
        ` : null}
      </div>

      <div class="settings-form__section">
        <h2 class="settings-form__heading">Get started</h2>
        <div class="settings-about-actions">
          <${Button} kind="neutral" onClick=${startTour}>
            <${Icon} name="map" size=${16} />
            Start dashboard tour
          </${Button}>
          <${Button} kind="neutral" onClick=${() => navigate('docs')}>
            <${Icon} name="book" size=${16} />
            Browse documentation
          </${Button}>
        </div>
      </div>

      <div class="settings-form__section settings-form__section--muted">
        <p class="settings-form__hint">
          Watchtower Lantern — Minecraft server monitoring dashboard.<br/>
          <a class="ui-link" href="https://github.com/mc-status-world/watchtower" target="_blank" rel="noopener noreferrer">GitHub</a>
          {' · '}
          <a class="ui-link" onClick=${() => navigate('docs', { wiki: 'Changelog' })} href="#">Changelog</a>
        </p>
      </div>
    </div>
  `;
}

function RulesPanel() {
  const [packs, setPacks] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [yaml, setYaml] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listCrashRules();
        if (cancelled) return;
        setPacks(data?.packs ?? []);
        setWarnings(data?.warnings ?? []);
      } catch {
        if (!cancelled) setPacks([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleValidate() {
    const r = await validateCrashRules(yaml);
    setResult(r);
  }

  return html`
    <div class="settings-form">
      <div class="settings-form__section">
        <h2 class="settings-form__heading">Crash rule packs</h2>
        <p class="settings-form__hint">
          Declarative YAML matchers under <code>config/watchtower/rules/</code> plus JAR builtins.
          Java classifiers always run first; packs apply after. See
          <a class="ui-link" onClick=${() => navigate('docs', { wiki: 'Crash-Rule-Packs' })} href="#">Crash rule packs</a>.
        </p>
        ${loading ? html`<p class="settings-form__hint">Loading packs…</p>` : html`
          <ul class="settings-rules-list">
            ${packs.length === 0 ? html`<li class="settings-form__hint">No packs loaded</li>` : null}
            ${packs.map((p) => html`
              <li key=${p.id}>
                <strong>${p.name || p.id}</strong>
                <span class="settings-form__hint"> · ${p.builtin ? 'builtin' : 'operator'} · priority ${p.priority} · ${(p.rules || []).length} rules</span>
                <ul>
                  ${(p.rules || []).map((r) => html`<li key=${r.id}><code>${r.id}</code>${r.description ? ` — ${r.description}` : ''}</li>`)}
                </ul>
              </li>
            `)}
          </ul>
        `}
        ${warnings.length ? html`
          <p class="settings-form__hint">Warnings: ${warnings.join('; ')}</p>
        ` : null}
      </div>
      <div class="settings-form__section">
        <h2 class="settings-form__heading">Validate YAML</h2>
        <textarea
          class="settings-rules-paste"
          rows="10"
          placeholder="Paste a rule pack YAML…"
          value=${yaml}
          onInput=${(e) => setYaml(e.target.value)}
        ></textarea>
        <div class="settings-form__actions">
          <${Button} kind="accent" onClick=${handleValidate} disabled=${!yaml.trim()}>Validate</${Button}>
        </div>
        ${result ? html`
          <p class="settings-form__hint">
            ${result.valid ? 'Valid pack.' : `Invalid: ${(result.errors || []).join('; ')}`}
          </p>
        ` : null}
      </div>
    </div>
  `;
}

// ── Settings page ─────────────────────────────────────────────────────────────

const PANEL_COMPONENTS = {
  general:    GeneralPanel,
  monitoring: MonitoringPanel,
  backups:    BackupsPanel,
  rules:      RulesPanel,
  security:   SecurityPanel,
  advanced:   AdvancedPanel,
  about:      AboutPanel,
};

export function PageView() {
  const { route } = ui.value;
  const panel = route?.params?.panel || 'general';

  function setPanel(id) {
    navigate('settings', { panel: id });
  }

  const PanelComponent = PANEL_COMPONENTS[panel] ?? GeneralPanel;

  return html`
    <${Page} title="Settings" subtitle="Server and dashboard configuration">
      <div class="settings-layout" data-tour="settings">
        <nav class="settings-nav" aria-label="Settings panels">
          ${PANELS.map((p) => html`
            <button
              key=${p.id}
              class=${'settings-nav__item' + (panel === p.id ? ' settings-nav__item--active' : '')}
              onClick=${() => setPanel(p.id)}
              aria-current=${panel === p.id ? 'page' : undefined}
            >
              <${Icon} name=${p.icon} size=${16} class="settings-nav__icon" />
              <span class="settings-nav__label">${p.label}</span>
            </button>
          `)}
        </nav>
        <div class="settings-panel">
          <${PanelComponent} />
        </div>
      </div>
    </${Page}>
  `;
}
