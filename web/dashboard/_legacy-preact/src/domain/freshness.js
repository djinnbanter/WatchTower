/**
 * Time / freshness utilities — all pure functions, no side-effects.
 */

/**
 * Age in milliseconds of an ISO timestamp or ms epoch, relative to nowMs.
 * Returns NaN if the input cannot be parsed.
 */
export function ageMs(isoOrMs, nowMs = Date.now()) {
  if (isoOrMs == null) return NaN;
  const t = typeof isoOrMs === 'number' ? isoOrMs : Date.parse(String(isoOrMs));
  if (isNaN(t)) return NaN;
  return nowMs - t;
}

/**
 * Human-readable age string: "4s ago", "2m ago", "3h ago", "2d ago", or "—".
 */
export function formatAge(ms) {
  if (ms == null || isNaN(ms) || ms < 0) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

/**
 * Returns true if the report meta is considered stale.
 * Stale if the report's stale flag is set, or if age_hours > 24.
 */
export function isStaleReport(meta, nowMs = Date.now()) {
  if (!meta) return false;
  if (meta.stale) return true;
  if (meta.age_hours != null && meta.age_hours > 24) return true;
  if (meta.last_report_at || meta.generated) {
    const ts = meta.last_report_at || meta.generated;
    const age = ageMs(ts, nowMs);
    if (!isNaN(age) && age > 24 * 60 * 60 * 1000) return true;
  }
  return false;
}

/**
 * Source layer identifier for a given data field.
 * Returns 'live' | 'scan' | 'report' | 'unknown'.
 */
export function resolveSourceLayer(field) {
  const liveFields = [
    'tps', 'mspt', 'host_cpu_pct', 'players_online', 'heap_mb',
    'mem_available_gb', 'disk_use_pct', 'disk_free_gb', 'world_gb',
    'mem_used_gb', 'mem_total_gb',
    'net_rx_mbps', 'net_tx_mbps', 'disk_read_mb_s', 'disk_write_mb_s',
    'entities', 'chunks', 'java_rss_gb',
  ];
  const scanFields = [
    'crashes', 'mod_log_errors', 'activity', 'running_mods',
    'client_mods', 'backups', 'ops_cache',
  ];
  const reportFields = [
    'issues', 'health', 'session', 'player_directory', 'mod_recommendations',
    'spark_profile', 'facts', 'meta',
  ];

  if (liveFields.includes(field)) return 'live';
  if (scanFields.includes(field)) return 'scan';
  if (reportFields.includes(field)) return 'report';
  return 'unknown';
}
