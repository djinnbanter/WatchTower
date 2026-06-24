/**
 * Watchtower UI v3 — shared state
 */

const state = {
  facts: null,
  factsPrev: null,
  brief: '',
  snapshot: null,
  liveSamples: null,
  liveSamplesRaw: null,
  reportsIndex: null,
  selectedReportId: 'latest',
  reportCache: {},
  activeTab: 'overview',
  activeFacts: null,
  modsPage: 0,
  modsSearch: '',
  backupsSearch: '',
  modsView: 'overview',
  modsPerPage: 50,
  showTechNames: false,
  crashFilter: 'all',
  crashExtraRows: {},
  crashScrollTo: null,
  crashContextCache: {},
  crashLogModalContent: '',
  crashLogModalFile: '',
  charts: {},
  liveJitter: { tps: 20, mspt: 3, players: 0 },
  liveLatest: null,
  liveEnvelope: null,
  updateCheck: null,
  bandwidthHistory: [],
  diskIoHistory: [],
  liveConfig: null,
  apiMode: false,
  livePollTimer: null,
  liveChartTimer: null,
  corePollTimer: null,
  staticSimTimer: null,
  samplesFreshnessTimer: null,
  samplesAbortController: null,
  samplesPollInFlight: false,
  samplesFetchedAt: null,
  samplesPointCount: 0,
  samplesPollFail: false,
  chartUpdateScheduled: false,
  cachedHeapMax: null,
  playersChartMax: 20,
  noReportYet: false,
  activityEvents: [],
  activityLoading: false,
  activitySearch: '',
  activityTypeFilter: 'all',
  activityScanAt: 0,
  activityScanInFlight: false,
  lagPinInFlight: false,
  lagIssuesPeek: null,
  pregenIdCounter: 0,
  sessionFilter: 'all',
  sessionSearch: '',
  sessionSort: 'name',
  dataSources: null,
  playerRoster: null,
  bootReady: false,
  overviewMeta: null,
  opsCache: null,
  crashScanAt: 0,
  crashScanInFlight: false,
  modScanAt: 0,
  modScanInFlight: false,
  modVersion: null,
  livePollError: null,
  overviewMetaPollCounter: 0,
  lastHeroHealthGrade: null,
  overviewIntroPlayed: false,
  overviewIntroPlaying: false,
  overviewUptimeAnchor: null,
  overviewUptimeTimer: null,
  lastOverviewVitals: null,
  tabIntroPlayed: {},
  tabBadgeCounts: { issues: 0, crashes: 0, mods: 0, backups: 0, activity: 0 },
  performanceDashboard: null,
  performanceInsights: null,
  performanceRollups: null,
  performanceWindow: '7d',
  performanceRollupsPollCounter: 0,
  insightsView: 'patterns',
  canvasView: null,
  wikiPageSlug: null,
  sparkProfilesList: [],
  sparkSearchDirs: [],
  sparkReportProfilePath: null,
  sparkEnabled: true,
  sparkSelectedPath: null,
  sparkActiveProfile: null,
  sparkProfilesLoading: false,
  sparkProfileLoading: false,
  sparkProfileError: null,
  sparkView: 'summary',
};
const THEME_KEY = 'watchtower-theme';
const LEGACY_THEME_KEY = 'watchtower-poc-theme';
const THEMES = ['dark', 'light', 'black'];
const RUN_CONFIG_KEY = 'watchtower-run-config';
const LEGACY_RUN_CONFIG_KEY = 'watchtower-poc-run-config';
const LIVE_REFRESH_KEY = 'watchtower-live-refresh-ms';
const WELCOME_KEY = 'watchtower-welcome-seen';
const ONBOARDING_KEY = 'watchtower-onboarding-dismissed';
const SETUP_WIZARD_KEY = 'watchtower-setup-wizard-v1';
const PREVIEW_SETTINGS_KEY = 'watchtower-preview-settings';
const SELECTED_REPORT_KEY = 'watchtower-selected-report';
const SPARK_SELECTED_KEY = 'watchtower-spark-selected';
const SPARK_VIEW_KEY = 'watchtower-spark-view';

function isApiMode() {
  return typeof WatchtowerApi !== 'undefined' && WatchtowerApi.isEmbedded();
}
