/**
 * Watchtower UI v3 — in-canvas Settings / Help views
 */
const TowerViews = (function () {
  function renderSplitShell(title, panels, activePanel, contentHtml) {
    const nav = panels.map(([id, label]) =>
      `<button type="button" class="wt-split-view__nav-btn wt-hub-nav__btn${id === activePanel ? ' active' : ''}" data-view-panel="${id}">${label}</button>`
    ).join('');
    return `
      <div class="wt-split-view wt-enter">
        <div class="wt-split-view__nav" aria-label="${title} sections">
          <button type="button" class="wt-btn wt-btn--ghost wt-btn--sm" id="tower-view-back" style="margin-bottom:12px;width:100%">← Back to dashboard</button>
          ${nav}
        </div>
        <div class="wt-split-view__content" id="tower-view-content">${contentHtml}</div>
      </div>`;
  }

  function renderHubShell({ hubId, title, panels, activePanel, contentHtml, contentClass = '' }) {
    const hero = typeof TowerTabChrome !== 'undefined'
      ? TowerTabChrome.tabHero(hubId)
      : '';
    const nav = panels.map(([id, label]) =>
      `<button type="button" class="wt-hub-nav__btn wt-split-view__nav-btn${id === activePanel ? ' active' : ''}" data-view-panel="${id}">${label}</button>`
    ).join('');
    const mainCls = contentClass ? ` ${contentClass}` : '';
    return `
      <div class="wt-hub wt-enter">
        <div class="wt-bento wt-stagger">
          ${hero}
          <div class="wt-hub-shell__split wt-bento__span-12">
            <nav class="wt-card wt-card--surface wt-hub-shell__nav" aria-label="${title} sections">
              <button type="button" class="wt-btn wt-btn--ghost wt-btn--sm wt-hub-shell__back" id="tower-view-back">
                <i data-lucide="arrow-left" width="14" height="14"></i> Back to dashboard
              </button>
              <div class="wt-hub-shell__nav-list">${nav}</div>
            </nav>
            <div class="wt-card wt-card--surface wt-hub-shell__main${mainCls}" id="tower-view-content">${contentHtml}</div>
          </div>
        </div>
      </div>`;
  }

  function bindBack(handler) {
    document.getElementById('tower-view-back')?.addEventListener('click', handler);
  }

  function openSettings(panel) {
    if (typeof WatchtowerSettings !== 'undefined' && WatchtowerSettings.openInCanvas) {
      WatchtowerSettings.openInCanvas(panel || 'settings');
    } else if (typeof WatchtowerSettings !== 'undefined') {
      WatchtowerSettings.open(panel || 'settings');
    }
  }

  function openHelp(panel) {
    if (panel === 'docs' && typeof window.openWiki === 'function') {
      window.openWiki('Home');
      return;
    }
    if (typeof WatchtowerHelp !== 'undefined' && WatchtowerHelp.openInCanvas) {
      WatchtowerHelp.openInCanvas(panel || 'guide');
    } else if (typeof WatchtowerHelp !== 'undefined') {
      WatchtowerHelp.open('guide');
    }
  }

  function backToDashboard() {
    state.canvasView = null;
    if (typeof render === 'function') render();
    if (typeof TowerNav !== 'undefined') TowerNav.setActiveTab(state.activeTab);
  }

  return { renderSplitShell, renderHubShell, bindBack, openSettings, openHelp, backToDashboard };
})();
