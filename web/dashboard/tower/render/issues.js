/**
 * Watchtower UI v3 — issues tab renderers
 */
const TowerRenderIssues = (function () {
  const esc = TowerRenderShared.esc;
  const fmtTime = TowerRenderShared.fmtTime;
  const fmtTimeShort = TowerRenderShared.fmtTimeShort;
  const kpiCard = TowerRenderShared.kpiCard;

  function escAttr(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function issueWhenText(issue, facts) {
    if (issue.event_time) return fmtTime(issue.event_time);
    const ev = (facts?.events ?? []).find((e) => e.type === 'reboot');
    if (ev?.time) return fmtTime(ev.time);
    for (const e of issue.evidence || []) {
      if (e.time) return fmtTime(e.time);
    }
    return null;
  }

  function issueEvidenceQuote(issue, facts) {
    for (const e of issue.evidence || []) {
      if (e.quote) return e.quote;
    }
    const ev = (facts?.events ?? []).find((e) => e.type === 'reboot');
    return ev?.detail || null;
  }

  function rebootDetectionNote(issue, facts) {
    const source = issue.event_source || (facts?.events ?? []).find((e) => e.type === 'reboot')?.source;
    const detail = issueEvidenceQuote(issue);
    if (source === 'proc_uptime' || (detail && detail.includes('/proc/uptime'))) {
      return 'We know the machine rebooted; logs don\'t show whether it was manual, watchdog, or power loss.';
    }
    return issue.message || Labels.issueSummary(issue);
  }

  function issueDeepLinkTab(id) {
    return Health.issueActionTab(id);
  }

  function actionQueueKindIcon(kind) {
    const m = { crash: 'file-warning', backup: 'database-backup', mod: 'package', issue: 'alert-circle', info: 'info' };
    return m[kind] || 'alert-circle';
  }

  function actionQueueWhenText(item, facts) {
    if (item.when) return fmtTime(item.when);
    if (item.issue) return issueWhenText(item.issue, facts);
    return null;
  }

  function actionQueueDetailText(item, facts) {
    if (item.issue?.id === 'MANUAL_REBOOT') return rebootDetectionNote(item.issue, facts);
    if (item.detail && item.detail !== item.summary) return item.detail;
    if (item.issue?.message && item.issue.message !== item.summary) return item.issue.message;
    return null;
  }

  function dedupeFixes(fixes) {
    const seen = new Set();
    return (fixes || []).filter((f) => {
      const k = String(f).trim();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  function renderActionQueueEvidence(item) {
    if (!item.evidence?.length) return '';
    const rows = item.evidence.map((e) => `
      <div class="action-queue-evidence-item">
        ${e.file ? `<span class="text-caption mono-cell">${esc(e.file)}</span>` : ''}
        ${e.quote ? `<code class="issue-evidence action-queue-evidence">${esc(String(e.quote).slice(0, 240))}</code>` : ''}
        ${e.time ? `<span class="text-caption">${esc(fmtTimeShort(e.time))}</span>` : ''}
      </div>`).join('');
    const more = item.meta?.moreCount > 0
      ? `<p class="text-caption">+${item.meta.moreCount} more on the Crashes tab</p>`
      : '';
    return `<div class="action-queue-evidence-list">${rows}${more}</div>`;
  }

  function renderActionQueueRow(item, facts) {
    const when = actionQueueWhenText(item, facts);
    const detail = actionQueueDetailText(item, facts);
    const fixes = dedupeFixes(item.fixes);
    const icon = actionQueueKindIcon(item.kind);
    const cta = item.primaryAction
      ? `<a href="#" class="wt-btn wt-btn--ghost wt-btn--sm tab-link" data-tab="${esc(item.primaryAction.tab)}">${esc(item.primaryAction.label)} →</a>`
      : '';
    const sevBar = item.severity === 'critical' ? 'wt-queue__severity--critical'
      : item.severity === 'warning' ? 'wt-queue__severity--warning'
        : item.severity === 'info' ? 'wt-queue__severity--info'
          : 'wt-queue__severity--warning';

    return `
      <div class="wt-queue__row wt-issues-row wt-card--interactive" data-tier="${esc(item.tier)}">
        <span class="wt-queue__severity ${sevBar}"></span>
        <div class="wt-queue__body">
          <details class="wt-issues-row__details">
            <summary class="wt-issues-row__summary">
              <div class="wt-issues-row__head">
                <span class="wt-issues-row__icon" aria-hidden="true"><i data-lucide="${icon}" width="18" height="18"></i></span>
                <div class="wt-issues-row__copy">
                  <span class="wt-queue__title">${esc(item.title)}</span>
                  <span class="wt-queue__meta">${esc(item.summary)}</span>
                </div>
              </div>
              <i data-lucide="chevron-down" width="16" height="16" class="wt-issues-row__chevron" aria-hidden="true"></i>
            </summary>
            <div class="wt-accordion__body">
              ${when ? `<p class="issue-when"><strong>When:</strong> ${esc(when)}</p>` : ''}
              ${detail ? `<div class="issue-section"><span class="issue-section-label">What we know</span><p>${esc(detail)}</p></div>` : ''}
              ${item.meta?.shouldWorry ? `<div class="issue-section"><span class="issue-section-label">Should you worry?</span><p>${esc(item.meta.shouldWorry)}</p></div>` : ''}
              ${item.evidence?.length ? `<div class="issue-section"><span class="issue-section-label">Evidence</span>${renderActionQueueEvidence(item)}</div>` : ''}
              ${fixes.length ? `<div class="issue-section"><span class="issue-section-label">What to do</span><ul class="fix-list">${fixes.map((h) => `<li>${esc(h)}</li>`).join('')}</ul></div>` : ''}
            </div>
          </details>
        </div>
        <div class="wt-queue__actions">${cta}</div>
      </div>`;
  }

  function renderIssuesInboxHealthCard(health) {
    const gradCls = health.effective === 'critical' ? 'critical' : health.effective === 'warning' ? 'warning' : 'ok';
    const verdictMod = gradCls === 'critical' ? 'critical' : gradCls === 'warning' ? 'warn' : 'ok';
    const inboxSev = verdictMod === 'critical' ? 'critical' : verdictMod === 'warn' ? 'warn' : 'ok';
    const beaconCls = gradCls === 'critical'
      ? 'wt-beacon--critical wt-beacon--pulse-critical'
      : gradCls === 'warning'
        ? 'wt-beacon--warn wt-beacon--pulse-warn'
        : 'wt-beacon--healthy wt-beacon--pulse-healthy';
    const effectiveWord = Labels.healthStatus(health.effective);
    const ackSuffix = health.ackCount > 0 && health.effective !== health.overall
      ? ` (${health.ackCount} acked)`
      : '';

    return `
      <div class="wt-card wt-card--surface wt-card--severity-${inboxSev} wt-overview-health-card wt-issues-summary__card" id="issues-inbox-health">
        <div class="wt-kpi">
          <span class="wt-kpi__label">Inbox status</span>
          <span class="wt-overview-health-card__hint">From latest health report</span>
          <div class="wt-overview-health-card__value">
            <span class="wt-beacon wt-beacon--lg ${beaconCls}" aria-hidden="true"></span>
            <span class="wt-overview-health-card__word wt-overview-health-card__word--${verdictMod}">${esc(effectiveWord)}${esc(ackSuffix)}</span>
          </div>
        </div>
      </div>`;
  }

  function renderIssuesSummaryRow(health, nowCount, soonCount, histCount) {
    const nowFoot = nowCount ? 'Blocking issues' : 'Nothing blocking';
    const soonFoot = soonCount ? 'Schedule when you can' : 'Queue clear';
    const histFoot = histCount ? 'Older report items' : 'No history';
    const stat = typeof TowerTabChrome !== 'undefined' ? TowerTabChrome.statCard : null;
    const cards = stat
      ? [
        stat({ id: 'issues-now', tone: nowCount ? 'danger' : 'ok', icon: 'alert-circle', label: 'Needs attention', value: String(nowCount), hint: nowFoot }),
        stat({ id: 'issues-soon', tone: soonCount ? 'warn' : 'neutral', icon: 'clock', label: 'Worth fixing', value: String(soonCount), hint: soonFoot }),
        stat({ id: 'issues-hist', tone: 'report', icon: 'archive', label: 'Historical', value: String(histCount), hint: histFoot }),
      ].join('')
      : [
        kpiCard('issues-now', 'Needs attention', String(nowCount), nowFoot, '', 'wt-issues-summary__card'),
        kpiCard('issues-soon', 'Worth fixing', String(soonCount), soonFoot, '', 'wt-issues-summary__card'),
        kpiCard('issues-hist', 'Historical', String(histCount), histFoot, '', 'wt-issues-summary__card'),
      ].join('');
    return `
      <div class="wt-bento__span-12 wt-stat-grid wt-issues-summary">
      ${renderIssuesInboxHealthCard(health)}
      ${cards}
      </div>`;
  }

  function renderIssuesOkBanner() {
    return `
      <div class="wt-issues-ok">
        <p class="wt-issues-ok__line"><i data-lucide="circle-check" width="18" height="18"></i> Nothing blocking you — see optional or historical items below.</p>
      </div>`;
  }

  function activeLagIssues() {
    const peek = state.lagIssuesPeek?.lag_issues;
    const cache = state.opsCache?.lag_issues?.entries;
    const entries = Array.isArray(peek) ? peek : (Array.isArray(cache) ? cache : []);
    return entries.filter((e) => e && !e.resolved);
  }

  function renderLiveLagFindings(entry) {
    const findings = entry.findings?.length ? entry.findings : (entry.hints || []).map((h) => ({ kind: 'confirmed', text: h }));
    if (!findings.length) return '';
    const confirmed = findings.filter((f) => f.kind !== 'manual');
    const manual = findings.filter((f) => f.kind === 'manual');
    const rows = (items, icon) => items.map((f) => `
      <li class="wt-lag-finding wt-lag-finding--${esc(f.kind || 'confirmed')}">
        <i data-lucide="${icon}" width="14" height="14" aria-hidden="true"></i>
        <span>${esc(f.text || '')}</span>
      </li>`).join('');
    return `
      ${entry.primary_suspect ? `<p class="wt-lag-suspect"><strong>Most likely cause:</strong> ${esc(entry.primary_suspect)}</p>` : ''}
      ${confirmed.length ? `<div class="issue-section"><span class="issue-section-label">Checked at spike time</span><ul class="wt-lag-findings">${rows(confirmed, 'circle-check')}</ul></div>` : ''}
      ${manual.length ? `<div class="issue-section"><span class="issue-section-label">Still needs a deeper look</span><ul class="wt-lag-findings wt-lag-findings--manual">${rows(manual, 'search')}</ul></div>` : ''}`;
  }

  function renderLiveLagCard(entry) {
    const sevBar = entry.severity === 'critical' ? 'wt-queue__severity--critical'
      : entry.severity === 'warning' ? 'wt-queue__severity--warning'
        : 'wt-queue__severity--info';
    const when = entry.time ? fmtTime(entry.time) : null;
    const metrics = entry.metrics || {};
    const metricLine = [
      metrics.mspt != null ? `MSPT ${Math.round(metrics.mspt)}ms` : null,
      metrics.tps != null ? `TPS ${Number(metrics.tps).toFixed(1)}` : null,
      metrics.players_online != null ? `${metrics.players_online} online` : null,
    ].filter(Boolean).join(' · ');
    const incidentId = entry.incident_id || '';

    return `
      <div class="wt-queue__row wt-issues-row wt-card--interactive severity-${esc(entry.severity || 'warning')}" data-tier="now">
        <span class="wt-queue__severity ${sevBar}"></span>
        <div class="wt-queue__body">
          <details class="wt-issues-row__details" open>
            <summary class="wt-issues-row__summary">
              <div class="wt-issues-row__head">
                <span class="wt-issues-row__icon" aria-hidden="true"><i data-lucide="gauge" width="18" height="18"></i></span>
                <div class="wt-issues-row__copy">
                  <span class="wt-queue__title">${esc(entry.title || 'Lag spike')}</span>
                  <span class="wt-queue__meta">${esc(entry.narrative || metricLine || 'Live lag incident')}</span>
                </div>
              </div>
              <i data-lucide="chevron-down" width="16" height="16" class="wt-issues-row__chevron" aria-hidden="true"></i>
            </summary>
            <div class="wt-accordion__body">
              ${when ? `<p class="issue-when"><strong>When:</strong> ${esc(when)}</p>` : ''}
              ${metricLine ? `<p class="wt-queue__meta">${esc(metricLine)}</p>` : ''}
              ${entry.players?.length ? `<p class="wt-queue__meta"><strong>Players:</strong> ${esc(entry.players.join(', '))}</p>` : ''}
              ${renderLiveLagFindings(entry)}
            </div>
          </details>
        </div>
        <div class="wt-queue__actions">
          ${incidentId ? `<button type="button" class="wt-btn wt-btn--ghost wt-btn--sm view-lag-incident" data-incident-id="${esc(incidentId)}">View investigation</button>` : ''}
          <a href="#" class="wt-btn wt-btn--ghost wt-btn--sm tab-link" data-tab="activity">Activity →</a>
        </div>
      </div>`;
  }

  function renderLiveLagSection() {
    const active = activeLagIssues();
    if (!active.length) return '';
    const cards = active.map(renderLiveLagCard).join('');
    return `
      <div class="wt-card wt-card--surface wt-bento__span-12 wt-issues-tier wt-issues-live-lag">
        <div class="wt-card__head wt-issues-tier__head">
          <h3 class="wt-card__title"><i data-lucide="zap" width="16" height="16"></i> Live lag incidents</h3>
          <span class="wt-issues-tier__count">${active.length}</span>
        </div>
        <div class="wt-queue">${cards}</div>
      </div>`;
  }

  function renderLiveModCard(entry) {
    const sevBar = entry.severity === 'critical' ? 'wt-queue__severity--critical'
      : entry.severity === 'warning' ? 'wt-queue__severity--warning'
        : 'wt-queue__severity--info';
    const when = entry.time ? fmtTime(entry.time) : null;
    const modId = entry.mod_id || '';
    const fixSteps = (entry.fix_steps ?? []).slice(0, 5);
    const hints = fixSteps.length ? [] : (entry.hints ?? []).slice(0, 3);
    const docLink = entry.doc_url
      ? `<p class="text-caption"><a href="${escAttr(entry.doc_url)}" target="_blank" rel="noopener">Documentation →</a></p>`
      : '';

    return `
      <div class="wt-queue__row wt-issues-row severity-${esc(entry.severity || 'warning')}" data-tier="now" data-mod-id="${escAttr(modId)}">
        <span class="wt-queue__severity ${sevBar}"></span>
        <div class="wt-queue__body">
          <details class="wt-issues-row__details" open>
            <summary class="wt-issues-row__summary">
              <div class="wt-issues-row__head">
                <span class="wt-issues-row__icon" aria-hidden="true"><i data-lucide="package" width="18" height="18"></i></span>
                <div class="wt-issues-row__copy">
                  <span class="wt-queue__title">${esc(entry.title || 'Mod log error')}</span>
                  <span class="wt-queue__meta">${esc(entry.narrative || '')}</span>
                </div>
              </div>
              <i data-lucide="chevron-down" width="16" height="16" class="wt-issues-row__chevron" aria-hidden="true"></i>
            </summary>
            <div class="wt-accordion__body">
              ${when ? `<p class="issue-when"><strong>When:</strong> ${esc(when)}</p>` : ''}
              ${entry.sample_line ? `<code class="issue-evidence">${esc(String(entry.sample_line).slice(0, 240))}</code>` : ''}
              ${fixSteps.length ? `<ul class="fix-list">${fixSteps.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}
              ${hints.length ? `<ul class="fix-list">${hints.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}
              ${docLink}
            </div>
          </details>
        </div>
        <div class="wt-queue__actions">
          <a href="#" class="wt-btn wt-btn--ghost wt-btn--sm tab-link" data-tab="mods" data-mod-highlight="${escAttr(modId)}">Mods →</a>
        </div>
      </div>`;
  }

  function renderLiveModSection() {
    const active = typeof activeModIssues === 'function' ? activeModIssues() : [];
    if (!active.length) return '';
    const cards = active.map(renderLiveModCard).join('');
    return `
      <div class="wt-card wt-card--surface wt-bento__span-12 wt-issues-tier wt-issues-live-mod">
        <div class="wt-card__head wt-issues-tier__head">
          <h3 class="wt-card__title"><i data-lucide="package" width="16" height="16"></i> Live mod log errors</h3>
          <span class="wt-issues-tier__count">${active.length}</span>
        </div>
        <div class="wt-queue">${cards}</div>
      </div>`;
  }

  function renderActionQueueGroup(title, items, facts, options = {}) {
    const icon = options.icon || 'alert-circle';
    const collapsible = options.collapsible === true;
    const count = items.length;
    const queueHtml = items.map((item) => renderActionQueueRow(item, facts)).join('');

    let body = '';
    if (collapsible && count) {
      body = `
        <details class="wt-accordion wt-issues-tier__collapse">
          <summary class="wt-accordion__summary">
            <span>Show ${count} historical item${count === 1 ? '' : 's'}</span>
            <i data-lucide="chevron-down" width="16" height="16" class="wt-issues-row__chevron" aria-hidden="true"></i>
          </summary>
          <div class="wt-queue">${queueHtml}</div>
        </details>`;
    } else if (count) {
      body = `<div class="wt-queue">${queueHtml}</div>`;
    } else if (options.emptyHtml) {
      body = options.emptyHtml;
    }

    return `
      <div class="wt-card wt-card--surface wt-bento__span-12 wt-issues-tier wt-scroll-reveal">
        <div class="wt-card__head wt-issues-tier__head">
          <h3 class="wt-card__title"><i data-lucide="${icon}" width="16" height="16"></i> ${esc(title)}</h3>
          <span class="wt-issues-tier__count">${count}</span>
        </div>
        ${body}
      </div>`;
  }

  function issueFixHints(issue, facts) {
    if (issue.id === 'MOD_LOAD_FAILED' && issue.mod_id) {
      const rec = (facts?.optional?.mod_recommendations ?? []).find((r) => r.mod_id === issue.mod_id);
      if (rec?.fix_steps?.length) return rec.fix_steps;
      const cat = rec?.category || 'mod_load_failed';
      const steps = Labels.modDrFixSteps(issue.mod_id, cat);
      if (steps.length) return steps;
    }
    return Labels.fixHints(issue.id);
  }

  function renderActiveIssueCard(issue, facts) {
    const when = issueWhenText(issue, facts);
    const hints = issueFixHints(issue, facts);
    const quote = issueEvidenceQuote(issue, facts);
    const isReboot = issue.id === 'MANUAL_REBOOT';
    const whatWeKnow = isReboot ? rebootDetectionNote(issue, facts) : (issue.message || Labels.issueSummary(issue));
    const linkTab = issueDeepLinkTab(issue.id);

    const sevBar = issue.severity === 'critical' ? 'wt-queue__severity--critical'
      : issue.severity === 'warning' ? 'wt-queue__severity--warning'
        : issue.severity === 'info' ? 'wt-queue__severity--info'
          : 'wt-queue__severity--warning';

    return `
      <div class="wt-queue__row severity-${issue.severity}">
        <span class="wt-queue__severity ${sevBar}"></span>
        <div class="wt-queue__body">
          <div class="wt-queue__title">${esc(Labels.issueTitle(issue.id))}</div>
          ${when ? `<p class="wt-queue__meta"><strong>When:</strong> ${esc(when)}</p>` : ''}
          <div class="issue-section">
            <span class="issue-section-label">What we know</span>
            <p>${esc(whatWeKnow)}</p>
            ${quote ? `<code class="issue-evidence">${esc(quote)}</code>` : ''}
          </div>
          <div class="issue-section">
            <span class="issue-section-label">What to do</span>
            <ul class="fix-list">${hints.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>
          </div>
          ${linkTab ? `<p class="text-caption"><a href="#" class="tab-link" data-tab="${linkTab}">Open ${esc(linkTab)} tab →</a></p>` : ''}
        </div>
      </div>`;
  }

  function renderIssues() {
    const f = state.activeFacts;
    const acks = getAcks();
    const ignores = getClientModIgnores();
    const health = Health.displayHealth(f, acks, ignores);
    const queue = Health.buildActionQueue(f, acks, ignores);
    const nowItems = queue.filter((i) => i.tier === 'now');
    const soonItems = queue.filter((i) => i.tier === 'soon');
    const histItems = queue.filter((i) => i.tier === 'historical');
    const attentionCount = nowItems.length;

    const summaryRow = renderIssuesSummaryRow(health, nowItems.length, soonItems.length, histItems.length);
    const liveLagBlock = renderLiveLagSection();
    const liveModBlock = renderLiveModSection();

    const heroHtml = typeof TowerTabChrome !== 'undefined'
      ? TowerTabChrome.tabHero('issues', {
        title: attentionCount
          ? `${attentionCount} thing${attentionCount === 1 ? '' : 's'} need${attentionCount === 1 ? 's' : ''} attention`
          : 'Nothing blocking you',
        lead: attentionCount
          ? 'Tackle blocking items first — optional and historical items appear below.'
          : 'Optional and historical items may still appear below.',
        actions: activeLagIssues().length
          ? '<a href="#" class="wt-btn wt-btn--ghost wt-btn--sm tab-link" data-tab="live">Check Live lag →</a>'
          : '',
        titleTag: 'h2',
      })
      : (() => {
        const attentionLine = attentionCount
          ? `${attentionCount} thing${attentionCount === 1 ? '' : 's'} need${attentionCount === 1 ? 's' : ''} attention now`
          : 'Nothing blocking you right now';
        return `<p class="wt-bento__span-12 text-caption wt-issues-attention">${attentionLine}</p>`;
      })();

    const shellStart = `
      <div class="wt-tab-issues">
        <div class="wt-bento wt-stagger">
          ${summaryRow}
          ${heroHtml}
          ${liveLagBlock}
          ${liveModBlock}`;

    const shellEnd = `
        </div>
      </div>`;

    if (!queue.length) {
      return `${shellStart}
          <div class="wt-card wt-card--surface wt-bento__span-12">
            <p class="wt-empty">No issues in this report. Run reports regularly to catch problems early.</p>
          </div>
        ${shellEnd}`;
    }

    const nowBlock = attentionCount
      ? renderActionQueueGroup('Needs attention now', nowItems, f, { icon: 'alert-circle' })
      : renderActionQueueGroup('Needs attention now', [], f, {
        icon: 'alert-circle',
        emptyHtml: renderIssuesOkBanner(),
      });

    const soonBlock = soonItems.length
      ? renderActionQueueGroup('Worth fixing when you can', soonItems, f, { icon: 'clock' })
      : '';

    const histBlock = histItems.length
      ? renderActionQueueGroup('Historical', histItems, f, { icon: 'archive', collapsible: true })
      : '';

    return `${shellStart}${nowBlock}${soonBlock}${histBlock}${shellEnd}`;
  }

  return { renderIssues, renderActionQueueEvidence, renderActionQueueRow, renderActionQueueGroup, renderActiveIssueCard };
})();
