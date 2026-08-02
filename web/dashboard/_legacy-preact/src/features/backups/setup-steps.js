import { html, useState, useEffect } from '../../lib/preact.js';
import { settings } from '../../state/stores.js';
import {
  addToast,
  saveBackupDirs,
  saveBackupExternal,
} from '../../state/actions.js';
import { isEmbedded } from '../../api/index.js';
import { Button, Segmented, PathField } from '../../ui/primitives/index.js';
import { FolderBrowseModal } from './folder-browse.js';

export const TRACKING_OPTS = [
  { value: 'folder', label: 'Folder on this server' },
  { value: 'heartbeat', label: 'Panel or cloud' },
  { value: 'both', label: 'Both' },
  { value: 'off', label: 'Not tracking' },
];

const WEBHOOK_EVENTS = ['start', 'complete', 'fail'];

export function parseBackupDirs(data) {
  const raw = data?.backup_dirs ?? '';
  if (!raw || typeof raw !== 'string') return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

export function deriveUiTrackingMode(data) {
  if (data?.backup_tracking_enabled === false) return 'off';
  const ext = data?.backup_tracking_mode ?? 'off';
  const local = parseBackupDirs(data).length > 0;
  const externalOn = ext !== 'off' && ext !== '';
  if (local && externalOn) return 'both';
  if (externalOn) return 'heartbeat';
  if (local) return 'folder';
  return null;
}

export function LocalFolderStep({ settingsData, onSaved }) {
  const savedDirs = parseBackupDirs(settingsData);
  const [path, setPath] = useState(savedDirs[0] ?? '');
  const [browseOpen, setBrowseOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const dirs = parseBackupDirs(settings.value.data);
    if (dirs[0]) setPath(dirs[0]);
  }, [settings.value.data?.backup_dirs]);

  async function handleSave() {
    const trimmed = path.trim();
    if (!trimmed) {
      setError('Choose a folder first — browse or paste a path.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await saveBackupDirs([trimmed]);
      onSaved?.();
    } catch (err) {
      setError(err?.message ?? 'Could not save folder');
    } finally {
      setSaving(false);
    }
  }

  return html`
    <div class="feat-backup-setup__step">
      <div class="feat-backup-setup__step-head">
        <span class="feat-backup-setup__step-badge">A</span>
        <div>
          <h3 class="feat-backup-setup__step-title">Folder on this server</h3>
          <p class="feat-hint ui-text-low">
            Choose the folder with your <code>.zip</code> / <code>.tar.gz</code> archives — WatchTower never guesses the path.
          </p>
        </div>
      </div>
      <${PathField}
        id="backup-local-path"
        label="Backup folder"
        value=${path}
        placeholder="Choose a folder…"
        hint=${savedDirs[0] ? `Saved: ${savedDirs[0]}` : 'Browse to your backup output directory'}
        error=${error || undefined}
        onInput=${(e) => { setPath(e.target.value); setError(''); }}
        onBrowse=${() => setBrowseOpen(true)}
      />
      <div class="feat-backup-setup__actions">
        <${Button} kind="accent" loading=${saving} disabled=${!path.trim() || saving} onClick=${handleSave}>
          Save folder & scan
        </${Button}>
      </div>
      <${FolderBrowseModal}
        open=${browseOpen}
        onClose=${() => setBrowseOpen(false)}
        onSelect=${(p) => { setPath(p); setError(''); }}
        title="Choose backup folder"
      />
    </div>
  `;
}

export function ExternalCloudStep({ settingsData, onSaved }) {
  const initialMode = deriveUiTrackingMode(settingsData);
  const [mode, setMode] = useState(initialMode);
  const [markerPath, setMarkerPath] = useState(
    settingsData?.backup_external_marker_rel
      ?? settingsData?.backup_external_marker
      ?? '',
  );
  const [webhookToken, setWebhookToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [markerBrowseOpen, setMarkerBrowseOpen] = useState(false);

  useEffect(() => {
    const data = settings.value.data ?? {};
    setMode(deriveUiTrackingMode(data));
    const marker = data.backup_external_marker_rel ?? data.backup_external_marker ?? '';
    if (marker) setMarkerPath(marker);
  }, [
    settings.value.data?.backup_tracking_mode,
    settings.value.data?.backup_tracking_enabled,
    settings.value.data?.backup_dirs,
    settings.value.data?.backup_external_marker,
    settings.value.data?.backup_external_marker_rel,
  ]);

  const showExternal = mode === 'heartbeat' || mode === 'both';
  const trackingOff = mode === 'off';
  const webhookEnabled = settingsData?.backup_webhook_enabled || !!webhookToken;

  function copyWebhook(type) {
    const url = `${window.location.origin}/api/backups/heartbeat/${type}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    addToast(`${type} webhook URL copied`, 'info');
  }

  function buildPayload() {
    if (mode === 'off') {
      return { trackingEnabled: false, trackingMode: 'off' };
    }
    if (mode === 'folder') {
      return { trackingEnabled: true, trackingMode: 'off' };
    }
    const payload = {
      trackingEnabled: true,
      generateWebhookToken: true,
      backupSuppressLocalMissing: mode === 'heartbeat',
    };
    const marker = markerPath.trim();
    if (marker) {
      payload.backupExternalMarker = marker;
      payload.trackingMode = 'both';
    } else {
      payload.trackingMode = 'webhook';
    }
    return payload;
  }

  async function handleSave() {
    if (!mode) {
      setError('Pick how you want Watchtower to track backups.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = await saveBackupExternal(buildPayload());
      if (result?.backup_webhook_token) {
        setWebhookToken(result.backup_webhook_token);
        addToast('Webhook token generated — copy it into your panel script', 'info');
      } else if (mode === 'off') {
        addToast('Backup tracking disabled — alerts and Issues for backups are off', 'info');
      }
      onSaved?.();
    } catch (err) {
      setError(err?.message ?? 'Could not save backup tracking settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    try {
      const { backupsExternalTest } = await import('../../api/endpoints.js');
      await backupsExternalTest();
      addToast('Test signal received — panel backup tracking works', 'success');
    } catch (err) {
      addToast(err?.message ?? 'Test failed — save external settings first', 'error');
    } finally {
      setTesting(false);
    }
  }

  return html`
    <div class="feat-backup-setup__step">
      <div class="feat-backup-setup__step-head">
        <span class="feat-backup-setup__step-badge">B</span>
        <div>
          <h3 class="feat-backup-setup__step-title">Panel or cloud backups</h3>
          <p class="feat-hint ui-text-low">
            For backups that never land on this disk — panel jobs, S3, or cloud sync.
          </p>
        </div>
      </div>

      <div class="feat-kv-section">
        <label class="feat-label">How should Watchtower track backups?</label>
        <${Segmented} options=${TRACKING_OPTS} value=${mode ?? ''} onChange=${(v) => { setMode(v); setError(''); }} size="sm" />
        ${!mode && html`<p class="feat-hint ui-text-low">Pick an option — nothing is enabled until you save.</p>`}
        ${trackingOff && html`
          <p class="feat-hint ui-text-low">
            Backup Issues and Overview alerts stay off. Folder paths are kept if you re-enable later.
          </p>
        `}
      </div>

      ${showExternal && html`
        <div class="feat-backup-heartbeat">
          <ol class="feat-backup-setup__guide">
            <li>Save below to generate a webhook token (if you do not have one yet).</li>
            <li>Copy the webhook URL into your panel’s “after backup” task or cron script.</li>
            <li>Optionally set a marker file Watchtower can read when a job finishes.</li>
            <li>Run a backup, then click <strong>Test it worked</strong>.</li>
          </ol>

          <${PathField}
            id="backup-marker-path"
            label="Marker file (optional)"
            value=${markerPath}
            placeholder="watchtower/backup-heartbeat.json"
            hint="Relative to the server directory, or browse to pick a path"
            onInput=${(e) => setMarkerPath(e.target.value)}
            onBrowse=${() => setMarkerBrowseOpen(true)}
          />

          <label class="feat-label" style="margin-top:12px">Webhook URLs</label>
          <p class="feat-hint ui-text-low">
            Add <code>Authorization: Bearer &lt;token&gt;</code> when calling from your panel.
            ${!webhookEnabled && !isEmbedded() ? ' Preview mode — token is simulated on save.' : ''}
          </p>
          <div class="feat-webhook-list">
            ${WEBHOOK_EVENTS.map((t) => html`
              <div key=${t} class="feat-webhook-row">
                <code class="feat-log-sample">/api/backups/heartbeat/${t}</code>
                <${Button} kind="neutral" size="sm" onClick=${() => copyWebhook(t)}>Copy</${Button}>
              </div>
            `)}
          </div>

          ${webhookToken && html`
            <p class="feat-hint ui-text-low">
              New token (save somewhere safe): <code>${webhookToken}</code>
            </p>
          `}

          <div class="feat-backup-setup__actions">
            <${Button} kind="neutral" size="sm" loading=${testing} disabled=${testing || !webhookEnabled} onClick=${handleTest}>
              Test it worked
            </${Button}>
          </div>
        </div>
      `}

      ${error && html`<p class="feat-backup-setup__error">${error}</p>`}

      <div class="feat-backup-setup__actions">
        <${Button} kind="accent" loading=${saving} disabled=${!mode || saving} onClick=${handleSave}>
          ${trackingOff ? 'Save — turn off tracking' : 'Save external settings'}
        </${Button}>
      </div>

      <${FolderBrowseModal}
        open=${markerBrowseOpen}
        onClose=${() => setMarkerBrowseOpen(false)}
        onSelect=${(p) => setMarkerPath(p)}
        title="Choose marker file location"
      />
    </div>
  `;
}
