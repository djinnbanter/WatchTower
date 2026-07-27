/**
 * Fixture source — static preview mode.
 * Loads data/*.json files and simulates live updates for development / demo.
 */

import {
  live, samples, overviewMeta, players, reports, opsCache, dataSources,
  issuesPeek, activity, updateCheck, spark,
  performance, settings, noReportYet, acks, crashGroups, inbox, issueSuppressions,
  modrinthScan, discovery,
} from '../state/stores.js';
import { createSimState, stepSim } from './mock-physics.js';
import { MOCK_MEM_TOTAL_GB } from './mock-physics.js';
import { groupCrashes, mergeCrashRows } from '../domain/crash-groups.js';

async function loadJson(path) {
  const r = await fetch(path);
  if (!r.ok) return null;
  return r.json();
}

// ── Fixture paths ──────────────────────────────────────────────────────────────

const PATHS = {
  reportsIndex:        'data/reports-index.json',
  liveSamples:         'data/live-samples.json',
  liveEnvelope:        'data/live-envelope.json',
  opsCache:            'data/ops-cache.json',
  overviewMeta:        'data/overview-meta.json',
  issuesPeek:          'data/issues-peek.json',
  perfRollups:         'data/performance-rollups.json',
  perfRollups7d:       'data/performance-rollups-7d.json',
  perfRollups30d:      'data/performance-rollups-30d.json',
  perfInsights:        'data/performance-insights.json',
  perfInsights30d:     'data/performance-insights-30d.json',
  perfDashboard:       'data/performance-dashboard.json',
  perfDashboard30d:    'data/performance-dashboard-30d.json',
  sparkProfiles:       'data/spark-profiles.json',
  sparkProfileMocks:   'data/spark-profile-mocks.json',
  crashContexts:       'data/crash-contexts.json',
  logsIndex:           'data/logs-index.json',
  snapshot:            'data/snapshot.json',
};

function factsPath(rep) {
  return `data/${rep.facts}`;
}
function briefPath(rep) {
  return `data/${rep.brief}`;
}

export class FixtureSource {
  constructor() {
    this._reportCache = {};
    this._crashContexts = null;
    this._sparkProfileMocks = null;
    this._simulatorTimer = null;
    this._simState = null;
  }

  // ── Boot / initial load ────────────────────────────────────────────────────

  async boot() {
    const [
      index,
      envelope,
      samplesRaw,
      opsCacheData,
      overviewMetaData,
      issuesPeekData,
      perfRollups,
      perfInsights,
      perfDashboard,
    ] = await Promise.all([
      loadJson(PATHS.reportsIndex),
      loadJson(PATHS.liveEnvelope),
      loadJson(PATHS.liveSamples),
      loadJson(PATHS.opsCache).catch(() => null),
      loadJson(PATHS.overviewMeta).catch(() => null),
      loadJson(PATHS.issuesPeek).catch(() => null),
      loadJson(PATHS.perfRollups).catch(() => null),
      loadJson(PATHS.perfInsights).catch(() => null),
      loadJson(PATHS.perfDashboard).catch(() => null),
    ]);

    // Live — enrich latest with derived mem_used when fixtures only ship available
    const latestBase = envelope?.latest ?? null;
    const memTotal = latestBase?.mem_total_gb ?? MOCK_MEM_TOTAL_GB;
    const latest = latestBase ? {
      ...latestBase,
      mem_total_gb: latestBase.mem_total_gb ?? memTotal,
      mem_used_gb: latestBase.mem_used_gb
        ?? (latestBase.mem_available_gb != null
          ? Math.round(Math.max(0, memTotal - latestBase.mem_available_gb) * 100) / 100
          : null),
    } : null;
    const envelopeHydrated = envelope ? { ...envelope, latest } : envelope;

    live.value = {
      envelope: envelopeHydrated,
      latest,
      error: null,
      at: Date.now(),
    };

    // Samples — hydrate IO + mem used, then rebase timestamps to "now"
    const seriesHydrated = _ensureThermalSeries(
      _rebaseSeriesToNow(_ensureMemUsedSeries(_ensureIoSeries(samplesRaw ?? {}, envelopeHydrated), envelopeHydrated)),
    );
    samples.value = {
      series: seriesHydrated,
      window: { kind: 'hours', value: 1 },
      points: _countPoints(seriesHydrated),
      at: Date.now(),
      error: null,
    };

    // Ops cache
    if (opsCacheData) opsCache.value = { data: opsCacheData, at: Date.now() };

    const rep0 = index?.reports?.[0];
    dataSources.value = {
      liveAt: latest?.ts ?? latest?.at ?? envelope?.latest?.at ?? null,
      scanAt: opsCacheData?.updated_at ?? null,
      reportAt: rep0?.generated ?? null,
      supportComposeAt: opsCacheData?.last_support_compose_at ?? null,
      issuesLiveAt: opsCacheData?.issues_live_updated_at ?? opsCacheData?.updated_at ?? null,
      nextScheduledMin: null,
      opsPollSec: 60,
      opsLogScanSec: 60,
    };

    // Overview meta
    if (overviewMetaData) overviewMeta.value = { data: overviewMetaData, at: Date.now() };

    // Issues peek
    if (issuesPeekData) issuesPeek.value = { data: issuesPeekData, at: Date.now() };

    // Performance
    performance.value = {
      window: '7d',
      rollups: perfRollups,
      insights: perfInsights,
      dashboard: perfDashboard,
      at: Date.now(),
    };

    // Reports
    await this._loadReports(index);

    // Players from facts optional
    const activeFacts = reports.value.facts;
    if (activeFacts?.optional?.player_directory) {
      players.value = { directory: activeFacts.optional.player_directory, at: Date.now() };
    }

    // Activity events
    this._hydrateActivity(opsCacheData, activeFacts);

    // Crash acks + grouped crashes + inbox (preview)
    await this.fetchCrashAcks();
    await this.fetchCrashesGrouped();
    await this.fetchInbox();

    return { envelope, samplesRaw, index };
  }

  async _loadReports(index) {
    const reps = index?.reports ?? [];
    if (!reps.length) {
      noReportYet.value = true;
      return;
    }

    for (const rep of reps) {
      const [facts, brief] = await Promise.all([
        loadJson(factsPath(rep)).catch(() => null),
        fetch(briefPath(rep)).then((r) => r.ok ? r.text() : '').catch(() => ''),
      ]);
      this._reportCache[rep.id] = { facts, brief };
    }

    const latestCached = this._reportCache['latest'];
    const prevCached = this._reportCache['prev'];

    noReportYet.value = !latestCached?.facts;
    reports.value = {
      ...reports.value,
      index: reps,
      facts: latestCached?.facts ?? null,
      prevFacts: prevCached?.facts ?? null,
      brief: latestCached?.brief ?? null,
      activeId: 'latest',
    };
  }

  _hydrateActivity(opsCacheData, facts) {
    const ledger = opsCacheData?.activity?.events ?? [];
    const factEvents = facts?.events ?? [];
    const seen = new Set();
    const merged = [];
    for (const ev of [...factEvents, ...ledger]) {
      const key = `${ev?.time}|${ev?.type}|${ev?.detail}`;
      if (!seen.has(key)) { seen.add(key); merged.push(ev); }
    }
    merged.sort((a, b) => {
      const ta = Date.parse(String(a?.time || '').replace(',', '.').replace(' ', 'T'));
      const tb = Date.parse(String(b?.time || '').replace(',', '.').replace(' ', 'T'));
      return (isNaN(tb) ? 0 : tb) - (isNaN(ta) ? 0 : ta);
    });
    activity.value = {
      events: merged,
      incidentStories: Array.isArray(opsCacheData?.incident_stories)
        ? opsCacheData.incident_stories
        : (Array.isArray(facts?.optional?.incident_stories) ? facts.optional.incident_stories : []),
      at: Date.now(),
      loading: false,
    };
  }

  // ── Live & samples ─────────────────────────────────────────────────────────

  async fetchLive() {
    // Fixtures: return current live signal value (simulator may have jittered it)
    return live.value.envelope;
  }

  async fetchSamples(window) {
    return samples.value.series;
  }

  // ── Overview meta ──────────────────────────────────────────────────────────

  async fetchMeta() {
    const data = await loadJson(PATHS.overviewMeta).catch(() => null);
    if (data) overviewMeta.value = { data, at: Date.now() };
    return data;
  }

  async fetchDataSources() {
    return null;
  }

  // ── Players ────────────────────────────────────────────────────────────────

  async fetchPlayers() {
    const facts = reports.value.facts;
    const dir = facts?.optional?.player_directory ?? null;
    players.value = { directory: dir, at: Date.now() };
    return { player_directory: dir };
  }

  // ── Reports ────────────────────────────────────────────────────────────────

  async fetchReportsIndex() {
    return { reports: reports.value.index };
  }

  async fetchReportsLatest() {
    return {
      facts: reports.value.facts,
      brief: reports.value.brief,
    };
  }

  async hydrateReports() {
    // Fixture boot already loaded reports via boot(); nothing to re-fetch.
    if (!reports.value.facts && !(reports.value.index?.length)) {
      noReportYet.value = true;
    }
  }

  async fetchReport(factsFile) {
    const rep = reports.value.index.find((r) => r.facts === factsFile);
    if (!rep) return null;
    const cached = this._reportCache[rep.id];
    if (cached) return { facts: cached.facts, brief: cached.brief };
    const [facts, brief] = await Promise.all([
      loadJson(factsPath(rep)).catch(() => null),
      fetch(briefPath(rep)).then((r) => r.ok ? r.text() : '').catch(() => ''),
    ]);
    return { facts, brief };
  }

  async fetchReportStatus() {
    const data = {
      running: reports.value.run?.running ?? false,
      started_at: reports.value.run?.startedAt ?? null,
      message: reports.value.run?.message ?? null,
      success: reports.value.run?.success ?? null,
      stage: reports.value.run?.stage ?? null,
      stage_label: reports.value.run?.stageLabel ?? null,
      stage_detail: reports.value.run?.stageDetail ?? null,
    };
    reports.value = {
      ...reports.value,
      run: {
        running: data.running,
        startedAt: data.started_at,
        message: data.message,
        success: data.running ? null : data.success,
        stage: data.stage,
        stageLabel: data.stage_label,
        stageDetail: data.stage_detail,
      },
    };
    return data;
  }

  async runReport() {
    if (this._reportSimTimer) {
      return { status: 'already_running' };
    }

    const stages = [
      { id: 'window', label: 'Computing time window', detail: 'Resolving lookback window...' },
      { id: 'collect', label: 'Collecting logs, crashes, mods, host metrics', detail: 'Scanning server logs...' },
      { id: 'analyze', label: 'Analyzing health and crashes', detail: 'Building facts...' },
      { id: 'enrich', label: 'Enriching incidents and scorecard', detail: 'Attaching lag incidents...' },
      { id: 'write', label: 'Writing facts and brief', detail: 'Writing facts JSON...' },
      { id: 'finalize', label: 'Saving state and ops cache', detail: 'Updating state.json...' },
    ];

    reports.value = {
      ...reports.value,
      run: {
        running: true,
        startedAt: Date.now(),
        message: 'Starting report…',
        success: null,
        stage: stages[0].id,
        stageLabel: stages[0].label,
        stageDetail: stages[0].detail,
      },
    };

    let step = 0;
    const tick = () => {
      step += 1;
      if (step < stages.length) {
        const stage = stages[step];
        reports.value = {
          ...reports.value,
          run: {
            ...reports.value.run,
            stage: stage.id,
            stageLabel: stage.label,
            stageDetail: stage.detail,
          },
        };
        return;
      }
      clearInterval(this._reportSimTimer);
      this._reportSimTimer = null;
      reports.value = {
        ...reports.value,
        run: {
          running: false,
          startedAt: reports.value.run.startedAt,
          message: 'Report completed',
          success: true,
          stage: stages[stages.length - 1].id,
          stageLabel: stages[stages.length - 1].label,
          stageDetail: null,
        },
      };
    };

    this._reportSimTimer = setInterval(tick, 900);
    return { status: 'started', running: true };
  }

  async fetchModrinthStatus() {
    const data = {
      enabled: settings.value?.data?.modrinth_lookup !== false,
      running: modrinthScan.value?.status?.running ?? false,
      stage: modrinthScan.value?.status?.stage ?? null,
      stage_label: modrinthScan.value?.status?.stage_label ?? null,
      stage_detail: modrinthScan.value?.status?.stage_detail ?? null,
      progress: modrinthScan.value?.status?.progress ?? { done: 0, total: 0 },
      batch: modrinthScan.value?.status?.batch ?? { index: 0, count: 0, size: 0 },
      eta_seconds: modrinthScan.value?.status?.eta_seconds ?? null,
      last_run: modrinthScan.value?.status?.last_run ?? null,
      stats: modrinthScan.value?.status?.stats ?? {
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
      success: modrinthScan.value?.status?.success ?? null,
      error: modrinthScan.value?.status?.error ?? null,
    };
    modrinthScan.value = {
      ...modrinthScan.value,
      status: { ...modrinthScan.value.status, ...data },
    };
    return data;
  }

  async runModrinthScan() {
    if (settings.value?.data?.modrinth_lookup === false) {
      return {
        status: 'disabled',
        enabled: false,
        error: 'Modrinth lookup is disabled. Enable it in Settings → Monitoring.',
      };
    }
    if (this._modrinthSimTimer) {
      return { status: 'already_running', running: true };
    }
    const stages = [
      { id: 'prepare', label: 'Preparing scan' },
      { id: 'hash', label: 'Hashing jars' },
      { id: 'cache', label: 'Checking cache' },
      { id: 'version_files', label: 'Looking up version files' },
      { id: 'projects', label: 'Fetching projects' },
      { id: 'compat', label: 'Checking compatible updates' },
      { id: 'impact', label: 'Analyzing pack impact' },
      { id: 'persist', label: 'Saving results' },
      { id: 'done', label: 'Done' },
    ];
    const started = new Date().toISOString();
    modrinthScan.value = {
      startedAt: Date.now(),
      error: null,
      status: {
        enabled: true,
        running: true,
        stage: stages[0].id,
        stage_label: stages[0].label,
        stage_detail: 'Fixture simulation…',
        progress: { done: 0, total: stages.length - 1 },
        batch: { index: 1, count: 2, size: 128 },
        eta_seconds: 8,
        last_run: { started_at: started },
        stats: modrinthScan.value.status?.stats ?? null,
        success: null,
        error: null,
      },
    };
    let step = 0;
    const tick = () => {
      step += 1;
      if (step < stages.length - 1) {
        const stage = stages[step];
        modrinthScan.value = {
          ...modrinthScan.value,
          status: {
            ...modrinthScan.value.status,
            stage: stage.id,
            stage_label: stage.label,
            progress: { done: step, total: stages.length - 1 },
            batch: { index: Math.min(2, step), count: 2, size: 128 },
            eta_seconds: Math.max(1, 8 - step),
          },
        };
        return;
      }
      clearInterval(this._modrinthSimTimer);
      this._modrinthSimTimer = null;
      const finished = new Date().toISOString();
      modrinthScan.value = {
        ...modrinthScan.value,
        status: {
          ...modrinthScan.value.status,
          running: false,
          stage: 'done',
          stage_label: 'Modrinth scan complete',
          stage_detail: null,
          progress: { done: stages.length - 1, total: stages.length - 1 },
          eta_seconds: null,
          success: true,
          last_run: {
            started_at: started,
            finished_at: finished,
            duration_ms: 4500,
            success: true,
          },
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
        },
      };
    };
    this._modrinthSimTimer = setInterval(tick, 700);
    return { status: 'started', running: true, enabled: true };
  }

  // ── Ops cache ──────────────────────────────────────────────────────────────

  async fetchOpsCache() {
    const data = await loadJson(PATHS.opsCache).catch(() => null);
    if (data) opsCache.value = { data, at: Date.now() };
    return data;
  }

  // ── Issues / peek ──────────────────────────────────────────────────────────

  async fetchIssuesPeek() {
    const data = await loadJson(PATHS.issuesPeek).catch(() => null);
    if (data) issuesPeek.value = { data, at: Date.now() };
    return data;
  }

  // ── Activity ───────────────────────────────────────────────────────────────

  async scanActivity() {
    // Preview: reload ops cache
    await this.fetchOpsCache();
    await this.fetchIssuesPeek();
    const facts = reports.value.facts;
    this._hydrateActivity(opsCache.value.data, facts);
    return { new_count: opsCache.value.data?.activity?.new_count ?? 0 };
  }

  async fetchActivity() {
    return { events: activity.value.events, incident_stories: activity.value.incidentStories ?? [] };
  }

  // ── Scans ──────────────────────────────────────────────────────────────────

  async scanCrashes() {
    await this.fetchOpsCache();
    const block = opsCache.value.data?.crashes;
    return block ? { count: block.count, unreviewed: block.unreviewed } : {};
  }

  async scanMods() {
    await this.fetchOpsCache();
    await this.fetchIssuesPeek();
    return { mod_error_count: (opsCache.value.data?.mod_log_errors?.entries ?? []).length };
  }

  async scanBackups() {
    await this.fetchOpsCache();
    return { ok: true };
  }

  async saveBackupDirs(dirs) {
    const merged = (dirs ?? []).filter(Boolean).join(',');
    settings.value = {
      ...settings.value,
      data: { ...(settings.value.data ?? {}), backup_dirs: merged },
    };
    await this.fetchOpsCache();
    return { ok: true, saved_dirs: merged };
  }

  async saveBackupExternal(payload) {
    let enabled = true;
    if (payload?.trackingEnabled === false) enabled = false;
    else if (payload?.trackingEnabled === true) enabled = true;

    let trackingMode = payload?.trackingMode ?? 'off';
    if (!enabled) trackingMode = 'off';

    const next = {
      ...(settings.value.data ?? {}),
      backup_tracking_enabled: enabled,
      backup_tracking_mode: trackingMode,
      backup_external_configured: enabled && trackingMode !== 'off',
      backup_webhook_enabled: enabled && (trackingMode === 'webhook' || trackingMode === 'both'),
      backup_suppress_local_missing: !!payload?.backupSuppressLocalMissing,
    };
    if (payload?.backupExternalMarker) {
      next.backup_external_marker_rel = payload.backupExternalMarker;
      next.backup_external_marker = payload.backupExternalMarker;
    }
    settings.value = { ...settings.value, data: next };
    const out = { ok: true, settings: next };
    if (payload?.generateWebhookToken && enabled && trackingMode !== 'off') {
      out.backup_webhook_token = 'preview-webhook-token';
    }
    return out;
  }

  // ── Crash acks / groups / inbox ────────────────────────────────────────────

  async fetchCrashAcks() {
    const facts = reports.value.facts;
    const crashes = facts?.optional?.acknowledged_crashes ?? {};
    acks.value = { ...acks.value, crashes };
    return { acknowledged_crashes: crashes };
  }

  async fetchIssueAcks() {
    return { acknowledged_issues: acks.value.issues ?? {} };
  }

  async fetchIssueSuppressions() {
    const facts = reports.value.facts;
    const data = facts?.optional?.active_suppressions
      ?? { conf_ids: [], state: [], merged: [] };
    issueSuppressions.value = { data, at: Date.now() };
    return data;
  }

  async ackIssue({ id, reviewed = true }) {
    const next = { ...(acks.value.issues ?? {}) };
    if (reviewed) {
      next[id] = { ackedAt: new Date().toISOString(), by: 'dashboard' };
    } else {
      delete next[id];
    }
    acks.value = { ...acks.value, issues: next };
    if (reviewed && typeof id === 'string' && id.startsWith('modrinth:')) {
      const modId = id.slice('modrinth:'.length);
      const inboxId = `mod_update:${modId}`;
      inbox.value = {
        items: (inbox.value.items ?? []).filter((it) => it.id !== inboxId),
        at: Date.now(),
        dismissals: { ...inbox.value.dismissals, [inboxId]: true },
      };
    }
    return { ok: true, acknowledged_issues: next };
  }

  async acknowledgeAllIssues({ ids = [] } = {}) {
    const next = { ...(acks.value.issues ?? {}) };
    let acknowledged = 0;
    for (const id of ids) {
      if (!id || next[id]) continue;
      next[id] = { ackedAt: new Date().toISOString(), by: 'dashboard' };
      acknowledged += 1;
      if (String(id).startsWith('modrinth:')) {
        const modId = String(id).slice('modrinth:'.length);
        const inboxId = `mod_update:${modId}`;
        inbox.value = {
          items: (inbox.value.items ?? []).filter((it) => it.id !== inboxId),
          at: Date.now(),
          dismissals: { ...inbox.value.dismissals, [inboxId]: true },
        };
      }
    }
    acks.value = { ...acks.value, issues: next };
    return { ok: true, acknowledged, acknowledged_issues: next };
  }

  async ackCrash({ file, reviewed }) {
    const prev = opsCache.value.data ?? {};
    const crashes = { ...(prev.crashes ?? {}) };
    if (crashes.entries) {
      crashes.entries = crashes.entries.map((e) =>
        e.file === file ? { ...e, reviewed } : e
      );
    }
    opsCache.value = { data: { ...prev, crashes }, at: Date.now() };

    const nextAcks = { ...(acks.value.crashes ?? {}) };
    const bare = file?.startsWith('crash-reports/') ? file.slice('crash-reports/'.length) : file;
    if (reviewed) {
      const record = { ackedAt: new Date().toISOString(), by: 'dashboard' };
      nextAcks[bare] = record;
      nextAcks[`crash-reports/${bare}`] = record;
    } else {
      delete nextAcks[bare];
      delete nextAcks[`crash-reports/${bare}`];
      delete nextAcks[file];
    }
    acks.value = { ...acks.value, crashes: nextAcks };
    await this.fetchCrashesGrouped();
    return { ok: true, acknowledged_crashes: nextAcks };
  }

  async fetchCrashesGrouped() {
    const summaries = reports.value.facts?.optional?.crash_summaries ?? [];
    const entries = opsCache.value.data?.crashes?.entries ?? [];
    const rows = mergeCrashRows(summaries, entries);
    const grouped = groupCrashes(rows, acks.value.crashes ?? {});
    const scanned_at = opsCache.value.data?.crashes?.scanned_at ?? null;
    crashGroups.value = { ...grouped, scanned_at, at: Date.now() };
    return { ...grouped, scanned_at };
  }

  async acknowledgeAllCrashes(payload = {}) {
    const fingerprint = payload?.fingerprint;
    const data = await this.fetchCrashesGrouped();
    const nextAcks = { ...(acks.value.crashes ?? {}) };
    let acknowledged = 0;
    for (const g of data.groups ?? []) {
      if (fingerprint && g.fingerprint !== fingerprint) continue;
      for (const m of g.members ?? []) {
        if (m.acknowledged) continue;
        const bare = m.file?.startsWith('crash-reports/')
          ? m.file.slice('crash-reports/'.length)
          : m.file;
        if (!bare) continue;
        const record = { ackedAt: new Date().toISOString(), by: 'dashboard' };
        nextAcks[bare] = record;
        nextAcks[`crash-reports/${bare}`] = record;
        acknowledged += 1;
      }
    }
    acks.value = { ...acks.value, crashes: nextAcks };
    const refreshed = await this.fetchCrashesGrouped();
    await this.fetchInbox();
    return { ok: true, acknowledged, acknowledged_crashes: nextAcks, ...refreshed };
  }

  async fetchInbox() {
    const grouped = crashGroups.value?.groups?.length
      ? crashGroups.value
      : await this.fetchCrashesGrouped();
    const dismissals = inbox.value.dismissals ?? {};
    const items = [];
    for (const g of grouped.groups ?? []) {
      if (!(g.unreviewed > 0)) continue;
      const id = `crash:${g.fingerprint}`;
      if (dismissals[id]) continue;
      const first = g.members?.[0];
      const body = first?.plain_english || first?.display_label || first?.summary || g.label;
      const kind = g.failure_kind || '';
      items.push({
        id,
        kind: 'crash_group',
        title: `${g.label} (${g.count}×)`,
        body,
        severity: kind.startsWith('watchdog') ? 'critical' : 'warning',
        href: `?tab=crashes&group=${encodeURIComponent(g.fingerprint)}`,
        created_at: g.last_at,
        meta: { fingerprint: g.fingerprint, count: g.count, unreviewed: g.unreviewed },
      });
    }
    const upd = updateCheck.value?.data;
    if (upd?.update_available && !dismissals.update) {
      items.push({
        id: 'update',
        kind: 'update_check',
        title: 'Watchtower update available',
        body: `Version ${upd.latest_version ?? 'newer'} is newer than ${upd.current ?? 'current'}.`,
        severity: 'warning',
        href: upd.modrinth_url || '?tab=settings',
        created_at: upd.published_at ?? null,
        meta: { current: upd.current, latest_version: upd.latest_version },
      });
    }
    inbox.value = { items, at: Date.now(), dismissals };
    return { items };
  }

  async dismissInboxItem({ id }) {
    const dismissals = { ...(inbox.value.dismissals ?? {}), [id]: true };
    inbox.value = {
      items: (inbox.value.items ?? []).filter((it) => it.id !== id),
      at: Date.now(),
      dismissals,
    };
    if (typeof id === 'string' && id.startsWith('mod_update:')) {
      const modId = id.slice('mod_update:'.length);
      const issueKey = `modrinth:${modId}`;
      if (!acks.value.issues?.[issueKey]) {
        await this.ackIssue({ id: issueKey, reviewed: true });
      }
    }
    return { ok: true };
  }

  async fetchCrashContext(file) {
    if (!this._crashContexts) {
      this._crashContexts = await loadJson(PATHS.crashContexts).catch(() => ({}));
    }
    return { pre_crash: this._crashContexts?.[file] ?? null };
  }

  async fetchCrashReport(file) {
    try {
      const r = await fetch(`data/crash-reports/${file}`);
      if (r.ok) return r.text();
    } catch { /* ignore */ }
    return `(Crash report preview not available in fixture mode)\n\nFile: ${file}\n\nIn live mode this would show the full server crash log.`;
  }

  async fetchModsTree(modId) {
    const mods = reports.value?.facts?.optional?.mods ?? [];
    if (!mods.length) return null;
    const { toTree } = await import('../domain/mod-graph.js');
    const match = mods.find((m) => (m.id ?? m.mod_id) === modId);
    if (!match) return null;
    return {
      mod_id: modId,
      side_score: match.side_score ?? null,
      dependents: toTree(modId, mods, 'dependents', 6),
      dependencies: toTree(modId, mods, 'dependencies', 6),
    };
  }

  // ── Logs ───────────────────────────────────────────────────────────────────

  async fetchLogsList() {
    const data = await loadJson(PATHS.logsIndex).catch(() => null);
    return data ?? { files: [] };
  }

  async fetchLogContent(file, tail = 2000) {
    const name = String(file || '').replace(/\.gz$/i, '');
    const candidates = [
      `data/logs/${file}`,
      `data/logs/${name}.txt`,
      `data/logs/${name}`,
    ];
    let text = null;
    for (const path of candidates) {
      try {
        const r = await fetch(path);
        if (r.ok) {
          text = await r.text();
          break;
        }
      } catch { /* try next */ }
    }
    if (text == null) {
      text = `(Log preview not available in fixture mode)\n\nFile: ${file}\n\nIn live mode this would show the last ${tail} lines of the server log.`;
    }
    const lines = text.split(/\r?\n/);
    const keep = Math.max(1, Math.min(20000, Number(tail) || 2000));
    const sliced = lines.length > keep ? lines.slice(-keep) : lines;
    return {
      file,
      content: sliced.join('\n'),
      truncated: lines.length > keep,
      size: text.length,
      lines: sliced.length,
    };
  }

  // ── Client mod ignores ─────────────────────────────────────────────────────

  async fetchClientModIgnores() {
    const facts = reports.value.facts;
    return { ignored_client_mods: facts?.optional?.ignored_client_mods ?? {} };
  }

  async ignoreClientMod({ mod_id, ignored }) {
    const prev = reports.value.facts?.optional?.ignored_client_mods ?? {};
    // Store locally; no persistence across reload in preview
    return { ok: true, ignored_client_mods: { ...prev, [mod_id]: ignored } };
  }

  // ── Spark ──────────────────────────────────────────────────────────────────

  async fetchSparkProfiles() {
    const data = await loadJson(PATHS.sparkProfiles).catch(() => null);
    if (data) {
      const profiles = data?.profiles ?? [];
      const reportPath = data?.report_profile_path ?? null;
      spark.value = {
        ...spark.value,
        profiles,
        skipped: data?.skipped ?? [],
        searchDirs: data?.search_dirs ?? [],
        reportProfilePath: reportPath,
        enabled: data?.spark_enabled !== false && data?.enabled !== false,
        listLoading: false,
        lastRefreshedAt: Date.now(),
      };
      // Auto-open report profile (or first) so preview isn't stuck on empty.
      if (!spark.value.activePath && !spark.value.profile && profiles.length > 0) {
        const preferred =
          reportPath
          ?? profiles[0]?.source_path
          ?? profiles[0]?.path
          ?? null;
        if (preferred) await this.fetchSparkProfile(preferred);
      }
    } else {
      spark.value = { ...spark.value, listLoading: false };
    }
    return data;
  }

  async fetchSparkProfile(path) {
    if (!this._sparkProfileMocks) {
      this._sparkProfileMocks = await loadJson(PATHS.sparkProfileMocks).catch(() => ({}));
    }
    const map = this._sparkProfileMocks?.profiles ?? this._sparkProfileMocks;
    let profile = map?.[path] ?? map?.default ?? null;
    if (!profile && map && typeof map === 'object') {
      const keys = Object.keys(map);
      if (keys.length) profile = map[keys[0]];
    }
    spark.value = { ...spark.value, profile, activePath: path, loading: false, error: null };
    return profile;
  }

  async importSparkProfile(url) {
    // Preview: pretend import succeeded using the first mock profile.
    await this.fetchSparkProfiles();
    const path = spark.value.reportProfilePath
      ?? spark.value.profiles?.[0]?.source_path
      ?? null;
    if (path) await this.fetchSparkProfile(path);
    return { ok: true, source_path: path, preview: true, url };
  }

  // ── Performance ────────────────────────────────────────────────────────────

  async fetchPerformance(window) {
    const w = window ?? '7d';
    const [dashboard, insights, rollups] = await Promise.all([
      loadJson(w === '30d' ? PATHS.perfDashboard30d : PATHS.perfDashboard).catch(() => null),
      loadJson(w === '30d' ? PATHS.perfInsights30d : PATHS.perfInsights).catch(() => null),
      loadJson(w === '30d' ? PATHS.perfRollups30d : w === '7d' ? PATHS.perfRollups7d : PATHS.perfRollups).catch(() => null),
    ]);
    const dash = dashboard && this._baselineRegressionOverride
      ? { ...dashboard, baseline_regression: this._baselineRegressionOverride }
      : dashboard;
    performance.value = { window: w, dashboard: dash, insights, rollups, at: Date.now() };
    return { dashboard: dash, insights, rollups };
  }

  async fetchPerformanceRollups(hours) {
    const path = hours >= 720 ? PATHS.perfRollups30d : hours >= 168 ? PATHS.perfRollups7d : PATHS.perfRollups;
    const data = await loadJson(path).catch(() => null);
    performance.value = { ...performance.value, rollups: data, at: Date.now() };
    return data;
  }

  async setPerformanceBaselineNow() {
    const dash = performance.value?.dashboard ?? {};
    const next = {
      ...(dash.baseline_regression ?? {}),
      active: false,
      has_baseline: true,
      baseline_source: 'manual',
      severity: 'ok',
      label: 'On pace with baseline',
      detail: 'Last 7 days are within 10% of your saved baseline (preview — baseline reset locally).',
      baseline_captured_at: new Date().toISOString(),
    };
    this._baselineRegressionOverride = next;
    performance.value = {
      ...performance.value,
      dashboard: { ...dash, baseline_regression: next },
      at: Date.now(),
    };
    return { ok: true, baseline_regression: next };
  }

  // ── Settings ───────────────────────────────────────────────────────────────

  async fetchSettings() {
    const stored = settings.value.data;
    return stored ?? {};
  }

  async saveSettings(payload) {
    const mapped = { ...(payload ?? {}) };
    if ('modrinthLookup' in mapped) {
      mapped.modrinth_lookup = !!mapped.modrinthLookup;
      delete mapped.modrinthLookup;
    }
    if ('modrinthAutoScanOnModChanges' in mapped) {
      mapped.modrinth_auto_scan_on_mod_changes = !!mapped.modrinthAutoScanOnModChanges;
      delete mapped.modrinthAutoScanOnModChanges;
    }
    if ('sparkAutoCaptureOnLag' in mapped) {
      mapped.spark_auto_capture_on_lag = !!mapped.sparkAutoCaptureOnLag;
      delete mapped.sparkAutoCaptureOnLag;
    }
    if ('baselineAutoCapture' in mapped) {
      mapped.baseline_auto_capture = !!mapped.baselineAutoCapture;
      delete mapped.baselineAutoCapture;
    }
    if ('baselineRegressionThresholdPct' in mapped) {
      mapped.baseline_regression_threshold_pct = Number(mapped.baselineRegressionThresholdPct);
      delete mapped.baselineRegressionThresholdPct;
    }
    settings.value = {
      ...settings.value,
      data: { ...(settings.value.data ?? {}), ...mapped },
    };
    return { ok: true, settings: settings.value.data };
  }

  async onboardingAudit() {
    return this.startDiscovery();
  }

  async startDiscovery() {
    const stages = [
      { id: 'window', label: 'Computing time window', detail: 'Resolving lookback window…', done: 1, total: 7, ms: 400 },
      { id: 'collect', label: 'Collecting logs, crashes, mods, host metrics', detail: 'Reading logs and crash-reports…', done: 2, total: 7, ms: 800 },
      { id: 'collect', label: 'Collecting logs, crashes, mods, host metrics', detail: 'Scanning mods and host metrics…', done: 2, total: 7, ms: 700 },
      { id: 'analyze', label: 'Analyzing health and crashes', detail: 'Building facts from collected data…', done: 3, total: 7, ms: 700 },
      { id: 'enrich', label: 'Enriching incidents and scorecard', detail: 'Attaching lag incidents and stories…', done: 4, total: 7, ms: 500 },
      { id: 'write', label: 'Writing facts and brief', detail: 'Writing watchtower-facts-…json', done: 5, total: 7, ms: 400 },
      { id: 'finalize', label: 'Saving state and ops cache', detail: 'Reconciling ops-cache from facts…', done: 6, total: 7, ms: 400 },
      { id: 'done', label: 'Done', detail: null, done: 7, total: 7, ms: 200 },
    ];
    const startedAt = Date.now();
    discovery.value = {
      startedAt,
      error: null,
      status: {
        running: true,
        success: null,
        error: null,
        stage: 'window',
        stage_label: 'Computing time window',
        stage_detail: 'Starting deep audit…',
        progress: { done: 0, total: 7 },
        counts: { crashes: 3, jars: 87, active_issues: 2 },
        elapsed_ms: 0,
        last_run: { started_at: new Date(startedAt).toISOString() },
      },
    };
    // Fire-and-forget stage simulation
    (async () => {
      const counts = { crashes: 3, jars: 87, active_issues: 2 };
      for (const s of stages) {
        await new Promise((r) => setTimeout(r, s.ms));
        const done = s.id === 'done';
        discovery.value = {
          startedAt,
          error: null,
          status: {
            running: !done,
            success: done ? true : null,
            error: null,
            message: done ? 'Initial deep audit complete (preview)' : null,
            stage: s.id,
            stage_label: s.label,
            stage_detail: s.detail,
            progress: { done: s.done, total: s.total },
            counts: { ...counts },
            elapsed_ms: Date.now() - startedAt,
            last_run: {
              started_at: new Date(startedAt).toISOString(),
              finished_at: done ? new Date().toISOString() : undefined,
            },
          },
        };
      }
    })();
    return { status: 'started', running: true };
  }

  async fetchDiscoveryStatus() {
    return discovery.value.status;
  }

  // ── Auth (preview always authenticated) ────────────────────────────────────

  async fetchConfig() {
    return { live_sample_interval_sec: 1, live_retention_hours: 2160, mod_version: null };
  }

  async fetchSession() {
    return { authenticated: true, fully_authenticated: true };
  }

  // ── Update check ───────────────────────────────────────────────────────────

  async fetchUpdateCheck() {
    const data = await loadJson('data/update-check.json').catch(() => null);
    if (data) updateCheck.value = { data, at: Date.now() };
    return data;
  }

  // ── Incident pin ───────────────────────────────────────────────────────────

  async pinIncident() {
    return { id: null, preview: true };
  }

  // ── Simulator ─────────────────────────────────────────────────────────────

  startSimulator(intervalMs = 3000) {
    if (this._simulatorTimer) return;
    const latest = live.value?.latest;
    this._simState = createSimState(latest, Date.now());
    this._simulatorTimer = setInterval(() => this._tick(), intervalMs);
  }

  stopSimulator() {
    if (this._simulatorTimer) {
      clearInterval(this._simulatorTimer);
      this._simulatorTimer = null;
    }
  }

  _tick() {
    const prev = live.value;
    const latest = prev?.latest;
    if (!latest) return;

    if (!this._simState) {
      this._simState = createSimState(latest, Date.now());
    }

    // Advance physics at ~30s cadence equivalent even if UI poll is faster —
    // scale event rates by treating each tick as ~3s of wall time.
    const m = stepSim(this._simState, Date.now(), 3);

    const updated = {
      ...latest,
      tps: m.tps,
      mspt: m.mspt,
      host_cpu_pct: m.host_cpu,
      mem_available_gb: m.mem_available_gb,
      mem_used_gb: m.mem_used_gb,
      mem_total_gb: m.mem_total_gb,
      disk_use_pct: m.disk_use_pct,
      heap_mb: latest.heap_mb ? {
        ...latest.heap_mb,
        used: m.heap_mb,
      } : { used: m.heap_mb, committed: 8192, max: 8192 },
      players_online: m.players,
      entities: m.entities,
      chunks: m.chunks,
      java_rss_gb: Math.round((m.heap_mb / 1024 + 3.8 + m.players * 0.15) * 100) / 100,
    };

    const envelope = prev.envelope ? {
      ...prev.envelope,
      latest: updated,
      bandwidth: prev.envelope.bandwidth ? {
        ...prev.envelope.bandwidth,
        rx_mbps: m.rx,
        tx_mbps: m.tx,
        sample_age_sec: 0,
      } : prev.envelope.bandwidth,
      disk_io: prev.envelope.disk_io ? {
        ...prev.envelope.disk_io,
        read_mb_s: m.read,
        write_mb_s: m.write,
        sample_age_sec: 0,
      } : prev.envelope.disk_io,
      thermal: prev.envelope.thermal?.available ? {
        ...prev.envelope.thermal,
        package_c: m.thermal_c,
        ambient_c: m.ambient_c,
      } : prev.envelope.thermal,
      bandwidth_history: _appendHistory(prev.envelope.bandwidth_history, {
        t: new Date().toISOString(),
        rx: m.rx,
        tx: m.tx,
      }),
      disk_io_history: _appendHistory(prev.envelope.disk_io_history, {
        t: new Date().toISOString(),
        read: m.read,
        write: m.write,
      }),
    } : prev.envelope;

    live.value = { ...prev, envelope, latest: updated, at: Date.now() };

    const nowIso = new Date().toISOString();
    const cutoffMs = Date.now() - 36 * 3600_000;
    const series = { ...samples.value.series };
    const appendPoint = (key, val) => {
      if (val == null || Number.isNaN(val)) return;
      const prevArr = series[key] ?? [];
      const trimmed = prevArr.filter((p) => {
        const ms = typeof p.t === 'number' ? (p.t > 1e12 ? p.t : p.t * 1000) : Date.parse(p.t);
        return ms >= cutoffMs;
      });
      series[key] = [...trimmed, { t: nowIso, v: val }].slice(-2000);
    };
    appendPoint('tps', updated.tps);
    appendPoint('mspt', updated.mspt);
    appendPoint('host_cpu', updated.host_cpu_pct);
    appendPoint('players', updated.players_online);
    appendPoint('disk_use_pct', updated.disk_use_pct);
    if (updated.heap_mb?.used != null) appendPoint('heap_mb', updated.heap_mb.used);
    if (updated.mem_available_gb != null) appendPoint('mem_available_gb', updated.mem_available_gb);
    if (updated.mem_used_gb != null) appendPoint('mem_used_gb', updated.mem_used_gb);
    if (updated.mem_total_gb != null) appendPoint('mem_total_gb', updated.mem_total_gb);
    appendPoint('thermal_package', m.thermal_c);
    appendPoint('thermal_ambient', m.ambient_c);
    appendPoint('net_rx_mbps', m.rx);
    appendPoint('net_tx_mbps', m.tx);
    appendPoint('disk_read_mb_s', m.read);
    appendPoint('disk_write_mb_s', m.write);

    samples.value = {
      ...samples.value,
      series,
      points: _countPoints(series),
      at: Date.now(),
    };
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function _countPoints(raw) {
  if (!raw) return 0;
  return [
    'tps', 'mspt', 'host_cpu', 'players', 'heap_mb',
    'mem_available_gb', 'mem_used_gb', 'mem_total_gb', 'disk_use_pct', 'net_rx_mbps',
    'net_tx_mbps', 'disk_read_mb_s', 'disk_write_mb_s',
    'thermal_package', 'thermal_ambient',
  ].reduce((n, k) => n + (raw[k]?.length ?? 0), 0);
}

function _appendHistory(arr, point, max = 720) {
  const next = Array.isArray(arr) ? [...arr, point] : [point];
  return next.length > max ? next.slice(-max) : next;
}

/** Derive mem_used_gb from available when fixtures only ship free RAM. */
function _ensureMemUsedSeries(seriesMap, envelope) {
  if (!seriesMap || typeof seriesMap !== 'object') return seriesMap;
  const out = { ...seriesMap };
  const total = Number(envelope?.latest?.mem_total_gb) || MOCK_MEM_TOTAL_GB;
  if (!out.mem_used_gb?.length && out.mem_available_gb?.length) {
    out.mem_used_gb = out.mem_available_gb.map((p) => ({
      t: p.t,
      v: Math.round(Math.max(0, total - Number(p.v || 0)) * 100) / 100,
    }));
  }
  if (!out.mem_total_gb?.length && out.mem_used_gb?.length) {
    out.mem_total_gb = out.mem_used_gb.map((p) => ({ t: p.t, v: total }));
  }
  return out;
}

/** Derive net/disk chart series from envelope histories when fixture samples lack them. */
function _ensureIoSeries(seriesMap, envelope) {
  if (!seriesMap || typeof seriesMap !== 'object') return seriesMap;
  const out = { ...seriesMap };
  const bw = Array.isArray(envelope?.bandwidth_history) ? envelope.bandwidth_history : [];
  const dio = Array.isArray(envelope?.disk_io_history) ? envelope.disk_io_history : [];

  if (bw.length) {
    if (!out.net_rx_mbps?.length) {
      out.net_rx_mbps = bw.map((p) => ({ t: p.t, v: p.rx }));
    }
    if (!out.net_tx_mbps?.length) {
      out.net_tx_mbps = bw.map((p) => ({ t: p.t, v: p.tx }));
    }
  }
  if (dio.length) {
    if (!out.disk_read_mb_s?.length) {
      out.disk_read_mb_s = dio.map((p) => ({ t: p.t, v: p.read }));
    }
    if (!out.disk_write_mb_s?.length) {
      out.disk_write_mb_s = dio.map((p) => ({ t: p.t, v: p.write }));
    }
  }
  return out;
}

/** Derive thermal history from host_cpu when fixture samples lack it. */
function _ensureThermalSeries(seriesMap) {
  if (!seriesMap || typeof seriesMap !== 'object') return seriesMap;
  const out = { ...seriesMap };
  const cpu = Array.isArray(out.host_cpu) ? out.host_cpu : [];
  if ((!out.thermal_package || !out.thermal_package.length) && cpu.length) {
    out.thermal_package = cpu.map((p) => ({
      t: p.t,
      v: Math.round((42 + (Number(p.v) || 0) * 0.32) * 10) / 10,
    }));
  }
  if ((!out.thermal_ambient || !out.thermal_ambient.length) && cpu.length) {
    out.thermal_ambient = cpu.map((p, i) => ({
      t: p.t,
      v: Math.round((28.5 + Math.sin(i / 36) * 1.4 + (Number(p.v) || 0) * 0.035) * 10) / 10,
    }));
  }
  return out;
}

/**
 * If the newest sample is older than 2 minutes, shift the whole series so the
 * last point lands at Date.now(). Keeps relative spacing intact for charts.
 */
function _rebaseSeriesToNow(seriesMap) {
  if (!seriesMap || typeof seriesMap !== 'object') return seriesMap;
  let maxMs = 0;
  for (const arr of Object.values(seriesMap)) {
    if (!Array.isArray(arr) || !arr.length) continue;
    const last = arr[arr.length - 1];
    const ms = typeof last.t === 'number' ? (last.t > 1e12 ? last.t : last.t * 1000) : Date.parse(last.t);
    if (ms > maxMs) maxMs = ms;
  }
  if (!maxMs) return seriesMap;
  const lag = Date.now() - maxMs;
  if (lag < 120_000) return seriesMap; // fresh enough

  const out = {};
  for (const [key, arr] of Object.entries(seriesMap)) {
    if (!Array.isArray(arr)) {
      out[key] = arr;
      continue;
    }
    out[key] = arr.map((p) => {
      const ms = typeof p.t === 'number' ? (p.t > 1e12 ? p.t : p.t * 1000) : Date.parse(p.t);
      return { ...p, t: new Date(ms + lag).toISOString() };
    });
  }
  return out;
}
