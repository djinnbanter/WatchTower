/**
 * Watchtower UI v3 — crashes tab renderers
 */
const TowerRenderCrashes = (function () {
  const esc = TowerRenderShared.esc;
  const fmtTime = TowerRenderShared.fmtTime;
  const fmtTimeShort = TowerRenderShared.fmtTimeShort;
  const fmtRelative = TowerRenderShared.fmtRelative;
  const kpiCard = TowerRenderShared.kpiCard;

  function escAttr(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function getPreCrash(c) {
    return state.crashContextCache?.[c.file] || c.pre_crash || null;
  }

  function categoryAccent(category) {
    if (category === 'mod') return 'wt-crash-card--mod';
    if (category === 'host_resource') return 'wt-crash-card--host';
    if (category === 'loader') return 'wt-crash-card--loader';
    return 'wt-crash-card--unknown';
  }

  function severityBarClass(c, confCls, acked) {
    if (acked) return 'wt-crash-card__accent--resolved';
    if (c.category === 'mod' && !acked) return 'wt-crash-card__accent--critical';
    if (confCls === 'warn') return 'wt-crash-card__accent--warn';
    if (confCls === 'ok') return 'wt-crash-card__accent--ok';
    return 'wt-crash-card__accent--info';
  }

  function confidencePill(confCls) {
    if (confCls === 'warn') return 'wt-status-pill--warn';
    if (confCls === 'ok') return 'wt-status-pill--healthy';
    return 'wt-status-pill--warn';
  }

  function buildKeyEvents(pre, c) {
    const events = [];
    const crashTime = c.time ? new Date(c.time).getTime() : null;

    (pre?.commands ?? []).forEach((cmd) => {
      const t = cmd.time ? new Date(cmd.time).getTime() : null;
      const who = cmd.player ? `${cmd.player}: ` : (cmd.source === 'panel' ? 'Panel: ' : '');
      const cmdText = cmd.command || '';
      const highlight = /chunky|pregen|save-all|stop|reload/i.test(cmdText);
      events.push({
        time: t,
        timeIso: cmd.time,
        icon: 'terminal',
        label: `${who}${cmdText}`,
        highlight,
        kind: 'command',
      });
    });

    const cg = pre?.chunk_gen;
    if (cg?.active || cg?.last_line) {
      const src = cg.source === 'chunky' ? 'Chunky' : cg.source === 'dh_pregen' ? 'DH pregen' : 'Chunk gen';
      const pct = cg.pct != null ? ` (${cg.pct}%)` : '';
      events.push({
        time: crashTime,
        timeIso: c.time,
        icon: 'layers',
        label: `${src} active${pct}`,
        highlight: true,
        kind: 'chunk_gen',
      });
    }

    const tps = pre?.tps;
    const lastTps = tps?.last ?? (tps?.points?.length ? tps.points[tps.points.length - 1].v : null);
    const minTps = tps?.min ?? (tps?.points?.length ? Math.min(...tps.points.map((p) => p.v)) : null);
    if (minTps != null && (minTps < 15 || (lastTps != null && lastTps < 10))) {
      events.push({
        time: crashTime,
        timeIso: c.time,
        icon: 'trending-down',
        label: `TPS dropped${minTps != null ? ` (low ${minTps})` : ''}`,
        highlight: true,
        kind: 'tps',
      });
    }

    events.sort((a, b) => {
      const ta = a.time ?? 0;
      const tb = b.time ?? 0;
      return tb - ta;
    });
    return events;
  }

  function renderKeyEventsTimeline(pre, c) {
    const events = buildKeyEvents(pre, c);
    if (!events.length) {
      return '<p class="text-caption wt-empty">No key events recorded in this window.</p>';
    }
    return `
      <ol class="wt-crash-events">
        ${events.map((ev) => `
          <li class="wt-crash-events__item${ev.highlight ? ' wt-crash-events__item--highlight' : ''}">
            <span class="wt-crash-events__icon" aria-hidden="true"><i data-lucide="${ev.icon}" width="14" height="14"></i></span>
            <span class="wt-crash-events__time text-caption">${ev.timeIso ? esc(fmtTimeShort(ev.timeIso)) : '—'}</span>
            <span class="wt-crash-events__label">${esc(ev.label)}</span>
          </li>`).join('')}
      </ol>`;
  }

  function renderCrashReportActions(c) {
    if (!c.file) return '';
    const fname = (c.file || '').split('/').pop();
    return `
      <div class="wt-crash-report-actions">
        <button type="button" class="wt-btn wt-btn--ghost wt-btn--sm view-crash-log" data-crash-file="${escAttr(c.file)}" data-crash-name="${escAttr(fname)}"><i data-lucide="file-text" width="14" height="14"></i> View full log</button>
        <button type="button" class="wt-btn wt-btn--ghost wt-btn--sm download-crash-log" data-crash-file="${escAttr(c.file)}" data-crash-name="${escAttr(fname)}"><i data-lucide="download" width="14" height="14"></i> Download</button>
      </div>`;
  }

  function renderLogTail(pre, c) {
    const actions = renderCrashReportActions(c);
    const lines = pre?.log_tail ?? [];
    if (lines.length) {
      return `
        <div class="wt-crash-log-tail-wrap">
          <div class="wt-crash-log-tail__head">
            <span class="issue-section-label">Log just before crash</span>
            ${actions}
          </div>
          <pre class="wt-crash-log-tail">${lines.map((line) => esc(line)).join('\n')}</pre>
        </div>`;
    }
    const fallback = pre?.chunk_gen?.last_line;
    if (fallback) {
      return `
        <div class="wt-crash-log-tail-wrap">
          <div class="wt-crash-log-tail__head">
            <span class="issue-section-label">Last log line before crash</span>
            ${actions}
          </div>
          <pre class="wt-crash-log-tail">${esc(fallback)}</pre>
        </div>`;
    }
    if (actions) {
      return `
        <div class="wt-crash-log-tail-wrap">
          <div class="wt-crash-log-tail__head">
            <span class="issue-section-label">Crash report file</span>
            ${actions}
          </div>
        </div>`;
    }
    return '';
  }

  function renderPreCrashMetrics(pre) {
    if (!pre) return '';
    const tiles = [];
    const tps = pre.tps;
    if (tps?.min != null && tps?.max != null) {
      tiles.push(`<div class="wt-crash-metric"><span class="wt-crash-metric__label">TPS</span><span class="wt-crash-metric__value">${esc(String(tps.min))}–${esc(String(tps.max))}${tps.last != null ? ` <span class="text-caption">(last ${esc(String(tps.last))})</span>` : ''}</span></div>`);
    }
    if (pre.mspt?.max != null) {
      tiles.push(`<div class="wt-crash-metric"><span class="wt-crash-metric__label">MSPT peak</span><span class="wt-crash-metric__value">${esc(String(pre.mspt.max))} ms</span></div>`);
    }
    if (pre.players?.last != null) {
      tiles.push(`<div class="wt-crash-metric"><span class="wt-crash-metric__label">Players</span><span class="wt-crash-metric__value">${esc(String(pre.players.last))}</span></div>`);
    }
    const cg = pre.chunk_gen;
    if (cg?.active || cg?.pct != null) {
      const src = cg.source === 'chunky' ? 'Chunky' : cg.source === 'dh_pregen' ? 'DH pregen' : 'Chunk gen';
      tiles.push(`<div class="wt-crash-metric"><span class="wt-crash-metric__label">${esc(src)}</span><span class="wt-crash-metric__value">${cg.pct != null ? `${esc(String(cg.pct))}%` : 'Active'}</span></div>`);
    }
    if (!tiles.length) return '';
    return `<div class="wt-crash-context__metrics">${tiles.join('')}</div>`;
  }

  function renderPreCrashContext(c) {
    const pre = getPreCrash(c);
    if (!pre && state.apiMode) {
      return `
        <section class="wt-crash-context">
          <h4 class="wt-crash-context__title"><i data-lucide="clock" width="16" height="16"></i> Before this crash (10 min)</h4>
          <p class="text-caption wt-empty">Loading pre-crash context…</p>
        </section>`;
    }
    if (!pre) return '';

    const mins = pre.window_minutes ?? 10;
    const summary = Labels.preCrashSummary(pre);
    const canvasId = `pre-crash-tps-${String(c.file || 'x').replace(/[^a-zA-Z0-9]/g, '-')}`;
    const points = pre.tps?.points ?? [];
    const sparkHtml = points.length
      ? `<div class="wt-crash-sparkline"><canvas id="${canvasId}" class="wt-chart-canvas" width="480" height="64" data-pre-crash-tps="${escAttr(JSON.stringify(points))}"></canvas></div>`
      : '';
    const emptyNote = pre.unavailable_reason && !points.length
      ? `<p class="text-caption">${esc(pre.unavailable_reason)}</p>` : '';

    return `
      <section class="wt-crash-context">
        <h4 class="wt-crash-context__title"><i data-lucide="clock" width="16" height="16"></i> Before this crash (${mins} min)</h4>
        <p class="text-caption wt-crash-context__summary">${esc(summary)}</p>
        ${emptyNote}
        ${renderPreCrashMetrics(pre)}
        ${sparkHtml}
        <div class="wt-crash-context__events">
          <span class="issue-section-label">Key events</span>
          ${renderKeyEventsTimeline(pre, c)}
        </div>
        ${renderLogTail(pre, c)}
      </section>`;
  }

  function renderFixHints(hints, manualReview) {
    const list = hints.length
      ? hints
      : (manualReview ? Labels.fixHints('CRASH_REPORT') : []);
    if (!list.length) {
      return '<p class="text-caption">No specific fix steps — see technical detail below.</p>';
    }
    return `
      <ol class="fix-list wt-crash-fix-list">
        ${list.map((h) => `
          <li>
            ${esc(h)}
            <button type="button" class="wt-btn wt-btn--ghost wt-btn--sm copy-hint" data-copy="${escAttr(h)}">Copy</button>
          </li>`).join('')}
      </ol>`;
  }

  function renderModFixBlock(modFix) {
    if (!modFix) return '';
    return `
      <div class="wt-crash-mod-fix">
        <span class="issue-section-label">Recommended mod fix</span>
        ${modFix.action ? `<p class="mod-action-line"><span class="mod-action-badge">${esc(Labels.modActionLabel(modFix.action))}</span> ${esc(modFix.action_detail || modFix.fix || '')}</p>` : ''}
        ${modFix.why ? `<p class="text-caption">${esc(modFix.why)}</p>` : ''}
        ${modFix.install_hint ? `<p class="text-caption">${esc(modFix.install_hint)}</p>` : ''}
      </div>`;
  }

  function collectDisplayCrashes(facts) {
    const rows = [...(facts?.optional?.crash_summaries ?? [])];
    const seen = new Set(rows.map((c) => Acks.bareFile(c.file)));
    const cacheEntries = state.opsCache?.crashes?.entries ?? [];
    cacheEntries.forEach((entry) => {
      const bare = Acks.bareFile(entry.file);
      const existing = rows.find((c) => Acks.bareFile(c.file) === bare);
      if (existing) {
        if (entry.display_label && !existing.display_label) {
          existing.display_label = entry.display_label;
        }
        if (entry.plain_english && !existing.plain_english) {
          existing.plain_english = entry.plain_english;
        }
        return;
      }
      if (seen.has(bare)) return;
      const time = entry.time
        || (entry.mtime ? new Date(entry.mtime * 1000).toISOString() : null);
      rows.push({
        file: entry.file,
        display_label: entry.display_label || entry.summary || 'Crash report',
        summary: entry.summary || entry.display_label || '',
        plain_english: entry.plain_english || entry.display_label || '',
        scan_only: entry.source === 'scan' || !entry.category,
        time,
        category: entry.category || 'unknown',
      });
      seen.add(bare);
    });
    const extras = state.crashExtraRows || {};
    Object.values(extras).forEach((row) => {
      const bare = Acks.bareFile(row.file);
      if (!seen.has(bare)) {
        rows.push(row);
        seen.add(bare);
      }
    });
    rows.sort((a, b) => {
      const ta = a.time ? new Date(a.time).getTime() : (a.mtime ? a.mtime * 1000 : 0);
      const tb = b.time ? new Date(b.time).getTime() : (b.mtime ? b.mtime * 1000 : 0);
      return tb - ta;
    });
    return rows;
  }

  function renderCrashCard(c, acks) {
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
    const accentCls = severityBarClass(c, confCls, acked);
    const bodyOpen = !acked;

    const orphanNote = c.orphan
      ? '<p class="wt-crash-card__orphan-note text-caption">Not in the selected report window — switch reports or run a new health scan for full context. View log / download still work.</p>'
      : '';
    const scanOnlyNote = c.scan_only
      ? '<p class="wt-crash-card__orphan-note text-caption">Live scan only — run a full report for classification, fix steps, and pre-crash context.</p>'
      : '';

    return `
      <article class="wt-card wt-card--surface wt-bento__span-12 wt-crash-card wt-scroll-reveal ${categoryAccent(category)}${acked ? ' wt-crash-card--resolved' : ''}" data-crash-file="${escAttr(c.file)}">
        <span class="wt-crash-card__accent ${accentCls}" aria-hidden="true"></span>
        <header class="wt-crash-card__head">
          <div class="wt-crash-card__lead">
            <h3 class="wt-crash-card__title">${esc(plain)}</h3>
            ${orphanNote}
            ${scanOnlyNote}
            ${c.time ? `<div class="wt-crash-card__when">${esc(fmtTime(c.time))} · ${esc(fmtRelative(c.time))}</div>` : ''}
            <div class="wt-crash-card__pills">
              <span class="wt-status-pill ${Labels.crashCategoryClass(category)}">${esc(Labels.crashCategoryLabel(category))}</span>
              <span class="wt-status-pill ${confidencePill(confCls)}">${esc(confLabel)}</span>
              ${c.historical ? '<span class="wt-status-pill">Historical</span>' : ''}
            </div>
            <span class="wt-crash-card__file mono-cell" title="${escAttr(c.file)}">${esc(fname)}</span>
          </div>
          <div class="wt-crash-card__head-actions">
            <label class="wt-crash-card__review">
              <input type="checkbox" class="crash-ack" data-crash-file="${escAttr(c.file)}" data-crash-category="${escAttr(category)}" data-crash-plain="${escAttr(c.plain_english || '')}" ${acked ? 'checked' : ''}>
              <span>Reviewed</span>
            </label>
            ${renderCrashReportActions(c)}
          </div>
        </header>
        <details class="wt-crash-card__body"${bodyOpen ? ' open' : ''}>
          <summary class="wt-crash-card__toggle"><span>${bodyOpen ? 'Hide details' : 'Show details'}</span><i data-lucide="chevron-down" width="16" height="16" class="wt-crash-card__chevron" aria-hidden="true"></i></summary>
          <div class="wt-crash-card__content">
            ${c.likely_cause ? `<div class="issue-section"><span class="issue-section-label">Likely cause</span><p>${esc(c.likely_cause)}</p></div>` : ''}
            ${suspect ? `<div class="issue-section"><span class="issue-section-label">What caused it</span><p><a href="#" class="tab-link" data-tab="mods">${esc(Labels.modFriendlyName(suspect))}</a>${c.mod_file ? ` <span class="text-caption mono-cell">(${esc(c.mod_file)})</span>` : ''}</p></div>` : ''}
            ${renderModFixBlock(c.mod_fix)}
            <div class="issue-section">
              <span class="issue-section-label">How to fix</span>
              ${renderFixHints(hints, manualReview)}
            </div>
            ${renderPreCrashContext(c)}
            <details class="wt-crash-tech">
              <summary>Technical detail</summary>
              <div class="wt-accordion__body">
                <p class="mono-cell">${esc(label)}</p>
                ${c.exception && c.exception !== label ? `<p class="text-caption mono-cell">${esc(c.exception)}</p>` : ''}
              </div>
            </details>
          </div>
        </details>
      </article>`;
  }

  function renderCrashesSummaryRow(summaries, unacked, acks) {
    const modCount = summaries.filter((c) => c.category === 'mod').length;
    const hostCount = summaries.filter((c) => c.category === 'host_resource').length;
    if (typeof TowerTabChrome !== 'undefined') {
      return TowerTabChrome.statGrid([
        TowerTabChrome.statCard({ id: 'crashes-total', tone: 'report', icon: 'file-stack', label: 'In this report', value: String(summaries.length), hint: summaries.length ? 'From latest health report' : 'No crashes' }),
        TowerTabChrome.statCard({ id: 'crashes-review', tone: unacked.length ? 'danger' : 'ok', icon: 'eye', label: 'Needs review', value: String(unacked.length), hint: unacked.length ? 'Unreviewed in report' : 'All reviewed' }),
        TowerTabChrome.statCard({ id: 'crashes-mod', tone: modCount ? 'warn' : 'neutral', icon: 'package', label: 'Mod-related', value: String(modCount), hint: modCount ? 'Suspect mod crashes' : 'None in report' }),
        TowerTabChrome.statCard({ id: 'crashes-host', tone: hostCount ? 'warn' : 'neutral', icon: 'server', label: 'Host / resource', value: String(hostCount), hint: hostCount ? 'Watchdog / resource' : 'None in report' }),
      ].join(''));
    }
    return `
      <div class="wt-bento__span-12 wt-stat-grid wt-crashes-summary">
        ${kpiCard('crashes-total', 'In this report', String(summaries.length), summaries.length ? 'From latest health report' : 'No crashes', '', 'wt-issues-summary__card')}
        ${kpiCard('crashes-review', 'Needs review', String(unacked.length), unacked.length ? 'Unreviewed in report' : 'All reviewed', unacked.length ? '<span class="wt-kpi-delta wt-kpi-delta--down">Open</span>' : '<span class="wt-kpi-delta wt-kpi-delta--up">Clear</span>', 'wt-issues-summary__card')}
        ${kpiCard('crashes-mod', 'Mod-related', String(modCount), modCount ? 'Suspect mod crashes' : 'None in report', '', 'wt-issues-summary__card')}
        ${kpiCard('crashes-host', 'Host / resource', String(hostCount), hostCount ? 'Watchdog / resource' : 'None in report', '', 'wt-issues-summary__card')}
      </div>`;
  }

  function renderCrashes() {
    const f = state.activeFacts;
    const acks = getAcks();
    const summaries = collectDisplayCrashes(f);
    const unacked = summaries.filter((c) => !Acks.isAcked(acks, c.file));
    const filter = state.crashFilter || 'all';

    let filtered = summaries;
    if (filter === 'unacked') filtered = summaries.filter((c) => !Acks.isAcked(acks, c.file));
    else if (filter === 'mod') filtered = summaries.filter((c) => c.category === 'mod');
    else if (filter === 'host') filtered = summaries.filter((c) => c.category === 'host_resource');

    const history = Acks.reviewHistory(f, acks);
    const historyHtml = history.length
      ? `
        <details class="wt-card wt-card--surface wt-bento__span-12 wt-crash-history">
          <summary class="wt-accordion__summary">
            <span><i data-lucide="history" width="16" height="16"></i> Review history (${history.length})</span>
            <i data-lucide="chevron-down" width="16" height="16" class="wt-crash-card__chevron" aria-hidden="true"></i>
          </summary>
          <ul class="wt-crash-history__list">
            ${history.map((h) => `
              <li class="wt-crash-history__item">
                <div class="wt-crash-history__head">
                  <span class="mono-cell">${esc(h.file)}</span>
                  <span class="text-caption">${fmtTime(h.ackedAt)}</span>
                  <button type="button" class="wt-btn wt-btn--ghost wt-btn--sm crash-unack" data-crash-file="${escAttr(h.file)}" data-crash-plain="${escAttr(h.plain_english || '')}" data-crash-category="${escAttr(h.category || 'unknown')}">Un-review</button>
                </div>
                ${h.plain_english ? `<p class="text-caption">${esc(h.plain_english)}</p>` : ''}
              </li>`).join('')}
          </ul>
        </details>`
      : '';

    const cardsHtml = filtered.length
      ? filtered.map((c) => renderCrashCard(c, acks)).join('')
      : `<div class="wt-card wt-card--surface wt-bento__span-12"><p class="wt-empty">No crashes match this filter in ${esc(reportWindowEmptyCaption())}.</p></div>`;

    return `
      <div class="wt-tab-crashes">
        <div class="wt-bento wt-stagger">
          ${typeof TowerTabChrome !== 'undefined' ? TowerTabChrome.tabHero('crashes') : ''}
          ${renderCrashesSummaryRow(summaries, unacked, acks)}
          <div class="wt-bento__span-12 wt-live-toolbar">
            <div class="wt-segment">
              <button type="button" class="wt-segment__btn${filter === 'all' ? ' active' : ''}" data-crash-filter="all">All</button>
              <button type="button" class="wt-segment__btn${filter === 'unacked' ? ' active' : ''}" data-crash-filter="unacked">Needs review</button>
              <button type="button" class="wt-segment__btn${filter === 'mod' ? ' active' : ''}" data-crash-filter="mod">Mod-related</button>
              <button type="button" class="wt-segment__btn${filter === 'host' ? ' active' : ''}" data-crash-filter="host">Host / resource</button>
            </div>
            <button type="button" class="wt-btn wt-btn--ghost wt-btn--sm" id="crash-scan-btn"${state.crashScanInFlight ? ' disabled' : ''}>
              <i data-lucide="refresh-cw" width="14" height="14"></i> Scan crash folder
            </button>
          </div>
          ${cardsHtml}
          ${historyHtml}
          <p class="wt-bento__span-12 text-caption ack-note">Review state is saved on the server and persists across report snapshots.</p>
        </div>
      </div>`;
  }

  return { renderCrashes, renderCrashCard, renderPreCrashContext, getPreCrash, collectDisplayCrashes };
})();
