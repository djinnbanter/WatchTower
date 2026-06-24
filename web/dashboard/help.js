/**
 * Help hub — in-canvas guide.
 */
const WatchtowerHelp = (function () {
  let activePanel = 'guide';

  const GUIDE_SECTIONS = [
    {
      title: 'What Watchtower does',
      icon: 'radio-tower',
      body: 'Watchtower watches your Minecraft server for problems — slow ticks, crashes, mod errors, missing backups, and more. It reads your server logs and files on the machine where the server runs. Nothing is sent to the cloud, and there is no AI.',
      wiki: 'Home',
    },
    {
      title: 'Quick start',
      icon: 'rocket',
      body: '1) Open <strong>Live</strong> to see charts right away. 2) The <strong>setup wizard</strong> runs an initial audit and walks you through backups and scheduled reports. 3) On <strong>Backups</strong>, tell Watchtower where your backup files live. 4) In <strong>Settings</strong>, turn on scheduled reports so the dashboard stays up to date.',
      wiki: 'Quick-Start-Checklist',
    },
    {
      title: 'What updates when?',
      icon: 'layers',
      body: '<strong>Right now</strong> — speed, lag, CPU, and memory charts refresh every few seconds while you have the dashboard open. <strong>In the background</strong> — the server still checks logs, crashes, and recent activity about once a minute, even when nobody is looking. <strong>Full report</strong> — a deeper check that builds your fix list and full mod review; run it on a schedule instead of every visit. Open <strong>Sources</strong> to see when each layer last updated.',
      wiki: 'Understanding-Data-Sources',
    },
    {
      title: 'Dashboard tabs',
      icon: 'layout-dashboard',
      body: '<strong>Overview</strong> — quick health summary. <strong>Live</strong> — live charts. <strong>Insights</strong> — busy times and lag patterns over days. <strong>Session</strong> — who is online now. <strong>Sources</strong> — what updates how. <strong>Issues</strong> — what to fix, in priority order. <strong>Crashes</strong> — crash reports with plain advice. <strong>Mods</strong> — mod problems from logs and reports. <strong>Backups</strong> — are backups recent? <strong>Activity</strong> — joins, reboots, and other events.',
      wiki: 'Dashboard-Tabs',
    },
    {
      title: 'Hosting panels and backups',
      icon: 'server',
      body: 'If you use a hosting panel (Crafty, Pterodactyl, bloom, and others), Watchtower can show helpful context. It will <strong>not</strong> guess your backup location — you choose it. If backup files sit on this server, use <strong>Choose backup folder</strong> on the <strong>Backups</strong> tab. If backups only exist on your host or in the cloud, set that up under <strong>Settings → Backups</strong>.',
      wiki: 'Hosting-Panels',
    },
    {
      title: 'Scheduled reports',
      icon: 'calendar-clock',
      body: 'Turn on automatic health reports in <strong>Settings</strong> (gear icon). Twice a day or every hour are common choices. That keeps trends, the <strong>Activity</strong> tab, and your fix list useful without you running a report by hand each time. Changes save right away and survive server restarts.',
      wiki: 'Scheduled-Reports',
    },
    {
      title: 'Useful commands',
      icon: 'terminal',
      body: 'In the server console or in-game (with permission): <code>/watchtower run</code> — run a full health report now. <code>/watchtower brief</code> — print the latest summary. <code>/watchtower issues</code> — list current problems. <code>/watchtower schedule show</code> — see the report schedule. <code>/watchtower diagnostics</code> — zip files for support.',
      wiki: 'Commands',
    },
    {
      title: 'Performance over time',
      icon: 'line-chart',
      body: 'Watchtower saves a snapshot every minute (up to 90 days) so you can see busy hours and lag patterns. Open the <strong>Insights</strong> tab for heatmaps, comparisons, and export. <strong>Overview</strong> shows a short teaser with a link there. <strong>Activity</strong> is for individual events (joins, restarts) — not long-term patterns.',
      wiki: 'Dashboard-Tabs',
    },
    {
      title: 'Settings vs advanced files',
      icon: 'settings-2',
      body: 'Most options are in <strong>Settings</strong> — report schedule, warning levels, backups, login security, and the optional <strong>guided tour</strong>. A few advanced options (dashboard port, how often live charts sample) live in server config files and need a server restart. The full guides explain which is which.',
      wiki: 'Configuration',
    },
    {
      title: 'Login and security',
      icon: 'shield',
      body: 'The dashboard needs a <strong>username and password</strong>. First login is <code>watchtower</code> / <code>password</code> — change the password when asked. Turn on two-factor authentication (2FA) under <strong>Settings → Security</strong> if anyone outside your home network can reach the dashboard. Locked out? See the full guide for recovery steps.',
      wiki: 'Security-and-Access',
    },
  ];

  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function wikiBtn(slug, label = 'Read the full guide') {
    return `<button type="button" class="wt-btn wt-btn--ghost wt-btn--sm wt-help-section__wiki-btn" data-open-wiki="${esc(slug)}">${esc(label)}</button>`;
  }

  function renderGuide() {
    const setupReplay = typeof WatchtowerSetupWizard !== 'undefined'
      ? `<button type="button" class="wt-btn wt-btn--ghost wt-btn--sm" id="help-run-setup-wizard">
          <i data-lucide="wand-2" width="16" height="16"></i> Run setup wizard again
        </button>`
      : '';
    const topics = GUIDE_SECTIONS.map((s) => `
      <article class="wt-card wt-card--surface wt-help-topic">
        <h3 class="wt-help-topic__title">
          <i data-lucide="${esc(s.icon)}" width="18" height="18" aria-hidden="true"></i>
          ${esc(s.title)}
        </h3>
        <p class="wt-text-body wt-text-secondary wt-help-topic__body">${s.body}</p>
        ${s.wiki ? wikiBtn(s.wiki) : ''}
      </article>`).join('');
    const footer = typeof TowerTabChrome !== 'undefined'
      ? TowerTabChrome.tabActions({
        text: 'Want more detail? Open the full guides in the Docs tab.',
        buttons: `<button type="button" class="wt-btn wt-btn--primary wt-btn--sm" data-open-wiki="Home"><i data-lucide="book-open" width="14" height="14"></i> Open full guides</button>${setupReplay}`,
      })
      : `<p class="wt-help-section__link"><button type="button" class="wt-btn wt-btn--primary wt-btn--sm" data-open-wiki="Home">Open Docs tab</button>${setupReplay}</p>`;
    return `
      <div class="wt-hub-panel wt-help-guide">
        ${topics}
        ${footer}
      </div>`;
  }

  function bindGuideActions(root) {
    root.querySelectorAll('[data-open-wiki]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (typeof window.openWiki === 'function') window.openWiki(btn.dataset.openWiki);
      });
    });
    document.getElementById('help-run-setup-wizard')?.addEventListener('click', () => {
      if (typeof TowerViews !== 'undefined') TowerViews.backToDashboard();
      if (typeof WatchtowerSetupWizard !== 'undefined') {
        setTimeout(() => WatchtowerSetupWizard.open({ replay: true }), 300);
      }
    });
  }

  function renderContent() {
    const el = document.getElementById('help-content');
    if (!el) return;
    el.innerHTML = renderGuide();
    bindGuideActions(el);
    if (window.lucide) lucide.createIcons({ root: el });
  }

  function openInCanvas(panel = 'guide') {
    activePanel = 'guide';
    state.canvasView = 'help';
    const panels = [['guide', 'Guide']];
    const main = document.getElementById('main-content');
    if (!main || typeof TowerViews === 'undefined') return;
    main.innerHTML = TowerViews.renderHubShell({
      hubId: 'help',
      title: 'Help',
      panels,
      activePanel,
      contentHtml: '<div id="help-content" class="wt-hub-shell__panel"></div>',
    });
    TowerViews.bindBack(() => TowerViews.backToDashboard());
    main.querySelectorAll('[data-view-panel]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.viewPanel === activePanel) return;
        activePanel = 'guide';
        main.querySelectorAll('[data-view-panel]').forEach((b) => {
          b.classList.toggle('active', b.dataset.viewPanel === activePanel);
        });
        renderContent();
        const panelEl = document.getElementById('help-content');
        if (typeof TowerMotion !== 'undefined' && panelEl) TowerMotion.staggerEnter(panelEl);
      });
    });
    renderContent();
    if (typeof TowerMotion !== 'undefined') TowerMotion.staggerEnter(main);
    if (window.lucide) lucide.createIcons({ root: main });
  }

  function open(panel = 'guide') {
    if (panel === 'docs' && typeof window.openWiki === 'function') {
      window.openWiki('Home');
      return;
    }
    if (panel === 'tour' && typeof WatchtowerSettings !== 'undefined') {
      return WatchtowerSettings.open('about');
    }
    return openInCanvas('guide');
  }

  function close() {
    if (state.canvasView === 'help') {
      state.canvasView = null;
      if (typeof render === 'function') render();
      if (typeof TowerNav !== 'undefined') TowerNav.setActiveTab(state.activeTab);
    }
  }

  return { open, openInCanvas, close };
})();
