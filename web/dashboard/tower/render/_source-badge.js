/**
 * Data-source pill badges — Live · Scanned · Report · Mixed
 */
const TowerSourceBadge = (function () {
  const TYPES = {
    live: { label: 'Live', cls: 'wt-source-badge--live', title: 'Updates every few seconds while the server runs' },
    scanned: { label: 'Scanned', cls: 'wt-source-badge--scanned', title: 'From background log and folder scans' },
    report: { label: 'Report', cls: 'wt-source-badge--report', title: 'From your last full health report' },
    mixed: { label: 'Mixed', cls: 'wt-source-badge--mixed', title: 'Combines live, scan, and report data' },
  };

  function badge(type, extraClass) {
    const t = TYPES[type] || TYPES.report;
    const cls = ['wt-source-badge', t.cls, extraClass].filter(Boolean).join(' ');
    return `<span class="${cls}" title="${t.title}">${t.label}</span>`;
  }

  function inlineTitle(title, type) {
    if (!type) return title;
    return `${badge(type)}<span class="wt-source-badge__title">${title}</span>`;
  }

  return { badge, inlineTitle, TYPES };
})();
