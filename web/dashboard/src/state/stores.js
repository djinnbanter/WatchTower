import { signal, batch } from '../lib/signals.js';
import { kickRender } from '../app/kick-render.js';

export const live = signal({ envelope: null, latest: null, error: null, at: null });

export const samples = signal({
  series: {},
  window: { kind: 'hours', value: 1 },
  points: 0,
  at: null,
  error: null,
});

export const reports = signal({
  index: [],
  activeId: 'latest',
  facts: null,
  prevFacts: null,
  brief: null,
  run: { running: false, startedAt: null, message: null, success: null, stage: null, stageLabel: null, stageDetail: null },
  error: null,
});

export const modrinthScan = signal({
  status: {
    enabled: null,
    running: false,
    stage: null,
    stage_label: null,
    stage_detail: null,
    progress: { done: 0, total: 0 },
    batch: { index: 0, count: 0, size: 0 },
    eta_seconds: null,
    last_run: null,
    stats: null,
    success: null,
    error: null,
  },
  startedAt: null,
  error: null,
});

export const discovery = signal({
  status: {
    running: false,
    stage: null,
    stage_label: null,
    stage_detail: null,
    progress: { done: 0, total: 0 },
    counts: {},
    success: null,
    error: null,
    message: null,
    elapsed_ms: null,
    last_run: null,
  },
  startedAt: null,
  error: null,
});

export const opsCache = signal({ data: null, at: null });

export const overviewMeta = signal({ data: null, at: null });

export const players = signal({ directory: null, at: null });

export const performance = signal({
  window: '7d',
  dashboard: null,
  insights: null,
  rollups: null,
  at: null,
});

export const spark = signal({
  enabled: true,
  searchDirs: [],
  profiles: [],
  skipped: [],
  reportProfilePath: null,
  activePath: null,
  profile: null,
  loading: false,
  listLoading: false,
  error: null,
  importing: false,
  importError: null,
  importOpen: false,
  lastRefreshedAt: null,
  view: 'summary',
});

try {
  const rawView = localStorage.getItem('wt.sparkView');
  if (rawView) {
    const view = JSON.parse(rawView);
    if (typeof view === 'string' && view) {
      spark.value = { ...spark.value, view };
    }
  }
  const rawPath = localStorage.getItem('wt.sparkActivePath');
  if (rawPath) {
    const path = JSON.parse(rawPath);
    if (typeof path === 'string' && path) {
      spark.value = { ...spark.value, activePath: path };
    }
  }
} catch { /* ignore */ }

export const incidents = signal({ list: [], byId: {} });

export const dataSources = signal({
  liveAt: null,
  scanAt: null,
  reportAt: null,
  supportComposeAt: null,
  issuesLiveAt: null,
  nextScheduledMin: null,
  opsPollSec: 60,
  opsLogScanSec: null,
});

export const settings = signal({ data: null, saving: false, error: null });

export const auth = signal({ config: null, session: null, gate: 'none', user: null });

export const acks = signal({ crashes: {}, issues: {}, clientModIgnores: {} });

export const crashGroups = signal({
  groups: [],
  count: 0,
  unreviewed: 0,
  unreviewed_groups: 0,
  scanned_at: null,
  at: null,
});

export const inbox = signal({ items: [], at: null, dismissals: {} });

export const issuesPeek = signal({ data: null, at: null });

export const issueSuppressions = signal({ data: null, at: null });

export const activity = signal({ events: [], incidentStories: [], at: null, loading: false });

export const updateCheck = signal({ data: null, at: null });

export const ui = signal({
  route: { tab: 'overview', params: {} },
  theme: 'dark',
  skin: 'aero',
  railExpanded: true,
  paletteOpen: false,
  toasts: [],
  banners: [],
  modal: null,
  liveRefreshMs: 5000,
  chartWindow: { kind: 'hours', value: 1 },
  bootPhase: 'boot', // boot|auth|loading|wizard|ready
  connectionDown: false,
  mobileNavOpen: false,
});

export const noReportYet = signal(false);

/**
 * Shallow-merge partial into ui signal.
 * Skips work when every provided key already matches (avoids kickRender thrash).
 * @param {Partial<typeof ui.value>} partial
 */
export function setUi(partial) {
  const cur = ui.value;
  let changed = false;
  for (const key of Object.keys(partial)) {
    if (cur[key] !== partial[key]) {
      changed = true;
      break;
    }
  }
  if (!changed) return;
  batch(() => {
    ui.value = { ...ui.value, ...partial };
  });
  // Signals subscriptions can stall on this Preact build — always force root reconcile.
  kickRender();
}

/**
 * Navigate to a named tab with optional params.
 * @param {string} tab
 * @param {Record<string, unknown>} params
 */
export function setRoute(tab, params = {}) {
  setUi({ route: { tab, params } });
}
