/**
 * Post-auth boot: load reports and start live polling.
 * Shared by main.js (already authenticated) and auth-gate (after login / account setup).
 */

import { isEmbedded } from '../api/index.js';
import { startClock } from '../state/clock.js';
import { startScheduler } from '../state/scheduler.js';
import { pollReportStatus } from '../state/actions.js';
import { ui, setUi, reports, noReportYet } from '../state/stores.js';
import { initRouter } from './router.js';
import { initPalette } from './palette.js';
import { shouldShowSetupWizard, relaunchSetupWizard } from '../features/wizard/view.js';
import { kickRender } from './kick-render.js';

let _source = null;
let _sessionReady = false;
let _routerReady = false;
let _hydrateInFlight = null;

export function setBootSource(source) {
  _source = source;
}

/**
 * Load report index + latest facts (with get-fallback and selected-report restore).
 * Safe to call after boot if facts are still missing.
 */
export async function hydrateReports() {
  if (!_source) return;
  if (_hydrateInFlight) return _hydrateInFlight;

  _hydrateInFlight = (async () => {
    if (typeof _source.hydrateReports === 'function') {
      await _source.hydrateReports();
      return;
    }
    // Fallback for sources without hydrateReports
    await Promise.allSettled([
      _source.fetchReportsIndex?.(),
      _source.fetchReportsLatest?.(),
    ]);
  })().finally(() => {
    _hydrateInFlight = null;
  });

  return _hydrateInFlight;
}

/** Safe to call more than once — only the first successful call runs loaders. */
export async function resumeAfterAuth() {
  if (!_source || _sessionReady) return;
  _sessionReady = true;

  const embedded = isEmbedded();
  if (embedded) {
    // Keep App on BootScreen until hydrate finishes (bootPhase stays auth/loading)
    if (ui.value.bootPhase === 'auth' || ui.value.bootPhase === 'boot') {
      setUi({ bootPhase: 'loading' });
    }
    try {
      await Promise.allSettled([
        hydrateReports(),
        _source.fetchSettings?.(),
        _source.fetchMeta?.(),
        _source.fetchOpsCache?.(),
        _source.fetchDataSources?.(),
        _source.fetchIssueSuppressions?.(),
        // Prefetch chart series so Live paints filled on first visit
        _source.fetchSamples?.(ui.value.chartWindow),
        _source.fetchLive?.(),
      ]);
      kickRender();
    } catch (err) {
      console.warn('[WatchTower] Initial report load failed:', err);
    }
  }

  const forceSetup = new URLSearchParams(location.search).get('setup') === '1';
  if (forceSetup) {
    relaunchSetupWizard();
  } else if (
    ui.value.bootPhase === 'auth'
    || ui.value.bootPhase === 'boot'
    || ui.value.bootPhase === 'loading'
  ) {
    setUi({ bootPhase: shouldShowSetupWizard() ? 'wizard' : 'ready' });
  }

  startClock();

  if (embedded) {
    startScheduler(_source);
    pollReportStatus();
  } else {
    _source.startSimulator?.();
  }

  ensureRouter();
}

/**
 * Shell safety net: if Overview mounts with no facts and we never marked
 * "no report yet", retry hydrate once (covers failed/raced first load).
 */
export function ensureReportsPresent() {
  if (!isEmbedded() || !_source) return;
  if (reports.value?.facts || noReportYet.value) return;
  hydrateReports().catch((err) => {
    console.warn('[WatchTower] Report re-hydrate failed:', err);
  });
}

export function ensureRouter() {
  if (_routerReady) return;
  _routerReady = true;
  initRouter();
  initPalette();
}
