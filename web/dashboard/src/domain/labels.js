/**
 * User-facing copy / label helpers — ported from legacy labels.js.
 * Only the functions needed by Overview, Sources, and Settings are included.
 */

/**
 * Data sources explainer copy for the Sources panel.
 * Returns { intro, footer, rows }.
 */
export function dataSourcesExplainer() {
  return {
    intro: 'Watchtower collects data three ways. <strong>Live</strong> updates charts every few seconds while the dashboard is open. <strong>Scanned</strong> runs on the server in the background (~60s) — log tail, activity, mod errors, and crash folder — even when nobody has the web UI open. <strong>Report</strong> is a full audit snapshot.',
    footer: 'Schedule reports for Issues, mod manifests, and session history. Live and scans cover day-to-day ops.',
    rows: [
      { area: 'Overview vitals / charts', live: true, scan: false, report: false },
      { area: 'Overview health narrative', live: false, scan: false, report: true },
      { area: 'Issues action queue', live: false, scan: false, report: true },
      { area: 'Issues lag cards', live: false, scan: true, report: false },
      { area: 'Mods log errors', live: false, scan: true, report: false },
      { area: 'Mods manifest / conflicts', live: false, scan: false, report: true },
      { area: 'Crashes folder list', live: false, scan: true, report: false },
      { area: 'Activity recent events', live: false, scan: true, report: false },
      { area: 'Session online roster', live: true, scan: false, report: false },
      { area: 'Session playtime / peaks', live: false, scan: false, report: true },
      { area: 'Backups folder scan', live: false, scan: true, report: false },
    ],
  };
}

/**
 * Monitoring panel rows for the Settings → Monitoring table.
 * @returns {Array<{ label: string, value: string, edit: string, editNote: string, key: string }>}
 */
export function monitoringPanelRows() {
  return [
    { label: 'Watching (live sample rate)', value: 'Chart tick interval', edit: 'config/watchtower-server.toml', editNote: 'Restart server', key: 'live_sample' },
    { label: 'Scanning (ops log scan)', value: 'Background log, activity, mod errors, crash folder', edit: 'OPS_LOG_SCAN_SEC', editNote: 'watchtower.conf', key: 'ops_log_scan' },
    { label: 'Scanning (dashboard poll)', value: 'Extra crash refresh while dashboard open', edit: 'OPS_POLL_SEC', editNote: 'watchtower.conf', key: 'ops_poll' },
    { label: 'Auditing (schedule)', value: 'Full report interval', edit: 'Settings → Schedule', editNote: 'REPORT_INTERVAL_MINUTES', key: 'schedule' },
    { label: 'Auditing (retention)', value: 'How many reports to keep', edit: 'REPORT_RETENTION_COUNT / REPORT_RETENTION_DAYS', editNote: 'watchtower.conf', key: 'retention' },
  ];
}

/**
 * Return true if the environment banner should be shown.
 * @param {{ deployment?: string, metrics?: Record<string, { status: string }> }} env
 * @param {boolean} [enabled=true]
 */
export function shouldShowEnvironmentBanner(env, enabled = true) {
  if (!enabled || !env) return false;
  if (env.deployment && env.deployment !== 'bare_metal') return true;
  return Object.values(env.metrics ?? {}).some((m) => m?.status === 'misleading');
}

/**
 * Human-readable freshness text for a report meta block.
 * @param {{ stale?: boolean, age_hours?: number, last_report_at?: string }} meta
 */
export function formatReportFreshness(meta) {
  if (!meta) return '';
  if (meta.stale) {
    const age = meta.age_hours != null ? `${meta.age_hours}h ago` : 'over 24h ago';
    return `Report stale — last run ${age}. Run a fresh report for current health.`;
  }
  if (meta.last_report_at) {
    const age = meta.age_hours != null ? `${meta.age_hours}h ago` : 'recently';
    return `Report fresh — last run ${age}`;
  }
  return 'No report on disk yet';
}

/**
 * Source layer display labels.
 * @param {'live'|'scan'|'report'|'unknown'} layer
 */
export function sourceLayerLabel(layer) {
  const m = {
    live: 'Live',
    scan: 'Scanned',
    report: 'Report',
    unknown: '—',
  };
  return m[layer] ?? '—';
}

/**
 * Health status word for display.
 * @param {string} status
 */
export function healthStatus(status) {
  if (!status) return 'Unknown';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/**
 * Issue title map — same as legacy labels.js.
 * @param {string} id
 */
export function issueTitle(id) {
  const m = {
    MOD_LOAD_FAILED: 'Mod problem',
    MOD_UPDATE_CONFLICT: 'Mod update conflicts',
    CRASH_REPORT: 'Crash reports on disk',
    BACKUP_NOT_CONFIGURED: 'Backups not set up',
    BACKUP_NOT_FOUND: 'Backup failure',
    BACKUP_STALE: 'Backup is stale',
    MANUAL_REBOOT: 'Server machine rebooted',
    OOM: 'Out of memory',
    DISK_HIGH: 'Disk almost full',
    MEM_LOW: 'Low system memory',
    TICK_LAG: 'Server falling behind',
    MSPT_HIGH: 'High tick time',
    TPS_LOW: 'Low TPS',
    DH_PREGEN_THROTTLE: 'World pregen slowing server',
    DH_PREGEN_STALL: 'World pregen may be stuck',
    CHUNKY_PREGEN_STALL: 'Chunky pregen may be stuck',
    CHUNKY_PREGEN_DEGRADED: 'Chunky pregen running slowly',
    CHUNKY_PREGEN_THROTTLE: 'Chunky pregen during high load',
    CHUNK_GEN_DURING_PREGEN: 'Chunk errors during pregen',
    PANEL_DOWN: 'Control panel offline',
    LOG_STALE: 'Logs look stale',
    CLIENT_NOISE: 'Client UI mods on server',
  };
  return m[id] || id.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * One-line event title for activity log rows.
 * @param {{ type: string, detail?: string }} ev
 */
export function eventTitle(ev) {
  const t = ev.type === 'crash' ? 'crash_report' : ev.type === 'reboot' ? 'manual_reboot' : ev.type;
  if (t === 'server_start') return 'Server started';
  if (t === 'clean_stop') return 'Server stopped cleanly';
  if (t === 'crash_report') return 'Crash report saved';
  if (t === 'manual_reboot') return 'Machine rebooted';
  if (t === 'kernel_oom') return 'Out-of-memory kill';
  if (t === 'player_join') return ev.detail || 'Player joined';
  if (t === 'player_leave') return ev.detail || 'Player left';
  if (t === 'command') return ev.detail ? `Command: ${ev.detail}` : 'Command issued';
  if (t === 'tick_lag') return 'Server tick lag';
  if (t === 'lag_incident') return 'Lag spike captured';
  if (t === 'backup_job') return ev.detail ? `Backup: ${ev.detail}` : 'Backup in progress';
  if (t === 'restart_scheduled') return ev.detail || 'Restart scheduled';
  if (t === 'performance_spike') return ev.detail || 'Sticky lag after players left';
  return ev.detail || ev.type || 'Activity';
}

/**
 * Event category label for activity log grouping.
 * @param {string} type
 */
export function eventType(type) {
  const t = type === 'crash' ? 'crash_report' : type === 'reboot' ? 'manual_reboot' : type;
  const m = {
    server_start: 'Lifecycle',
    clean_stop: 'Lifecycle',
    crash_report: 'Crash',
    manual_reboot: 'System',
    panel_command: 'Task',
    player_join: 'Session',
    player_leave: 'Session',
    command: 'Task',
    tick_lag: 'System',
    lag_incident: 'System',
    kernel_oom: 'System',
    backup_job: 'Task',
    restart_scheduled: 'Lifecycle',
    performance_spike: 'Performance',
  };
  return m[t] || 'Event';
}

/**
 * Friendly heap headroom summary.
 * @param {{ used?: number, max?: number }} heap
 * @param {{ java_xmx_gb?: number }} [sys]
 */
export function heapHeadroomLabel(heap, sys) {
  const used = Number(heap?.used ?? 0);
  const max = Number(heap?.max ?? (sys?.java_xmx_gb ?? 0) * 1024);
  if (!max) return { value: '—', subtitle: 'Heap unknown' };
  const freeGb = Math.max(0, (max - used) / 1024);
  return {
    value: `${freeGb.toFixed(1)}`,
    subtitle: `Java heap · ${Math.round(used)} / ${Math.round(max)} MB used`,
  };
}

/**
 * "Run a report" helper blurb for the report runner.
 */
export function runReportHelperCopy() {
  return 'Builds an audit snapshot — full Issues list, mod analysis, session stats, and log window. Day-to-day tabs still update from scans between reports.';
}

function panelDisplayName(panelId) {
  const m = {
    bloom: 'Bloom',
    crafty: 'Crafty',
    pterodactyl: 'Pterodactyl',
    pebblehost: 'PebbleHost',
    aternos: 'Aternos',
    multicraft: 'Multicraft',
  };
  return m[panelId] || (panelId ? panelId.charAt(0).toUpperCase() + panelId.slice(1) : 'Unknown');
}

function formatJavaVersion(raw) {
  if (!raw) return '—';
  const s = String(raw);
  const m = s.match(/(?:version\s+)?(\d+(?:\.\d+)*)/i);
  return m ? `Java ${m[1]}` : s.slice(0, 24);
}

function backupPillLabelCombined(backup, external, mode) {
  const ext = external?.configured ? external : null;
  const m = mode || (() => {
    const local = backup && backup.status !== 'unconfigured';
    if (local && ext) return 'hybrid';
    if (ext) return 'external_only';
    if (local) return 'local_only';
    return 'none';
  })();
  if (m === 'external_only' && ext) {
    if (ext.status === 'success' && !ext.stale) {
      const src = ext.source ? ` (${ext.source})` : '';
      return `OK${src}`;
    }
    if (ext.status === 'running') return 'Running';
    if (ext.stale || ext.status === 'stale') return 'Stale';
    if (ext.status === 'missing') return 'No heartbeat';
    return 'External';
  }
  if (!backup) return ext?.configured ? backupPillLabelCombined(null, ext, 'external_only') : 'Unknown';
  if (backup.status === 'success') {
    const src = ext?.source && m === 'hybrid' ? ` (${ext.source})` : '';
    return `OK${src}`;
  }
  if (backup.status === 'not_found') return 'Not found';
  if (backup.status === 'unconfigured') {
    if (ext?.configured) return backupPillLabelCombined(null, ext, 'external_only');
    return 'Unconfigured';
  }
  if (backup.stale || backup.status === 'stale') return 'Stale';
  return 'Check';
}

function backupPillTone(backup, external, mode, trackingEnabled = true) {
  if (trackingEnabled === false) return 'neutral';
  const label = backupPillLabelCombined(backup, external, mode);
  if (label.includes('OK') || label.includes('Running')) return 'ok';
  if (label.includes('Stale') || label.includes('Unconfigured') || label.includes('Unknown') || label.includes('Check')) return 'warn';
  if (label.includes('Not found') || label.includes('No heartbeat')) return 'danger';
  return 'warn';
}

/**
 * Build Overview status pills: Hosting / Java / Mods / Backup.
 * @returns {Array<{ label: string, value: string, icon: string, tone: string }>}
 */
export function overviewStatusPills({ facts, live, opsCache, overviewMeta, backupTrackingEnabled } = {}) {
  const f = facts ?? {};
  const env = f.optional?.host_environment;
  const panelId = String(f.meta?.panel || env?.hosting || '').toLowerCase();
  const deployment = env?.deployment;

  let hosting;
  if (panelId && panelId !== 'none' && panelId !== 'unknown') {
    hosting = { label: 'Hosting', value: panelDisplayName(panelId), icon: 'cloud', tone: 'neutral' };
  } else if (deployment === 'bare_metal') {
    hosting = { label: 'Environment', value: 'Bare metal', icon: 'server', tone: 'neutral' };
  } else if (deployment === 'vps') {
    hosting = { label: 'Environment', value: 'VPS', icon: 'cloud', tone: 'neutral' };
  } else if (deployment === 'container') {
    hosting = { label: 'Environment', value: 'Container', icon: 'cloud', tone: 'neutral' };
  } else {
    hosting = { label: 'Hosting', value: f.meta?.hostname || 'Local', icon: 'server', tone: 'neutral' };
  }

  const javaRaw = live?.java_version ?? f.system?.java_version;
  const javaRunning = f.health?.java_running !== false;
  const java = javaRaw
    ? { label: 'Java', value: formatJavaVersion(javaRaw), icon: 'coffee', tone: 'neutral' }
    : { label: 'Java', value: javaRunning ? '—' : 'Offline', icon: 'coffee', tone: javaRunning ? 'neutral' : 'warn' };

  const modCount = overviewMeta?.running_mod_count
    ?? opsCache?.running_mods?.count
    ?? f.optional?.mods?.length
    ?? null;
  const errCount = (opsCache?.mod_log_errors?.new_count)
    ?? (opsCache?.mod_log_errors?.entries?.length)
    ?? 0;
  let modsValue = '—';
  if (modCount != null) {
    modsValue = String(modCount);
    if (errCount > 0) modsValue += ` (${errCount} err)`;
  } else if (errCount > 0) {
    modsValue = `${errCount} with errors`;
  }
  const mods = {
    label: 'Mods',
    value: modsValue,
    icon: 'package',
    tone: errCount > 0 ? 'warn' : 'neutral',
  };

  const lastBackup = f.optional?.last_backup;
  const external = f.optional?.backup_external ?? opsCache?.backup_external;
  const trackingOn = backupTrackingEnabled !== false;

  return [
    hosting,
    java,
    mods,
    {
      label: 'Backup',
      value: trackingOn
        ? backupPillLabelCombined(lastBackup, external, overviewMeta?.backup_mode)
        : 'Not tracking',
      icon: 'archive',
      tone: trackingOn
        ? backupPillTone(lastBackup, external, overviewMeta?.backup_mode, true)
        : 'neutral',
    },
  ];
}
