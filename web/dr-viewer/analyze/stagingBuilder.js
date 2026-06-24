/**
 * Minimal staging skeleton — port of StagingBuilder.newStagingSkeleton (DR subset).
 */
export function buildStagingSkeleton(options = {}) {
  const now = new Date().toISOString();
  const lookbackHours = options.lookbackHours ?? 168;
  const cutoff = Math.floor(Date.now() / 1000) - lookbackHours * 3600;
  const windowStart = new Date(cutoff * 1000).toISOString();

  return {
    meta: {
      generated: now,
      hostname: options.hostname || 'local-export',
      lookback_hours: lookbackHours,
      window_start: windowStart,
      incremental: false,
      server_dir: options.serverDir || '(uploaded export)',
      panel: 'dr',
      panel_display_name: 'Disaster Recovery',
      loader: options.loader || 'neoforge',
      engine: 'dr-browser',
      engine_version: '0.1.0',
    },
    flags: {
      java_running: false,
      panel_running: false,
    },
    thresholds: {
      disk_warn_pct: 85,
      mem_warn_avail_gb: 2,
      log_stale_minutes: 15,
    },
    events: [],
    minecraft: {
      clean_shutdown_seen: false,
      oom_in_logs: false,
      cant_keep_up_count: 0,
      new_crash_reports: [],
      log_had_activity_in_window: false,
      tick_lag_evidence: [],
      oom_evidence: [],
    },
    optional: {},
    health_log_gap_minutes: null,
    kernel_oom_evidence: [],
    collection_warnings: [],
    _cutoffEpoch: cutoff,
  };
}
