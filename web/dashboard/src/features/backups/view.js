import { html, useState, useMemo, useEffect } from '../../lib/preact.js';
import { opsCache, reports, settings } from '../../state/stores.js';
import { scanBackups, addToast, loadSettings } from '../../state/actions.js';
import { navigate } from '../../app/router.js';
import { Page, Section, MetricTile, DataTable, FilterBar, EmptyState } from '../../ui/patterns/index.js';
import { Button, Badge } from '../../ui/primitives/index.js';
import { Icon } from '../../ui/icons.js';
import { formatGb, formatMb } from '../../domain/formats.js';
import { parseBackupDirs } from './setup-steps.js';

function backupAgeLabel(ageHours) {
  if (ageHours == null) return '—';
  if (ageHours < 1) return `${Math.round(ageHours * 60)}m ago`;
  if (ageHours < 24) return `${ageHours.toFixed(1)}h ago`;
  return `${(ageHours / 24).toFixed(1)}d ago`;
}

function ageTone(ageHours, warnDays) {
  if (ageHours == null) return 'warn';
  const warnHours = (warnDays != null ? Number(warnDays) : 1) * 24;
  if (ageHours < warnHours) return 'ok';
  if (ageHours < warnHours * 1.5) return 'warn';
  return 'danger';
}

function badgeTone(tone) {
  if (tone === 'success' || tone === 'ok') return 'ok';
  return tone;
}

function verdictTone(ageHours, configured, warnDays) {
  if (!configured) return 'neutral';
  return ageTone(ageHours, warnDays ?? 1.08);
}

function AgeChip({ ageHours, warnDays }) {
  if (ageHours == null) return html`<${Badge} tone="neutral">—</${Badge}>`;
  const tone = ageTone(ageHours, warnDays);
  return html`<${Badge} tone=${badgeTone(tone)} className="feat-age-chip">${backupAgeLabel(ageHours)}</${Badge}>`;
}

function normalizeInventoryRow(f, warnDays) {
  const file = f.file ?? f.filename ?? '—';
  const sizeMb = f.size_mb != null
    ? Number(f.size_mb)
    : f.size_gb != null
      ? Number(f.size_gb) * 1024
      : null;
  let ageHours = f.age_hours != null ? Number(f.age_hours) : null;
  if (ageHours == null && f.age_days != null) ageHours = Number(f.age_days) * 24;
  let mtime = f.mtime ?? null;
  if (mtime == null && f.time) {
    const ms = Date.parse(f.time);
    if (!isNaN(ms)) mtime = ms / 1000;
  }
  if (ageHours == null && mtime != null) {
    ageHours = (Date.now() / 1000 - Number(mtime)) / 3600;
  }
  return { file, size_mb: sizeMb, mtime, age_hours: ageHours, warn_days: warnDays };
}

function BackupKpis({ backupsLive, facts, warnDays }) {
  const lastBackup = backupsLive?.last_backup ?? facts?.optional?.last_backup ?? null;
  const ageHours = lastBackup?.age_hours
    ?? (lastBackup?.age_days != null ? Number(lastBackup.age_days) * 24 : null);
  const archives = backupsLive?.inventory_summary?.file_count
    ?? lastBackup?.inventory_count
    ?? (facts?.optional?.backup_inventory ?? facts?.optional?.backups ?? []).length
    ?? 0;
  const tone = ageTone(ageHours, warnDays);
  const scannedAt = backupsLive?.scanned_at ?? null;

  return html`
    <div class="feat-kpi-row">
      <${MetricTile}
        label="Newest age"
        value=${ageHours ?? 0}
        format=${() => backupAgeLabel(ageHours)}
        tone=${ageHours != null ? tone : 'warn'}
        source=${scannedAt ? { layer: 'scan', at: scannedAt } : undefined}
      />
      <${MetricTile}
        label="Archives"
        value=${archives}
        format=${(v) => String(Math.round(v))}
        source=${scannedAt ? { layer: 'scan', at: scannedAt } : { layer: 'report' }}
      />
      ${warnDays != null && html`
        <${MetricTile}
          label="Warn threshold"
          value=${Number(warnDays)}
          format=${(v) => `${v}d`}
          caption="Stale after this age"
          source=${{ layer: 'report' }}
        />
      `}
    </div>
  `;
}

function VerdictCard({ backupsLive, facts, warnDays, localConfigured, externalConfigured }) {
  const lastBackup = backupsLive?.last_backup;
  const ext = facts?.optional?.backup_external ?? null;
  const ageHours = lastBackup?.age_hours
    ?? ext?.age_hours
    ?? (facts?.optional?.last_backup?.age_hours != null
      ? Number(facts.optional.last_backup.age_hours)
      : facts?.optional?.last_backup?.age_days != null
        ? Number(facts.optional.last_backup.age_days) * 24
        : null);
  const configured = localConfigured || externalConfigured || !!backupsLive || !!facts?.optional?.last_backup;

  const tone = verdictTone(ageHours, configured, warnDays);
  const label = tone === 'ok' ? 'OK' : tone === 'warn' ? 'Stale' : tone === 'danger' ? 'Critical' : 'Unknown';

  if (!configured) {
    return html`
      <${EmptyState}
        icon="💾"
        title="Backups not configured"
        body="Set up a backup folder or panel heartbeat in Settings → Backups. Watchtower never guesses paths for you."
        action=${html`
          <${Button} kind="accent" onClick=${() => navigate('settings', { panel: 'backups' })}>
            Open Settings → Backups
          </${Button}>
        `}
      />
    `;
  }

  if (!localConfigured && externalConfigured) {
    return html`
      <div class="feat-backup-verdict feat-card feat-card--${tone === 'ok' ? 'success' : tone}">
        <div class="feat-backup-verdict__status">
          <${Badge} tone=${badgeTone(tone)}>${label}</${Badge}>
          <span class="feat-backup-verdict__mode">Panel / cloud signal</span>
        </div>
        <p class="feat-hint ui-text-low">
          Backups run off this machine (bloom, S3, etc.). Watchtower tracks the panel heartbeat — there is no local archive list to show.
        </p>
        ${ext?.last_at && html`
          <div class="feat-backup-verdict__last">Last signal: ${backupAgeLabel(ageHours)}</div>
        `}
      </div>
    `;
  }

  const file = lastBackup?.file ?? facts?.optional?.last_backup?.path ?? null;
  const sizeMb = lastBackup?.size_mb
    ?? (facts?.optional?.last_backup?.size_gb != null
      ? Number(facts.optional.last_backup.size_gb) * 1024
      : null);

  return html`
    <div class=${`feat-backup-verdict feat-card feat-card--${tone === 'ok' ? 'success' : tone}`}>
      <div class="feat-backup-verdict__status">
        <${Badge} tone=${badgeTone(tone)}>${label}</${Badge}>
        <span class="feat-backup-verdict__mode">
          ${localConfigured && externalConfigured ? 'Folder + panel' : localConfigured ? 'Folder scan' : 'Detected'}
        </span>
      </div>
      ${file && html`
        <div class="feat-backup-verdict__last">
          Last backup: ${file} — ${backupAgeLabel(ageHours)}${sizeMb != null ? ` (${formatMb(sizeMb)})` : ''}
        </div>
      `}
      ${backupsLive?.inventory_summary && html`
        <div class="feat-backup-verdict__summary">
          ${backupsLive.inventory_summary.file_count} files · ${formatGb(backupsLive.inventory_summary.total_gb)} total
        </div>
      `}
    </div>
  `;
}

function InventorySection({ backupsLive, facts, warnDays, localConfigured }) {
  const [search, setSearch] = useState('');
  const [scanning, setScanning] = useState(false);

  const inventory = useMemo(() => {
    const raw = facts?.optional?.backups ?? facts?.optional?.backup_inventory ?? [];
    return raw.map((f) => normalizeInventoryRow(f, warnDays));
  }, [facts, warnDays]);

  const filtered = useMemo(() => {
    if (!search.trim()) return inventory;
    const q = search.toLowerCase();
    return inventory.filter((f) => (f.file ?? '').toLowerCase().includes(q));
  }, [inventory, search]);

  const cols = [
    { key: 'file', label: 'File', sortable: true },
    { key: 'size_mb', label: 'Size', render: (v) => formatMb(v), align: 'right' },
    {
      key: 'age_hours',
      label: 'Age',
      sortable: true,
      render: (v, row) => html`<${AgeChip} ageHours=${v} warnDays=${row.warn_days} />`,
    },
    {
      key: 'mtime',
      label: 'Date',
      render: (v) => (v ? new Date(v * 1000).toLocaleString() : '—'),
    },
  ];

  async function handleScan() {
    setScanning(true);
    await scanBackups(true);
    setScanning(false);
    addToast('Backup scan complete', 'success');
  }

  if (!localConfigured) {
    return html`
      <${EmptyState}
        title="No local archive list"
        body="Folder inventory appears after you save a backup directory in Settings → Backups. Panel-only setups use the heartbeat — there are no zip files on disk to list."
        action=${html`
          <${Button} kind="neutral" size="sm" onClick=${() => navigate('settings', { panel: 'backups' })}>
            Configure in Settings
          </${Button}>
        `}
      />
    `;
  }

  if (!inventory.length && !backupsLive) {
    return html`
      <${EmptyState}
        title="No backup inventory yet"
        body="Save a backup folder in Settings, then run a scan — or wait for the next scheduled report."
        action=${html`<${Button} kind="accent" loading=${scanning} onClick=${handleScan}>Scan now</${Button}>`}
      />
    `;
  }

  return html`
    <${Section} title="Backup inventory" defaultOpen=${true}>
      <div class="feat-toolbar">
        <${FilterBar}
          search=${search}
          onSearch=${setSearch}
          placeholder="Search files…"
          resultCount=${filtered.length}
        />
        <${Button} kind="neutral" size="sm" loading=${scanning} onClick=${handleScan}>Rescan</${Button}>
      </div>
      ${inventory.length > 0
        ? html`
            <div class="feat-table-scroll">
              <${DataTable}
                columns=${cols}
                rows=${filtered}
                rowKey="file"
                density=${36}
                stickyHeader=${true}
                empty="No files match search"
              />
            </div>
          `
        : html`<p class="feat-hint ui-text-low">Inventory scan pending — hit Rescan to populate.</p>`
      }
    </${Section}>
  `;
}

export function PageView() {
  const opsCacheData = opsCache.value.data;
  const { facts } = reports.value;
  const settingsData = settings.value.data ?? {};

  useEffect(() => {
    loadSettings();
  }, []);

  const backupsLive = opsCacheData?.backups_live ?? null;
  const warnDays = facts?.optional?.last_backup?.warn_days
    ?? facts?.optional?.backup_config?.warn_days
    ?? null;

  const localConfigured = parseBackupDirs(settingsData).length > 0 || !!backupsLive?.inventory_summary;
  const trackingEnabled = settingsData.backup_tracking_enabled !== false;
  const externalConfigured = trackingEnabled && (
    (settingsData.backup_tracking_mode ?? 'off') !== 'off'
    || settingsData.backup_external_configured
    || !!facts?.optional?.backup_external
  );
  const anyConfigured = localConfigured || externalConfigured || !trackingEnabled;

  return html`
    <${Page}
      tour="backups"
      title="Backups"
      subtitle=${trackingEnabled
        ? 'Monitor backup age and archives — configure folders in Settings'
        : 'Backup tracking is off — alerts and Issues for backups are silenced'}
    >
      <div class="feat-backup-config-link">
        <${Button} kind="neutral" size="sm" onClick=${() => navigate('settings', { panel: 'backups' })}>
          <${Icon} name="sliders" size=${14} />
          Configure in Settings
        </${Button}>
      </div>

      ${!trackingEnabled && html`
        <${Section} title="Tracking disabled" defaultOpen=${true}>
          <p class="feat-hint">
            Watchtower is not monitoring backups and will not raise backup Issues or Overview alerts.
            Re-enable tracking anytime in <a class="ui-link" onClick=${() => navigate('settings', { panel: 'backups' })} href="#">Settings → Backups</a>.
          </p>
        </${Section}>
      `}

      ${anyConfigured && trackingEnabled && html`
        <${Section} title="At a glance" defaultOpen=${true}>
          <${BackupKpis} backupsLive=${backupsLive} facts=${facts} warnDays=${warnDays} />
        </${Section}>
      `}

      <div class="feat-backup-layout">
        <div class="feat-backup-layout__status">
          <${VerdictCard}
            backupsLive=${backupsLive}
            facts=${facts}
            warnDays=${warnDays}
            localConfigured=${localConfigured}
            externalConfigured=${externalConfigured}
          />
        </div>
        <div class="feat-backup-layout__inventory">
          <${InventorySection}
            backupsLive=${backupsLive}
            facts=${facts}
            warnDays=${warnDays}
            localConfigured=${localConfigured}
          />
        </div>
      </div>
    </${Page}>
  `;
}
