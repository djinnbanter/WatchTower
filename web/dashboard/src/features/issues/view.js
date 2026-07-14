import { html, useState } from '../../lib/preact.js';
import { reports, opsCache, issuesPeek, acks, noReportYet, crashGroups, settings, issueSuppressions } from '../../state/stores.js';
import { setRoute } from '../../state/stores.js';
import {
  openModal,
  ackIssue,
  acknowledgeAllIssues,
  acknowledgeAllCrashes,
  addToast,
  applyIssueSuppressions,
} from '../../state/actions.js';
import { suppressIssue, unsuppressIssue } from '../../api/endpoints.js';
import { navigate } from '../../app/router.js';
import {
  buildActionQueue,
  displayHealth,
  isIssueAcked,
  peekIssueAckKey,
} from '../../domain/health.js';
import { Page, Section, EmptyState, FreshnessBadge, HealthGrade, BeaconCard, MetricTile, Subnav } from '../../ui/patterns/index.js';
import { Badge, Button, Card } from '../../ui/primitives/index.js';
import { formatTps, formatMspt } from '../../domain/formats.js';
import { Icon } from '../../ui/icons.js';

const VIEW_OPTS = [
  { value: 'active', label: 'Active' },
  { value: 'reviewed', label: 'Reviewed' },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function severityTone(severity) {
  if (severity === 'critical') return 'danger';
  if (severity === 'warning') return 'warn';
  if (severity === 'info') return 'info';
  return 'neutral';
}

function mapGrade(status) {
  const m = { ok: 'A', warning: 'C', critical: 'F' };
  return m[status] ?? '?';
}

function FixSteps({ steps, docUrl, hints }) {
  const list = Array.isArray(steps) && steps.length
    ? steps
    : (Array.isArray(hints) ? hints : []);
  if (!list.length && !docUrl) return null;
  return html`
    <div class="issues-fix">
      ${list.length ? html`
        <div class="issues-fix__label">Do this next</div>
        <ol class="issues-fix__steps">
          ${list.map((step, i) => html`<li key=${i}>${step}</li>`)}
        </ol>
      ` : null}
      ${docUrl ? html`
        <a class="issues-fix__doc" href=${docUrl} target="_blank" rel="noopener noreferrer">
          Open mod docs
          <${Icon} name="external-link" size=${12} />
        </a>
      ` : null}
    </div>
  `;
}

function CardActions({ primary, onAck, reviewed, onUnack, onSuppress }) {
  return html`
    <div class="issues-card__actions">
      ${primary}
      ${!reviewed && onSuppress
        ? html`<${Button} kind="neutral" size="sm" onClick=${onSuppress}>Don't show again</${Button}>`
        : null}
      ${reviewed
        ? html`<${Button} kind="neutral" size="sm" onClick=${onUnack}>Undo</${Button}>`
        : html`<${Button} kind="neutral" size="sm" onClick=${onAck}>Mark reviewed</${Button}>`}
    </div>
  `;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function LagIssueRow({ entry, ackKey, reviewed, onAck, onUnack }) {
  const { id, incident_id, severity, title, narrative, metrics, hints, primary_suspect, ackedAt } = entry;
  const tone = reviewed ? 'neutral' : severityTone(severity);
  const modalId = incident_id ?? id;

  return html`
    <${Card} tone=${tone} className="issues-card" padding="12">
      <div class="issues-card__top">
        <div class="issues-card__title-row">
          <${Badge} tone=${tone}>${reviewed ? 'reviewed' : severity}</${Badge}>
          <strong class="issues-card__title">${title}</strong>
        </div>
        <${CardActions}
          reviewed=${reviewed}
          onAck=${() => onAck(ackKey)}
          onUnack=${() => onUnack(ackKey)}
          primary=${html`
            <${Button}
              kind="neutral"
              size="sm"
              onClick=${() => openModal('lag-incident', { id: modalId, entry })}
            >Details</${Button}>
          `}
        />
      </div>
      ${narrative ? html`<p class="issues-card__narrative">${narrative}</p>` : null}
      ${ackedAt ? html`<p class="issues-card__acked">Reviewed ${new Date(ackedAt).toLocaleString()}</p>` : null}
      ${primary_suspect ? html`
        <p class="issues-card__suspect">Suspect: <strong>${primary_suspect}</strong></p>
      ` : null}
      ${metrics ? html`
        <div class="issues-lag-metrics">
          <span>TPS ${formatTps(metrics.tps)}</span>
          <span class="issues-lag-metrics__sep">·</span>
          <span>MSPT ${formatMspt(metrics.mspt)}</span>
          <span class="issues-lag-metrics__sep">·</span>
          <span>${metrics.players_online ?? 0} player${metrics.players_online !== 1 ? 's' : ''}</span>
        </div>
      ` : null}
      ${!reviewed ? html`<${FixSteps} steps=${null} hints=${hints} />` : null}
    </${Card}>
  `;
}

function ModIssueRow({ entry, ackKey, reviewed, onAck, onUnack }) {
  const { severity, title, narrative, hints, fix_steps, doc_url, ackedAt } = entry;
  const tone = reviewed ? 'neutral' : severityTone(severity);

  return html`
    <${Card} tone=${tone} className="issues-card" padding="12">
      <div class="issues-card__top">
        <div class="issues-card__title-row">
          <${Badge} tone=${tone}>${reviewed ? 'reviewed' : severity}</${Badge}>
          <strong class="issues-card__title">${title}</strong>
        </div>
        <${CardActions}
          reviewed=${reviewed}
          onAck=${() => onAck(ackKey)}
          onUnack=${() => onUnack(ackKey)}
          primary=${html`
            <${Button} kind="neutral" size="sm" onClick=${() => navigate('mods', { view: 'conflicts' })}>
              Open Mods
            </${Button}>
          `}
        />
      </div>
      ${narrative ? html`<p class="issues-card__narrative">${narrative}</p>` : null}
      ${ackedAt ? html`<p class="issues-card__acked">Reviewed ${new Date(ackedAt).toLocaleString()}</p>` : null}
      ${!reviewed ? html`<${FixSteps} steps=${fix_steps} hints=${hints} docUrl=${doc_url} />` : null}
    </${Card}>
  `;
}

function ActionRow({ item, reviewed, onAck, onUnack, onAckCrash, onSuppress }) {
  const { severity, title, summary, detail, primaryAction, evidence, kind, ackedAt } = item;
  const tone = reviewed ? 'neutral' : severityTone(severity);
  const steps = item.fix_steps
    ?? (Array.isArray(evidence) ? evidence.filter((e) => typeof e === 'string') : null);
  const issueId = item.meta?.issueId || (kind === 'issue' && item.key?.startsWith('issue:')
    ? item.key.slice(6) : null);

  function go() {
    if (!primaryAction) return;
    if (primaryAction.href) {
      try {
        window.open(primaryAction.href, '_blank', 'noopener,noreferrer');
      } catch {
        /* ignore */
      }
      return;
    }
    if (primaryAction.params) setRoute(primaryAction.tab, primaryAction.params);
    else if (primaryAction.tab) setRoute(primaryAction.tab);
  }

  async function handleAck() {
    if (kind === 'crash') {
      await onAckCrash();
      return;
    }
    onAck(item.key);
  }

  return html`
    <${Card} tone=${tone} className="issues-card" padding="12">
      <div class="issues-card__top">
        <div class="issues-card__title-row">
          <${Badge} tone=${tone}>${reviewed ? 'reviewed' : severity}</${Badge}>
          <strong class="issues-card__title">${title}</strong>
        </div>
        <${CardActions}
          reviewed=${reviewed}
          onAck=${handleAck}
          onUnack=${() => onUnack(item.key)}
          onSuppress=${issueId && onSuppress ? () => onSuppress(issueId) : null}
          primary=${primaryAction ? html`
            <${Button} kind="neutral" size="sm" onClick=${go}>${primaryAction.label}</${Button}>
          ` : null}
        />
      </div>
      ${summary ? html`<p class="issues-card__narrative">${summary}</p>` : null}
      ${detail && detail !== summary ? html`<p class="issues-card__detail">${detail}</p>` : null}
      ${ackedAt ? html`<p class="issues-card__acked">Reviewed ${new Date(ackedAt).toLocaleString()}</p>` : null}
      ${!reviewed ? html`<${FixSteps} steps=${steps} />` : null}
    </${Card}>
  `;
}

function LogStaleRow({ entry, reviewed, onAck, onUnack, ackedAt }) {
  return html`
    <${Card} tone=${reviewed ? 'neutral' : 'warn'} className="issues-card" padding="12">
      <div class="issues-card__top">
        <div class="issues-card__title-row">
          <${Badge} tone=${reviewed ? 'neutral' : 'warn'}>${reviewed ? 'reviewed' : 'warning'}</${Badge}>
          <strong class="issues-card__title">${entry.title}</strong>
        </div>
        <${CardActions}
          reviewed=${reviewed}
          onAck=${() => onAck('log_stale')}
          onUnack=${() => onUnack('log_stale')}
        />
      </div>
      <p class="issues-card__narrative">${entry.narrative}</p>
      ${ackedAt ? html`<p class="issues-card__acked">Reviewed ${new Date(ackedAt).toLocaleString()}</p>` : null}
      ${!reviewed ? html`<${FixSteps} hints=${[
        'Confirm the server is still writing latest.log',
        'Check disk space and file permissions on the logs folder',
        'Restart the server if logging has stalled',
      ]} />` : null}
    </${Card}>
  `;
}

export function issueBadgeCount() {
  const facts = reports.value.facts;
  const crashAcks = acks.value.crashes ?? {};
  const issueAcks = acks.value.issues ?? {};
  const opsCacheData = opsCache.value.data;
  const peek = issuesPeek.value.data;
  const groups = crashGroups.value;
  const queueOpts = {
    backupTrackingEnabled: settings.value?.data?.backup_tracking_enabled !== false,
    issueSuppressions: issueSuppressions.value?.data
      ?? facts?.optional?.active_suppressions
      ?? null,
  };

  let count = 0;

  if (facts) {
    const queue = buildActionQueue(facts, crashAcks, opsCacheData, groups, issueAcks, queueOpts);
    count += [...queue.now, ...queue.soon].filter((i) => i.kind !== 'crash').length;
  }

  const ug = groups?.unreviewed_groups;
  if (typeof ug === 'number' && ug > 0) {
    count += ug;
  } else if (facts && (ug == null)) {
    const queue = buildActionQueue(facts, crashAcks, opsCacheData, groups, issueAcks, queueOpts);
    if ([...queue.now, ...queue.soon].some((i) => i.kind === 'crash')) count += 1;
  }

  if (peek) {
    count += (peek.lag_issues ?? []).filter((e) => !e.resolved && !isIssueAcked(issueAcks, peekIssueAckKey('lag', e))).length;
    count += (peek.mod_issues ?? []).filter((e) => !e.resolved && !isIssueAcked(issueAcks, peekIssueAckKey('mod', e))).length;
    if (peek.log_stale?.active && !isIssueAcked(issueAcks, 'log_stale')) count += 1;
  }

  return count;
}

export function PageView() {
  const [view, setView] = useState('active');
  const facts = reports.value.facts;
  const crashAcks = acks.value.crashes ?? {};
  const issueAcks = acks.value.issues ?? {};
  const opsCacheData = opsCache.value.data;
  const peek = issuesPeek.value.data;
  const peekAt = issuesPeek.value.at;
  const isNoReport = noReportYet.value;

  const groups = crashGroups.value;
  const queueOpts = {
    backupTrackingEnabled: settings.value?.data?.backup_tracking_enabled !== false,
    issueSuppressions: issueSuppressions.value?.data
      ?? facts?.optional?.active_suppressions
      ?? null,
  };
  const health = facts ? displayHealth(facts, crashAcks, opsCacheData, queueOpts) : null;
  const queue = facts
    ? buildActionQueue(facts, crashAcks, opsCacheData, groups, issueAcks, queueOpts)
    : { now: [], soon: [], historical: [], reviewed: [] };

  const allLag = peek?.lag_issues ?? [];
  const allMod = peek?.mod_issues ?? [];
  const logStale = peek?.log_stale?.active ? peek.log_stale : null;

  const liveLag = allLag.filter((e) => !e.resolved && !isIssueAcked(issueAcks, peekIssueAckKey('lag', e)));
  const liveMod = allMod.filter((e) => !e.resolved && !isIssueAcked(issueAcks, peekIssueAckKey('mod', e)));
  const liveLogStale = logStale && !isIssueAcked(issueAcks, 'log_stale') ? logStale : null;

  const reviewedLag = allLag
    .map((e) => {
      const key = peekIssueAckKey('lag', e);
      if (!isIssueAcked(issueAcks, key)) return null;
      return { ...e, ackKey: key, ackedAt: issueAcks[key]?.ackedAt ?? null };
    })
    .filter(Boolean);
  const reviewedMod = allMod
    .map((e) => {
      const key = peekIssueAckKey('mod', e);
      if (!isIssueAcked(issueAcks, key)) return null;
      return { ...e, ackKey: key, ackedAt: issueAcks[key]?.ackedAt ?? null };
    })
    .filter(Boolean);
  const reviewedLogStale = isIssueAcked(issueAcks, 'log_stale') && logStale
    ? { ...logStale, ackedAt: issueAcks.log_stale?.ackedAt ?? null }
    : (isIssueAcked(issueAcks, 'log_stale')
      ? { title: 'Log output stale', narrative: 'Marked reviewed.', ackedAt: issueAcks.log_stale?.ackedAt ?? null }
      : null);

  const needsCount = liveLag.length + liveMod.length + queue.now.length + (liveLogStale ? 1 : 0);
  const soonCount = queue.soon.length;
  const historicalCount = queue.historical.length;
  const reviewedCount = queue.reviewed.length + reviewedLag.length + reviewedMod.length + (reviewedLogStale ? 1 : 0);
  const hasNow = needsCount > 0;
  const hasSoon = soonCount > 0;
  const hasHistorical = historicalCount > 0;
  const hasReviewed = reviewedCount > 0;

  const inboxTone = hasNow ? 'danger' : hasSoon ? 'warn' : 'ok';
  const inboxWord = hasNow ? 'Needs attention' : hasSoon ? 'Watching' : 'Clear';

  async function handleAck(id) {
    if (!id) return;
    await ackIssue(id, true);
    addToast('Marked reviewed', 'success');
  }

  async function handleUnack(id) {
    if (!id) return;
    await ackIssue(id, false);
    addToast('Moved back to Active', 'info');
    setView('active');
  }

  async function handleAckCrash() {
    await acknowledgeAllCrashes({ scope: 'unreviewed' });
    addToast('Crash groups marked reviewed', 'success');
  }

  async function handleSuppress(issueId) {
    if (!issueId) return;
    try {
      const res = await suppressIssue({ issue_id: issueId });
      applyIssueSuppressions(res?.suppressions ?? res);
      addToast('Hidden from Active — undo in Hidden below', 'success');
    } catch (e) {
      addToast(e?.message || 'Could not hide issue', 'danger');
    }
  }

  async function handleUnsuppress(issueId) {
    if (!issueId) return;
    try {
      const res = await unsuppressIssue({ issue_id: issueId });
      applyIssueSuppressions(res?.suppressions ?? res);
      addToast(`Restored ${issueId}`, 'info');
    } catch (e) {
      addToast(e?.message || 'Could not restore issue', 'danger');
    }
  }

  async function handleAckAllActive() {
    const ids = [];
    for (const e of liveLag) {
      const key = peekIssueAckKey('lag', e);
      if (key) ids.push(key);
    }
    for (const e of liveMod) {
      const key = peekIssueAckKey('mod', e);
      if (key) ids.push(key);
    }
    if (liveLogStale) ids.push('log_stale');
    for (const item of [...queue.now, ...queue.soon, ...queue.historical]) {
      if (item.kind === 'crash') continue;
      if (item.key) ids.push(item.key);
    }
    const hasCrash = [...queue.now, ...queue.soon].some((i) => i.kind === 'crash');
    if (ids.length) await acknowledgeAllIssues(ids);
    if (hasCrash) await acknowledgeAllCrashes({ scope: 'unreviewed' });
    if (ids.length || hasCrash) {
      addToast('All active issues marked reviewed', 'success');
    }
  }

  if (isNoReport) {
    return html`
      <${Page} title="Issues" subtitle="Prioritized fixes and alerts">
        <${EmptyState}
          title="No report yet"
          body="Run a report from the top bar to start receiving issue analysis and guided fixes."
          action=${html`<${Button} kind="accent" onClick=${() => openModal('run-report')}>Run Report</${Button}>`}
        />
      </${Page}>
    `;
  }

  return html`
    <${Page}
      title="Issues"
      subtitle="Prioritized fixes — what to do next"
      actions=${html`
        <div class="issues-page-actions">
          ${view === 'active' && (hasNow || hasSoon) ? html`
            <${Button} kind="neutral" size="sm" onClick=${handleAckAllActive}>Mark all reviewed</${Button}>
          ` : null}
          ${health ? html`
            <${HealthGrade}
              grade=${mapGrade(health.grade)}
              label=${health.label}
              size=${56}
            />
          ` : null}
        </div>
      `}
    >
      <div data-tour="issues" class="ui-page__stack">
        <div class="issues-summary">
          <${BeaconCard}
            label="Inbox"
            hint="Action queue status"
            word=${inboxWord}
            tone=${inboxTone}
          />
          <div class="feat-kpi-row issues-summary__metrics">
            <${MetricTile}
              label="Needs attention"
              value=${needsCount}
              tone=${needsCount > 0 ? 'danger' : 'ok'}
              padding="12"
            />
            <${MetricTile}
              label="Worth fixing"
              value=${soonCount}
              tone=${soonCount > 0 ? 'warn' : null}
              padding="12"
            />
            <${MetricTile}
              label="Reviewed"
              value=${reviewedCount}
              padding="12"
            />
          </div>
        </div>

        <${Subnav} options=${VIEW_OPTS} value=${view} onChange=${setView} />

        ${view === 'active' ? html`
          ${!hasNow && !hasSoon && !hasHistorical ? html`
            <${EmptyState}
              title="All clear"
              body=${hasReviewed
                ? 'Nothing active — open Reviewed for past acknowledgements.'
                : 'No active issues detected. Peek at Live charts or Insights if you want a deeper look.'}
              action=${html`
                <div class="issues-empty-actions">
                  ${hasReviewed ? html`
                    <${Button} kind="neutral" size="sm" onClick=${() => setView('reviewed')}>Open Reviewed</${Button}>
                  ` : null}
                  <${Button} kind="neutral" size="sm" onClick=${() => navigate('live')}>Open Live</${Button}>
                  <${Button} kind="neutral" size="sm" onClick=${() => navigate('insights')}>Open Insights</${Button}>
                </div>
              `}
            />
          ` : null}

          ${hasNow ? html`
            <${Section} title="Needs attention" badge=${html`<${Badge} tone="danger">${needsCount}</${Badge}>`}>
              ${liveLag.map((e) => html`
                <${LagIssueRow}
                  key=${e.id}
                  entry=${e}
                  ackKey=${peekIssueAckKey('lag', e)}
                  onAck=${handleAck}
                  onUnack=${handleUnack}
                />
              `)}
              ${liveMod.map((e) => html`
                <${ModIssueRow}
                  key=${e.id}
                  entry=${e}
                  ackKey=${peekIssueAckKey('mod', e)}
                  onAck=${handleAck}
                  onUnack=${handleUnack}
                />
              `)}
              ${liveLogStale ? html`
                <${LogStaleRow}
                  entry=${liveLogStale}
                  onAck=${handleAck}
                  onUnack=${handleUnack}
                />
              ` : null}
              ${queue.now.map((item) => html`
                <${ActionRow}
                  key=${item.key}
                  item=${item}
                  onAck=${handleAck}
                  onUnack=${handleUnack}
                  onAckCrash=${handleAckCrash}
                  onSuppress=${handleSuppress}
                />
              `)}
            </${Section}>
          ` : null}

          <div class="issues-wide-secondary">
            ${hasSoon ? html`
              <${Section} title="Worth watching">
                ${queue.soon.map((item) => html`
                  <${ActionRow}
                    key=${item.key}
                    item=${item}
                    onAck=${handleAck}
                    onUnack=${handleUnack}
                    onAckCrash=${handleAckCrash}
                  onSuppress=${handleSuppress}
                  />
                `)}
              </${Section}>
            ` : null}

            ${hasHistorical ? html`
              <${Section} title="Older findings" collapsible=${true} defaultOpen=${false}>
                ${queue.historical.map((item) => html`
                  <${ActionRow}
                    key=${item.key}
                    item=${item}
                    onAck=${handleAck}
                    onUnack=${handleUnack}
                    onAckCrash=${handleAckCrash}
                  onSuppress=${handleSuppress}
                  />
                `)}
              </${Section}>
            ` : null}
          </div>
        ` : html`
          ${!hasReviewed && !hasHistorical ? html`
            <${EmptyState}
              title="No reviewed issues yet"
              body="Mark items reviewed on the Active tab to clear the queue. They’ll land here so you can undo later if needed."
              action=${html`<${Button} kind="neutral" size="sm" onClick=${() => setView('active')}>Back to Active</${Button}>`}
            />
          ` : html`
            ${hasReviewed ? html`
              <${Section} title="Marked reviewed" badge=${html`<${Badge} tone="ok">${reviewedCount}</${Badge}>`}>
                ${reviewedLag.map((e) => html`
                  <${LagIssueRow}
                    key=${e.ackKey}
                    entry=${e}
                    ackKey=${e.ackKey}
                    reviewed=${true}
                    onAck=${handleAck}
                    onUnack=${handleUnack}
                  />
                `)}
                ${reviewedMod.map((e) => html`
                  <${ModIssueRow}
                    key=${e.ackKey}
                    entry=${e}
                    ackKey=${e.ackKey}
                    reviewed=${true}
                    onAck=${handleAck}
                    onUnack=${handleUnack}
                  />
                `)}
                ${reviewedLogStale ? html`
                  <${LogStaleRow}
                    entry=${reviewedLogStale}
                    reviewed=${true}
                    ackedAt=${reviewedLogStale.ackedAt}
                    onAck=${handleAck}
                    onUnack=${handleUnack}
                  />
                ` : null}
                ${queue.reviewed.map((item) => html`
                  <${ActionRow}
                    key=${item.key}
                    item=${item}
                    reviewed=${true}
                    onAck=${handleAck}
                    onUnack=${handleUnack}
                    onAckCrash=${handleAckCrash}
                  onSuppress=${handleSuppress}
                  />
                `)}
              </${Section}>
            ` : null}

            ${hasHistorical ? html`
              <${Section} title="Older findings (auto)" collapsible=${true} defaultOpen=${!hasReviewed}>
                <p class="ui-text-low feat-hint">These were already historical before you reviewed anything — mark reviewed to archive them here permanently.</p>
                ${queue.historical.map((item) => html`
                  <${ActionRow}
                    key=${item.key}
                    item=${item}
                    onAck=${handleAck}
                    onUnack=${handleUnack}
                    onAckCrash=${handleAckCrash}
                  onSuppress=${handleSuppress}
                  />
                `)}
              </${Section}>
            ` : null}
          `}
        `}

        ${(() => {
          const hidden = facts?.optional?.suppressed_issues ?? [];
          if (!Array.isArray(hidden) || !hidden.length) return null;
          return html`
            <${Section} title="Hidden (suppressed)" subtitle="Won’t show in Active until restored">
              <div class="issues-list">
                ${hidden.map((issue) => html`
                  <${Card} tone="neutral" className="issues-card" padding="12" key=${issue.id}>
                    <div class="issues-card__top">
                      <div class="issues-card__title-row">
                        <${Badge} tone="neutral">hidden</${Badge}>
                        <strong class="issues-card__title">${issue.id || 'Issue'}</strong>
                      </div>
                      <${Button} kind="neutral" size="sm" onClick=${() => handleUnsuppress(issue.id)}>
                        Unsuppress
                      </${Button}>
                    </div>
                    ${issue.message ? html`<p class="issues-card__narrative">${issue.message}</p>` : null}
                  </${Card}>
                `)}
              </div>
            </${Section}>
          `;
        })()}

        ${peekAt ? html`
          <div style="margin-top: var(--ui-sp-12)">
            <${FreshnessBadge} layer="scan" at=${peekAt} />
          </div>
        ` : null}
      </div>
    </${Page}>
  `;
}
