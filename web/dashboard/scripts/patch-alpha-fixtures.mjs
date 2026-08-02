/**
 * Post-process generated preview fixtures in data/.
 * Invoked automatically at the end of generate-mock-data.mjs (dynamic import).
 *
 * Run standalone: node scripts/patch-alpha-fixtures.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'data');

function readJson(name) {
  const path = join(dataDir, name);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(name, value) {
  writeFileSync(join(dataDir, name), `${JSON.stringify(value, null, 2)}\n`);
}

function isoAt(ms) {
  return new Date(ms).toISOString();
}

function buildUpdateCheck(now) {
  return {
    enabled: true,
    current: '1.2.0-beta.1',
    current_version: '1.2.0-beta.1',
    update_available: false,
    latest_version: '1.2.0-beta.1',
    published_at: isoAt(now - 3 * 86400_000),
    channel: 'beta',
    release_url: 'https://github.com/djinnbanter/WatchTower/releases/tag/v1.2.0-beta.1',
    modrinth_url: 'https://modrinth.com/mod/watchtower',
    urls: {
      github:
        'https://github.com/djinnbanter/WatchTower/releases/download/v1.2.0-beta.1/watchtower-neoforge-1.2.0-beta.1+mc1.21.jar',
      release_page: 'https://github.com/djinnbanter/WatchTower/releases/tag/v1.2.0-beta.1',
      modrinth: 'https://modrinth.com/mod/watchtower',
    },
  };
}

function buildPreviewSettings() {
  return {
    hostname: 'demo-server',
    panel: 'none',
    panel_display_name: 'None',
    backup_dirs: '/srv/backups/minecraft,/mnt/nas/mc-backups',
    backup_dir: '/srv/backups/minecraft',
    backup_tracking_enabled: true,
    backup_tracking_mode: 'local',
    backup_external_configured: false,
    backup_webhook_enabled: false,
    backup_suppress_local_missing: false,
    modrinth_lookup: true,
    modrinth_auto_scan_on_mod_changes: true,
    spark_enabled: true,
    spark_mod_loaded: true,
    spark_auto_capture_on_lag: true,
    spark_auto_capture_window_sec: 120,
    spark_auto_capture_cooldown_sec: 600,
    baseline_auto_capture: true,
    baseline_regression_threshold_pct: 10,
    tps_warn: 19.5,
    mspt_warn: 50,
    disk_warn_pct: 85,
    disk_fill_warn_days: 14,
    backup_stale_hours: 24,
    disk_io_latency_warn_ms: 50,
    chunk_write_pressure_enabled: true,
    chunk_write_growth_chunks: 48,
    chunk_write_sustained_scans: 3,
    update_check: true,
    lookback_hours: 24,
    incremental: true,
    report_retention_days: 30,
    report_retention_count: 14,
    ops_poll_sec: 60,
    ops_log_scan_sec: 60,
    live_sample_interval_seconds: 1,
    dashboard_port: 8787,
    metrics_context_banner: true,
  };
}

function buildAlphaProfiles() {
  return {
    default: 'normal',
    profiles: {
      normal: {
        label: 'Normal demo',
        description: 'Full generated fixtures with reports, ops cache, and performance history.',
        env: { PREVIEW_PROFILE: 'normal' },
      },
      fresh: {
        label: 'Fresh install',
        description: 'Empty reports index — wizard / first-run flow with minimal ops scan data.',
        env: { PREVIEW_PROFILE: 'fresh' },
      },
      loading: {
        label: 'Loading session',
        description: 'Slow initial hydration with report and Modrinth jobs already in progress.',
        env: { PREVIEW_PROFILE: 'loading' },
      },
      empty: {
        label: 'Empty collections',
        description: 'Established session with no live sample, activity, issues, Spark profiles, or performance history.',
        env: { PREVIEW_PROFILE: 'empty' },
      },
      'high-load': {
        label: 'High load',
        description: 'Elevated MSPT, active tick-lag issue, and baseline regression warning.',
        env: { PREVIEW_PROFILE: 'high-load' },
      },
      error: {
        label: 'Error / degraded',
        description: 'Update check failure, stale report meta, and degraded health signals.',
        env: { PREVIEW_PROFILE: 'error' },
      },
      degraded: {
        label: 'Error / degraded (alias)',
        description: 'Alias of the error profile for degraded-state testing.',
        env: { PREVIEW_PROFILE: 'degraded' },
        alias_for: 'error',
      },
    },
  };
}

function buildModrinthStatus(now) {
  const startedAt = isoAt(now - 96_000);
  const finishedAt = isoAt(now - 88_000);
  return {
    enabled: true,
    running: false,
    stage: 'done',
    stage_label: 'Modrinth scan complete',
    stage_detail: null,
    progress: { done: 8, total: 8 },
    batch: { index: 2, count: 2, size: 128 },
    eta_seconds: null,
    last_run: {
      started_at: startedAt,
      finished_at: finishedAt,
      duration_ms: 8000,
      success: true,
    },
    history: [
      {
        started_at: isoAt(now - 86400_000 - 75_000),
        finished_at: isoAt(now - 86400_000 - 68_000),
        duration_ms: 7000,
        success: true,
        matched: 38,
        outdated: 3,
      },
      {
        started_at: startedAt,
        finished_at: finishedAt,
        duration_ms: 8000,
        success: true,
        matched: 38,
        outdated: 3,
      },
    ],
    stats: {
      jars_considered: 42,
      matched: 38,
      unresolved: 4,
      outdated: 3,
      coverage_pct: 90,
      cache_hit_rate: 72,
      cache_entries: 40,
      api_requests: 6,
      rate_limit_waits: 0,
      rps: 5,
      hash_batches: 1,
      project_batches: 1,
      truncated: false,
      side_tag_mix: { server_required: 12, client_only: 8, both: 14, other: 4 },
      top_outdated: [
        { mod_id: 'create', title: 'Create' },
        { mod_id: 'flywheel', title: 'Flywheel' },
      ],
    },
    success: true,
    error: null,
  };
}

function mockRamSizing() {
  return {
    window: '7d',
    gc_verdict_source: 'window',
    sufficient_data: true,
    sample_minutes: 10080,
    span_days: 7,
    heap_used_gb_avg: 5.75,
    heap_used_gb_p95: 6.2,
    heap_used_gb_peak: 6.8,
    heap_pressure_pct_avg: 71.9,
    heap_pressure_pct_p95: 78.1,
    heap_pressure_pct_peak: 84.2,
    xmx_source: 'live',
    xmx_gb: 8,
    host_mem_gb: 16,
    ram_source: 'cgroup_v2',
    outside_headroom_gb: 8,
    envelope: 'ok',
    gc_verdict: 'healthy',
    verdict: 'right_sized',
    ram_upgrade_blocked: false,
    headroom_gb: 1.2,
    advice: 'Heap peaked around 6.8 GB of 8 GB — sizing looks about right for this window.',
  };
}

function mockRamSizingTight() {
  return {
    ...mockRamSizing(),
    xmx_gb: 6,
    host_mem_gb: 8,
    outside_headroom_gb: 2,
    envelope: 'low',
    verdict: 'envelope_tight',
    ram_upgrade_blocked: true,
    suggested_xmx_gb_min: 4,
    suggested_xmx_gb_max: 5,
    headroom_gb: 1.0,
    advice:
      'Host memory ~8 GB (cgroup). Java heap (-Xmx) 6 GB leaves little room outside Java — risk of an external OOM kill. Try -Xmx4G–5G on this host, or a larger plan.',
  };
}

function mockBaselineRegression(now) {
  return {
    active: true,
    can_set_baseline: true,
    threshold_pct: 10,
    has_baseline: true,
    baseline_captured_at: isoAt(now - 10 * 86400_000),
    baseline_source: 'auto',
    label: 'Slower than your baseline',
    detail: 'MSPT p95 is 18% higher than your saved baseline over the last 7 days.',
    severity: 'warn',
    worst_metric: 'mspt_p95',
    worst_delta_pct: 18.2,
    since: isoAt(now - 4 * 86400_000).slice(0, 10),
    deltas_pct: { mspt_p95: 18.2, tps_p50: 4.1, heap_pressure_pct_p95: 6.5 },
    baseline_metrics: {
      tps_p50: 19.6,
      tps_p95: 19.9,
      mspt_p50: 11.2,
      mspt_p95: 38.4,
      heap_pressure_pct_p50: 68,
      heap_pressure_pct_p95: 74,
    },
    current_metrics: {
      sample_minutes: 10080,
      tps_p50: 18.8,
      tps_p95: 19.4,
      mspt_p50: 13.1,
      mspt_p95: 45.3,
      heap_pressure_pct_p50: 72,
      heap_pressure_pct_p95: 79,
      players_peak: 8,
    },
  };
}

function mockDiskProjection(factsProjection) {
  if (factsProjection && typeof factsProjection === 'object') {
    return { ...factsProjection };
  }
  return {
    verdict: 'filling',
    days_until_full: 9.2,
    fill_rate_gb_per_day: 1.4,
    lookback_hours: 24,
    sample_minutes: 980,
    confidence: 'ok',
    disk_free_gb: 12.5,
    disk_use_pct: 78,
    message: '≈9 days until full at current growth',
    driver_hint: 'world +1.2 GB in 24h',
  };
}

function seedIssuesLive(opsCache, facts, now) {
  const nowIso = isoAt(now);
  const byKey = new Map();

  const add = (row) => {
    const key = row.key || row.id;
    if (!key || byKey.has(key)) return;
    byKey.set(key, row);
  };

  for (const issue of facts?.issues ?? []) {
    if (!issue?.id || issue.historical) continue;
    const seenAt = issue.evidence?.[0]?.time || issue.event_time || nowIso;
    add({
      id: issue.id,
      key: issue.id,
      severity: issue.severity || 'warning',
      status: 'open',
      first_seen: seenAt,
      last_seen: nowIso,
      evidence_fingerprint: `facts:${String(issue.id).toLowerCase()}`,
      source: 'report',
      message: issue.message || issue.id,
      evidence_refs: [`facts:issues:${issue.id}`],
      fix_steps: [],
    });
  }

  for (const lag of opsCache?.lag_issues?.entries ?? []) {
    if (lag.resolved) continue;
    const lagAt = lag.time || nowIso;
    add({
      id: 'TICK_LAG',
      key: `lag:${lag.incident_id || lag.id || 'active'}`,
      severity: lag.severity || 'critical',
      status: 'open',
      first_seen: lagAt,
      last_seen: lagAt,
      evidence_fingerprint: `tick_lag:${lag.incident_id || lag.id || 'active'}`,
      source: 'ops',
      message: lag.narrative || lag.title || 'Server tick lag detected',
      evidence_refs: lag.incident_id ? [`incident:${lag.incident_id}`] : ['ops:lag_issues'],
      fix_steps: Array.isArray(lag.hints) ? lag.hints.slice(0, 3) : [],
    });
  }

  if (opsCache?.log_stale?.active) {
    const gap = Math.round(opsCache.log_stale.gap_minutes ?? 0);
    add({
      id: 'LOG_STALE',
      key: 'LOG_STALE',
      severity: 'warning',
      status: 'open',
      first_seen: opsCache.log_stale.last_mtime || nowIso,
      last_seen: nowIso,
      evidence_fingerprint: 'log_stale',
      source: 'ops',
      message: `Log output stale — ${gap} min since latest.log was written`,
      evidence_refs: ['ops:log_stale'],
      fix_steps: ['Confirm the server process is still running', 'Check disk space and log rotation'],
    });
  }

  if (opsCache?.disk_jump?.active) {
    add({
      id: 'DISK_JUMP',
      key: 'DISK_JUMP',
      severity: 'warning',
      status: 'open',
      first_seen: opsCache.disk_jump.scanned_at || nowIso,
      last_seen: nowIso,
      evidence_fingerprint: 'disk_jump',
      source: 'ops',
      message: opsCache.disk_jump.message || 'Disk use jumped since last check',
      evidence_refs: ['ops:disk_jump'],
      fix_steps: ['Review world growth and backup retention on the Insights → Storage tab'],
    });
  }

  for (const d of opsCache?.mods_inventory?.diff?.drift ?? []) {
    if (!d?.jar) continue;
    add({
      id: `MOD_JAR_DRIFT:${d.jar}`,
      key: `MOD_JAR_DRIFT:${d.jar}`,
      severity: 'warning',
      status: 'open',
      first_seen: opsCache.mods_inventory?.scanned_at || nowIso,
      last_seen: nowIso,
      evidence_fingerprint: `mod_drift:${d.jar}`,
      source: 'ops',
      message: `\`${d.jar}\` changed without a version bump — verify this was intentional.`,
      evidence_refs: ['ops:mods_inventory'],
      fix_steps: [
        'Open Mods → Changes and confirm the jar swap was intentional.',
        'If unexpected, restore the jar from a known-good backup and re-check.',
      ],
    });
  }

  for (const e of opsCache?.mods_light?.client_only_mods ?? []) {
    if (e?.bucket !== 'likely_removable' || String(e?.confidence || '').toLowerCase() !== 'high') continue;
    const modId = e.mod_id || e.id;
    if (!modId) continue;
    add({
      id: `CLIENT_ON_SERVER:${modId}`,
      key: `CLIENT_ON_SERVER:${modId}`,
      severity: 'info',
      status: 'open',
      first_seen: opsCache.mods_light?.updated_at || nowIso,
      last_seen: nowIso,
      evidence_fingerprint: `client_on_server:${modId}`,
      source: 'ops',
      message: e.reason
        ? `${e.display_name || modId} — ${e.reason}`
        : `${e.display_name || modId} looks client-only and is likely removable from this dedicated server.`,
      evidence_refs: ['ops:mods_light'],
      fix_steps: [
        'Open Mods → Overview (Client filter) and confirm this jar is not needed server-side.',
        e.removal_advice || 'Remove or quarantine the jar if players do not need it on the server, then restart.',
      ].filter(Boolean),
    });
  }

  return [...byKey.values()];
}

function patchPerformanceDashboard(name, facts, now) {
  const dash = readJson(name);
  if (!dash) return false;
  let changed = false;
  if (!dash.ram_sizing) {
    // Prefer a tight-host example on the 7d pack so Insights Configs shows envelope UI.
    dash.ram_sizing = name.includes('7d') ? mockRamSizingTight() : mockRamSizing();
    changed = true;
  } else if (dash.ram_sizing.envelope == null) {
    const base = mockRamSizing();
    dash.ram_sizing = {
      ...dash.ram_sizing,
      host_mem_gb: dash.ram_sizing.host_mem_gb ?? base.host_mem_gb,
      ram_source: dash.ram_sizing.ram_source ?? base.ram_source,
      outside_headroom_gb: dash.ram_sizing.outside_headroom_gb ?? base.outside_headroom_gb,
      envelope: dash.ram_sizing.envelope ?? base.envelope,
    };
    changed = true;
  }
  if (!dash.disk_projection) {
    dash.disk_projection = mockDiskProjection(facts?.optional?.disk_projection);
    changed = true;
  }
  if (!dash.baseline_regression) {
    dash.baseline_regression = mockBaselineRegression(now);
    changed = true;
  }
  if (changed) writeJson(name, dash);
  return changed;
}

function patchSparkFixtures(now) {
  const list = readJson('spark-profiles.json');
  if (!list || !Array.isArray(list.profiles)) return false;
  const firstPath = list.report_profile_path
    ?? list.profiles[0]?.source_path
    ?? list.profiles[0]?.path
    ?? null;
  list.spark_enabled = list.spark_enabled !== false;
  list.enabled = list.enabled !== false;
  list.report_profile_path = firstPath;
  list.auto_profile_path = firstPath;
  list.auto_capture = {
    enabled: true,
    reason: 'tick_lag',
    captured_at: isoAt(now - 8 * 60_000),
    source_path: firstPath,
  };
  list.profiles = list.profiles.map((profile, index) => ({
    ...profile,
    mtime: index === 0 ? isoAt(now - 8 * 60_000) : profile.mtime,
    fresh: profile.fresh !== false,
    auto_captured: profile.source_path === firstPath,
  }));
  writeJson('spark-profiles.json', list);
  return true;
}

function buildIncidentsIndex(opsCache) {
  const incidents = (opsCache?.lag_issues?.entries ?? [])
    .filter((entry) => entry?.incident_id)
    .map((entry) => ({
      id: entry.incident_id,
      pinned_at: entry.time ?? null,
      severity: entry.severity ?? 'warning',
      title: entry.title ?? 'Lag incident',
      narrative: entry.narrative ?? null,
      source: 'ops',
    }));
  return {
    incidents,
    count: incidents.length,
    updated_at: opsCache?.lag_issues?.updated_at ?? opsCache?.updated_at ?? null,
  };
}

export async function patchAlphaFixtures(options = {}) {
  const now = options.now ?? Date.now();
  const summary = [];

  const facts = readJson('facts.json');
  const opsCache = readJson('ops-cache.json');

  writeJson('update-check.json', buildUpdateCheck(now));
  summary.push('update-check.json');

  writeJson('preview-settings.json', buildPreviewSettings());
  summary.push('preview-settings.json');

  writeJson('preview-profiles.json', buildAlphaProfiles());
  summary.push('preview-profiles.json');

  writeJson('modrinth-status.json', buildModrinthStatus(now));
  summary.push('modrinth-status.json');

  if (opsCache) {
    let opsChanged = false;
    if (!Array.isArray(opsCache.issues_live)) {
      const issues_live = seedIssuesLive(opsCache, facts, now);
      opsCache.issues_live = issues_live;
      summary.push(`ops-cache.json (+issues_live ×${issues_live.length})`);
      opsChanged = true;
    }
    if (!opsCache.issues_live_updated_at) {
      opsCache.issues_live_updated_at = opsCache.updated_at ?? isoAt(now);
      opsChanged = true;
    }
    if (opsChanged) {
      writeJson('ops-cache.json', opsCache);
    }
    writeJson('incidents-index.json', buildIncidentsIndex(opsCache));
    summary.push('incidents-index.json');
  }

  if (patchSparkFixtures(now)) {
    summary.push('spark-profiles.json (+auto profile)');
  }

  if (opsCache && !opsCache.updated_at) {
    opsCache.updated_at = isoAt(now);
    writeJson('ops-cache.json', opsCache);
  }

  for (const name of ['performance-dashboard.json', 'performance-dashboard-30d.json']) {
    if (patchPerformanceDashboard(name, facts, now)) {
      summary.push(`${name} (+ram_sizing, disk_projection, baseline_regression)`);
    }
  }

  console.log(`patch-alpha-fixtures: wrote/patched ${summary.length} target(s)`);
  for (const line of summary) console.log(`  + ${line}`);
  return { summary };
}

await patchAlphaFixtures();
