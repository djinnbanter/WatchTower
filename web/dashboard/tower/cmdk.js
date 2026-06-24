/**
 * Watchtower UI v3 — command palette (Ctrl/Cmd+K)
 */
const TowerCmdk = (function () {
  let overlay = null;
  let input = null;
  let list = null;
  let items = [];
  let activeIndex = 0;
  let onRun = null;

  function defaultItems() {
    const tabs = [
      ['overview', 'Overview', 'Monitor'],
      ['live', 'Live metrics', 'Monitor'],
      ['performance', 'Insights — rollup patterns', 'Monitor'],
      ['session', 'Session roster', 'Monitor'],
      ['sources', 'Data sources', 'Monitor'],
      ['issues', 'Issues queue', 'Triage'],
      ['crashes', 'Crash reports', 'Triage'],
      ['spark', 'Spark profiler report', 'Triage'],
      ['mods', 'Mod health', 'Ops'],
      ['backups', 'Backups', 'Ops'],
      ['activity', 'Activity stream', 'Ops'],
      ['docs', 'Documentation', 'Admin'],
    ];
    const nav = tabs.map(([id, label, group]) => ({
      id: `tab:${id}`,
      label,
      group: 'Go to…',
      hint: group,
      run: () => window.navigateToTab?.(id),
    }));
    const actions = [
      { id: 'action:run', label: 'Run health report', group: 'Actions', hint: '↵', run: () => document.getElementById('run-report-btn')?.click() },
      { id: 'action:settings', label: 'Open Settings', group: 'Actions', run: () => TowerViews?.openSettings?.('settings') },
      { id: 'action:help', label: 'Open Help guide', group: 'Actions', run: () => TowerViews?.openHelp?.('guide') },
      { id: 'action:docs', label: 'Open documentation', group: 'Actions', run: () => window.openWiki?.('Home') },
      { id: 'action:theme', label: 'Cycle theme', group: 'Actions', run: () => document.getElementById('theme-toggle')?.click() },
    ];
    const settings = [
      ['settings', 'Settings — General'],
      ['security', 'Settings — Security'],
      ['about', 'Settings — About'],
    ].map(([sec, label]) => ({
      id: `settings:${sec}`,
      label,
      group: 'Go to…',
      run: () => TowerViews?.openSettings?.(sec),
    }));
    const wiki = [];
    const wikiData = window.WATCHTOWER_WIKI;
    if (wikiData?.nav) {
      for (const cat of wikiData.nav) {
        for (const p of cat.pages || []) {
          wiki.push({
            id: `wiki:${p.slug}`,
            label: p.title,
            group: 'Documentation',
            hint: cat.label,
            run: () => window.openWiki?.(p.slug),
          });
        }
      }
    }
    return [...nav, ...settings, ...wiki, ...actions];
  }

  function ensureDom() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'wt-cmdk-overlay';
    overlay.className = 'wt-modal-backdrop wt-cmdk-backdrop hidden';
    overlay.innerHTML = `
      <div class="wt-cmdk" role="dialog" aria-modal="true" aria-label="Command palette">
        <div class="wt-cmdk__header">
          <span class="wt-cmdk__icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </span>
          <input type="text" class="wt-cmdk__input" id="tower-cmdk-input" placeholder="Search commands and pages…" autocomplete="off" spellcheck="false">
          <span class="wt-cmdk__kbd">Esc</span>
        </div>
        <div class="wt-cmdk__body wt-cmdk__list" id="tower-cmdk-list" role="listbox"></div>
      </div>`;
    document.body.appendChild(overlay);
    input = overlay.querySelector('#tower-cmdk-input');
    list = overlay.querySelector('#tower-cmdk-list');
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    input.addEventListener('input', renderList);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = Math.min(activeIndex + 1, items.length - 1); highlight(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = Math.max(activeIndex - 1, 0); highlight(); }
      else if (e.key === 'Enter') { e.preventDefault(); runActive(); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); }
    });
  }

  function filter(query) {
    const q = query.trim().toLowerCase();
    const all = defaultItems();
    if (!q) return all;
    return all.filter((it) => it.label.toLowerCase().includes(q) || it.group.toLowerCase().includes(q));
  }

  function renderList() {
    items = filter(input?.value || '');
    activeIndex = 0;
    if (!list) return;
    if (!items.length) {
      list.innerHTML = '<p class="wt-cmdk__empty">No matching commands</p>';
      return;
    }
    let lastGroup = '';
    let html = '';
    items.forEach((it, i) => {
      if (it.group !== lastGroup) {
        html += `<div class="wt-cmdk__group-label">${it.group}</div>`;
        lastGroup = it.group;
      }
      html += `<button type="button" class="wt-cmdk__item${i === 0 ? ' active' : ''}" data-idx="${i}" role="option" aria-selected="${i === 0 ? 'true' : 'false'}">${it.label}${it.hint ? `<span class="wt-cmdk__item-desc">${it.hint}</span>` : ''}</button>`;
    });
    list.innerHTML = html;
    list.querySelectorAll('.wt-cmdk__item').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeIndex = Number(btn.dataset.idx);
        runActive();
      });
    });
  }

  function highlight() {
    list?.querySelectorAll('.wt-cmdk__item').forEach((el, i) => {
      const on = i === activeIndex;
      el.classList.toggle('active', on);
      el.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  function runActive() {
    const item = items[activeIndex];
    if (item?.run) item.run();
    close();
  }

  function open() {
    if (document.getElementById('tower-setup-wizard') && !document.getElementById('tower-setup-wizard').classList.contains('is-hidden')) return;
    if (document.getElementById('tower-welcome') && !document.getElementById('tower-welcome').classList.contains('is-hidden')) return;
    if (document.getElementById('tower-boot') && !document.getElementById('tower-boot').classList.contains('is-hidden')) return;
    ensureDom();
    overlay.classList.remove('is-hidden', 'hidden');
    overlay.classList.add('is-open');
    input.value = '';
    renderList();
    requestAnimationFrame(() => input.focus());
  }

  function close() {
    overlay?.classList.add('is-hidden');
    overlay?.classList.remove('is-open');
  }

  function init() {
    ensureDom();
    document.getElementById('cmdk-btn')?.addEventListener('click', open);
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        overlay?.classList.contains('is-hidden') || overlay?.classList.contains('hidden') ? open() : close();
      }
    });
  }

  return { init, open, close };
})();
