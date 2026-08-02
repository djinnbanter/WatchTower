import { ui, setRoute } from '../state/stores.js';
import { kickRenderNow } from './kick-render.js';
import { kickTask } from '../state/scheduler.js';
import { Motion } from '../motion/reduced.js';

const ALIASES = {
  performance: 'insights',
};

/**
 * Parse current location.search into a route descriptor.
 * Handles legacy query-param aliases.
 */
export function parseRoute() {
  const params = new URLSearchParams(location.search);

  // Special single-param aliases
  if (params.get('setup') === '1') return { tab: 'wizard', params: {} };
  if (params.get('tour') === '1') return { tab: 'tour', params: {} };
  if (params.has('help')) return { tab: 'docs', params: {} };
  if (params.get('tab') === 'help') return { tab: 'docs', params: {} };
  if (params.has('settings')) {
    const panel = params.get('settings');
    return { tab: 'settings', params: panel ? { panel } : {} };
  }

  const rawTab = params.get('tab') || 'overview';
  const tab = ALIASES[rawTab] || rawTab;

  const routeParams = {};
  for (const [k, v] of params.entries()) {
    if (k !== 'tab') routeParams[k] = v;
  }

  return { tab, params: routeParams };
}

/**
 * Apply a parsed route: update ui store + push to history.
 */
export function applyRoute(route, { replace = false } = {}) {
  const { tab, params = {} } = route;
  setRoute(tab, params);
  // setUi already kickRenders; flush immediately so rail/subnav clicks paint this frame
  kickRenderNow();
  // Samples/live only poll on certain tabs — kick immediately on navigation so Live isn't empty
  if (tab === 'live' || tab === 'overview') {
    kickTask('samples');
    kickTask('live');
  }
  if (tab === 'session') {
    kickTask('live');
    kickTask('players');
  }

  const qs = new URLSearchParams({ tab, ...params }).toString();
  const url = `${location.pathname}?${qs}`;
  try {
    if (replace) {
      history.replaceState({ tab, params }, '', url);
    } else {
      history.pushState({ tab, params }, '', url);
    }
  } catch {
    // history not available (e.g. embedded iframe with restricted origins)
  }
}

/**
 * Navigate to a tab with optional params.
 * Uses View Transitions when supported (opacity-safe for sticky panes).
 */
export function navigate(tab, params = {}, { replace = false } = {}) {
  const run = () => applyRoute({ tab, params }, { replace });
  if (
    Motion.enabled
    && typeof document !== 'undefined'
    && typeof document.startViewTransition === 'function'
  ) {
    try {
      document.startViewTransition(run);
      return;
    } catch {
      // fall through
    }
  }
  run();
}

/**
 * Set up popstate listener and apply initial route from URL.
 */
export function initRouter() {
  window.addEventListener('popstate', () => {
    const route = parseRoute();
    setRoute(route.tab, route.params);
    kickRenderNow();
    if (route.tab === 'live' || route.tab === 'overview') {
      kickTask('samples');
      kickTask('live');
    }
    if (route.tab === 'session') {
      kickTask('live');
      kickTask('players');
    }
  });
  const initial = parseRoute();
  setRoute(initial.tab, initial.params);
}

/** Read the current route from the ui store. */
export function getRoute() {
  return ui.value.route;
}
