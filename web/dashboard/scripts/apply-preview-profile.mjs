/**
 * Apply a named preview profile to dashboard fixtures.
 *
 * Usage:
 *   node scripts/apply-preview-profile.mjs [profile]
 *   PREVIEW_PROFILE=fresh node scripts/apply-preview-profile.mjs
 *
 * Profiles (see data/preview-profiles.json):
 *   normal     — regenerate mock data + patch (default full demo)
 *   fresh      — empty reports-index, minimal ops cache (first-run / wizard)
 *   loading    — delayed hydration with report and Modrinth jobs in progress
 *   empty      — established session with empty live/ops/performance collections
 *   high-load  — elevated MSPT, active tick lag, regression warning
 *   error      — update-check failure, stale overview meta, degraded health
 *   degraded   — alias of error
 *
 * Typical workflow:
 *   npm run generate:mock
 *   node scripts/apply-preview-profile.mjs high-load
 *   npm run preview
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'data');

const requestedProfile = (process.argv[2] || process.env.PREVIEW_PROFILE || 'normal').trim().toLowerCase();
const PROFILE_NAMES = ['normal', 'fresh', 'loading', 'empty', 'error', 'degraded', 'high-load'];

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

function runGenerate() {
  // Always create a complete base first; the selected profile is a reversible
  // transform over that base. This prevents switching profiles from compounding.
  const env = { ...process.env, PREVIEW_PROFILE: 'normal' };
  const result = spawnSync(process.execPath, ['scripts/generate-mock-data.mjs'], {
    cwd: root,
    stdio: 'inherit',
    env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function writeActiveProfile(name, now, behavior = {}) {
  const canonical = name === 'degraded' ? 'error' : name;
  writeJson('active-profile.json', {
    name,
    canonical_name: canonical,
    applied_at: isoAt(now),
    behavior,
  });
}

function applyFresh(now) {
  writeJson('reports-index.json', { reports: [] });
  const ops = readJson('ops-cache.json');
  if (!ops) return;
  const minimal = {
    schema_version: ops.schema_version ?? 3,
    updated_at: isoAt(now),
    issues_live: [],
    issues_live_updated_at: isoAt(now),
    activity: {
      scanned_at: isoAt(now),
      new_count: 1,
      events: [{
        time: isoAt(now - 60_000),
        type: 'scan',
        detail: 'Initial ops scan (fresh preview profile)',
        source: 'scan',
      }],
    },
    lag_issues: { updated_at: isoAt(now), active_count: 0, entries: [] },
    crashes: { scanned_at: isoAt(now), count: 0, unreviewed: 0, unreviewed_groups: 0, entries: [] },
    right_now: { updated_at: isoAt(now), signals: [] },
    log_stale: { checked_at: isoAt(now), active: false, gap_minutes: 0 },
    backups_live: { scanned_at: isoAt(now) },
    scorecard: { low_tps_minutes_24h: 0, low_tps_minutes_7d: 0, mspt_p95_24h: 12 },
  };
  writeJson('ops-cache.json', minimal);
  const meta = readJson('overview-meta.json');
  if (meta) {
    meta.stale = true;
    meta.last_report_at = null;
    meta.health_grade = '—';
    meta.scorecard = {
      grade: 'unknown',
      grade_word: 'Unknown',
      performance: { subtitle: 'No report yet' },
      crashes: { unreviewed: 0 },
    };
    writeJson('overview-meta.json', meta);
  }
}

function applyLoading(now) {
  const status = readJson('modrinth-status.json') ?? {};
  status.enabled = true;
  status.running = true;
  status.stage = 'hash';
  status.stage_label = 'Hashing jars';
  status.stage_detail = 'Fixture scan already in progress…';
  status.progress = { done: 2, total: 8 };
  status.batch = { index: 1, count: 2, size: 128 };
  status.eta_seconds = 6;
  status.success = null;
  status.error = null;
  status.last_run = { started_at: isoAt(now - 2_000) };
  writeJson('modrinth-status.json', status);
}

function applyEmpty(now) {
  const envelope = readJson('live-envelope.json');
  if (envelope) {
    envelope.latest = null;
    for (const key of ['bandwidth_history', 'disk_io_history']) {
      if (Array.isArray(envelope[key])) envelope[key] = [];
    }
    writeJson('live-envelope.json', envelope);
  }

  const samples = readJson('live-samples.json');
  if (samples && typeof samples === 'object') {
    for (const key of Object.keys(samples)) {
      if (Array.isArray(samples[key])) samples[key] = [];
    }
    writeJson('live-samples.json', samples);
  }

  const ops = readJson('ops-cache.json');
  if (ops) {
    ops.updated_at = isoAt(now);
    ops.issues_live = [];
    ops.issues_live_updated_at = isoAt(now);
    ops.activity = { scanned_at: isoAt(now), new_count: 0, events: [] };
    ops.lag_issues = { updated_at: isoAt(now), active_count: 0, entries: [] };
    ops.crashes = { scanned_at: isoAt(now), count: 0, unreviewed: 0, unreviewed_groups: 0, entries: [] };
    ops.right_now = { updated_at: isoAt(now), signals: [] };
    ops.incident_stories = [];
    writeJson('ops-cache.json', ops);
  }

  writeJson('issues-peek.json', { updated_at: isoAt(now), count: 0, issues: [] });
  writeJson('incidents-index.json', { incidents: [], count: 0, updated_at: isoAt(now) });

  const sparkProfiles = readJson('spark-profiles.json');
  if (sparkProfiles) {
    sparkProfiles.profiles = [];
    sparkProfiles.report_profile_path = null;
    sparkProfiles.auto_profile_path = null;
    sparkProfiles.auto_capture = { enabled: true, source_path: null, captured_at: null };
    writeJson('spark-profiles.json', sparkProfiles);
  }

  const modrinth = readJson('modrinth-status.json') ?? {};
  writeJson('modrinth-status.json', {
    ...modrinth,
    running: false,
    stage: null,
    stage_label: null,
    progress: { done: 0, total: 0 },
    last_run: null,
    history: [],
    stats: null,
    success: null,
  });

  for (const name of [
    'performance-rollups.json',
    'performance-rollups-7d.json',
    'performance-rollups-30d.json',
  ]) {
    const rollups = readJson(name);
    if (!rollups) continue;
    rollups.rows = [];
    rollups.sufficient_data = false;
    if (rollups.summary) rollups.summary.sample_minutes = 0;
    writeJson(name, rollups);
  }

  for (const name of [
    'performance-dashboard.json',
    'performance-dashboard-30d.json',
    'performance-insights.json',
    'performance-insights-30d.json',
  ]) {
    const data = readJson(name);
    if (!data) continue;
    data.sufficient_data = false;
    data.busy_quiet = { busy_hours: [], quiet_hours: [] };
    for (const key of ['player_bins', 'outlier_minutes', 'sticky_lag', 'insights', 'hour_of_week', 'daily_series', 'related_events']) {
      if (Array.isArray(data[key])) data[key] = [];
    }
    writeJson(name, data);
  }
}

function scaleSeriesPoint(point, factor) {
  if (!point || point.v == null) return point;
  return { ...point, v: Math.round(point.v * factor * 10) / 10 };
}

function applyHighLoad(now) {
  const samples = readJson('live-samples.json');
  if (samples && typeof samples === 'object') {
    for (const key of ['mspt', 'host_cpu']) {
      if (Array.isArray(samples[key])) {
        samples[key] = samples[key].map((p, i) => scaleSeriesPoint(p, i >= samples[key].length - 40 ? 2.8 : 1.6));
      }
    }
    if (Array.isArray(samples.tps)) {
      samples.tps = samples.tps.map((p, i) => {
        if (p?.v == null) return p;
        const factor = i >= samples.tps.length - 40 ? 0.72 : 0.88;
        return { ...p, v: Math.round(p.v * factor * 100) / 100 };
      });
    }
    writeJson('live-samples.json', samples);
  }

  const envelope = readJson('live-envelope.json');
  if (envelope?.latest) {
    envelope.latest.mspt = Math.max(envelope.latest.mspt ?? 0, 68);
    envelope.latest.tps = Math.min(envelope.latest.tps ?? 20, 14.2);
    envelope.latest.host_cpu_pct = Math.max(envelope.latest.host_cpu_pct ?? 0, 88);
    writeJson('live-envelope.json', envelope);
  }

  const ops = readJson('ops-cache.json');
  if (ops) {
    const lagAt = isoAt(now - 5 * 60_000);
    const incidentId = `high-load-${lagAt.replace(/[:.]/g, '-').replace('Z', 'Z')}`;
    ops.issues_live = [{
      id: 'TICK_LAG',
      key: 'TICK_LAG',
      severity: 'critical',
      status: 'open',
      first_seen: lagAt,
      last_seen: lagAt,
      evidence_fingerprint: 'tick_lag:high_load',
      source: 'ops',
      message: "Can't keep up — MSPT sustained above 65 ms with 6 players online",
      evidence_refs: [`incident:${incidentId}`, 'ops:lag_issues'],
      fix_steps: ['Pause Chunky pregen during peak hours', 'Check entity farms and chunk loaders'],
    }];
    ops.issues_live_updated_at = lagAt;
    ops.lag_issues = {
      updated_at: lagAt,
      active_count: 1,
      entries: [{
        id: 'LAG-HIGH-LOAD',
        incident_id: incidentId,
        severity: 'critical',
        time: lagAt,
        title: 'Lag spike — MSPT 68ms · TPS 14.2',
        narrative: "Can't keep up — MSPT sustained above 65 ms with 6 players online",
        resolved: false,
        metrics: { tps: 14.2, mspt: 68, players_online: 6 },
      }],
    };
    writeJson('ops-cache.json', ops);
    const incident = {
      id: incidentId,
      pinned_at: lagAt,
      source: 'auto',
      trigger: 'auto_mspt',
      severity: 'critical',
      tps: 14.2,
      mspt: 68,
      players_online: 6,
      narrative: "Can't keep up — MSPT sustained above 65 ms with 6 players online",
      findings: [
        { kind: 'confirmed', category: 'load', text: 'MSPT remained above 65 ms' },
        { kind: 'confirmed', category: 'players', text: '6 players online during the spike' },
      ],
      primary_suspect: 'Chunk generation and entity load overlapped during peak traffic',
    };
    mkdirSync(join(dataDir, 'incidents'), { recursive: true });
    writeFileSync(join(dataDir, 'incidents', `${incidentId}.json`), `${JSON.stringify(incident, null, 2)}\n`);
    writeJson('incidents-index.json', {
      incidents: [{
        id: incidentId,
        pinned_at: lagAt,
        severity: 'critical',
        title: 'Lag spike — MSPT 68ms · TPS 14.2',
        narrative: incident.narrative,
        source: 'ops',
      }],
      count: 1,
      updated_at: lagAt,
    });
  }

  for (const name of ['performance-dashboard.json', 'performance-dashboard-30d.json']) {
    const dash = readJson(name);
    if (!dash) continue;
    dash.baseline_regression = {
      ...(dash.baseline_regression ?? {}),
      active: true,
      has_baseline: true,
      severity: 'warn',
      label: 'Slower than your baseline',
      detail: 'MSPT p95 is 32% higher than your saved baseline — load spike in the last 24h.',
      worst_metric: 'mspt_p95',
      worst_delta_pct: 32.4,
      deltas_pct: { mspt_p95: 32.4, tps_p50: 12.8 },
    };
    if (dash.summary_extended) {
      dash.summary_extended.mspt_avg = Math.max(dash.summary_extended.mspt_avg ?? 0, 28);
      dash.summary_extended.low_tps_minutes = Math.max(dash.summary_extended.low_tps_minutes ?? 0, 180);
    }
    writeJson(name, dash);
  }

  const meta = readJson('overview-meta.json');
  if (meta) {
    meta.health_grade = 'D';
    meta.scorecard = {
      ...(meta.scorecard ?? {}),
      grade: 'degraded',
      grade_word: 'Degraded',
    };
    writeJson('overview-meta.json', meta);
  }
}

function applyError(now) {
  writeJson('update-check.json', {
    enabled: true,
    current: '1.1.3a',
    current_version: '1.1.3a',
    update_available: false,
    error: 'check_failed',
    channel: 'stable',
    modrinth_url: 'https://modrinth.com/mod/watchtower',
  });

  const meta = readJson('overview-meta.json');
  if (meta) {
    meta.stale = true;
    meta.health_grade = 'F';
    meta.scorecard = {
      grade: 'critical',
      grade_word: 'Critical',
      performance: { subtitle: 'Report stale — rescan recommended' },
      crashes: { unreviewed: meta.scorecard?.crashes?.unreviewed ?? 12 },
    };
    writeJson('overview-meta.json', meta);
  }

  const ops = readJson('ops-cache.json');
  if (ops) {
    ops.log_stale = {
      checked_at: isoAt(now),
      active: true,
      gap_minutes: 180,
      last_mtime: isoAt(now - 180 * 60_000),
    };
    const staleRow = {
      id: 'LOG_STALE',
      key: 'LOG_STALE',
      severity: 'critical',
      status: 'open',
      first_seen: isoAt(now - 180 * 60_000),
      last_seen: isoAt(now),
      evidence_fingerprint: 'log_stale',
      source: 'ops',
      message: 'Log output stale — 180 min since latest.log was written',
      evidence_refs: ['ops:log_stale'],
      fix_steps: ['Check whether the Minecraft server process is running'],
    };
    ops.issues_live = [staleRow];
    ops.issues_live_updated_at = isoAt(now);
    writeJson('ops-cache.json', ops);
  }
}

export function applyProfile(profile, { now = Date.now() } = {}) {
  const name = String(profile || 'normal').trim().toLowerCase();
  if (!PROFILE_NAMES.includes(name)) {
    throw new Error(`Unknown profile "${name}". Expected: ${PROFILE_NAMES.join(', ')}`);
  }

  let behavior = { simulator: true };
  if (name === 'fresh') {
    applyFresh(now);
    behavior = { simulator: false, first_run: true };
  } else if (name === 'loading') {
    applyLoading(now);
    behavior = {
      simulator: true,
      boot_delay_ms: 1400,
      report_running: true,
      modrinth_running: true,
    };
  } else if (name === 'empty') {
    applyEmpty(now);
    behavior = { simulator: false, empty_collections: true };
  } else if (name === 'high-load') {
    applyHighLoad(now);
    behavior = { simulator: false, high_load: true };
  } else if (name === 'error' || name === 'degraded') {
    applyError(now);
    behavior = {
      simulator: false,
      degraded: true,
      live_error: 'Live collector unavailable in degraded preview',
      performance_error: 'Performance history is temporarily unavailable',
    };
  }
  writeActiveProfile(name, now, behavior);
  return { name, behavior };
}

async function main() {
  console.log(`apply-preview-profile: ${requestedProfile}`);
  if (!PROFILE_NAMES.includes(requestedProfile)) {
    throw new Error(`Unknown profile "${requestedProfile}". Expected: ${PROFILE_NAMES.join(', ')}`);
  }
  runGenerate();
  applyProfile(requestedProfile);
  console.log(`apply-preview-profile: applied "${requestedProfile}" transforms`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === resolve(fileURLToPath(import.meta.url))) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
