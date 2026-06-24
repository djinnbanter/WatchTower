/**
 * Watchtower UI v3 — desktop sidebar expand/collapse
 */
const TowerSidebar = (function () {
  const STORAGE_KEY = 'wt-sidebar-collapsed';
  const MOBILE_MQ = '(max-width: 768px)';

  function isMobile() {
    return window.matchMedia(MOBILE_MQ).matches;
  }

  function shellEl() {
    return document.querySelector('.wt-shell');
  }

  function railEl() {
    return document.getElementById('tower-rail');
  }

  function toggleBtn() {
    return document.getElementById('sidebar-toggle-btn');
  }

  function isExpanded() {
    return railEl()?.classList.contains('wt-rail--expanded') ?? false;
  }

  function syncToggleIcon() {
    const btn = toggleBtn();
    const icon = btn?.querySelector('[data-lucide]');
    if (!icon) return;
    const expanded = isExpanded();
    icon.setAttribute('data-lucide', expanded ? 'panel-left-close' : 'panel-left');
    if (window.lucide) lucide.createIcons({ root: btn });
  }

  function resizeChartsForTab() {
    if (typeof state === 'undefined' || typeof SparklineManager === 'undefined') return;
    const tab = state.activeTab;
    if (tab === 'overview' || tab === 'live') {
      SparklineManager.resizeTab(tab);
      if (tab === 'live' && typeof resizeLiveCharts === 'function') {
        requestAnimationFrame(() => resizeLiveCharts());
      }
    }
  }

  function onShellTransitionEnd(e) {
    if (e.target !== shellEl() || e.propertyName !== 'grid-template-columns') return;
    resizeChartsForTab();
  }

  function setSidebarExpanded(expanded, { persist = true } = {}) {
    if (isMobile()) return;
    const rail = railEl();
    const shell = shellEl();
    if (!rail || !shell) return;

    rail.classList.toggle('wt-rail--expanded', expanded);
    shell.classList.toggle('wt-shell--sidebar-expanded', expanded);

    const btn = toggleBtn();
    if (btn) btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');

    if (persist) {
      localStorage.setItem(STORAGE_KEY, (!expanded).toString());
    }

    syncToggleIcon();
  }

  function init() {
    const shell = shellEl();
    const rail = railEl();
    const btn = toggleBtn();
    if (!shell || !rail) return;

    const collapsed = localStorage.getItem(STORAGE_KEY) === 'true';
    setSidebarExpanded(!collapsed, { persist: false });

    shell.addEventListener('transitionend', onShellTransitionEnd);

    btn?.addEventListener('click', () => {
      if (isMobile()) return;
      setSidebarExpanded(!isExpanded());
    });

    window.matchMedia(MOBILE_MQ).addEventListener('change', (e) => {
      if (e.matches) {
        shell.classList.remove('wt-shell--sidebar-expanded');
      } else {
        const storedCollapsed = localStorage.getItem(STORAGE_KEY) === 'true';
        setSidebarExpanded(!storedCollapsed, { persist: false });
      }
    });
  }

  return { init, setSidebarExpanded, isExpanded };
})();
