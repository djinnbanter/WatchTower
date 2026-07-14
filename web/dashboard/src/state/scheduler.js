/**
 * Poll scheduler — manages periodic data fetching with:
 * - Per-task AbortController (single-flight)
 * - Visibility skip (document.hidden)
 * - Exponential backoff on consecutive failure
 * - Connection-down detection after 3 live failures
 */

import { ui, setUi, reports } from './stores.js';
import { pollReportStatus } from './actions.js';

// ── State ──────────────────────────────────────────────────────────────────────

let _source = null;
let _timers = {};        // key → intervalId
let _aborts = {};        // key → AbortController
let _failCounts = {};    // key → number
let _lastRun = {};       // key → timestamp
let _running = false;

const LIVE_FAIL_THRESHOLD = 3;

// ── Task registry ──────────────────────────────────────────────────────────────

const _tasks = {};

/**
 * Register a polling task.
 * @param {{ key: string, run: (source: any, signal: AbortSignal) => Promise<void>, every: () => number, activeWhen: () => boolean }} task
 */
export function registerTask({ key, run, every, activeWhen }) {
  _tasks[key] = { key, run, every, activeWhen };
}

// ── Lifecycle ──────────────────────────────────────────────────────────────────

export function startScheduler(source) {
  _source = source;
  _running = true;
  _failCounts = {};
  _lastRun = {};

  // Register built-in tasks
  _registerBuiltinTasks();

  // Initial run: fire tasks that are active now
  for (const key of Object.keys(_tasks)) {
    _maybeRun(key);
  }

  // Schedule recurring ticks
  for (const key of Object.keys(_tasks)) {
    _scheduleTick(key);
  }
}

export function stopScheduler() {
  _running = false;
  for (const id of Object.values(_timers)) clearInterval(id);
  for (const ac of Object.values(_aborts)) { try { ac.abort(); } catch { } }
  _timers = {};
  _aborts = {};
}

/** Fire a registered task immediately (e.g. after chart window change). */
export function kickTask(key) {
  if (!_running) return;
  _maybeRun(key);
}

// ── Built-in tasks ─────────────────────────────────────────────────────────────

function _registerBuiltinTasks() {
  // Live — fast poll on overview / live / session tabs
  registerTask({
    key: 'live',
    run: async (source, signal) => {
      await source.fetchLive(signal);
    },
    every: () => ui.value.liveRefreshMs || 5000,
    activeWhen: () => {
      const tab = ui.value.route?.tab;
      return tab === 'overview' || tab === 'live' || tab === 'session';
    },
  });

  // Players — alongside live when on session tab
  registerTask({
    key: 'players',
    run: async (source) => {
      await source.fetchPlayers();
    },
    every: () => ui.value.liveRefreshMs || 5000,
    activeWhen: () => ui.value.route?.tab === 'session',
  });

  // Samples — medium cadence based on window size
  registerTask({
    key: 'samples',
    run: async (source, signal) => {
      await source.fetchSamples(ui.value.chartWindow, signal);
    },
    every: () => _samplesPollMs(ui.value.chartWindow),
    activeWhen: () => {
      const tab = ui.value.route?.tab;
      return tab === 'overview' || tab === 'live';
    },
  });

  // Meta — slow, 60s — overview + issues
  registerTask({
    key: 'meta',
    run: async (source) => {
      await Promise.allSettled([
        source.fetchMeta(),
        source.fetchOpsCache(),
        source.fetchDataSources?.(),
        source.fetchCrashAcks?.(),
        source.fetchIssueAcks?.(),
        source.fetchIssueSuppressions?.(),
        source.fetchInbox?.(),
      ]);
      const tab = ui.value.route?.tab;
      if (tab === 'overview' || tab === 'issues') {
        await source.fetchIssuesPeek().catch(() => null);
      }
      if (tab === 'crashes') {
        await source.fetchCrashesGrouped?.().catch(() => null);
      }
    },
    every: () => 60_000,
    activeWhen: () => true,
  });

  // Update check — boot + every 6h
  registerTask({
    key: 'updateCheck',
    run: async (source) => {
      await source.fetchUpdateCheck();
    },
    every: () => 6 * 60 * 60 * 1000,
    activeWhen: () => true,
  });

  // Report status — 2s while a report run is in flight
  registerTask({
    key: 'reportStatus',
    run: async () => {
      await pollReportStatus();
    },
    every: () => 2000,
    // Skip hidden check for this task — see _maybeRun
    activeWhen: () => reports.value.run?.running === true,
  });
}

// ── Internal scheduling ────────────────────────────────────────────────────────

function _scheduleTick(key) {
  if (_timers[key]) {
    clearInterval(_timers[key]);
    delete _timers[key];
  }
  const task = _tasks[key];
  if (!task) return;

  const interval = () => {
    _reschedule(key);
    _maybeRun(key);
  };

  _timers[key] = setInterval(interval, task.every());
}

/** Restart the interval after a run (handles dynamic every()) */
function _reschedule(key) {
  if (_timers[key]) {
    clearInterval(_timers[key]);
    delete _timers[key];
  }
  const task = _tasks[key];
  if (!task || !_running) return;
  _timers[key] = setInterval(() => {
    _reschedule(key);
    _maybeRun(key);
  }, task.every());
}

async function _maybeRun(key) {
  if (!_running) return;
  const task = _tasks[key];
  if (!task) return;

  // Skip when page hidden, except for reportStatus
  if (document.hidden && key !== 'reportStatus') return;

  if (!task.activeWhen()) return;

  // Single-flight guard
  if (_aborts[key]) return;

  const ac = new AbortController();
  _aborts[key] = ac;
  _lastRun[key] = Date.now();

  try {
    await task.run(_source, ac.signal);
    _failCounts[key] = 0;

    // Recover connection-down flag on live task success
    if (key === 'live' && ui.value.connectionDown) {
      setUi({ connectionDown: false });
    }
  } catch (err) {
    if (err?.name === 'AbortError') return;

    _failCounts[key] = (_failCounts[key] ?? 0) + 1;

    if (key === 'live' && _failCounts[key] >= LIVE_FAIL_THRESHOLD) {
      setUi({ connectionDown: true });
    }
  } finally {
    delete _aborts[key];
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function _windowMinutes(window) {
  const { kind = 'hours', value = 1 } = window ?? {};
  if (kind === 'minutes') return Number(value) || 60;
  if (kind === 'hours') return value * 60;
  if (kind === 'days') return value * 1440;
  return Number(value) || 60;
}

function _samplesPollMs(window) {
  const m = _windowMinutes(window);
  if (m <= 60) return 15_000;
  if (m <= 1440) return 30_000;
  if (m <= 10080) return 60_000;
  return 120_000;
}
