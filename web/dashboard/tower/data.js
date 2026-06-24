/**
 * Watchtower UI v3 — data loading and polling
 */

async function loadData() {
  state.apiMode = isApiMode();
  if (state.apiMode) {
    await loadDataFromApi();
    return;
  }
  setBootMessage('Loading dashboard data…');
  const [index, snapshot, samples, envelope, rollups, opsCache, overviewMetaExtra, issuesPeek, perfInsights, perfDashboard] = await Promise.all([
    fetch('data/reports-index.json').then((r) => r.json()),
    fetch('data/snapshot.json').then((r) => r.json()),
    fetch('data/live-samples.json').then((r) => r.json()),
    fetch('data/live-envelope.json').then((r) => r.json()),
    fetch('data/performance-rollups.json').then((r) => r.json()).catch(() => null),
    fetch('data/ops-cache.json').then((r) => r.json()).catch(() => null),
    fetch('data/overview-meta.json').then((r) => r.json()).catch(() => null),
    fetch('data/issues-peek.json').then((r) => r.json()).catch(() => null),
    fetch('data/performance-insights.json').then((r) => r.json()).catch(() => null),
    fetch('data/performance-dashboard.json').then((r) => r.json()).catch(() => null),
  ]);
  state.reportsIndex = index;
  state.snapshot = snapshot;
  state.liveEnvelope = envelope;
  state.liveLatest = envelope.latest;
  applyLiveLatest(envelope.latest);
  state.liveSamplesRaw = samples;
  state.liveSamples = samplesToChartFormat(samples);
  state.samplesFetchedAt = Date.now();
  state.samplesPointCount = countSamplePoints(samples);
  state.bandwidthHistory = envelope.bandwidth_history ? [...envelope.bandwidth_history] : [];
  state.diskIoHistory = envelope.disk_io_history ? [...envelope.disk_io_history] : [];
  state.liveConfig = {
    live_sample_interval_sec: envelope.latest?.sample_interval_sec ?? 1,
    live_retention_hours: envelope.latest?.retention_hours ?? 2160,
    mod_version: overviewMetaExtra?.version ?? '1.0.0',
    hostname: 'demo-server',
  };
  state.modVersion = overviewMetaExtra?.version ?? '1.0.0';
  state.performanceRollups = rollups;
  state.performanceInsights = perfInsights;
  state.performanceDashboard = perfDashboard || perfInsights;
  state.opsCache = opsCache;
  state.lagIssuesPeek = issuesPeek;
  state.overviewMeta = overviewMetaExtra ?? {
    version: '1.0.0',
    stale: false,
    rss_hint: {
      show: true,
      rss_gb: envelope.latest?.java_rss_gb ?? 10.2,
      heap_max_gb: (envelope.latest?.heap_mb?.max ?? 8192) / 1024,
      message: 'Native memory (RSS) is elevated vs Java heap max — possible off-heap/native leak; check mods using JNI or large direct buffers.',
    },
  };
  state.reportCache = {};
  for (const rep of index.reports) {
    const [facts, brief] = await Promise.all([
      fetch(`data/${rep.facts}`).then((r) => r.json()),
      fetch(`data/${rep.brief}`).then((r) => r.text()),
    ]);
    state.reportCache[rep.id] = { facts, brief };
    if (rep.id === 'latest') state.facts = facts;
    if (rep.id === 'prev') state.factsPrev = facts;
    syncReportIndexMeta(rep.id, facts);
  }
  const savedId = localStorage.getItem(SELECTED_REPORT_KEY);
  const initialId = savedId && index.reports?.some((r) => r.id === savedId) ? savedId : 'latest';
  state.selectedReportId = initialId;
  await loadReport(initialId);
  await mergeServerAcks();
  await mergeServerClientModIgnores();
  applySnapshotToLive();
  populateReportSelect();
  try {
    const previewSettings = JSON.parse(localStorage.getItem(PREVIEW_SETTINGS_KEY) || '{}');
    state.dashboardSettings = { ...(state.dashboardSettings || {}), ...previewSettings };
  } catch {
    state.dashboardSettings = state.dashboardSettings || {};
  }
  await loadActivityEvents();
}
async function hydrateBackupStateFromConfig() {
  if (!state.apiMode) return;
  const dirsCsv = (state.dashboardSettings?.backup_dirs || '').trim();
  if (!dirsCsv) return;
  const backup = state.activeFacts?.optional?.last_backup;
  const searchDirs = backup?.search_dirs ?? [];
  const needsHydrate = !backup
    || backup.status === 'unconfigured'
    || (!searchDirs.length && dirsCsv.length > 0);
  if (!needsHydrate) return;
  try {
    const data = await WatchtowerApi.postBackupScan();
    if (!state.activeFacts.optional) state.activeFacts.optional = {};
    if (data.last_backup) {
      state.activeFacts.optional.last_backup = data.last_backup;
      if (state.facts?.optional) state.facts.optional.last_backup = data.last_backup;
      if (state.reportCache.latest?.facts?.optional) {
        state.reportCache.latest.facts.optional.last_backup = data.last_backup;
      }
    }
    if (data.backup_inventory) {
      state.activeFacts.optional.backup_inventory = data.backup_inventory;
      if (state.facts?.optional) state.facts.optional.backup_inventory = data.backup_inventory;
      if (state.reportCache.latest?.facts?.optional) {
        state.reportCache.latest.facts.optional.backup_inventory = data.backup_inventory;
      }
    }
  } catch (e) {
    console.warn('backup hydrate from config failed', e);
  }
}

async function loadDataFromApi() {
  setBootMessage('Connecting to server…');
  document.documentElement.dataset.embedded = 'true';
  try {
    state.liveConfig = await WatchtowerApi.fetchConfig();
    state.modVersion = state.liveConfig?.mod_version || null;
  } catch {
    state.liveConfig = { live_sample_interval_sec: 1, live_retention_hours: 24 };
  }
  setBootMessage('Loading health reports…');
  const index = await WatchtowerApi.fetchReportsIndex();
  state.reportsIndex = index;
  state.reportCache = {};
  const latest = await WatchtowerApi.fetchLatestReport();
  if (latest?.facts) {
    state.facts = latest.facts;
    state.brief = latest.brief || '';
    state.reportCache.latest = { facts: latest.facts, brief: state.brief };
    state.activeFacts = latest.facts;
    state.selectedReportId = 'latest';
    state.noReportYet = false;
    if (index.reports?.length > 1) {
      state.factsPrev = null;
    }
  } else {
    state.facts = emptyFactsPlaceholder();
    state.activeFacts = state.facts;
    state.brief = '';
    state.noReportYet = true;
  }
  await mergeServerAcks();
  await mergeServerClientModIgnores();
  populateReportSelect();
  if (!state.noReportYet) {
    const savedId = localStorage.getItem(SELECTED_REPORT_KEY);
    const initialId = savedId && index.reports?.some((r) => r.id === savedId) ? savedId : 'latest';
    if (initialId !== state.selectedReportId) {
      state.selectedReportId = initialId;
      await loadReport(initialId);
      await mergeServerAcks();
      await mergeServerClientModIgnores();
      populateReportSelect();
    }
  }
  try {
    state.dashboardSettings = await WatchtowerApi.fetchSettings();
  } catch {
    state.dashboardSettings = {};
  }
  if (typeof TowerDataSources !== 'undefined') {
    await TowerDataSources.fetchFromApi();
  }
  await hydrateBackupStateFromConfig();
  await fetchOverviewMeta();
  await fetchPerformanceRollups(168);
  await fetchPerformanceInsights('7d');
  await fetchPerformanceDashboard('7d');
  await fetchOpsCache();
  await fetchLagIssuesPeek();
  setBootMessage('Loading live metrics…');
  try {
    const live = await WatchtowerApi.fetchLive();
    state.liveEnvelope = live;
    state.liveLatest = live.latest;
    applyLiveLatest(live.latest);
  } catch {
    /* live may start empty */
  }
  try {
    state.liveSamplesRaw = await WatchtowerApi.fetchSamples(chartWindowMinutes(), maxSamplesPoints());
    state.liveSamples = samplesToChartFormat(state.liveSamplesRaw);
    hydrateIoHistoriesFromSamples(state.liveSamplesRaw);
    state.samplesFetchedAt = Date.now();
    state.samplesPointCount = countSamplePoints(state.liveSamplesRaw);
  } catch {
    state.liveSamples = { mspt_samples: [], cpu_samples: [], tps_samples: [] };
  }
  await loadActivityEvents();
}
function emptyFactsPlaceholder() {
  return {
    meta: { hostname: state.liveConfig?.hostname || 'server', generated: new Date().toISOString() },
    health: { status: 'ok', current_status: 'ok' },
    issues: [],
    events: [],
    optional: {},
    minecraft: {},
    system: {},
  };
}
function mergeDualSampleSeries(a, b, keyA, keyB) {
  const byT = new Map();
  for (const p of a || []) {
    const row = byT.get(p.t) || { t: p.t };
    row[keyA] = p.v;
    byT.set(p.t, row);
  }
  for (const p of b || []) {
    const row = byT.get(p.t) || { t: p.t };
    row[keyB] = p.v;
    byT.set(p.t, row);
  }
  return [...byT.values()].sort((x, y) => Date.parse(x.t) - Date.parse(y.t));
}

function hydrateIoHistoriesFromSamples(raw) {
  if (!raw) return;
  const netPts = (raw.net_rx_mbps?.length || 0) + (raw.net_tx_mbps?.length || 0);
  if (netPts > 0) {
    state.bandwidthHistory = mergeDualSampleSeries(raw.net_rx_mbps, raw.net_tx_mbps, 'rx', 'tx')
      .map((p) => ({ t: p.t, rx: p.rx ?? 0, tx: p.tx ?? 0 }));
  }
  const diskPts = (raw.disk_read_mb_s?.length || 0) + (raw.disk_write_mb_s?.length || 0);
  if (diskPts > 0) {
    state.diskIoHistory = mergeDualSampleSeries(raw.disk_read_mb_s, raw.disk_write_mb_s, 'read', 'write')
      .map((p) => ({ t: p.t, read: p.read ?? 0, write: p.write ?? 0 }));
  }
}

function samplesToChartFormat(samples) {
  return {
    tps_samples: (samples.tps || []).map((p) => ({ time: p.t, tps: p.v, mspt: null })),
    mspt_samples: (samples.mspt || []).map((p) => ({ time: p.t, mspt: p.v })),
    cpu_samples: (samples.host_cpu || []).map((p) => ({ time: p.t, host_pct: p.v })),
    heap_samples: (samples.heap_mb || []).map((p) => ({ time: p.t, v: p.v })),
    mem_samples: (samples.mem_available_gb || []).map((p) => ({ time: p.t, v: p.v })),
    disk_samples: (samples.disk_use_pct || []).map((p) => ({ time: p.t, v: p.v })),
    players_samples: (samples.players || []).map((p) => ({ time: p.t, v: p.v })),
    tps_samples_legacy: (samples.mspt || []).map((p) => ({ time: p.t, mspt: p.v })),
  };
}
function maxRetentionHours() {
  return state.liveConfig?.live_retention_hours ?? 2160;
}

function chartWindowMinutes() {
  return ChartWindow.get(maxRetentionHours());
}

function samplesPollIntervalMs() {
  const m = chartWindowMinutes();
  if (m <= 60) return 15000;
  if (m <= 1440) return 30000;
  if (m <= 10080) return 60000;
  return 120000;
}

function maxSamplesPoints() {
  return 500;
}

function countSamplePoints(raw) {
  if (!raw) return 0;
  return ['tps', 'mspt', 'host_cpu', 'players', 'heap_mb', 'mem_available_gb', 'disk_use_pct',
    'net_rx_mbps', 'net_tx_mbps', 'disk_read_mb_s', 'disk_write_mb_s']
    .reduce((n, k) => n + (raw[k]?.length || 0), 0);
}

function updateSamplesFreshnessCaption() {
  const el = document.getElementById('samples-freshness-caption');
  if (!el) return;
  if (!state.samplesFetchedAt) {
    el.textContent = '';
    return;
  }
  const ago = Math.max(0, Math.round((Date.now() - state.samplesFetchedAt) / 1000));
  const stale = state.samplesPollFail ? ' · stale — retrying…' : '';
  el.textContent = `History synced ${ago}s ago · ${state.samplesPointCount} points${stale}`;
}

function heapChartMax() {
  const h = state.liveLatest?.heap_mb?.max;
  const next = h ? Math.round(h) : (state.cachedHeapMax || 8192);
  if (h) state.cachedHeapMax = next;
  return state.cachedHeapMax || next;
}

function playersChartMax(raw) {
  const players = raw?.players || [];
  let peak = state.playersChartMax || 20;
  for (const p of players) peak = Math.max(peak, Math.ceil(p.v || 0));
  state.playersChartMax = Math.max(20, peak);
  return state.playersChartMax;
}

function appendTailToSamplesRaw(latest) {
  if (!latest || !state.liveSamplesRaw) return false;
  const now = new Date().toISOString();
  const appendOne = (key, val) => {
    if (val == null || Number.isNaN(val)) return;
    const arr = state.liveSamplesRaw[key] || (state.liveSamplesRaw[key] = []);
    const last = arr[arr.length - 1];
    if (last && Math.abs(Date.parse(last.t) - Date.now()) < 900) {
      last.v = val;
      return;
    }
    arr.push({ t: now, v: val });
    const cutoff = Date.now() - chartWindowMinutes() * 60 * 1000;
    while (arr.length && Date.parse(arr[0].t) < cutoff) arr.shift();
  };
  appendOne('tps', latest.tps);
  appendOne('mspt', latest.mspt);
  appendOne('host_cpu', latest.host_cpu_pct);
  appendOne('players', latest.players_online);
  appendOne('heap_mb', latest.heap_mb?.used);
  appendOne('mem_available_gb', latest.mem_available_gb);
  appendOne('disk_use_pct', latest.disk_use_pct);
  state.liveSamples = samplesToChartFormat(state.liveSamplesRaw);
  state.samplesPointCount = countSamplePoints(state.liveSamplesRaw);
  return true;
}
function applyLiveLatest(latest) {
  if (!latest) return;
  state.liveJitter.tps = latest.tps ?? 20;
  state.liveJitter.mspt = latest.mspt ?? 0;
  state.liveJitter.players = latest.players_online ?? 0;
  state.snapshot = {
    overworld: { tps: latest.tps, mspt: latest.mspt },
    players_online: latest.players_online,
    entities: latest.entities,
    chunks: latest.chunks,
  };
}
async function mergeServerClientModIgnores() {
  const f = state.activeFacts;
  const hostname = f?.meta?.hostname;
  if (!hostname) return;
  if (state.apiMode) {
    try {
      const resp = await WatchtowerApi.fetchClientModIgnores();
      if (resp?.ignored_client_mods) {
        ClientModIgnores.syncFromServer(hostname, resp.ignored_client_mods);
      }
    } catch {
      /* keep local ignore state */
    }
    return;
  }
  const serverIgnores = f?.optional?.ignored_client_mods;
  if (serverIgnores) ClientModIgnores.mergeFromServer(hostname, serverIgnores);
}

async function mergeServerAcks() {
  const f = state.activeFacts;
  const hostname = f?.meta?.hostname;
  if (!hostname) return;
  if (state.apiMode) {
    try {
      const resp = await WatchtowerApi.fetchCrashAcks();
      if (resp?.acknowledged_crashes) {
        Acks.syncFromServer(hostname, resp.acknowledged_crashes);
      }
    } catch {
      /* keep local ack state */
    }
    return;
  }
  const serverAcks = f?.optional?.acknowledged_crashes;
  if (serverAcks) Acks.mergeFromServer(hostname, serverAcks);
}

async function loadReport(id) {
  if (state.apiMode) {
    const rep = state.reportsIndex?.reports?.find((r) => r.id === id);
    if (!rep) return;
    if (!state.reportCache[id]) {
      try {
        const data = await WatchtowerApi.fetchReport(rep.facts);
        state.reportCache[id] = { facts: data.facts, brief: data.brief || '' };
      } catch (e) {
        showToast(`Failed to load report: ${e.message}`, 'error');
        return;
      }
    }
    state.selectedReportId = id;
    state.activeFacts = state.reportCache[id].facts;
    state.brief = state.reportCache[id].brief;
    if (id === 'latest') state.facts = state.activeFacts;
    if (id.startsWith('prev')) state.factsPrev = state.activeFacts;
    syncReportIndexMeta(id, state.activeFacts);
    localStorage.setItem(SELECTED_REPORT_KEY, id);
    return;
  }
  const cached = state.reportCache[id];
  if (!cached) return;
  state.selectedReportId = id;
  state.activeFacts = cached.facts;
  state.brief = cached.brief;
  syncReportIndexMeta(id, state.activeFacts);
  localStorage.setItem(SELECTED_REPORT_KEY, id);
}
function syncReportIndexMeta(id, facts) {
  const rep = state.reportsIndex?.reports?.find((r) => r.id === id);
  const meta = facts?.meta;
  if (!rep || !meta) return;
  if (meta.generated) rep.generated = meta.generated;
  if (meta.window_start) rep.window_start = meta.window_start;
  if (meta.lookback_hours != null) rep.lookback_hours = meta.lookback_hours;
}

function reportMetaFrom(rep) {
  const cached = state.reportCache[rep.id]?.facts?.meta;
  return {
    generated: cached?.generated || rep.generated,
    window_start: cached?.window_start || rep.window_start,
    lookback_hours: cached?.lookback_hours ?? rep.lookback_hours,
  };
}

function formatLookbackLabel(hours) {
  const h = Number(hours);
  if (Number.isNaN(h)) return '';
  if (h >= 720) return '30d';
  if (h >= 168) return '7d';
  if (h >= 48) return '48h';
  return `${h}h`;
}

function formatReportOption(rep) {
  const meta = reportMetaFrom(rep);
  const when = meta.generated ? fmtTime(meta.generated) : (rep.label || rep.facts || 'Report');
  const prefix = rep.id === 'latest' ? 'Latest · ' : '';
  const lb = meta.lookback_hours ? ` (${formatLookbackLabel(meta.lookback_hours)})` : '';
  const engine = rep.engine ? ` · engine ${rep.engine}` : '';
  const text = `${prefix}${when}${lb}${engine}`;
  const title = rep.facts ? `File: ${rep.facts}` : text;
  return { text, title };
}

function formatReportWindow(facts) {
  const meta = facts?.meta;
  const isOlder = state.selectedReportId !== 'latest';
  if (!meta) {
    return { primary: 'Report window unavailable', secondary: '', isOlder };
  }
  const end = meta.generated;
  const start = meta.window_start;
  const lb = meta.lookback_hours;
  const lbLabel = lb ? `${formatLookbackLabel(lb)} lookback` : 'lookback window';
  if (start && end) {
    return {
      primary: `Report window: ${fmtTime(start)} → ${fmtTime(end)}`,
      secondary: lb ? `· ${lbLabel}` : '',
      isOlder,
    };
  }
  if (end) {
    return {
      primary: `Report generated ${fmtTime(end)}`,
      secondary: lb ? `· ${lbLabel}` : '',
      isOlder,
    };
  }
  return { primary: 'Report window unavailable', secondary: '', isOlder };
}

function reportWindowEmptyCaption() {
  const win = formatReportWindow(state.activeFacts || state.facts);
  const extra = win.secondary ? ` ${win.secondary}` : '';
  return win.primary !== 'Report window unavailable' ? `${win.primary}${extra}` : 'this report window';
}

function populateReportSelect() {
  const sel = document.getElementById('report-select');
  if (!sel || !state.reportsIndex) return;
  sel.innerHTML = state.reportsIndex.reports.map((r) => {
    const { text, title } = formatReportOption(r);
    return `<option value="${esc(r.id)}" title="${esc(title)}">${esc(text)}</option>`;
  }).join('');
  sel.value = state.selectedReportId;
}

function applySnapshotToLive() {
  const s = state.snapshot;
  if (!s) return;
  state.liveJitter.tps = s.overworld?.tps ?? 20;
  state.liveJitter.mspt = s.overworld?.mspt ?? 3;
  state.liveJitter.players = s.players_online ?? 0;
}
async function fetchPerformanceRollups(hours = 24) {
  if (!state.apiMode) {
    let fixture = 'data/performance-rollups.json';
    if (hours >= 720) fixture = 'data/performance-rollups-30d.json';
    else if (hours >= 168) fixture = 'data/performance-rollups-7d.json';
    try {
      const r = await fetch(fixture);
      if (r.ok) state.performanceRollups = await r.json();
    } catch (e) {
      console.warn('performance rollups fixture failed', e);
    }
    return;
  }
  try {
    state.performanceRollups = await WatchtowerApi.fetchPerformanceRollups(hours);
  } catch (e) {
    console.warn('performance rollups failed', e);
  }
}

async function fetchPerformanceInsights(window = '7d') {
  const w = window || '7d';
  if (!state.apiMode) {
    const fixture = w === '30d' ? 'data/performance-insights-30d.json' : 'data/performance-insights.json';
    try {
      const r = await fetch(fixture);
      if (r.ok) state.performanceInsights = await r.json();
    } catch (e) {
      console.warn('performance insights fixture failed', e);
    }
    return;
  }
  try {
    state.performanceInsights = await WatchtowerApi.fetchPerformanceInsights(w);
  } catch (e) {
    console.warn('performance insights failed', e);
  }
}

async function fetchPerformanceDashboard(window) {
  const w = window || state.performanceWindow || '7d';
  state.performanceWindow = w;
  if (!state.apiMode) {
    const fixture = w === '30d' ? 'data/performance-dashboard-30d.json' : 'data/performance-dashboard.json';
    try {
      const r = await fetch(fixture);
      if (r.ok) {
        state.performanceDashboard = await r.json();
      }
    } catch (e) {
      console.warn('performance dashboard fixture failed', e);
    }
    return;
  }
  try {
    state.performanceDashboard = await WatchtowerApi.fetchPerformanceDashboard(w);
  } catch (e) {
    console.warn('performance dashboard failed', e);
  }
}

async function fetchStaticOpsCache() {
  try {
    state.opsCache = await fetch('data/ops-cache.json').then((r) => r.json());
  } catch (e) {
    console.warn('ops cache fixture failed', e);
  }
}

async function fetchStaticIssuesPeek() {
  try {
    state.lagIssuesPeek = await fetch('data/issues-peek.json').then((r) => r.json());
  } catch (e) {
    console.warn('issues peek fixture failed', e);
  }
}

async function fetchOpsCache() {
  if (!state.apiMode) {
    await fetchStaticOpsCache();
    return;
  }
  try {
    state.opsCache = await WatchtowerApi.fetchOpsCache();
  } catch (e) {
    console.warn('ops cache failed', e);
  }
}

function opsModLogEntries(opsCache) {
  const block = opsCache?.mod_log_errors;
  if (!block) return [];
  if (Array.isArray(block.entries)) return block.entries;
  if (Array.isArray(block)) return block;
  return [];
}

function mergedModLogErrors(facts, opsCache) {
  const cache = opsCache ?? state.opsCache;
  const scanned = opsModLogEntries(cache).filter((e) => e?.mod_id !== 'client_noise');
  if (scanned.length) return scanned;
  return (facts?.optional?.mod_log_errors ?? []).filter((e) => e?.mod_id !== 'client_noise');
}

function mergedRunningMods(facts, opsCache) {
  const cache = opsCache ?? state.opsCache;
  const block = cache?.running_mods;
  const scanned = block?.mods ?? [];
  const reportMods = facts?.optional?.mods ?? [];
  const scanAt = block?.scanned_at ? Date.parse(block.scanned_at) : 0;
  const reportAt = facts?.meta?.generated ? Date.parse(facts.meta.generated) : 0;
  if (scanned.length && (!reportMods.length || scanAt >= reportAt)) {
    return { mods: scanned, source: 'live' };
  }
  if (reportMods.length) return { mods: reportMods, source: 'report' };
  if (scanned.length) return { mods: scanned, source: 'live' };
  return { mods: [], source: null };
}

function hasOpsModScanData(opsCache) {
  return opsModLogEntries(opsCache ?? state.opsCache).some((e) => e?.mod_id !== 'client_noise');
}

function activeModIssues() {
  const peek = state.lagIssuesPeek?.mod_issues;
  const cache = state.opsCache?.mod_issues?.entries;
  const entries = Array.isArray(peek) ? peek : (Array.isArray(cache) ? cache : []);
  return entries.filter((e) => e && !e.resolved);
}

async function scanCrashes(force = false) {
  if (state.crashScanInFlight) return null;
  const now = Date.now();
  if (!force && state.crashScanAt && now - state.crashScanAt < 30000) {
    return null;
  }
  state.crashScanInFlight = true;
  try {
    if (!state.apiMode) {
      await fetchStaticOpsCache();
      state.crashScanAt = Date.now();
      updateTabBadges();
      const block = state.opsCache?.crashes;
      return block ? { count: block.count, unreviewed: block.unreviewed } : null;
    }
    const result = await WatchtowerApi.postCrashScan();
    state.crashScanAt = Date.now();
    await fetchOpsCache();
    updateTabBadges();
    return result;
  } catch (e) {
    console.warn('crash scan failed', e);
    return null;
  } finally {
    state.crashScanInFlight = false;
  }
}

async function fetchLagIssuesPeek() {
  if (!state.apiMode) {
    await fetchStaticIssuesPeek();
    return;
  }
  try {
    state.lagIssuesPeek = await WatchtowerApi.fetchIssuesPeek();
  } catch (e) {
    console.warn('issues peek failed', e);
  }
}

async function pinLagMoment() {
  if (!state.apiMode) {
    showToast('Pin lag requires the embedded dashboard on a live server.', 'info');
    return null;
  }
  if (state.lagPinInFlight) return null;
  const note = window.prompt('Optional note for this lag snapshot (leave blank to skip):');
  if (note === null) return null;
  state.lagPinInFlight = true;
  try {
    const data = await WatchtowerApi.postIncidentPin(note.trim() || null);
    await fetchLagIssuesPeek();
    await fetchOpsCache();
    updateTabBadges();
    showToast('Lag moment pinned', 'success');
    if (data?.id && typeof openLagIncidentModal === 'function') {
      await openLagIncidentModal(data.id);
    }
    return data;
  } catch (e) {
    showToast(`Pin failed: ${e.message}`, 'error');
    return null;
  } finally {
    state.lagPinInFlight = false;
  }
}

async function scanActivity(force = false) {
  if (state.activityScanInFlight) return null;
  const now = Date.now();
  if (!force && state.activityScanAt && now - state.activityScanAt < 30000) {
    return null;
  }
  state.activityScanInFlight = true;
  try {
    if (!state.apiMode) {
      await fetchStaticOpsCache();
      await fetchStaticIssuesPeek();
      state.activityScanAt = Date.now();
      updateTabBadges();
      const block = state.opsCache?.activity;
      return block ? { new_count: block.new_count ?? block.events?.length ?? 0 } : null;
    }
    const result = await WatchtowerApi.postActivityScan();
    state.activityScanAt = Date.now();
    await fetchOpsCache();
    await fetchLagIssuesPeek();
    updateTabBadges();
    return result;
  } catch (e) {
    console.warn('activity scan failed', e);
    return null;
  } finally {
    state.activityScanInFlight = false;
  }
}

async function scanMods(force = false) {
  if (state.modScanInFlight) return null;
  const now = Date.now();
  if (!force && state.modScanAt && now - state.modScanAt < 30000) {
    return null;
  }
  state.modScanInFlight = true;
  try {
    if (!state.apiMode) {
      await fetchStaticOpsCache();
      await fetchStaticIssuesPeek();
      state.modScanAt = Date.now();
      updateTabBadges();
      const entries = opsModLogEntries(state.opsCache);
      return entries.length ? { mod_error_count: entries.length } : null;
    }
    const result = await WatchtowerApi.postModsScan();
    state.modScanAt = Date.now();
    await fetchOpsCache();
    await fetchLagIssuesPeek();
    await fetchOverviewMeta();
    updateTabBadges();
    return result;
  } catch (e) {
    console.warn('mod scan failed', e);
    return null;
  } finally {
    state.modScanInFlight = false;
  }
}

async function fetchOverviewMeta() {
  if (!state.apiMode) return;
  try {
    state.overviewMeta = await WatchtowerApi.fetchOverviewMeta();
    state.modVersion = state.overviewMeta?.version || state.modVersion || state.liveConfig?.mod_version;
    if (state.overviewMeta?.update_check) {
      state.updateCheck = state.overviewMeta.update_check;
    }
    renderGlobalBanners();
    renderVersionChip();
  } catch (e) {
    console.warn('overview meta failed', e);
    try {
      state.updateCheck = await WatchtowerApi.fetchUpdateCheck();
      renderGlobalBanners();
      renderVersionChip();
    } catch {
      /* optional */
    }
  }
}
async function loadCrashContexts(files) {
  if (!state.apiMode || !files?.length) return;
  let changed = false;
  for (const file of files) {
    if (!file || state.crashContextCache[file]) continue;
    try {
      const res = await WatchtowerApi.fetchCrashContext(file, 10);
      if (res?.pre_crash) {
        state.crashContextCache[file] = res.pre_crash;
        changed = true;
      }
    } catch {
      state.crashContextCache[file] = { unavailable_reason: 'Could not load live pre-crash context.' };
      changed = true;
    }
  }
  if (changed && state.activeTab === 'crashes') {
    document.getElementById('main-content').innerHTML = TowerRenderCrashes.renderCrashes();
    afterRender();
  }
}
async function loadPlayerRoster() {
  if (state.apiMode) {
    try {
      const data = await WatchtowerApi.fetchPlayers();
      state.playerRoster = data?.player_directory ?? null;
    } catch (e) {
      console.warn('player roster failed', e);
    }
    return;
  }
  state.playerRoster = state.activeFacts?.optional?.player_directory ?? null;
}
function getLiveRefreshMs() {
  const saved = parseInt(localStorage.getItem(LIVE_REFRESH_KEY) || '5000', 10);
  return Number.isFinite(saved) ? saved : 5000;
}

function setLiveRefreshMs(ms) {
  localStorage.setItem(LIVE_REFRESH_KEY, String(ms));
}

async function pollCoreLive() {
  if (!shouldPollLive()) return;
  try {
    const live = await WatchtowerApi.fetchLive();
    state.livePollError = null;
    state.liveEnvelope = live;
    state.liveLatest = live.latest;
    applyLiveLatest(live.latest);
    updateLiveValues(live.latest);
    updateLiveStatusLine(live);
    updateLivePanels();
    updateWorldJobsOverview();
    if (appendTailToSamplesRaw(live.latest)) {
      scheduleSparklineRefresh(false);
    }
    state.overviewMetaPollCounter += 1;
    if (state.overviewMetaPollCounter >= 60) {
      state.overviewMetaPollCounter = 0;
      fetchOverviewMeta();
    }
    state.performanceRollupsPollCounter = (state.performanceRollupsPollCounter || 0) + 1;
    if (state.performanceRollupsPollCounter >= 60) {
      state.performanceRollupsPollCounter = 0;
      const w = state.performanceWindow || '7d';
      fetchPerformanceRollups(w === '30d' ? 720 : 168);
      fetchPerformanceInsights(w);
      if (state.activeTab === 'performance') {
        fetchPerformanceDashboard(w);
      }
    }
    if (state.activeTab === 'session' && !state.canvasView) {
      await loadPlayerRoster();
      TowerRenderSession.applySessionRosterUpdate();
    }
    if (typeof TowerDataSources !== 'undefined') TowerDataSources.refreshTab();
  } catch (e) {
    state.livePollError = e.message || 'Live metrics unavailable';
    updateLiveStatusLine(state.liveEnvelope);
    console.warn('live poll failed', e);
  }
}

async function pollSamples(force = false) {
  if (!state.apiMode || document.hidden) return;
  if (state.activeTab !== 'overview' && state.activeTab !== 'live') return;
  if (state.samplesPollInFlight && !force) return;

  if (state.samplesAbortController) {
    state.samplesAbortController.abort();
  }
  state.samplesAbortController = new AbortController();
  const { signal } = state.samplesAbortController;

  state.samplesPollInFlight = true;
  SparklineManager.chartIdsForTab(state.activeTab).forEach((id) => SparklineManager.setLoading(id, true));

  try {
    const windowMinutes = chartWindowMinutes();
    state.liveSamplesRaw = await WatchtowerApi.fetchSamples(windowMinutes, maxSamplesPoints(), signal);
    state.liveSamples = samplesToChartFormat(state.liveSamplesRaw);
    hydrateIoHistoriesFromSamples(state.liveSamplesRaw);
    state.samplesFetchedAt = Date.now();
    state.samplesPointCount = countSamplePoints(state.liveSamplesRaw);
    state.samplesPollFail = false;
    scheduleSparklineRefresh(false);
    updateSamplesFreshnessCaption();
  } catch (e) {
    if (e.name === 'AbortError') return;
    state.samplesPollFail = true;
    updateSamplesFreshnessCaption();
    console.warn('samples poll failed', e);
  } finally {
    state.samplesPollInFlight = false;
  }
}
function stopCorePolling() {
  if (state.corePollTimer) { clearInterval(state.corePollTimer); state.corePollTimer = null; }
  if (state.liveChartTimer) { clearInterval(state.liveChartTimer); state.liveChartTimer = null; }
  if (state.samplesFreshnessTimer) { clearInterval(state.samplesFreshnessTimer); state.samplesFreshnessTimer = null; }
  if (state.samplesAbortController) {
    state.samplesAbortController.abort();
    state.samplesAbortController = null;
  }
}

function shouldPollLive() {
  return state.apiMode && !document.hidden
    && (state.activeTab === 'overview' || state.activeTab === 'live' || state.activeTab === 'session');
}

function startCorePolling() {
  stopCorePolling();
  if (!shouldPollLive()) return;
  const ms = getLiveRefreshMs();
  pollCoreLive();
  pollSamples(true);
  if (ms <= 0) {
    if (state.liveEnvelope) updateLiveStatusLine(state.liveEnvelope);
    return;
  }
  state.corePollTimer = setInterval(() => {
    if (shouldPollLive()) pollCoreLive();
  }, ms);
  const sampleMs = samplesPollIntervalMs();
  state.liveChartTimer = setInterval(() => {
    if (shouldPollLive()) pollSamples();
  }, sampleMs);
  state.samplesFreshnessTimer = setInterval(updateSamplesFreshnessCaption, 1000);
}

function bindLiveControls() {
  const sel = document.getElementById('live-refresh-select');
  if (sel) {
    sel.value = String(getLiveRefreshMs());
    sel.onchange = () => {
      setLiveRefreshMs(parseInt(sel.value, 10));
      startCorePolling();
      if (state.liveEnvelope) updateLiveStatusLine(state.liveEnvelope);
    };
  }
  const pinBtn = document.getElementById('live-pin-lag-btn');
  if (pinBtn) {
    pinBtn.onclick = async () => {
      pinBtn.disabled = true;
      await pinLagMoment();
      if (typeof render === 'function') render();
    };
  }
  SparklineManager.bindHoursSelect(() => pollSamples(true));
  SparklineManager.bindVitalsSelect(() => pollSamples(true));
}

function bindLiveRefreshControl() { bindLiveControls(); }

function stopLivePolling() { stopCorePolling(); }

function startLivePolling() {
  startCorePolling();
  bindLiveControls();
}
function activityEventKey(ev) {
  return `${ev?.time ?? ''}|${ev?.type ?? ''}|${ev?.detail ?? ''}`;
}

function sortActivityEventsNewestFirst(events) {
  if (typeof TowerRenderShared !== 'undefined' && TowerRenderShared.sortEventsNewestFirst) {
    return TowerRenderShared.sortEventsNewestFirst(events);
  }
  return [...events].sort((a, b) => {
    const ta = new Date(String(a?.time || '').replace(',', '.').replace(' ', 'T')).getTime();
    const tb = new Date(String(b?.time || '').replace(',', '.').replace(' ', 'T')).getTime();
    return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
  });
}

/** Merge deduped events from every cached health report (static preview). */
function collectStoredActivityEvents() {
  const seen = new Set();
  const merged = [];
  const add = (events) => {
    if (!Array.isArray(events)) return;
    events.forEach((ev) => {
      const key = activityEventKey(ev);
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(ev);
    });
  };
  Object.values(state.reportCache || {}).forEach((entry) => add(entry?.facts?.events));
  if (!merged.length) add(state.activeFacts?.events);
  return sortActivityEventsNewestFirst(merged);
}

async function loadActivityEvents() {
  if (!state.apiMode) {
    const ledger = state.opsCache?.activity?.events ?? [];
    const merged = collectStoredActivityEvents();
    if (ledger.length) {
      const seen = new Set(merged.map((ev) => activityEventKey(ev)));
      ledger.forEach((ev) => {
        const key = activityEventKey(ev);
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(ev);
        }
      });
      state.activityEvents = sortActivityEventsNewestFirst(merged);
    } else {
      state.activityEvents = merged;
    }
    state.activityLoading = false;
    return;
  }
  state.activityLoading = true;
  if (state.activeTab === 'activity') {
    refreshActivityPage();
  }
  try {
    const hours = maxRetentionHours();
    const data = await WatchtowerApi.fetchActivity(hours);
    state.activityEvents = data.events ?? [];
    if (!state.activityEvents.length) {
      state.activityEvents = collectStoredActivityEvents();
    }
  } catch {
    state.activityEvents = collectStoredActivityEvents();
  } finally {
    state.activityLoading = false;
  }
}
