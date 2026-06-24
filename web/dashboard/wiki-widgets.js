/**
 * Rich wiki page widgets — diagrams and sample UI that match dashboard chrome.
 */
const WatchtowerWikiWidgets = (function () {
  const esc = (s) => {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  function badge(kind, label) {
    const text = label || (kind === 'live' ? 'Live' : kind === 'scanned' ? 'Scanned' : kind === 'report' ? 'Report' : 'Mixed');
    return `<span class="wt-source-badge wt-source-badge--${kind}">${esc(text)}</span>`;
  }

  function dataSourcesFlow() {
    const steps = [
      { kind: 'live', sub: 'Charts while you watch', icon: 'zap' },
      { kind: 'scanned', sub: 'Logs & crashes', icon: 'scan' },
      { kind: 'report', sub: 'Full health check', icon: 'clipboard-list' },
    ];
    const nodes = steps.map((s, i) => `
      <div class="wt-hero-flow__node wt-hero-flow__node--${s.kind}">
        <span class="wt-hero-flow__icon"><i data-lucide="${s.icon}" width="18" height="18"></i></span>
        ${badge(s.kind)}
        <span class="wt-hero-flow__sub">${esc(s.sub)}</span>
      </div>
      ${i < steps.length - 1 ? '<span class="wt-hero-flow__arrow" aria-hidden="true"><i data-lucide="chevron-right" width="18" height="18"></i></span>' : ''}`).join('');
    return `<div class="wt-wiki-widget wt-wiki-widget--diagram"><div class="wt-hero-flow" aria-hidden="true">${nodes}</div></div>`;
  }

  function freshnessSample() {
    const cards = [
      { kind: 'live', icon: 'activity', label: 'Live charts', value: 'Just now', hint: 'Updates while dashboard is open' },
      { kind: 'scanned', icon: 'scan-line', label: 'Background scan', value: '42s ago', hint: 'About once a minute on the server' },
      { kind: 'report', icon: 'file-stack', label: 'Full report', value: '3h ago', hint: 'Your latest health check' },
      { kind: 'neutral', icon: 'calendar-clock', label: 'Next scheduled', value: 'In 4h', hint: 'From Settings schedule', muted: true },
    ];
    return `<div class="wt-wiki-widget wt-wiki-widget--freshness">
      <p class="wt-wiki-widget__caption">Example — open the <strong>Sources</strong> tab for real times on your server</p>
      <div class="wt-stat-grid wt-wiki-freshness-sample">
        ${cards.map((c) => `
          <article class="wt-card wt-card--surface wt-stat-card wt-stat-card--${c.muted ? 'neutral' : c.kind}">
            <div class="wt-stat-card__top">
              <span class="wt-stat-card__icon wt-stat-card__icon--${c.kind}" aria-hidden="true"><i data-lucide="${c.icon}" width="20" height="20"></i></span>
              ${!c.muted ? `<div class="wt-stat-card__badge">${badge(c.kind)}</div>` : ''}
            </div>
            <span class="wt-stat-card__label">${esc(c.label)}</span>
            <span class="wt-stat-card__value">${esc(c.value)}</span>
            <span class="wt-stat-card__hint">${esc(c.hint)}</span>
          </article>`).join('')}
      </div>
    </div>`;
  }

  function railDiagram() {
    const groups = [
      { label: 'Monitor', tabs: ['Overview', 'Live', 'Insights', 'Session', 'Sources'] },
      { label: 'Fix problems', tabs: ['Issues', 'Crashes', 'Spark'] },
      { label: 'Day to day', tabs: ['Mods', 'Backups', 'Activity'] },
    ];
    return `<div class="wt-wiki-widget wt-wiki-rail-diagram">
      ${groups.map((g) => `
        <div class="wt-wiki-rail-diagram__group">
          <span class="wt-wiki-rail-diagram__label">${esc(g.label)}</span>
          <div class="wt-wiki-rail-diagram__tabs">
            ${g.tabs.map((t) => `<span class="wt-wiki-rail-diagram__tab">${esc(t)}</span>`).join('')}
          </div>
        </div>`).join('')}
    </div>`;
  }

  function configFiles() {
    return `<div class="wt-wiki-widget wt-wiki-config-compare">
      <article class="wt-card wt-card--surface wt-wiki-config-card">
        <div class="wt-wiki-config-card__head"><i data-lucide="server" width="18" height="18"></i><code>config/watchtower-server.toml</code></div>
        <p><strong>Needs a server restart.</strong> Dashboard port and how often live charts refresh.</p>
        <ul><li>dashboardBindHost</li><li>liveSampleIntervalSeconds</li><li>liveRetentionHours</li></ul>
      </article>
      <article class="wt-card wt-card--surface wt-wiki-config-card">
        <div class="wt-wiki-config-card__head"><i data-lucide="sliders-horizontal" width="18" height="18"></i><code>watchtower/watchtower.conf</code></div>
        <p><strong>Change in Settings — no restart.</strong> Report schedule, warning levels, backup paths.</p>
        <ul><li>REPORT_INTERVAL_MINUTES</li><li>OPS_LOG_SCAN_SEC</li><li>BACKUP_DIRS</li></ul>
      </article>
    </div>`;
  }

  function securitySteps() {
    const steps = [
      { icon: 'log-in', title: 'Sign in', body: 'First time: <code>watchtower</code> / <code>password</code> — you will be asked to pick a new password.' },
      { icon: 'shield', title: 'Turn on 2FA', body: '<strong>Settings → Security</strong> — scan the QR code with an authenticator app on your phone.' },
      { icon: 'network', title: 'Public server?', body: 'Do not expose the dashboard to the internet. Use localhost plus a secure tunnel (SSH) instead.' },
    ];
    return `<div class="wt-wiki-widget wt-wiki-steps">
      ${steps.map((s, i) => `
        <div class="wt-wiki-step">
          <span class="wt-wiki-step__num">${i + 1}</span>
          <div class="wt-wiki-step__body">
            <h4 class="wt-wiki-step__title"><i data-lucide="${s.icon}" width="16" height="16"></i> ${s.title}</h4>
            <p>${s.body}</p>
          </div>
        </div>`).join('')}
    </div>`;
  }

  function drFlow() {
    return `<div class="wt-wiki-widget wt-wiki-dr-flow">
      <div class="wt-wiki-dr-flow__node"><i data-lucide="server-crash" width="20" height="20"></i><span>Server will not start</span></div>
      <span class="wt-wiki-dr-flow__arrow"><i data-lucide="arrow-right" width="18" height="18"></i></span>
      <div class="wt-wiki-dr-flow__node"><i data-lucide="terminal" width="20" height="20"></i><span>Run recovery tool</span></div>
      <span class="wt-wiki-dr-flow__arrow"><i data-lucide="arrow-right" width="18" height="18"></i></span>
      <div class="wt-wiki-dr-flow__node"><i data-lucide="folder-archive" width="20" height="20"></i><span>Get a zip bundle</span></div>
      <span class="wt-wiki-dr-flow__arrow"><i data-lucide="arrow-right" width="18" height="18"></i></span>
      <div class="wt-wiki-dr-flow__node"><i data-lucide="globe" width="20" height="20"></i><span>Open in your browser</span></div>
    </div>`;
  }

  function homeFeatures() {
    const items = [
      { icon: 'file-heart', title: 'Health reports', sub: 'Checks logs, crashes, mods, and backups on your server' },
      { icon: 'activity', title: 'Live dashboard', sub: 'See speed, lag, CPU, and memory — with history' },
      { icon: 'inbox', title: 'Fix list', sub: 'What to tackle first, from your latest report' },
      { icon: 'life-buoy', title: 'Recovery help', sub: 'Tools when the server will not boot' },
    ];
    return `<div class="wt-wiki-widget wt-stat-grid wt-wiki-feature-grid">
      ${items.map((it) => `
        <article class="wt-card wt-card--surface wt-wiki-feature-card">
          <span class="wt-wiki-feature-card__icon"><i data-lucide="${it.icon}" width="22" height="22"></i></span>
          <h4 class="wt-wiki-feature-card__title">${esc(it.title)}</h4>
          <p class="wt-wiki-feature-card__sub">${esc(it.sub)}</p>
        </article>`).join('')}
    </div>`;
  }

  const WIDGETS = {
    'Home': () => homeFeatures(),
    'Understanding-Data-Sources': () => dataSourcesFlow() + freshnessSample(),
    'Dashboard-Overview': () => railDiagram(),
    'Dashboard-Tabs': () => railDiagram(),
    'Configuration': () => configFiles(),
    'Security-and-Access': () => securitySteps(),
    'Disaster-Recovery': () => drFlow(),
    'Quick-Start-Checklist': () => `<div class="wt-wiki-widget wt-wiki-callout wt-wiki-callout--tip">
      <i data-lucide="list-checks" width="18" height="18"></i>
      <p>Work through the list below in order — about <strong>15 minutes</strong> for a solid start. Checkboxes are for your notes (they are not saved).</p>
    </div>`,
    'Live-Charts': () => `<div class="wt-wiki-widget wt-wiki-callout wt-wiki-callout--info">
      <i data-lucide="line-chart" width="18" height="18"></i>
      <p><strong>Tip:</strong> On <strong>Live</strong>, the vitals range goes from <strong>1 min</strong> up to <strong>90 days</strong> (within saved history). <strong>Overview</strong> uses a quick <strong>1h / 6h / 24h</strong> picker — both stay in sync. Memory charts show <strong>how much RAM is in use</strong>, which is easier to read on hosted servers than “free memory.”</p>
    </div>`,
    'HTTP-API': () => `<div class="wt-wiki-widget wt-wiki-callout wt-wiki-callout--info">
      <i data-lucide="plug" width="18" height="18"></i>
      <p><strong>For developers.</strong> Most endpoints need you to be logged in. Base URL: <code>http://&lt;your-server&gt;:8787</code></p>
    </div>`,
  };

  function forPage(slug) {
    const fn = WIDGETS[slug];
    return fn ? fn() : '';
  }

  return { forPage, esc };
})();
