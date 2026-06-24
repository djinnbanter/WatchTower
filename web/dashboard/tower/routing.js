/**
 * Dashboard URL routing — keeps tab and wiki page in the query string so refresh restores place.
 * Legacy `#wiki/Slug` hashes are still read for backward compatibility.
 */
const TowerRouting = (function () {
  function basePath() {
    return location.pathname || '/';
  }

  function parseWikiSlug() {
    const params = new URLSearchParams(location.search);
    const fromQuery = params.get('wiki');
    if (fromQuery) return decodeURIComponent(fromQuery);
    const m = location.hash.match(/^#wiki\/([^?#]+)/);
    if (m) return decodeURIComponent(m[1]);
    return null;
  }

  function parseTab() {
    return new URLSearchParams(location.search).get('tab');
  }

  function parseInsightsView() {
    const view = new URLSearchParams(location.search).get('view');
    return view && ['patterns', 'mod-changes', 'storage'].includes(view) ? view : null;
  }

  function buildUrl({ tab, wiki, view } = {}) {
    const params = new URLSearchParams();
    if (tab) params.set('tab', tab);
    if (wiki && tab === 'docs') params.set('wiki', wiki);
    if (view && tab === 'performance') params.set('view', view);
    const q = params.toString();
    return q ? `${basePath()}?${q}` : basePath();
  }

  function currentUrl() {
    return basePath() + location.search;
  }

  function write({ tab, wiki, view } = {}, { push = false } = {}) {
    const url = buildUrl({ tab, wiki, view });
    if (url === currentUrl() && !/^#wiki\//.test(location.hash)) return;
    const payload = { tab, wiki, view };
    if (push) history.pushState(payload, '', url);
    else history.replaceState(payload, '', url);
  }

  function resolveWikiSlug(options = {}) {
    if (options.wikiSlug) return options.wikiSlug;
    const fromUrl = parseWikiSlug();
    if (fromUrl) return fromUrl;
    if (state.wikiPageSlug) return state.wikiPageSlug;
    return 'Home';
  }

  function syncFromAppState({ push = false } = {}) {
    if (!state?.bootReady) return;
    const tab = state.activeTab;
    const payload = { tab };
    if (tab === 'docs' && state.wikiPageSlug) payload.wiki = state.wikiPageSlug;
    if (tab === 'performance' && state.insightsView) payload.view = state.insightsView;
    write(payload, { push });
  }

  return {
    parseWikiSlug,
    parseTab,
    parseInsightsView,
    buildUrl,
    write,
    resolveWikiSlug,
    syncFromAppState,
  };
})();
