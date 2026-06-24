/**
 * Watchtower UI v3 — Documentation tab (in-app wiki)
 */
const TowerRenderDocs = (function () {
  function renderDocs() {
    const hero = typeof TowerTabChrome !== 'undefined' ? TowerTabChrome.tabHero('docs') : '';
    return `
      <div class="wt-tab-docs wt-enter">
        <div class="wt-bento wt-stagger">
          ${hero}
          <div id="wiki-root" class="wt-tab-docs__wiki wt-bento__span-12"></div>
        </div>
      </div>`;
  }

  return { renderDocs };
})();
