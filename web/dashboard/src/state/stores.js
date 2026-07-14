import { signal, batch } from '../lib/signals.js';

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
  activePath: null,
  profile: null,
  loading: false,
  error: null,
  view: 'summary',
});

export const incidents = signal({ list: [], byId: {} });

export const dataSources = signal({
  liveAt: null,
  scanAt: null,
  reportAt: null,
  nextScheduledMin: null,
  opsPollSec: 60,
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

export const activity = signal({ events: [], at: null, loading: false });

export const updateCheck = signal({ data: null, at: null });

export const ui = signal({
  route: { tab: 'overview', params: {} },
  theme: 'dark',
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
 * @param {Partial<typeof ui.value>} partial
 */
export function setUi(partial) {
  batch(() => {
    ui.value = { ...ui.value, ...partial };
  });
}

/**
 * Navigate to a named tab with optional params.
 * @param {string} tab
 * @param {Record<string, unknown>} params
 */
export function setRoute(tab, params = {}) {
  setUi({ route: { tab, params } });
}
