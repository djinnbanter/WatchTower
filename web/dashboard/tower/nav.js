/**
 * Watchtower UI v3 — icon rail navigation
 */
const TowerNav = (function () {
  const VIEW_TABS = new Set(['overview', 'live', 'performance', 'session', 'sources', 'issues', 'crashes', 'spark', 'mods', 'backups', 'activity', 'docs']);
  const RAIL_TAB = '.wt-rail__link[data-tab]';
  let mobileBackdrop = null;

  function ensureMobileBackdrop() {
    if (mobileBackdrop) return mobileBackdrop;
    mobileBackdrop = document.createElement('div');
    mobileBackdrop.className = 'wt-rail-backdrop is-hidden';
    mobileBackdrop.setAttribute('aria-hidden', 'true');
    mobileBackdrop.addEventListener('click', closeMobileRail);
    document.body.appendChild(mobileBackdrop);
    return mobileBackdrop;
  }

  function openMobileRail() {
    document.getElementById('tower-rail')?.classList.add('is-open');
    ensureMobileBackdrop().classList.remove('is-hidden');
  }

  function closeMobileRail() {
    document.getElementById('tower-rail')?.classList.remove('is-open');
    mobileBackdrop?.classList.add('is-hidden');
  }

  function setActiveTab(tab) {
    document.querySelectorAll(RAIL_TAB).forEach((el) => {
      const active = el.dataset.tab === tab;
      el.classList.toggle('is-active', active);
      el.setAttribute('aria-current', active ? 'page' : 'false');
    });
  }

  function init(opts) {
    const onNavigate = typeof opts === 'function' ? opts : opts?.onNavigate;
    document.querySelectorAll(RAIL_TAB).forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = btn.dataset.tab;
        closeMobileRail();
        if (tab && typeof onNavigate === 'function') onNavigate(tab);
      });
    });
    document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
      const rail = document.getElementById('tower-rail');
      if (rail?.classList.contains('is-open')) closeMobileRail();
      else openMobileRail();
    });
  }

  function isTabView(view) {
    return VIEW_TABS.has(view);
  }

  return { init, setActiveTab, isTabView, VIEW_TABS, closeMobileRail };
})();
