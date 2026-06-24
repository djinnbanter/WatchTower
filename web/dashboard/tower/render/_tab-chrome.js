/**
 * Shared tab chrome HTML helpers (section heads, stat cards, hero, actions)
 */
const TowerTabChrome = (function () {
  const esc = typeof TowerRenderShared !== 'undefined' ? TowerRenderShared.esc : (s) => String(s ?? '');

  function sectionHead(opts = {}) {
    const {
      id = '',
      title = '',
      sub = '',
      icon = '',
      badge = '',
      ruled = false,
      extra = '',
      span = 'wt-bento__span-12',
    } = opts;
    const idAttr = id ? ` id="${esc(id)}"` : '';
    const ruledCls = ruled ? ' wt-tab-section--ruled' : '';
    const iconHtml = icon
      ? `<i data-lucide="${esc(icon)}" width="18" height="18" aria-hidden="true"></i>`
      : '';
    const badgeHtml = badge || '';
    const subHtml = sub
      ? `<p class="wt-tab-section__sub">${esc(sub)}</p>`
      : '';
    const extraHtml = extra ? `<div class="wt-tab-section__extra">${extra}</div>` : '';
    return `
      <header class="wt-tab-section${ruledCls} ${span}"${idAttr}>
        <div class="wt-tab-section__row">
          <h2 class="wt-tab-section__title">${badgeHtml}${iconHtml}${esc(title)}</h2>
          ${extraHtml}
        </div>
        ${subHtml}
      </header>`;
  }

  function statCard(opts = {}) {
    const {
      id = '',
      tone = '',
      icon = '',
      badge = '',
      label = '',
      value = '',
      hint = '',
      title = '',
    } = opts;
    const toneCls = tone ? ` wt-stat-card--${tone}` : '';
    const iconTone = tone && tone !== 'neutral' ? ` wt-stat-card__icon--${tone}` : '';
    const idAttr = id ? ` id="${esc(id)}"` : '';
    const titleAttr = title ? ` title="${esc(title)}"` : '';
    const iconHtml = icon
      ? `<span class="wt-stat-card__icon${iconTone}" aria-hidden="true"><i data-lucide="${esc(icon)}" width="20" height="20"></i></span>`
      : '';
    const badgeHtml = badge ? `<div class="wt-stat-card__badge">${badge}</div>` : '';
    return `
      <article class="wt-card wt-card--surface wt-stat-card${toneCls}"${idAttr}>
        <div class="wt-stat-card__top">
          ${iconHtml}
          ${badgeHtml}
        </div>
        <span class="wt-stat-card__label">${esc(label)}</span>
        <span class="wt-stat-card__value"${titleAttr}>${value}</span>
        ${hint ? `<span class="wt-stat-card__hint">${esc(hint)}</span>` : ''}
      </article>`;
  }

  function statGrid(cardsHtml, cols = 4) {
    const cls = cols === 3 ? 'wt-stat-grid wt-stat-grid--3' : 'wt-stat-grid';
    return `<div class="${cls} wt-bento__span-12">${cardsHtml}</div>`;
  }

  function flowVisual(nodes) {
    if (!nodes?.length) return '';
    const nodesHtml = nodes.map((s, i) => {
      const tone = s.tone || s.badge || 'neutral';
      const labelHtml = (s.badge && typeof TowerSourceBadge !== 'undefined')
        ? TowerSourceBadge.badge(s.badge)
        : `<span class="wt-hero-flow__pill wt-hero-flow__pill--${tone}">${esc(s.label)}</span>`;
      return `
      <div class="wt-hero-flow__node wt-hero-flow__node--${tone}">
        <span class="wt-hero-flow__icon"><i data-lucide="${esc(s.icon)}" width="18" height="18"></i></span>
        ${labelHtml}
        <span class="wt-hero-flow__sub">${esc(s.sub)}</span>
      </div>
      ${i < nodes.length - 1 ? '<span class="wt-hero-flow__arrow" aria-hidden="true"><i data-lucide="chevron-right" width="18" height="18"></i></span>' : ''}`;
    }).join('');
    return `<div class="wt-hero-flow" aria-hidden="true">${nodesHtml}</div>`;
  }

  const TAB_HERO_PRESETS = {
    live: {
      title: 'Live metrics',
      lead: 'Real-time TPS, MSPT, CPU, RAM, and charts sample every few seconds while the dashboard is open.',
      nodes: [
        { tone: 'live', icon: 'gauge', label: 'TPS', sub: 'Game tick rate' },
        { tone: 'live', icon: 'activity', label: 'MSPT', sub: 'Tick time' },
        { tone: 'live', icon: 'cpu', label: 'Host', sub: 'CPU & RAM' },
      ],
    },
    session: {
      title: 'Session',
      lead: 'Online roster updates live while you watch; playtime, peaks, and window stats come from your last full report.',
      nodes: [
        { tone: 'live', icon: 'users', label: 'Online', sub: 'Live roster' },
        { tone: 'scanned', icon: 'radar', label: 'Activity', sub: 'Log events' },
        { tone: 'report', icon: 'bar-chart-3', label: 'Window', sub: 'Report stats' },
      ],
    },
    issues: {
      title: 'Issues',
      lead: 'Urgent items from your last full report; lag spikes and mod log errors also update from live scans.',
      nodes: [
        { badge: 'scanned', icon: 'zap', label: 'Live', sub: 'Lag & log peek' },
        { badge: 'report', icon: 'list-checks', label: 'Report', sub: 'Action queue' },
        { badge: 'report', icon: 'history', label: 'History', sub: 'Older items' },
      ],
    },
    crashes: {
      title: 'Crashes',
      lead: 'Crash folder scans run in the background; classification depth and pre-crash context come from reports.',
      nodes: [
        { badge: 'scanned', icon: 'folder-search', label: 'Scanned', sub: 'Folder scan' },
        { badge: 'scanned', icon: 'eye', label: 'Review', sub: 'Ack workflow' },
        { badge: 'report', icon: 'file-search', label: 'Report', sub: 'Deep context' },
      ],
    },
    mods: {
      title: 'Mods',
      lead: 'Log errors update in the background; the full mod list, conflicts, and client-only analysis need a report.',
      nodes: [
        { badge: 'scanned', icon: 'scan-line', label: 'Scanned', sub: 'Log errors' },
        { badge: 'live', icon: 'package', label: 'Live', sub: 'Running list' },
        { badge: 'report', icon: 'layers', label: 'Report', sub: 'Full manifest' },
      ],
    },
    activity: {
      title: 'Activity',
      lead: 'Recent events from background log scans; older history backfills from your saved reports.',
      nodes: [
        { badge: 'scanned', icon: 'list', label: 'Scanned', sub: 'Log ledger' },
        { badge: 'live', icon: 'bell', label: 'Alerts', sub: 'Latest signal' },
        { badge: 'report', icon: 'archive', label: 'Report', sub: 'Event backfill' },
      ],
    },
    backups: {
      title: 'Backups',
      lead: 'Backup signals read in the background; folder inventory and archive details baseline from reports.',
      nodes: [
        { badge: 'scanned', icon: 'cloud', label: 'External', sub: 'Panel heartbeat' },
        { badge: 'scanned', icon: 'folder', label: 'Local', sub: 'Folder scan' },
        { badge: 'report', icon: 'archive', label: 'Report', sub: 'Inventory' },
      ],
    },
    performance: {
      title: 'Insights',
      lead: 'Performance patterns from minute rollups and your last report window — busy hours, mod changes, and storage deltas.',
      nodes: [
        { tone: 'live', icon: 'line-chart', label: 'Rollups', sub: 'Minute history' },
        { tone: 'live', icon: 'lightbulb', label: 'Patterns', sub: 'Busy hours' },
        { tone: 'scanned', icon: 'package-search', label: 'Changes', sub: 'Mod & disk' },
      ],
    },
    spark: {
      title: 'Spark profiler',
      lead: 'Capture a profile while lagging, pick it from the dropdown, and read plain-English lag advice here. Run a full report only if you want Spark on Overview too.',
      nodes: [
        { tone: 'neutral', icon: 'flame', label: 'Capture', sub: 'While lagging' },
        { tone: 'neutral', icon: 'list', label: 'Pick', sub: 'Profile dropdown' },
        { tone: 'neutral', icon: 'sparkles', label: 'Advice', sub: 'Hot methods' },
      ],
    },
    docs: {
      title: 'Documentation',
      lead: 'Step-by-step guides built into Watchtower — search for a topic or browse by category.',
      nodes: [
        { tone: 'neutral', icon: 'book-open', label: 'Browse', sub: 'By topic' },
        { tone: 'neutral', icon: 'search', label: 'Search', sub: 'Find a page' },
        { tone: 'neutral', icon: 'link', label: 'Share', sub: 'Copy a link' },
      ],
    },
    sources: {
      title: 'Data sources',
      leadHtml: 'Every number on the dashboard comes from one of three layers. Use the freshness row and matrix below when you need to know if something is <strong>live</strong>, from a background <strong>scan</strong>, or from your last full <strong>report</strong>.',
      nodes: [
        { badge: 'live', icon: 'zap', label: 'Live', sub: 'Charts & vitals' },
        { badge: 'scanned', icon: 'scan', label: 'Scanned', sub: 'Logs & crashes' },
        { badge: 'report', icon: 'clipboard-list', label: 'Report', sub: 'Full audit' },
      ],
    },
    settings: {
      title: 'Settings',
      lead: 'Schedule reports, tune monitoring intervals, configure backups, and manage dashboard security — changes apply immediately where noted.',
      nodes: [
        { tone: 'neutral', icon: 'sliders-horizontal', label: 'General', sub: 'Schedule & thresholds' },
        { tone: 'neutral', icon: 'gauge', label: 'Monitoring', sub: 'Poll & retention' },
        { tone: 'neutral', icon: 'archive', label: 'Backups', sub: 'External setup' },
        { tone: 'neutral', icon: 'shield', label: 'Security', sub: 'Login & 2FA' },
      ],
    },
    help: {
      title: 'Help',
      lead: 'Short answers and a guided walkthrough — or open the full guides when you want more detail.',
      nodes: [
        { tone: 'neutral', icon: 'book-marked', label: 'Guide', sub: 'Quick answers' },
        { tone: 'neutral', icon: 'compass', label: 'Tour', sub: 'Walkthrough' },
        { tone: 'neutral', icon: 'library', label: 'Docs', sub: 'Full guides' },
      ],
    },
  };

  function heroWithVisual(opts = {}) {
    const {
      title = '',
      lead = '',
      leadHtml = '',
      eyebrow = '',
      actions = '',
      visual = '',
      compact = false,
      span = 'wt-bento__span-12',
      titleTag = 'h1',
    } = opts;
    const compactCls = compact ? ' wt-hero-card--compact' : '';
    const eyebrowHtml = eyebrow
      ? `<p class="wt-hero-card__eyebrow">${esc(eyebrow)}</p>`
      : '';
    const leadContent = leadHtml
      ? `<p class="wt-hero-card__lead">${leadHtml}</p>`
      : (lead ? `<p class="wt-hero-card__lead">${esc(lead)}</p>` : '');
    const actionsHtml = actions
      ? `<div class="wt-hero-card__actions">${actions}</div>`
      : '';
    const visualHtml = visual
      ? visual
      : '';
    return `
      <section class="wt-card wt-card--surface wt-hero-card wt-hero-card--visual${compactCls} ${span}">
        <div class="wt-hero-card__grid">
          <div class="wt-hero-card__copy">
            ${eyebrowHtml}
            <${titleTag} class="wt-hero-card__title">${title}</${titleTag}>
            ${leadContent}
            ${actionsHtml}
          </div>
          ${visualHtml}
        </div>
      </section>`;
  }

  function tabHero(tabId, overrides = {}) {
    const preset = TAB_HERO_PRESETS[tabId];
    if (!preset) return '';
    const merged = { ...preset, ...overrides };
    const nodes = merged.nodes || preset.nodes;
    return heroWithVisual({
      title: merged.title,
      lead: merged.lead,
      leadHtml: merged.leadHtml,
      eyebrow: merged.eyebrow,
      actions: merged.actions,
      compact: merged.compact,
      visual: flowVisual(nodes),
      titleTag: merged.titleTag || 'h1',
    });
  }

  function heroCard(opts = {}) {
    const {
      eyebrow = '',
      title = '',
      lead = '',
      actions = '',
      compact = false,
      span = 'wt-bento__span-12',
    } = opts;
    const compactCls = compact ? ' wt-hero-card--compact' : '';
    const eyebrowHtml = eyebrow
      ? `<p class="wt-hero-card__eyebrow">${esc(eyebrow)}</p>`
      : '';
    const actionsHtml = actions
      ? `<div class="wt-hero-card__actions">${actions}</div>`
      : '';
    return `
      <article class="wt-card wt-card--surface wt-hero-card${compactCls} ${span}">
        ${eyebrowHtml}
        <h2 class="wt-hero-card__title">${title}</h2>
        ${lead ? `<p class="wt-hero-card__lead">${esc(lead)}</p>` : ''}
        ${actionsHtml}
      </article>`;
  }

  function tabActions(opts = {}) {
    const { text = '', buttons = '' } = opts;
    return `
      <footer class="wt-tab-actions wt-bento__span-12">
        ${text ? `<p class="wt-tab-actions__text">${text}</p>` : '<span></span>'}
        <div class="wt-tab-actions__buttons">${buttons}</div>
      </footer>`;
  }

  return { sectionHead, statCard, statGrid, heroCard, heroWithVisual, flowVisual, tabHero, tabActions };
})();
