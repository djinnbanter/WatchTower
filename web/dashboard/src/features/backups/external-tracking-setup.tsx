/**
 * Panel / cloud backup tracking — POST /api/backups/external (prod ExternalCloudStep).
 */
import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { useCanWrite, VIEW_ONLY_TITLE } from '@/app/permissions';
import { FolderBrowseModal } from '@/features/backups/folder-browse';
import { parseBackupDirs } from '@/features/backups/local-folder-setup';
import { Button } from '@/ui/patterns';
import { asRecord, bool, str } from '@/lib/utils';

export const TRACKING_OPTS = [
  { value: 'folder', label: 'Folder on this server' },
  { value: 'heartbeat', label: 'Panel or cloud' },
  { value: 'both', label: 'Both' },
  { value: 'off', label: 'Not tracking' },
] as const;

export type TrackingUiMode = (typeof TRACKING_OPTS)[number]['value'];

const WEBHOOK_EVENTS = ['start', 'complete', 'fail'] as const;

export function deriveUiTrackingMode(
  data: Record<string, unknown> | null | undefined,
): TrackingUiMode | null {
  if (!data) return null;
  if (data.backup_tracking_enabled === false) return 'off';
  const ext = str(data.backup_tracking_mode, 'off');
  const local = parseBackupDirs(data).length > 0;
  const externalOn = ext !== 'off' && ext !== '';
  if (local && externalOn) return 'both';
  if (externalOn) return 'heartbeat';
  if (local) return 'folder';
  return null;
}

export function ExternalTrackingSetup({
  settingsData,
  onSaved,
}: {
  settingsData?: Record<string, unknown> | null;
  onSaved?: (patch?: Record<string, unknown>) => void;
}) {
  const canWrite = useCanWrite();
  const [mode, setMode] = useState<TrackingUiMode | null>(() => deriveUiTrackingMode(settingsData));
  const [markerPath, setMarkerPath] = useState(
    str(settingsData?.backup_external_marker_rel || settingsData?.backup_external_marker),
  );
  const [webhookToken, setWebhookToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [markerBrowseOpen, setMarkerBrowseOpen] = useState(false);

  useEffect(() => {
    setMode(deriveUiTrackingMode(settingsData));
    const marker = str(
      settingsData?.backup_external_marker_rel || settingsData?.backup_external_marker,
    );
    if (marker) setMarkerPath(marker);
  }, [settingsData]);

  const showExternal = mode === 'heartbeat' || mode === 'both';
  const trackingOff = mode === 'off';
  const webhookEnabled = bool(settingsData?.backup_webhook_enabled) || !!webhookToken;

  function copyWebhook(type: string) {
    const url = `${window.location.origin}/api/backups/heartbeat/${type}`;
    void navigator.clipboard?.writeText(url).catch(() => {});
    setInfo(`${type} webhook URL copied`);
  }

  function buildPayload(): Record<string, unknown> {
    if (mode === 'off') {
      return { trackingEnabled: false, trackingMode: 'off' };
    }
    if (mode === 'folder') {
      return { trackingEnabled: true, trackingMode: 'off' };
    }
    const payload: Record<string, unknown> = {
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
    setInfo('');
    try {
      const result = asRecord(await api.saveBackupExternal(buildPayload()));
      if (str(result.backup_webhook_token)) {
        setWebhookToken(str(result.backup_webhook_token));
        setInfo('Webhook token generated — copy it into your panel script');
      } else if (mode === 'off') {
        setInfo('Backup tracking disabled — alerts and Issues for backups are off');
      } else {
        setInfo('External backup settings saved');
      }
      onSaved?.(asRecord(result.settings));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save backup tracking settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setError('');
    setInfo('');
    try {
      await api.testBackupExternal();
      setInfo('Test signal received — panel backup tracking works');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test failed — save external settings first');
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-wt-text">Panel or cloud backups</h3>
        <p className="mt-1 text-xs text-wt-text-low">
          For backups that never land on this disk — panel jobs, S3, or cloud sync.
        </p>
        <p className="mt-2 rounded-lg border border-wt-warn/35 bg-wt-warn/10 px-3 py-2 text-xs text-wt-text-mid">
          <strong className="font-semibold text-wt-warn">Alpha</strong> — panel / cloud backup
          tracking is experimental and may not work reliably on every host. Prefer a local backup
          folder when you can; treat webhook / marker setup as best-effort for now.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-wt-text-low">
          How should Watchtower track backups?
        </p>
        <div className="flex flex-wrap gap-1.5">
          {TRACKING_OPTS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setMode(opt.value);
                setError('');
              }}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                mode === opt.value
                  ? 'border-wt-accent bg-wt-accent text-white'
                  : 'border-wt-line bg-wt-bg2/50 text-wt-text-mid hover:border-wt-accent/40 hover:text-wt-text'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {!mode ? (
          <p className="text-xs text-wt-text-low">Pick an option — nothing is enabled until you save.</p>
        ) : null}
        {trackingOff ? (
          <p className="text-xs text-wt-text-low">
            Backup Issues and Overview alerts stay off. Folder paths are kept if you re-enable later.
          </p>
        ) : null}
      </div>

      {showExternal ? (
        <div className="space-y-3 rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg2/40 p-4">
          <ol className="list-decimal space-y-1 pl-4 text-xs text-wt-text-low">
            <li>Save below to generate a webhook token (if you do not have one yet).</li>
            <li>Copy the webhook URL into your panel’s “after backup” task or cron script.</li>
            <li>Optionally set a marker file Watchtower can read when a job finishes.</li>
            <li>
              Run a backup, then click <strong>Test it worked</strong>.
            </li>
          </ol>

          <label className="block text-sm">
            <span className="font-medium text-wt-text">Marker file (optional)</span>
            <div className="mt-1.5 flex gap-2">
              <input
                type="text"
                value={markerPath}
                placeholder="watchtower/backup-heartbeat.json"
                onChange={(e) => setMarkerPath(e.target.value)}
                className="min-w-0 flex-1 rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1 px-3 py-2 font-mono text-sm outline-none focus:border-wt-accent"
              />
              <Button
                kind="default"
                type="button"
                disabled={!canWrite}
                title={canWrite ? undefined : VIEW_ONLY_TITLE}
                onClick={() => setMarkerBrowseOpen(true)}
              >
                Browse…
              </Button>
            </div>
            <span className="mt-1 block text-xs text-wt-text-low">
              Relative to the server directory, or browse to pick a path
            </span>
          </label>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-wt-text-low">
              Webhook URLs
            </p>
            <p className="mt-1 text-xs text-wt-text-low">
              Add <code className="rounded bg-wt-bg1 px-1">Authorization: Bearer &lt;token&gt;</code>{' '}
              when calling from your panel.
            </p>
            <ul className="mt-2 space-y-1.5">
              {WEBHOOK_EVENTS.map((t) => (
                <li
                  key={t}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-wt-line bg-wt-bg1/60 px-2.5 py-2"
                >
                  <code className="font-mono text-xs text-wt-text">/api/backups/heartbeat/{t}</code>
                  <Button kind="ghost" onClick={() => copyWebhook(t)}>
                    Copy
                  </Button>
                </li>
              ))}
            </ul>
          </div>

          {webhookToken ? (
            <p className="text-xs text-wt-text-low">
              New token (save somewhere safe):{' '}
              <code className="rounded bg-wt-bg1 px-1 font-mono">{webhookToken}</code>
            </p>
          ) : null}

          <Button
            kind="default"
            disabled={!canWrite || testing || !webhookEnabled}
            title={canWrite ? undefined : VIEW_ONLY_TITLE}
            onClick={() => void handleTest()}
          >
            {testing ? 'Testing…' : 'Test it worked'}
          </Button>
        </div>
      ) : null}

      {error ? <p className="text-sm text-wt-danger">{error}</p> : null}
      {info ? <p className="text-sm text-wt-ok">{info}</p> : null}

      <Button
        kind="primary"
        disabled={!canWrite || !mode || saving}
        title={canWrite ? undefined : VIEW_ONLY_TITLE}
        onClick={() => void handleSave()}
      >
        {saving ? 'Saving…' : trackingOff ? 'Save — turn off tracking' : 'Save external settings'}
      </Button>

      <FolderBrowseModal
        open={markerBrowseOpen}
        onClose={() => setMarkerBrowseOpen(false)}
        onSelect={(p) => setMarkerPath(p)}
        title="Choose marker file location"
      />
    </div>
  );
}
