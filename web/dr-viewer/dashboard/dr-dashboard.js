/** Watchtower DR dashboard viewer 1.0.0 — fix-first crisis UI */
const LOG_RENDER_MAX_LINES = 12000;

const DrDashboard = {
  state: {
    facts: null,
    brief: '',
    warnings: [],
    acks: {},
    activeTab: 'fix',
    crashFilter: 'all',
    ingestSource: 'local',
    tldrText: '',
    bundleLogs: null,
    correlation: [],
    manifest: null,
    gunzipSync: null,
    logView: { category: 'regular', fileIndex: 0, search: '', highlightLine: null },
    logLoading: false,
    logLoadingMessage: '',
    modsSearch: '',
    modsFilter: 'all',
    showTechNames: false,
  },

  esc(s) {
    const d = document.createElement('div');
    d.textContent = s ?? '';
    return d.innerHTML;
  },

  escAttr(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  },

  fmtTime(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return String(iso).slice(0, 19);
      return d.toLocaleString(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return iso;
    }
  },

  fmtTimeShort(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch {
      return String(iso).slice(11, 16);
    }
  },

  fmtRelative(iso) {
    if (!iso) return '';
    try {
      const diff = Date.now() - new Date(iso).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'just now';
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 48) return `${hrs}h ago`;
      return `${Math.floor(hrs / 24)}d ago`;
    } catch {
      return '';
    }
  },

  truncatePath(p, max = 40) {
    if (!p) return '';
    if (p.length <= max) return p;
    return `…${p.slice(-(max - 1))}`;
  },

  emptyIgnores() {
    return {};
  },

  getAcks() {
    return Acks.load(this.state.facts?.meta?.hostname);
  },

  dedupeFixes(fixes) {
    const seen = new Set();
    return (fixes || []).filter((f) => {
      const k = String(f).trim();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  },

  formatLookbackLabel(hours) {
    const h = Number(hours);
    if (Number.isNaN(h)) return '';
    if (h >= 720) return '30d';
    if (h >= 168) return '7d';
    if (h >= 48) return '48h';
    return `${h}h`;
  },

  extractTldrFromBrief(brief) {
    if (!brief) return '';
    const match = brief.match(/TL;DR\s*\r?\n[-=]+\s*\r?\n([\s\S]*?)(?:\r?\n\r?\n[A-Z][A-Z0-9 /&'-]{2,}|\r?\n[-=]{10,}|$)/i);
    if (!match) return '';
    return match[1]
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .join(' ')
      .trim();
  },

  init(facts, brief, warnings = [], options = {}) {
    this.state.facts = facts;
    this.state.brief = brief || '';
    this.state.warnings = warnings || [];
    this.state.ingestSource = options.ingestSource === 'cli' ? 'cli' : 'local';
    this.state.bundleLogs = options.bundleLogs || null;
    this.state.gunzipSync = options.gunzipSync || null;
    this.state.manifest = options.manifest || null;
    this.state.correlation = options.correlation
      || facts?.optional?.dr_log_correlation
      || [];
    this.state.logView = { category: 'regular', fileIndex: 0, search: '', highlightLine: null };
    this.state.logLoading = false;
    this.state.logLoadingMessage = '';
    this.state.tldrText = this.extractTldrFromBrief(brief);
    this.state.acks = this.getAcks();
    this.renderNav();
    this.renderReportBar();
    this.render();
  },

  setTab(tab) {
    this.state.activeTab = tab;
    document.querySelectorAll('.wt-rail__link[data-tab]').forEach((el) => {
      const active = el.dataset.tab === tab;
      el.classList.toggle('is-active', active);
      el.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    this.render();
    if (tab === 'logs') this.startLogLoadIfNeeded();
    if (window.WatchtowerMotion?.tabEnter) {
      const canvas = document.getElementById('main-content');
      if (canvas) WatchtowerMotion.tabEnter(canvas);
    }
  },

  startLogLoadIfNeeded() {
    if (!this.logFileNeedsDecompress()) return;
    this.ensureCurrentLogReady()
      .then(() => {
        if (this.state.activeTab === 'logs') this.render();
      })
      .catch((err) => console.error(err));
  },

  refreshIcons() {
    if (!window.lucide?.createIcons) return;
    const wrap = document.querySelector('.wt-shell') || document.querySelector('.page-wrap');
    if (wrap) window.lucide.createIcons({ root: wrap });
    else window.lucide.createIcons();
  },

  formatReportWindow(facts) {
    const meta = facts?.meta || {};
    const end = meta.generated;
    const start = meta.window_start;
    const lbMins = meta.lookback_minutes;
    const lbHours = meta.lookback_hours;
    let lbLabel = '';
    if (lbMins != null) lbLabel = `${lbMins}m lookback`;
    else if (lbHours != null) lbLabel = `${this.formatLookbackLabel(lbHours)} lookback`;

    if (start && end) {
      return {
        primary: `Report window: ${this.fmtTime(start)} → ${this.fmtTime(end)}`,
        secondary: lbLabel ? `· ${lbLabel}` : '',
      };
    }
    if (end) {
      return {
        primary: `Report generated ${this.fmtTime(end)}`,
        secondary: lbLabel ? `· ${lbLabel}` : '',
      };
    }
    return { primary: 'Report window unavailable', secondary: '' };
  },

  renderNav() {
    const facts = this.state.facts;
    if (!facts) return;

    const meta = facts.meta || {};
    const hostname = (meta.hostname || 'dr').toUpperCase();
    const sourceLabel = this.state.ingestSource === 'cli' ? 'CLI export' : 'local analysis';
    const gen = meta.generated;
    const subtitle = gen
      ? `${this.fmtTime(gen)} · ${sourceLabel}`
      : `Disaster recovery · ${sourceLabel}`;

    const titleEl = document.getElementById('nav-title');
    if (titleEl) titleEl.textContent = meta.report_mode === 'dr' ? 'Watchtower DR' : 'Watchtower';

    const subtitleEl = document.getElementById('nav-subtitle');
    if (subtitleEl) subtitleEl.textContent = subtitle;

    const hostEl = document.getElementById('tower-host-name') || document.getElementById('host-name');
    if (hostEl) hostEl.textContent = hostname;

    const pathEl = document.getElementById('tower-server-path') || document.getElementById('server-path');
    if (pathEl) {
      const path = meta.server_dir || '';
      pathEl.textContent = this.truncatePath(path);
      pathEl.title = path;
    }

    document.title = hostname && hostname !== 'DR'
      ? `Watchtower DR — ${hostname}`
      : 'Watchtower DR';

    this.refreshIcons();
  },

  renderReportBar() {
    const facts = this.state.facts;
    if (!facts) return;

    const win = this.formatReportWindow(facts);
    const primaryEl = document.getElementById('tower-report-window') || document.getElementById('report-window-primary');
    const hintEl = document.getElementById('report-window-compare-hint');

    if (primaryEl) {
      primaryEl.textContent = win.secondary
        ? `${win.primary} ${win.secondary}`
        : win.primary;
    }

    if (hintEl) {
      if (facts.meta?.report_mode === 'dr') {
        hintEl.textContent = this.state.ingestSource === 'cli'
          ? 'Disaster recovery snapshot — upload from watchtower-cli dr output'
          : 'Disaster recovery snapshot — analyzed from files on your device';
        hintEl.classList.remove('hidden');
      } else {
        hintEl.textContent = '';
        hintEl.classList.add('hidden');
      }
    }
  },

  backupPillClass(backup) {
    if (!backup || backup.status === 'success') return 'green';
    return 'red';
  },

  renderStatusPills(f) {
    const h = f.health || {};
    const backup = f.optional?.last_backup;
    const mod = Health.modDriver(f, this.emptyIgnores());
    const pills = [];

    if (f.meta?.report_mode === 'dr') {
      pills.push('<span class="wt-status-pill wt-status-pill--warn dr-snapshot-badge"><i data-lucide="life-buoy" width="14" height="14"></i> DR snapshot</span>');
    }

    if (h.panel_running) {
      pills.push('<span class="wt-status-pill wt-status-pill--healthy"><span class="ping-wrap"><span class="ping"></span><span class="dot"></span></span>Panel: Online</span>');
    } else if (h.panel_running === false) {
      pills.push('<span class="wt-status-pill wt-status-pill--danger"><i data-lucide="power" width="14" height="14"></i>Panel: Down</span>');
    }

    if (h.java_running) {
      pills.push('<span class="wt-status-pill wt-status-pill--healthy"><i data-lucide="activity" width="14" height="14"></i>Java: Online</span>');
    } else {
      pills.push('<span class="wt-status-pill wt-status-pill--danger">Java: Down</span>');
    }

    if (mod) {
      pills.push('<span class="wt-status-pill wt-status-pill--warn"><i data-lucide="triangle-alert" width="14" height="14"></i>Mod Health: Warning</span>');
    } else {
      pills.push('<span class="wt-status-pill wt-status-pill--healthy">Mods: OK</span>');
    }

    const bCls = this.backupPillClass(backup);
    const bMod = bCls === 'green' ? 'healthy' : 'danger';
    pills.push(`<span class="wt-status-pill wt-status-pill--${bMod}"><i data-lucide="database-backup" width="14" height="14"></i>${this.esc(Labels.backupPillLabel(backup))}</span>`);

    return pills.join('');
  },

  renderStaticVitals(f) {
    const sys = f.system || {};
    const opt = f.optional || {};
    const diskPct = sys.disk_use_pct ?? opt.storage?.disk_use_pct;
    const modCount = (opt.mods ?? []).length;
    const crashCount = (opt.crash_summaries ?? []).length;
    const javaRunning = f.health?.java_running;
    const javaText = javaRunning ? 'Running' : 'Down';
    const javaCls = javaRunning ? 'wt-signal__value--healthy' : 'wt-text-danger';

    return `
      <div class="wt-signal-grid vitals-static-only">
        <div class="wt-signal">
          <span class="wt-signal__question">Disk used</span>
          <div class="wt-signal__value ${diskPct != null && diskPct >= 85 ? 'wt-signal__value--warn' : ''}">${diskPct != null ? `${Math.round(diskPct)}%` : '—'}</div>
        </div>
        <div class="wt-signal">
          <span class="wt-signal__question">Mods</span>
          <div class="wt-signal__value">${modCount}</div>
        </div>
        <div class="wt-signal">
          <span class="wt-signal__question">Crash reports</span>
          <div class="wt-signal__value ${crashCount ? 'wt-signal__value--warn' : ''}">${crashCount}</div>
        </div>
        <div class="wt-signal">
          <span class="wt-signal__question">Java process</span>
          <div class="wt-signal__value ${javaCls}">${this.esc(javaText)}</div>
        </div>
      </div>`;
  },

  renderOverview() {
    const f = this.state.facts;
    const acks = this.state.acks;
    const ignores = this.emptyIgnores();
    const health = Health.displayHealth(f, acks, ignores);
    const h = f.health || {};
    const gradCls = health.effective === 'critical' ? 'critical' : health.effective === 'warning' ? 'warning' : 'ok';
    const effectiveWord = Labels.healthStatus(health.effective);
    const ackSuffix = health.ackCount > 0 && health.effective !== health.overall
      ? ` (${health.ackCount} acked)`
      : '';
    const tldrHtml = Health.buildTldrHtml(f, acks, null, ignores);
    const sessionBadge = h.java_running === false
      ? 'Server not running at report time'
      : `Session: ${Labels.healthStatus(health.current).toUpperCase()}`;
    const verdictMod = gradCls === 'critical' ? 'critical' : gradCls === 'warning' ? 'warn' : 'ok';
    const briefGrad = gradCls === 'ok' ? 'ok' : gradCls === 'warning' ? 'warn' : 'critical';
    const statusCls = gradCls === 'critical' ? 'critical' : gradCls === 'warning' ? 'warn' : 'healthy';
    const beaconCls = gradCls === 'critical' ? 'wt-beacon--critical'
      : gradCls === 'warning' ? 'wt-beacon--warn' : 'wt-beacon--healthy';

    return `
      <div class="wt-bento wt-enter">
        <section class="wt-brief wt-bento__brief">
          <div class="wt-brief__gradient wt-brief__gradient--${briefGrad}" aria-hidden="true"></div>
          <div class="wt-brief__pills">${this.renderStatusPills(f)}</div>
          <div class="wt-brief__tldr-label"><i data-lucide="zap" width="14" height="14"></i> TLDR</div>
          <p class="wt-brief__tldr">${tldrHtml}</p>
          ${health.statusNote ? `<p class="wt-text-caption wt-text-tertiary">${this.esc(health.statusNote)}</p>` : ''}
          <p class="wt-text-caption wt-text-tertiary">Report generated ${this.fmtTime(f.meta?.generated)}</p>
        </section>
        <aside class="wt-verdict wt-verdict--${verdictMod} wt-bento__verdict">
          <span class="wt-verdict__label">Global Health State</span>
          <div class="wt-verdict__status">
            <span class="wt-beacon wt-beacon--lg wt-beacon--pulse ${beaconCls}" aria-hidden="true"></span>
            <span class="wt-verdict__word wt-verdict__word--${verdictMod}">${this.esc(effectiveWord)}${this.esc(ackSuffix)}</span>
          </div>
        </aside>
        <div class="wt-bento__session">
          <span class="wt-session-chip wt-session-chip--${statusCls}">
            <i data-lucide="alert-triangle" width="14" height="14"></i>
            ${this.esc(sessionBadge)}
          </span>
        </div>
      </div>
      ${this.renderStaticVitals(f)}${this.renderCorrelationBanner()}`;
  },

  renderCorrelationBanner() {
    const sessions = this.state.correlation || [];
    if (!sessions.length) return '';
    const alerts = sessions.filter((s) => s.correlation_status === 'logs_only');
    if (!alerts.length) return '';
    return alerts.map((s) => `
      <div class="dr-correlation-callout wt-panel" role="alert">
        <i data-lucide="alert-triangle" width="18" height="18"></i>
        <div>
          <strong>Restart #${s.attempt || '?'} — startup failed, no crash report</strong>
          <p class="text-caption">${this.esc(s.user_message || 'The server stopped during startup but did not write a file under crash-reports/.')}</p>
        </div>
      </div>`).join('');
  },

  renderAnchorBanner() {
    const anchor = this.state.facts?.meta?.dr_bundle?.anchor
      || this.state.manifest?.anchor;
    if (anchor?.found === false || this.state.facts?.meta?.dr_bundle?.anchor_status === 'not_found') {
      return `<div class="dr-correlation-callout wt-panel" role="alert">
        <i data-lucide="alert-triangle" width="18" height="18"></i>
        <div><strong>No successful start found in logs</strong>
        <p class="text-caption">Using 24h fallback window — review all bundled logs carefully.</p></div>
      </div>`;
    }
    if (anchor?.found && anchor.time) {
      return `<div class="dr-anchor-banner wt-panel">
        <i data-lucide="check-circle" width="16" height="16"></i>
        <span>Last good boot: ${this.esc(this.fmtTime(anchor.time))}${anchor.file ? ` · ${this.esc(anchor.file)}:${anchor.line || '?'}` : ''}</span>
      </div>`;
    }
    return '';
  },

  buildDrFindings(f) {
    const items = [];
    const h = f.health || {};
    const mc = f.minecraft || {};
    const opt = f.optional || {};

    if (h.java_running === false) {
      items.push('Minecraft is <strong>not running</strong> — the bundled logs show startup did not complete.');
    } else if (h.java_running === true) {
      items.push('Java process was running when this report was generated.');
    }

    const sessions = this.state.correlation || [];
    const failed = sessions.filter((s) => s.failure_signals).length;
    if (sessions.length) {
      items.push(`${sessions.length} restart attempt${sessions.length === 1 ? '' : 's'} since the last good boot${failed ? ` (<strong>${failed}</strong> with failure lines in logs)` : ''}.`);
    }

    const anchor = f.meta?.dr_bundle?.anchor || this.state.manifest?.anchor;
    if (anchor?.found && anchor.time) {
      items.push(`Last successful <code>Done!</code> start: <strong>${this.esc(this.fmtTime(anchor.time))}</strong>.`);
    } else if (f.meta?.dr_bundle?.anchor_status === 'not_found' || anchor?.found === false) {
      items.push('No successful server start found in logs — analysis uses a <strong>24h fallback</strong> window.');
    }

    const activeIssues = (f.issues || []).filter((i) => i.active !== false && !i.historical);
    if (activeIssues.length) {
      items.push(`<strong>${activeIssues.length}</strong> active issue${activeIssues.length === 1 ? '' : 's'} detected in this bundle.`);
    }

    const modErrs = (opt.mod_log_errors ?? []).filter((e) => e.mod_id !== 'client_noise');
    if (modErrs.length) {
      const names = modErrs.slice(0, 4).map((e) => Labels.modFriendlyName(e.mod_id)).join(', ');
      items.push(`<strong>${modErrs.length}</strong> mod${modErrs.length === 1 ? '' : 's'} with errors in logs${names ? `: ${this.esc(names)}${modErrs.length > 4 ? '…' : ''}` : ''}.`);
    }

    const modDiff = opt.dr_mod_diff;
    if (modDiff?.has_changes) {
      const n = (modDiff.added?.length || 0) + (modDiff.removed?.length || 0) + (modDiff.updated?.length || 0);
      items.push(`Mod list changed since last good boot — <strong>${n}</strong> add/remove/update${n === 1 ? '' : 's'}.`);
    }

    const crashes = opt.crash_summaries ?? [];
    if (crashes.length) {
      items.push(`<strong>${crashes.length}</strong> crash report${crashes.length === 1 ? '' : 's'} included in the bundle.`);
    }

    const modCount = (opt.mods ?? []).length;
    if (modCount) {
      items.push(`Mod manifest: <strong>${modCount}</strong> jar${modCount === 1 ? '' : 's'} in the bundle.`);
    }

    if (mc.last_log_line) {
      const line = String(mc.last_log_line).slice(0, 140);
      items.push(`Latest log line: <code class="dr-report-log-snippet">${this.esc(line)}</code>`);
    }

    if (h.status_note && f.meta?.report_mode === 'dr') {
      items.push(this.esc(h.status_note));
    }

    return items;
  },

  buildDrDiagnosis(f, sortedIssues) {
    const parts = [];
    const top = sortedIssues[0];
    const recs = (f.optional?.mod_recommendations ?? []).filter((r) =>
      r.severity === 'critical' || r.severity === 'warning');

    if (this.state.tldrText) {
      parts.push(`<p class="dr-report-lead">${this.esc(this.state.tldrText)}</p>`);
    }

    if (top) {
      parts.push(`<p class="dr-report-lead"><strong>Most likely cause:</strong> ${this.esc(Labels.issueSummary(top))}${top.message ? ` — ${this.esc(top.message)}` : ''}</p>`);
    } else if (!sortedIssues.length && !recs.length) {
      parts.push('<p class="dr-report-lead">No single blocker stood out — review restart attempts and raw logs.</p>');
    }

    const issueList = sortedIssues.slice(0, 5).map((i) => {
      const sev = i.severity || 'warning';
      return `<li class="dr-report-issue severity-${sev}"><span class="dr-report-issue-id">${this.esc(Labels.issueSummary(i))}</span>${i.message ? `<span class="dr-report-issue-msg">${this.esc(i.message)}</span>` : ''}</li>`;
    }).join('');

    if (issueList) {
      parts.push(`<ul class="dr-report-issue-list">${issueList}</ul>`);
    }

    const modDiagnosis = recs.slice(0, 3).map((r) =>
      `<li><strong>${this.esc(Labels.modFriendlyName(r.mod_id))}</strong>${r.why ? ` — ${this.esc(r.why)}` : ''}</li>`).join('');
    if (modDiagnosis) {
      parts.push(`<p class="dr-report-subhead">Mod log analysis</p><ul class="dr-report-mod-list">${modDiagnosis}</ul>`);
    }

    return parts.join('');
  },

  inferModCategory(f, modId) {
    const rec = (f.optional?.mod_recommendations ?? []).find((r) => r.mod_id === modId);
    if (rec?.category) return rec.category;
    const err = (f.optional?.mod_log_errors ?? []).find((e) => e.mod_id === modId);
    if (err?.by_category?.mod_corrupt) return 'mod_corrupt';
    if (err?.by_category?.mod_load_failed) return 'mod_load_failed';
    return 'mod_load_failed';
  },

  resolveModFixSteps(f, modId, category) {
    const rec = (f.optional?.mod_recommendations ?? []).find((r) => r.mod_id === modId);
    if (rec?.fix_steps?.length) return rec.fix_steps;
    const fromLabels = Labels.modDrFixSteps(modId, category);
    if (fromLabels.length) return fromLabels;
    return [];
  },

  isModStartupFixCategory(category, issueId) {
    return category === 'mod_corrupt' || category === 'mod_load_failed' || issueId === 'MOD_LOAD_FAILED';
  },

  buildDrFixSteps(f, sortedIssues) {
    const top = sortedIssues[0];
    const recs = (f.optional?.mod_recommendations ?? []).filter((r) =>
      r.severity === 'critical' || r.severity === 'warning');
    const topRec = recs[0];
    const modId = top?.mod_id || topRec?.mod_id;

    if (modId) {
      const category = this.inferModCategory(f, modId);
      if (this.isModStartupFixCategory(category, top?.id) || topRec?.category === 'mod_corrupt' || topRec?.category === 'mod_load_failed') {
        const steps = this.resolveModFixSteps(f, modId, category);
        if (steps.length) return steps;
      }
    }

    const steps = [];
    if (top) {
      const fromIssue = this.dedupeFixes(top.fix_steps || (top.fix ? [top.fix] : []));
      fromIssue.forEach((s) => steps.push(s));
      if (!fromIssue.length) {
        const hints = Labels.fixHints(top.id) || [];
        hints.forEach((h) => { if (h) steps.push(h); });
      }
    }

    recs.slice(0, 3).forEach((r) => {
      if (r.fix_steps?.length) {
        r.fix_steps.forEach((s) => { if (s && !steps.includes(s)) steps.push(s); });
        return;
      }
      if (r.fix && !steps.includes(r.fix)) steps.push(r.fix);
    });

    if (!steps.length && sortedIssues.length) {
      steps.push('Review the Logs tab for the first ERROR line after startup.');
      steps.push('Check the Mods tab for broken or changed mods since last good boot.');
    }

    return steps.slice(0, 8);
  },

  renderDrMiniReport(f, sortedIssues) {
    const h = f.health || {};
    const effective = h.current_status || h.status || 'unknown';
    const gradCls = effective === 'critical' ? 'critical' : effective === 'warning' ? 'warning' : 'ok';
    const verdictMod = gradCls === 'critical' ? 'critical' : gradCls === 'warning' ? 'warn' : 'ok';
    const findings = this.buildDrFindings(f);
    const diagnosis = this.buildDrDiagnosis(f, sortedIssues);
    const fixSteps = this.buildDrFixSteps(f, sortedIssues);

    const findingsHtml = findings.length
      ? `<ul class="dr-report-findings">${findings.map((item) => `<li>${item}</li>`).join('')}</ul>`
      : '<p class="text-caption">Upload a DR bundle zip for full findings.</p>';

    const fixHtml = fixSteps.length
      ? `<ol class="dr-report-fix-steps">${fixSteps.map((s) => `<li>${this.esc(s)}</li>`).join('')}</ol>`
      : '<p class="text-caption">No automated fix steps — inspect Logs and Attempts.</p>';

    const top = sortedIssues[0];
    const evidence = top ? this.renderIssueEvidence(top) : '';

    return `
      <section class="wt-panel dr-mini-report severity-${gradCls}">
        <header class="dr-mini-report-head">
          <div>
            <p class="dr-mini-report-kicker"><i data-lucide="file-search" width="14" height="14"></i> DR report</p>
            <h2 class="dr-mini-report-title">What happened &amp; how to fix it</h2>
          </div>
          <span class="dr-mini-report-status wt-verdict__word wt-verdict__word--${verdictMod}">${this.esc(Labels.healthStatus(effective))}</span>
        </header>

        <div class="dr-report-grid">
          <div class="dr-report-section">
            <h3><i data-lucide="search" width="16" height="16"></i> What we found</h3>
            ${findingsHtml}
          </div>

          <div class="dr-report-section dr-report-section-diagnosis">
            <h3><i data-lucide="crosshair" width="16" height="16"></i> What we think is wrong</h3>
            ${diagnosis || '<p class="text-caption">No diagnosis from facts alone — use Logs for the failing line.</p>'}
            ${evidence}
          </div>

          <div class="dr-report-section dr-report-section-fix">
            <h3><i data-lucide="wrench" width="16" height="16"></i> How to fix it</h3>
            ${fixHtml}
            <div class="dr-report-actions">
              <button type="button" class="wt-btn wt-btn--primary wt-btn--sm tab-link" data-tab="logs">Open logs</button>
              <button type="button" class="wt-btn wt-btn--ghost wt-btn--sm tab-link" data-tab="mods">Check mods</button>
              <button type="button" class="wt-btn wt-btn--ghost wt-btn--sm tab-link" data-tab="attempts">Restart attempts</button>
            </div>
          </div>
        </div>
      </section>`;
  },

  renderFix() {
    const f = this.state.facts;
    const issues = (f.issues || []).filter((i) => i.active !== false);
    const sorted = [...issues].sort((a, b) => {
      const sev = { critical: 0, warning: 1, info: 2 };
      return (sev[a.severity] ?? 9) - (sev[b.severity] ?? 9);
    });
    const modDiff = f.optional?.dr_mod_diff;
    const diffBlock = modDiff?.has_changes ? this.renderModDiffSummary(modDiff) : '';

    const others = sorted.slice(1, 6).map((i) => `
      <details class="action-queue-row severity-${i.severity}">
        <summary><strong>${this.esc(Labels.issueSummary(i))}</strong></summary>
        <p>${this.esc(i.message || '')}</p>
        ${this.renderIssueEvidence(i)}
      </details>`).join('');

    return `${this.renderAnchorBanner()}
      ${this.renderDrMiniReport(f, sorted)}
      ${diffBlock}
      ${others ? `<section class="wt-panel"><h3>Other findings</h3>${others}</section>` : ''}
      ${this.renderCorrelationBanner()}`;
  },

  renderIssueEvidence(issue) {
    if (!issue.evidence?.length) return '';
    return `<div class="dr-evidence-list">${issue.evidence.map((e) => {
      const loc = e.file ? `${e.file}${e.line ? ':' + e.line : ''}` : '';
      return `<button type="button" class="dr-evidence-link" data-log-goto="${this.escAttr(e.file || '')}" data-log-line="${e.line || ''}">
        <code>${this.esc(loc)}</code> ${e.quote ? this.esc(String(e.quote).slice(0, 120)) : ''}
      </button>`;
    }).join('')}</div>`;
  },

  renderModDiffSummary(diff) {
    const rows = [];
    for (const c of [...(diff.added || []), ...(diff.removed || []), ...(diff.updated || [])].slice(0, 8)) {
      const ch = c.change || c.changeType || '?';
      const label = ch === 'updated' ? `${c.id} ${c.from} → ${c.to}` : `${ch} ${c.id}${c.to ? ' ' + c.to : ''}`;
      rows.push(`<li><code>${this.esc(label)}</code></li>`);
    }
    if (!rows.length) return '';
    return `<section class="wt-panel dr-mod-diff-panel">
      <h3><i data-lucide="git-compare" width="16" height="16"></i> Mod changes since last good boot</h3>
      <ul class="dr-mod-diff-list">${rows.join('')}</ul>
      <button type="button" class="wt-btn wt-btn--ghost wt-btn--sm tab-link" data-tab="mods">Full mod diff →</button>
    </section>`;
  },

  attemptStatusMeta(session) {
    const status = session?.correlation_status || '';
    const failed = !!session?.failure_signals;
    const hasCrash = (session?.crash_reports || []).length > 0;
    const hasLog = (session?.regular_logs || []).length > 0;
    if (status === 'logs_only' || (failed && !hasCrash)) {
      return {
        label: 'Startup failed · no crash report',
        badgeClass: 'warn',
        cardClass: 'dr-attempt-failed',
        short: 'Failed — no crash report saved',
      };
    }
    if (status === 'crash_only') {
      return {
        label: 'Crash report only',
        badgeClass: 'warn',
        cardClass: 'dr-attempt-unclear',
        short: 'Crash report without matching server log',
      };
    }
    if (status === 'mismatch') {
      return {
        label: 'Logs unclear',
        badgeClass: 'warn',
        cardClass: 'dr-attempt-unclear',
        short: 'Log timestamps may not belong together',
      };
    }
    if (failed && hasCrash) {
      return {
        label: 'Startup failed · crash report saved',
        badgeClass: 'bad',
        cardClass: 'dr-attempt-failed',
        short: 'Failed — crash report available',
      };
    }
    if (failed) {
      return {
        label: 'Startup failed',
        badgeClass: 'bad',
        cardClass: 'dr-attempt-failed',
        short: 'Server did not finish starting',
      };
    }
    return {
      label: hasLog ? 'Restart logged · no error lines found' : 'Bundled files only',
      badgeClass: 'neutral',
      cardClass: 'dr-attempt-neutral',
      short: 'No obvious failure in this log snippet',
    };
  },

  renderAttempts() {
    const sessions = [...(this.state.correlation || [])].sort((a, b) => {
      const failDiff = Number(!!b.failure_signals) - Number(!!a.failure_signals);
      if (failDiff !== 0) return failDiff;
      return (a.attempt || 0) - (b.attempt || 0);
    });
    if (!sessions.length) {
      return `<section class="wt-panel"><p class="empty-state">No restart attempts in this bundle — upload a DR bundle from a crash loop.</p></section>`;
    }
    const failedCount = sessions.filter((s) => s.failure_signals).length;
    return `${this.renderAnchorBanner()}
      <section class="wt-panel dr-attempts-intro">
        <h2><i data-lucide="refresh-cw" width="16" height="16"></i> Failed restarts since last good boot</h2>
        <p class="text-caption">Each card is one time the server tried to start <strong>after</strong> your last successful <code>Done!</code> line. None of these reached a full startup. Click a card to open that attempt&rsquo;s log.</p>
        <ul class="dr-attempt-legend">
          <li><span class="dr-corr-badge bad">Startup failed</span> Error lines in the server log</li>
          <li><span class="dr-corr-badge warn">No crash report</span> Failed before Minecraft wrote crash-reports/</li>
          <li><span class="dr-corr-badge neutral">Unclear</span> Missing or mismatched log files</li>
        </ul>
        <p class="text-caption dr-attempts-count"><strong>${sessions.length}</strong> restart attempt${sessions.length === 1 ? '' : 's'}${failedCount ? ` · <strong>${failedCount}</strong> with startup failure lines` : ''}</p>
      </section>
      <div class="dr-attempts-timeline">
        ${sessions.map((s) => {
          const meta = this.attemptStatusMeta(s);
          const logPath = (s.regular_logs || [])[0] || (s.crash_reports || [])[0] || '';
          const logName = logPath ? logPath.split('/').pop() : 'No log file';
          const crashName = (s.crash_reports || [])[0]?.split('/').pop();
          return `<button type="button" class="dr-attempt-card ${meta.cardClass}" data-attempt-log="${this.escAttr(logPath)}">
            <div class="dr-attempt-head">
              <span class="dr-attempt-num">Attempt #${s.attempt || '?'}</span>
              <span class="dr-attempt-time">${this.esc(this.fmtTime(s.started_at))}</span>
              <span class="dr-corr-badge ${meta.badgeClass}">${this.esc(meta.label)}</span>
            </div>
            <p class="dr-attempt-summary">${this.esc(meta.short)}</p>
            <div class="dr-attempt-files">
              <span><i data-lucide="file-text" width="12" height="12"></i> ${this.esc(logName)}</span>
              ${crashName ? `<span><i data-lucide="file-warning" width="12" height="12"></i> ${this.esc(crashName)}</span>` : '<span class="text-caption">No crash report for this attempt</span>'}
            </div>
            ${s.user_message ? `<p class="dr-attempt-detail text-caption">${this.esc(s.user_message)}</p>` : ''}
          </button>`;
        }).join('')}
      </div>`;
  },

  correlationBadgeForFile(filePath) {
    const sessions = this.state.correlation || [];
    for (const s of sessions) {
      const all = [...(s.regular_logs || []), ...(s.debug_logs || []), ...(s.crash_reports || [])];
      if (!all.includes(filePath)) continue;
      const meta = this.attemptStatusMeta(s);
      return `<span class="dr-corr-badge ${meta.badgeClass}">${this.esc(meta.label)}</span>`;
    }
    return '';
  },

  renderLogLoadingPanel(message) {
    return `<section class="wt-panel dr-log-loading">
      <div class="dr-log-loading-inner">
        <div class="dr-spinner" aria-hidden="true"></div>
        <p>${this.esc(message || 'Loading log file…')}</p>
        <p class="text-caption">Decompressing archived logs can take a moment on large bundles.</p>
      </div>
    </section>`;
  },

  currentLogFile() {
    const logs = this.state.bundleLogs;
    if (!logs) return null;
    const cat = this.state.logView.category;
    const files = logs[cat] || [];
    if (!files.length) return null;
    const idx = Math.min(this.state.logView.fileIndex, files.length - 1);
    return files[idx] || null;
  },

  logFileNeedsDecompress() {
    const file = this.currentLogFile();
    return !!(file?.compressed && file.raw && !file._decompressed);
  },

  async ensureCurrentLogReady() {
    if (this._logLoadPromise) return this._logLoadPromise;
    const file = this.currentLogFile();
    if (!file || file._decompressed || !file.compressed || !file.raw) return;

    this._logLoadPromise = (async () => {
      this.state.logLoading = true;
      this.state.logLoadingMessage = `Opening ${file.name.split('/').pop()}…`;
      try {
        let gunzipSync = this.state.gunzipSync;
        const ingest = window.WatchtowerDrIngest;
        if (!gunzipSync && ingest?.loadFflate) {
          gunzipSync = (await ingest.loadFflate()).gunzipSync;
          this.state.gunzipSync = gunzipSync;
        }
        if (ingest?.decompressLogEntry) {
          ingest.decompressLogEntry(file, gunzipSync);
        }
      } catch (err) {
        console.error(err);
        file.content = '(Could not open this log file.)';
        file._decompressed = true;
      } finally {
        this.state.logLoading = false;
        this.state.logLoadingMessage = '';
        this._logLoadPromise = null;
      }
    })();

    await this._logLoadPromise;
  },

  renderLogs() {
    if (this.state.logLoading || this.logFileNeedsDecompress()) {
      const file = this.currentLogFile();
      const msg = this.state.logLoadingMessage
        || (file ? `Opening ${file.name.split('/').pop()}…` : 'Loading log file…');
      return this.renderLogLoadingPanel(msg);
    }
    const logs = this.state.bundleLogs;
    if (!logs) {
      return `<section class="wt-panel"><p class="text-caption">No bundled log files — upload a DR bundle zip from the CLI for full log viewers.</p></section>`;
    }
    const cat = this.state.logView.category;
    const files = logs[cat] || [];
    if (!files.length) {
      return `<section class="wt-panel"><p class="text-caption">No ${cat} log files in this bundle.</p></section>`;
    }
    const idx = Math.min(this.state.logView.fileIndex, files.length - 1);
    const file = files[idx];
    let content = file?.content || '';
    if (!content && file?.compressed && file?.raw) {
      content = '(gzip — decompress failed or empty)';
    }
    const search = (this.state.logView.search || '').toLowerCase();
    const allLines = content.split('\n');
    const truncated = allLines.length > LOG_RENDER_MAX_LINES;
    const lines = truncated ? allLines.slice(-LOG_RENDER_MAX_LINES) : allLines;
    const lineOffset = truncated ? allLines.length - LOG_RENDER_MAX_LINES : 0;
    let lastErr = -1;
    lines.forEach((line, i) => {
      if (/\b(ERROR|FATAL|Exception|Mod loading has failed)\b/i.test(line)) lastErr = i;
    });
    const hl = this.state.logView.highlightLine;
    const lineHtml = lines.map((line, i) => {
      if (search && !line.toLowerCase().includes(search)) return '';
      const lineNo = i + 1 + lineOffset;
      const cls = lineNo === hl ? ' log-line-highlight'
        : i === lastErr ? ' log-line-error'
        : (/\b(ERROR|FATAL)\b/i.test(line) ? ' log-line-warn' : '');
      return `<div class="log-line${cls}" id="log-line-${lineNo}" data-line="${lineNo}"><span class="log-ln">${lineNo}</span>${this.esc(line)}</div>`;
    }).join('');

    const fileOpts = files.map((f, i) =>
      `<option value="${i}" ${i === idx ? 'selected' : ''}>${this.esc(f.name.split('/').pop())}</option>`).join('');

    return `
      <section class="wt-panel dr-logs-panel">
        ${truncated ? `<p class="text-caption dr-log-truncated">Showing last ${LOG_RENDER_MAX_LINES.toLocaleString()} lines of ${allLines.length.toLocaleString()} — use Search to narrow.</p>` : ''}
        <div class="dr-logs-toolbar">
          <div class="dr-logs-tabs">
            ${['regular', 'debug', 'crashes'].map((c) => `
              <button type="button" class="wt-btn wt-btn--sm ${cat === c ? 'wt-btn--primary' : 'wt-btn--ghost'}" data-log-cat="${c}">
                ${c === 'crashes' ? 'Crash' : c.charAt(0).toUpperCase() + c.slice(1)}
                <span class="text-caption">(${(logs[c] || []).length})</span>
              </button>`).join('')}
          </div>
          ${files.length > 1 ? `<select class="dr-ingest-select" data-log-file-select>${fileOpts}</select>` : ''}
          <input type="search" class="dr-log-search" placeholder="Search log…" data-log-search value="${this.escAttr(this.state.logView.search || '')}">
          ${file ? `<span class="dr-corr-wrap">${this.correlationBadgeForFile(file.name)}</span>` : ''}
          ${lastErr >= 0 ? `<button type="button" class="wt-btn wt-btn--ghost wt-btn--sm" data-log-jump-error>Jump to last ERROR</button>` : ''}
        </div>
        <pre class="dr-log-viewer" id="dr-log-viewer">${lineHtml || '<span class="text-caption">No matching lines</span>'}</pre>
      </section>`;
  },

  actionQueueKindIcon(kind) {
    const m = { crash: 'file-warning', backup: 'database-backup', mod: 'package', issue: 'alert-circle', info: 'info' };
    return m[kind] || 'alert-circle';
  },

  issueWhenText(issue, facts) {
    if (issue?.event_time) return this.fmtTime(issue.event_time);
    const ev = (facts?.events ?? []).find((e) => e.type === 'reboot');
    if (ev?.time) return this.fmtTime(ev.time);
    for (const e of issue?.evidence || []) {
      if (e.time) return this.fmtTime(e.time);
    }
    return null;
  },

  rebootDetectionNote(issue, facts) {
    const source = issue.event_source || (facts?.events ?? []).find((e) => e.type === 'reboot')?.source;
    const detail = (issue?.evidence || []).find((e) => e.quote)?.quote
      || (facts?.events ?? []).find((e) => e.type === 'reboot')?.detail;
    if (source === 'proc_uptime' || (detail && detail.includes('/proc/uptime'))) {
      return 'We know the machine rebooted; logs don\'t show whether it was manual, watchdog, or power loss.';
    }
    return issue.message || Labels.issueSummary(issue);
  },

  actionQueueWhenText(item, facts) {
    if (item.when) return this.fmtTime(item.when);
    if (item.issue) return this.issueWhenText(item.issue, facts);
    return null;
  },

  actionQueueDetailText(item, facts) {
    if (item.issue?.id === 'MANUAL_REBOOT') return this.rebootDetectionNote(item.issue, facts);
    if (item.detail && item.detail !== item.summary) return item.detail;
    if (item.issue?.message && item.issue.message !== item.summary) return item.issue.message;
    return null;
  },

  renderActionQueueEvidence(item) {
    if (!item.evidence?.length) return '';
    const rows = item.evidence.map((e) => `
      <div class="action-queue-evidence-item">
        ${e.file ? `<span class="text-caption mono-cell">${this.esc(e.file)}</span>` : ''}
        ${e.quote ? `<code class="issue-evidence action-queue-evidence">${this.esc(String(e.quote).slice(0, 240))}</code>` : ''}
        ${e.time ? `<span class="text-caption">${this.esc(this.fmtTimeShort(e.time))}</span>` : ''}
      </div>`).join('');
    const more = item.meta?.moreCount > 0
      ? `<p class="text-caption">+${item.meta.moreCount} more on the Crashes tab</p>`
      : '';
    return `<div class="action-queue-evidence-list">${rows}${more}</div>`;
  },

  renderActionQueueRow(item, facts) {
    const when = this.actionQueueWhenText(item, facts);
    const detail = this.actionQueueDetailText(item, facts);
    const fixes = this.dedupeFixes(item.fixes);
    const icon = this.actionQueueKindIcon(item.kind);
    const cta = item.primaryAction
      ? `<a href="#" class="wt-btn wt-btn--ghost wt-btn--sm tab-link" data-tab="${this.esc(item.primaryAction.tab)}">${this.esc(item.primaryAction.label)} →</a>`
      : '';

    return `
      <details class="action-queue-row severity-${item.severity}" data-tier="${this.esc(item.tier)}">
        <summary class="action-queue-summary">
          <span class="action-queue-icon"><i data-lucide="${icon}" width="16" height="16"></i></span>
          <span class="action-queue-head">
            <span class="action-queue-title">${this.esc(item.title)}</span>
            <span class="action-queue-oneline">${this.esc(item.summary)}</span>
          </span>
          <span class="severity-pill ${item.severity}">${this.esc(item.severity)}</span>
          ${cta}
        </summary>
        <div class="action-queue-body">
          ${when ? `<p class="issue-when"><strong>When:</strong> ${this.esc(when)}</p>` : ''}
          ${detail ? `<div class="issue-section"><span class="issue-section-label">What we know</span><p>${this.esc(detail)}</p></div>` : ''}
          ${item.meta?.shouldWorry ? `<div class="issue-section"><span class="issue-section-label">Should you worry?</span><p>${this.esc(item.meta.shouldWorry)}</p></div>` : ''}
          ${item.evidence?.length ? `<div class="issue-section"><span class="issue-section-label">Evidence</span>${this.renderActionQueueEvidence(item)}</div>` : ''}
          ${fixes.length ? `<div class="issue-section"><span class="issue-section-label">What to do</span><ul class="fix-list">${fixes.map((h) => `<li>${this.esc(h)}</li>`).join('')}</ul></div>` : ''}
          ${cta ? `<p class="text-caption action-queue-cta-repeat">${cta}</p>` : ''}
        </div>
      </details>`;
  },

  renderActionQueueGroup(title, items, facts) {
    if (!items.length) return '';
    return `
      <section class="wt-panel action-queue-group">
        <h3 class="action-queue-group-title">${this.esc(title)}</h3>
        <div class="action-queue">${items.map((item) => this.renderActionQueueRow(item, facts)).join('')}</div>
      </section>`;
  },

  renderIssues() {
    const f = this.state.facts;
    const acks = this.state.acks;
    const ignores = this.emptyIgnores();
    const health = Health.displayHealth(f, acks, ignores);
    const queue = Health.buildActionQueue(f, acks, ignores);
    const nowItems = queue.filter((i) => i.tier === 'now');
    const soonItems = queue.filter((i) => i.tier === 'soon');
    const histItems = queue.filter((i) => i.tier === 'historical');
    const effectiveWord = Labels.healthStatus(health.effective);
    const attentionCount = nowItems.length;

    const header = `
      <section class="wt-panel issue-inbox-header">
        <div class="issue-inbox-head-row">
          <h2><i data-lucide="inbox" width="16" height="16"></i> Issues inbox</h2>
          <span class="health-status-pill severity-${health.effective}">${this.esc(effectiveWord)}</span>
        </div>
        <p class="issue-inbox-status">
          ${attentionCount
    ? `<strong>${attentionCount}</strong> thing${attentionCount === 1 ? '' : 's'} need${attentionCount === 1 ? 's' : ''} attention now`
    : 'Nothing blocking you right now'}
        </p>
      </section>`;

    if (!queue.length) {
      let html = `${header}<section class="wt-panel"><p class="empty-state">No issues in this report.</p></section>`;
      if (this.state.warnings.length) {
        html += `<section class="wt-panel"><h3 class="action-queue-group-title">Collection notes</h3><ul class="fix-list">${this.state.warnings.map((w) => `<li>${this.esc(w)}</li>`).join('')}</ul></section>`;
      }
      return html;
    }

    const nowBlock = attentionCount
      ? this.renderActionQueueGroup('Needs attention now', nowItems, f)
      : `<section class="wt-panel issue-inbox-ok">
          <p class="issue-inbox-ok-line"><i data-lucide="circle-check" width="18" height="18"></i> Nothing blocking you — expand sections below for optional or historical items.</p>
        </section>`;

    const soonBlock = soonItems.length
      ? this.renderActionQueueGroup('Worth fixing when you can', soonItems, f)
      : '';

    const histBlock = histItems.length
      ? `<section class="wt-panel action-queue-historical-wrap">
          <details class="action-queue-historical">
            <summary><span class="historical-summary-label">Historical</span><span class="count-badge">${histItems.length}</span></summary>
            <div class="action-queue">${histItems.map((item) => this.renderActionQueueRow(item, f)).join('')}</div>
          </details>
        </section>`
      : '';

    let html = `${header}${nowBlock}${soonBlock}${histBlock}`;
    if (this.state.warnings.length) {
      html += `<section class="wt-panel"><h3 class="action-queue-group-title">Collection notes</h3><ul class="fix-list">${this.state.warnings.map((w) => `<li>${this.esc(w)}</li>`).join('')}</ul></section>`;
    }
    return html;
  },

  renderPreCrashSimple(c) {
    const pre = c.pre_crash;
    if (!pre) return '';
    const mins = pre.window_minutes ?? 10;
    const summary = Labels.preCrashSummary(pre);
    const cmdList = (pre.commands ?? []).length
      ? `<ul class="pre-crash-commands">${pre.commands.slice(0, 8).map((cmd) => {
        const who = cmd.player ? `${this.esc(cmd.player)}: ` : (cmd.source === 'panel' ? 'Panel: ' : '');
        return `<li><span class="text-caption">${this.fmtTimeShort(cmd.time)}</span> ${who}<code class="inline-code">${this.esc(cmd.command)}</code></li>`;
      }).join('')}</ul>`
      : '<p class="text-caption">No commands logged in this window.</p>';
    const chunkLine = pre.chunk_gen?.last_line
      ? `<p class="text-caption mono-cell">${this.esc(pre.chunk_gen.last_line)}</p>`
      : '';
    const emptyNote = pre.unavailable_reason
      ? `<p class="text-caption">${this.esc(pre.unavailable_reason)}</p>`
      : '';

    return `
      <details class="pre-crash-block">
        <summary>Before this crash (${mins} min)${summary ? ` — ${this.esc(summary)}` : ''}</summary>
        ${emptyNote}
        ${chunkLine}
        <div class="pre-crash-commands-wrap"><strong>Commands</strong>${cmdList}</div>
      </details>`;
  },

  renderCrashCard(c, acks) {
    const acked = Acks.isAcked(acks, c.file);
    const label = c.display_label || c.exception || c.summary || 'Crash';
    const fname = (c.file || '').split('/').pop();
    const category = c.category || 'unknown';
    const suspect = c.suspect_mod_id || (c.mod_file ? c.mod_file.replace(/\.jar.*/, '').split('-')[0] : null);
    const hints = c.fix_hints ?? [];
    const manualReview = c.manual_review === true;
    const plain = c.plain_english || label;
    const confLabel = Labels.crashConfidenceLabel(c.confidence, manualReview);
    const confCls = Labels.crashConfidenceClass(c.confidence, manualReview);
    const hintList = hints.length
      ? `<ul class="fix-list">${hints.map((h) => `<li>${this.esc(h)} <button type="button" class="wt-btn wt-btn--ghost wt-btn--sm copy-hint" data-copy="${this.escAttr(h)}">Copy</button></li>`).join('')}</ul>`
      : (manualReview
        ? `<ul class="fix-list">${Labels.fixHints('CRASH_REPORT').map((h) => `<li>${this.esc(h)}</li>`).join('')}</ul>`
        : '<p class="text-caption">No specific fix steps — see technical detail below.</p>');
    const modFix = c.mod_fix;
    const modFixBlock = modFix
      ? `<div class="crash-mod-fix-block">
          <strong>Fix mod conflict</strong>
          ${modFix.action ? `<p class="mod-action-line"><span class="mod-action-badge">${this.esc(Labels.modActionLabel(modFix.action))}</span> ${this.esc(modFix.action_detail || modFix.fix || '')}</p>` : ''}
          ${modFix.install_hint ? `<p class="text-caption">${this.esc(modFix.install_hint)}</p>` : ''}
        </div>`
      : '';

    return `
      <div class="crash-card wt-panel${acked ? ' acked' : ''}${c.historical ? ' historical' : ''}">
        <div class="crash-card-head">
          <label><input type="checkbox" class="crash-ack" data-crash-file="${this.escAttr(c.file)}" data-crash-category="${this.escAttr(category)}" data-crash-plain="${this.escAttr(c.plain_english || '')}" ${acked ? 'checked' : ''}> Reviewed</label>
          <span class="crash-filename mono-cell" title="${this.escAttr(c.file)}">${this.esc(fname)}</span>
          <span class="crash-category-pill ${Labels.crashCategoryClass(category)}">${this.esc(Labels.crashCategoryLabel(category))}</span>
          <span class="severity-pill ${confCls}">${this.esc(confLabel)}</span>
          ${c.historical ? '<span class="severity-pill info">Historical</span>' : ''}
        </div>
        <div class="crash-card-body">
          <p class="crash-cause"><strong>What happened:</strong> ${this.esc(plain)}</p>
          <details class="crash-tech-detail">
            <summary>Technical detail</summary>
            <p class="mono-cell">${this.esc(label)}</p>
            ${c.exception && c.exception !== label ? `<p class="text-caption mono-cell">${this.esc(c.exception)}</p>` : ''}
            ${c.stack_frames?.length ? `<pre class="brief-pre">${c.stack_frames.map((f) => `${f.method} (${f.location})`).join('\n')}</pre>` : ''}
          </details>
          ${suspect ? `<p><strong>Suspected mod:</strong> <a href="#" class="tab-link" data-tab="mods">${this.esc(Labels.modFriendlyName(suspect))}</a>${c.mod_file ? ` <span class="text-caption">(${this.esc(c.mod_file)})</span>` : ''}</p>` : ''}
          ${c.time ? `<p class="text-caption">${this.fmtTime(c.time)} · ${this.esc(this.fmtRelative(c.time))}</p>` : ''}
          ${modFixBlock}
          ${this.renderPreCrashSimple(c)}
          <div class="crash-fix-block">
            <strong>Fix steps</strong>
            ${hintList}
          </div>
        </div>
      </div>`;
  },

  renderCrashes() {
    const f = this.state.facts;
    const acks = this.state.acks;
    const summaries = f?.optional?.crash_summaries ?? [];
    const unacked = Acks.unacknowledgedCrashes(f, acks);
    const filter = this.state.crashFilter || 'all';
    const filterCls = (id) => (this.state.crashFilter === id ? 'wt-segment__btn active' : 'wt-segment__btn');

    if (!summaries.length) {
      return '<section class="wt-panel"><p class="empty-state">No crash reports in this export. Include <code>crash-reports/*.txt</code> from the failed boot for richer diagnosis.</p></section>';
    }

    let filtered = summaries;
    if (filter === 'unacked') filtered = summaries.filter((c) => !Acks.isAcked(acks, c.file));
    else if (filter === 'mod') filtered = summaries.filter((c) => c.category === 'mod');
    else if (filter === 'host') filtered = summaries.filter((c) => c.category === 'host_resource');

    return `
      <section class="wt-panel crash-summary-panel">
        <h2><i data-lucide="file-warning" width="16" height="16"></i> Crash reports</h2>
        <div class="issue-stats">
          <div class="issue-stat"><span class="issue-stat-val">${summaries.length}</span><span class="issue-stat-label">In export</span></div>
          <div class="issue-stat warn"><span class="issue-stat-val">${unacked.length}</span><span class="issue-stat-label">Needs review</span></div>
        </div>
        <div class="wt-segment crash-filters">
          <button type="button" class="${filterCls('all')}" data-crash-filter="all">All</button>
          <button type="button" class="${filterCls('unacked')}" data-crash-filter="unacked">Needs review</button>
          <button type="button" class="${filterCls('mod')}" data-crash-filter="mod">Mod-related</button>
          <button type="button" class="${filterCls('host')}" data-crash-filter="host">Host / resource</button>
        </div>
      </section>
      ${filtered.length
        ? filtered.map((c) => this.renderCrashCard(c, acks)).join('')
        : '<section class="wt-panel"><p class="empty-state">No crashes match this filter.</p></section>'}
      <p class="text-caption dr-ack-note">Review state is saved in your browser only (localStorage).</p>`;
  },

  renderModProblemCard(r) {
    const worry = Labels.modWorryBadge(r);
    const actionLine = r.action
      ? `<p class="mod-action-line"><span class="mod-action-badge">${this.esc(Labels.modActionLabel(r.action))}</span> <strong>${this.esc(r.action_detail || r.fix || '')}</strong></p>`
      : '';
    const fixSteps = r.fix_steps?.length
      ? r.fix_steps
      : Labels.modDrFixSteps(r.mod_id, r.category);
    const startupFix = fixSteps.length && (r.category === 'mod_corrupt' || r.category === 'mod_load_failed');
    const fixBlock = startupFix
      ? `<div class="mod-problem-section"><span class="mod-problem-label">What to do</span><ol class="fix-list">${fixSteps.map((s) => `<li>${this.esc(s)}</li>`).join('')}</ol></div>`
      : `<div class="mod-problem-section"><span class="mod-problem-label">What to do</span><p>${this.esc(r.fix || '')}</p></div>`;
    const samples = r.sample_lines || (r.sample_line ? [r.sample_line] : []);
    const sampleBlock = samples.length
      ? `<div class="mod-problem-section"><span class="mod-problem-label">Sample log</span><code class="mod-sample-line">${this.esc(String(samples[0]).slice(0, 160))}</code></div>`
      : '';
    return `
      <div class="issue-card mod-problem-card severity-${r.severity || 'warning'}">
        <div class="mod-problem-head">
          <div>
            <strong>${this.esc(Labels.modProblemTitle(r))}</strong>
            ${r.category ? `<span class="mod-category-pill">${this.esc(Labels.modCategoryLabel(r.category))}</span>` : ''}
          </div>
          <span class="mod-worry-badge ${worry.cls}">${this.esc(worry.text)}</span>
        </div>
        <div class="mod-problem-section"><span class="mod-problem-label">What happened</span><p>${this.esc(r.why || r.explanation || '')}</p></div>
        ${actionLine}
        ${r.should_worry ? `<div class="mod-problem-section"><span class="mod-problem-label">Should you worry?</span><p>${this.esc(r.should_worry)}</p></div>` : ''}
        ${fixBlock}
        ${!startupFix && r.install_hint ? `<div class="mod-problem-section"><span class="mod-problem-label">Install hint</span><p>${this.esc(r.install_hint)}</p></div>` : ''}
        ${sampleBlock}
      </div>`;
  },

  modErrorRowForManifest(modId, modErrs, recs) {
    const err = modErrs.find((e) => e.mod_id === modId);
    const rec = recs.find((r) => r.mod_id === modId);
    if (!err && !rec) return '<td class="mod-manifest-errors"><span class="text-caption">—</span></td>';
    const cats = err?.by_category || rec?.by_category || {};
    const chips = Object.entries(cats).map(([cat, count]) =>
      `<span class="mod-error-chip">${this.esc(Labels.modCategoryLabel(cat))} ×${count}</span>`
    ).join('');
    const total = err?.total ?? rec?.count ?? '';
    const sample = (err?.sample_lines || rec?.sample_lines || [])[0] || err?.sample_line || rec?.sample_line || '';
    const status = total
      ? `<span class="dr-mod-error-count">${total} error${total === 1 ? '' : 's'}</span>`
      : '<span class="dr-mod-error-count">Issue flagged</span>';
    return `<td class="mod-manifest-errors"><div class="mod-error-chips">${chips || status}</div>${sample ? `<div class="mono-cell mod-error-sample">${this.esc(String(sample).slice(0, 140))}</div>` : ''}</td>`;
  },

  modSeverityRank(severity) {
    if (severity === 'critical') return 0;
    if (severity === 'warning') return 1;
    return 2;
  },

  buildModManifestRows(mods, modErrs, recs) {
    const seen = new Set(mods.map((m) => m.id));
    const rows = [...mods];
    for (const err of modErrs) {
      if (!err.mod_id || err.mod_id === 'client_noise' || seen.has(err.mod_id)) continue;
      rows.push({ id: err.mod_id, version: '—', synthetic: true });
      seen.add(err.mod_id);
    }
    return rows;
  },

  sortModsForDisplay(mods, modErrs, recs) {
    const errTotals = new Map(modErrs.map((e) => [e.mod_id, e.total || 0]));
    const recIds = new Set(recs.map((r) => r.mod_id));
    return [...mods].sort((a, b) => {
      const score = (m) => {
        const total = errTotals.get(m.id) || 0;
        const flagged = total > 0 || recIds.has(m.id);
        return { flagged, total };
      };
      const sa = score(a);
      const sb = score(b);
      if (sa.flagged !== sb.flagged) return sb.flagged - sa.flagged;
      if (sa.total !== sb.total) return sb.total - sa.total;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });
  },

  filterModRows(mods, modErrs, recs, modDiff, filter, query) {
    const errorModIds = new Set(modErrs.map((e) => e.mod_id));
    const recModIds = new Set(recs.map((r) => r.mod_id));
    const changedIds = new Set([
      ...(modDiff?.added || []).map((m) => m.id),
      ...(modDiff?.removed || []).map((m) => m.id),
      ...(modDiff?.updated || []).map((m) => m.id),
    ]);
    let filtered = mods;
    if (filter === 'errors') {
      filtered = mods.filter((m) => errorModIds.has(m.id) || recModIds.has(m.id));
    } else if (filter === 'changed') {
      filtered = mods.filter((m) => changedIds.has(m.id));
    }
    const q = String(query || '').trim().toLowerCase();
    if (q) {
      filtered = filtered.filter((m) =>
        String(m.id || '').toLowerCase().includes(q)
        || Labels.modFriendlyName(m.id).toLowerCase().includes(q));
    }
    return this.sortModsForDisplay(filtered, modErrs, recs);
  },

  renderMods() {
    const f = this.state.facts;
    const opt = f.optional || {};
    const modDiff = opt.dr_mod_diff;
    const modErrs = (opt.mod_log_errors ?? []).filter((e) => e.mod_id !== 'client_noise');
    const recs = opt.mod_recommendations ?? [];
    const mods = this.buildModManifestRows(opt.mods ?? [], modErrs, recs);
    const errorModIds = new Set(modErrs.map((e) => e.mod_id));
    const recModIds = new Set(recs.map((r) => r.mod_id));
    const conflictRecs = recs.filter((r) =>
      ['recipe_compat', 'mod_load_failed', 'registry_missing'].includes(r.category) || r.action);
    const problemRecs = recs.filter((r) => !conflictRecs.includes(r));
    const allProblems = [...conflictRecs, ...problemRecs].sort(
      (a, b) => this.modSeverityRank(a.severity) - this.modSeverityRank(b.severity)
        || String(a.mod_id).localeCompare(String(b.mod_id))
    );
    const filtered = this.filterModRows(
      mods,
      modErrs,
      recs,
      modDiff,
      this.state.modsFilter,
      this.state.modsSearch
    );
    const showTech = this.state.showTechNames;
    const filterCls = (id) => (this.state.modsFilter === id ? 'wt-segment__btn active' : 'wt-segment__btn');
    const changedCount = modDiff?.has_changes
      ? (modDiff.added?.length || 0) + (modDiff.removed?.length || 0) + (modDiff.updated?.length || 0)
      : 0;
    const errorCount = new Set([...errorModIds, ...recModIds]).size;

    const diffSection = modDiff?.has_changes ? `
      <section class="wt-panel dr-mod-diff-panel">
        <h2><i data-lucide="git-compare" width="16" height="16"></i> Changes since last good boot</h2>
        <p class="text-caption">Mods added, removed, or updated between your last successful start and this crash loop.</p>
        ${this.renderModDiffTable(modDiff)}
      </section>` : '';

    const problemSection = allProblems.length
      ? `<section class="wt-panel mod-cards-section dr-mod-problems">
          <h2><i data-lucide="alert-triangle" width="16" height="16"></i> Mods to fix first</h2>
          <p class="text-caption">${allProblems.length} mod${allProblems.length === 1 ? '' : 's'} flagged in logs — start here before scrolling the full list.</p>
          ${allProblems.map((r) => this.renderModProblemCard(r)).join('')}
        </section>`
      : '';

    const tableSection = mods.length
      ? `<section class="wt-panel panel-compact dr-mod-manifest">
          <div class="dr-mod-manifest-head">
            <h2><i data-lucide="list" width="16" height="16"></i> Full mod list</h2>
            <p class="text-caption">Showing ${filtered.length} of ${mods.length} mods${errorModIds.size ? ` · ${errorModIds.size} with log errors` : ''}. Errors are sorted to the top.</p>
          </div>
          <label class="toggle-row"><input type="checkbox" id="dr-tech-names-toggle" ${showTech ? 'checked' : ''}> Show technical mod IDs</label>
          <div class="mod-toolbar">
            <input type="search" id="dr-mod-search" value="${this.esc(this.state.modsSearch)}" placeholder="Search mods…">
            <span class="text-caption">${filtered.length} matching</span>
          </div>
          <div class="wt-segment dr-mod-filters">
            <button type="button" class="${filterCls('all')}" data-dr-mod-filter="all">All (${mods.length})</button>
            <button type="button" class="${filterCls('errors')}" data-dr-mod-filter="errors">Has errors (${errorCount})</button>
            ${changedCount ? `<button type="button" class="${filterCls('changed')}" data-dr-mod-filter="changed">Changed (${changedCount})</button>` : ''}
          </div>
          <div class="mod-list-wrap dr-mod-list-wrap">
            <table class="mod-table mod-table-zebra dr-mod-table">
              <thead><tr><th>Mod</th><th>Version</th><th>Log errors</th></tr></thead>
              <tbody>${filtered.map((m) => {
                const hasErr = errorModIds.has(m.id) || recModIds.has(m.id);
                const name = showTech ? m.id : Labels.modFriendlyName(m.id);
                return `<tr class="${hasErr ? 'row-error dr-mod-row-error' : ''}">
                  <td>${this.esc(name)}${m.synthetic ? ' <span class="text-caption">(from logs)</span>' : ''}${hasErr ? ' <span class="dr-mod-flag">!</span>' : ''}</td>
                  <td class="mono-cell">${this.esc(m.version || '—')}</td>
                  ${this.modErrorRowForManifest(m.id, modErrs, recs)}
                </tr>`;
              }).join('')}</tbody>
            </table>
          </div>
          ${!filtered.length ? '<p class="empty-state">No mods match this filter.</p>' : ''}
        </section>`
      : '';

    if (!diffSection && !problemSection && !tableSection) {
      return `<section class="wt-panel"><p class="empty-state">No mod list in this bundle. Re-run the DR CLI so <code>mods/*.jar</code> are included, or check the <strong>Fix</strong> tab for log-based mod errors.</p></section>`;
    }

    return `
      <div class="mods-summary wt-panel dr-mods-summary">
        <div class="mods-summary-stats">
          <span><strong>${mods.length}</strong> mods in list</span>
          <span class="${errorModIds.size ? 'dr-stat-warn' : ''}"><strong>${errorModIds.size}</strong> with log errors</span>
          ${changedCount ? `<span><strong>${changedCount}</strong> changed since last boot</span>` : ''}
          <span class="text-caption">Report ${this.fmtTime(f.meta?.generated)}</span>
        </div>
      </div>
      ${problemSection}
      ${diffSection}
      ${tableSection}`;
  },

  renderModDiffTable(diff) {
    const all = [...(diff.added || []), ...(diff.removed || []), ...(diff.updated || [])];
    if (!all.length) return '<p class="text-caption">No mod set changes detected.</p>';
    return `<table class="mod-table mod-table-zebra"><thead><tr><th>Change</th><th>Mod</th><th>Detail</th><th>Source</th></tr></thead><tbody>
      ${all.map((c) => {
        const ch = c.change || c.changeType || '?';
        const detail = ch === 'updated' ? `${c.from || '?'} → ${c.to || '?'}` : (c.to || c.from || '—');
        const src = c.first_seen ? `${c.first_seen.file || ''}:${c.first_seen.line || ''}` : '—';
        return `<tr><td>${this.esc(ch)}</td><td><strong>${this.esc(c.id)}</strong></td><td class="mono-cell">${this.esc(detail)}</td><td class="mono-cell">${this.esc(src)}</td></tr>`;
      }).join('')}
    </tbody></table>`;
  },

  renderReport() {
    const { facts, brief } = this.state;
    return `
      <section class="wt-panel">
        <h2><i data-lucide="file-text" width="16" height="16"></i> Health brief</h2>
        <pre class="brief-pre">${this.esc(brief || '(no brief included)')}</pre>
        <button type="button" class="wt-btn wt-btn--primary" id="btn-save-facts">
          <i data-lucide="download" width="14" height="14"></i> Download facts.json
        </button>
      </section>`;
  },

  setTabBadge(tab, count, variant = '') {
    const badge = document.querySelector(`[data-tab-badge="${tab}"]`);
    if (!badge) return;
    if (!count || count <= 0) {
      badge.textContent = '';
      badge.className = 'wt-rail__badge hidden';
      return;
    }
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.className = `wt-rail__badge${variant ? ` wt-rail__badge--${variant}` : ''}`;
  },

  updateTabBadges() {
    const f = this.state.facts;
    if (!f) {
      this.setTabBadge('attempts', 0);
      return;
    }
    const sessions = this.state.correlation || [];
    const failureAttempts = sessions.filter((s) => s.failure_signals).length;
    this.setTabBadge('attempts', failureAttempts || sessions.length, failureAttempts > 0 ? 'warn' : '');
  },

  goToLogFile(path, line) {
    const logs = this.state.bundleLogs;
    if (!logs || !path) {
      this.setTab('logs');
      return;
    }
    for (const cat of ['regular', 'debug', 'crashes']) {
      const idx = (logs[cat] || []).findIndex((f) => f.name === path || f.name.endsWith('/' + path.split('/').pop()));
      if (idx >= 0) {
        this.state.logView = { category: cat, fileIndex: idx, search: '', highlightLine: line ? parseInt(line, 10) : null };
        this.setTab('logs');
        return;
      }
    }
    this.setTab('logs');
  },

  copyText(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
      if (window.DrApp?.showToast) window.DrApp.showToast('Copied to clipboard');
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = orig; }, 1200);
      }
    }).catch(() => {
      if (window.DrApp?.showToast) window.DrApp.showToast('Copy failed');
    });
  },

  bindPanelEvents() {
    document.querySelectorAll('.tab-link').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = link.dataset.tab;
        if (tab) this.setTab(tab);
      });
    });

    document.querySelectorAll('.crash-ack').forEach((cb) => {
      cb.addEventListener('change', async () => {
        const host = this.state.facts?.meta?.hostname || 'dr';
        this.state.acks = await Acks.toggle(host, cb.dataset.crashFile, {
          category: cb.dataset.crashCategory,
          plainEnglish: cb.dataset.crashPlain,
        });
        this.render();
      });
    });

    document.querySelectorAll('[data-crash-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.state.crashFilter = btn.dataset.crashFilter;
        this.render();
      });
    });

    document.querySelectorAll('.copy-hint').forEach((btn) => {
      btn.addEventListener('click', () => this.copyText(btn.dataset.copy, btn));
    });

    document.getElementById('btn-save-facts')?.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(this.state.facts, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `watchtower-dr-facts-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      if (window.DrApp?.showToast) window.DrApp.showToast('Downloaded facts.json');
    });

    document.querySelectorAll('[data-log-cat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.state.logView = { category: btn.dataset.logCat, fileIndex: 0, search: this.state.logView.search || '', highlightLine: null };
        this.render();
        this.startLogLoadIfNeeded();
      });
    });

    document.querySelector('[data-log-file-select]')?.addEventListener('change', (e) => {
      this.state.logView.fileIndex = parseInt(e.target.value, 10) || 0;
      this.render();
      this.startLogLoadIfNeeded();
    });

    document.querySelector('[data-log-jump-error]')?.addEventListener('click', () => {
      const viewer = document.getElementById('dr-log-viewer');
      const errLine = viewer?.querySelector('.log-line-error, .log-line-warn');
      errLine?.scrollIntoView({ block: 'center' });
    });

    document.querySelector('[data-log-search]')?.addEventListener('input', (e) => {
      this.state.logView.search = e.target.value;
      this.render();
    });

    document.querySelectorAll('[data-log-goto]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.goToLogFile(btn.dataset.logGoto, btn.dataset.logLine);
      });
    });

    document.querySelectorAll('[data-attempt-log]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.goToLogFile(btn.dataset.attemptLog, null);
      });
    });

    document.getElementById('dr-mod-search')?.addEventListener('input', (e) => {
      this.state.modsSearch = e.target.value;
      this.render();
    });

    document.getElementById('dr-tech-names-toggle')?.addEventListener('change', (e) => {
      this.state.showTechNames = e.target.checked;
      this.render();
    });

    document.querySelectorAll('[data-dr-mod-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.state.modsFilter = btn.dataset.drModFilter || 'all';
        this.render();
      });
    });

    if (this.state.logView.highlightLine) {
      setTimeout(() => {
        const el = document.querySelector(`[data-line="${this.state.logView.highlightLine}"]`);
        el?.scrollIntoView({ block: 'center' });
      }, 50);
    }
  },

  render() {
    const main = document.getElementById('main-content');
    if (!main || !this.state.facts) return;

    switch (this.state.activeTab) {
      case 'fix':
        main.innerHTML = this.renderFix();
        break;
      case 'attempts':
        main.innerHTML = this.renderAttempts();
        break;
      case 'mods':
        main.innerHTML = this.renderMods();
        break;
      case 'logs':
        main.innerHTML = this.renderLogs();
        break;
      case 'report':
        main.innerHTML = this.renderReport();
        break;
      default:
        main.innerHTML = this.renderFix();
    }

    this.renderNav();
    this.renderReportBar();
    this.updateTabBadges();
    this.bindPanelEvents();
    this.refreshIcons();
  },
};

window.DrDashboard = DrDashboard;
