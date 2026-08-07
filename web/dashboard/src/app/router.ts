export type RouteState = {
  tab: string;
  view?: string;
  panel?: string;
  issue?: string;
  group?: string;
  mod?: string;
  filter?: string;
  wiki?: string;
  profile?: string;
  source?: string;
  finding?: string;
  raw: URLSearchParams;
};

function parse(): RouteState {
  const raw = new URLSearchParams(window.location.search);

  // Legacy Help aliases → canonical Help Center (docs), matching production.
  let tab = raw.get('tab') || 'overview';
  if (raw.has('help') || tab === 'help') {
    tab = 'docs';
  }

  return {
    tab,
    view: raw.get('view') || undefined,
    panel: raw.get('panel') || undefined,
    issue: raw.get('issue') || undefined,
    group: raw.get('group') || undefined,
    mod: raw.get('mod') || undefined,
    filter: raw.get('filter') || undefined,
    wiki: raw.get('wiki') || undefined,
    profile: raw.get('profile') || undefined,
    source: raw.get('source') || undefined,
    finding: raw.get('finding') || undefined,
    raw,
  };
}

let current = parse();
const listeners = new Set<() => void>();

const HIDDEN_TAB_REDIRECTS: Record<string, string> = {
  help: 'docs',
  lab: 'overview',
  wizard: 'overview',
};

/** Path + query that stays under the current page (works for / and /demo-app/index.html). */
function urlWithQuery(qs: string): string {
  const path = window.location.pathname || '/';
  return qs ? `${path}?${qs}` : path;
}

/** Normalize legacy / hidden tab aliases in the address bar. */
function canonicalizeRouteUrl() {
  const raw = new URLSearchParams(window.location.search);
  let tab = raw.get('tab') || 'overview';
  let changed = false;

  if (raw.has('help')) {
    raw.delete('help');
    changed = true;
    tab = 'docs';
  }

  const redirect = HIDDEN_TAB_REDIRECTS[tab];
  if (redirect) {
    tab = redirect;
    changed = true;
  }

  if (!changed) return;

  raw.set('tab', tab);
  const qs = raw.toString();
  window.history.replaceState({}, '', urlWithQuery(qs));
  current = parse();
}
canonicalizeRouteUrl();

function emit() {
  current = parse();
  canonicalizeRouteUrl();
  listeners.forEach((l) => l());
}

window.addEventListener('popstate', emit);

/** While > 0, navigate() is a no-op — used by Visuals live page previews. */
let previewNavLock = 0;

export function beginPreviewNavLock() {
  previewNavLock += 1;
}

export function endPreviewNavLock() {
  previewNavLock = Math.max(0, previewNavLock - 1);
}

export function getRoute() {
  return current;
}

export function subscribeRoute(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function navigate( partial: Record<string, string | null | undefined>, replace = false) {
  if (previewNavLock > 0) return;
  const next = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(partial)) {
    if (value == null || value === '') next.delete(key);
    else next.set(key, value);
  }
  if (!next.get('tab')) next.set('tab', 'overview');
  const qs = next.toString();
  const url = urlWithQuery(qs);
  if (replace) window.history.replaceState({}, '', url);
  else window.history.pushState({}, '', url);
  emit();
}

export function hrefFor(tab: string, extra: Record<string, string> = {}) {
  const params = new URLSearchParams({ tab, ...extra });
  return urlWithQuery(params.toString());
}
