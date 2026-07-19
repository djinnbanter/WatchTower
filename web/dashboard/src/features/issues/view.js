/**
 * Issues page shell — Active / Reviewed / Tools + URL deep links.
 */
import { html, useState, useCallback, useEffect, useMemo } from '../../lib/preact.js';
import {
  reports, opsCache, issuesPeek, acks, noReportYet, crashGroups, settings, issueSuppressions, ui,
} from '../../state/stores.js';
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
import { Page, Subnav, FreshnessBadge, HealthGrade, EmptyState } from '../../ui/patterns/index.js';
import { Button } from '../../ui/primitives/index.js';
import { QueueTab } from './queue-tab.js';
import { ToolsTab } from './tools-tab.js';
import {
  buildActiveItems,
  buildReviewedItems,
  mapGrade,
} from './helpers.js';

const SUBNAV = [
  { value: 'active', label: 'Active' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'tools', label: 'Tools' },
];

const VALID_VIEWS = new Set(SUBNAV.map((o) => o.value));

function resolveDeepLinkView(issueKey, activeItems, reviewedItems, hiddenIds) {
  if (!issueKey) return 'active';
  if (activeItems.some((i) => i.key === issueKey)) return 'active';
  if (reviewedItems.some((i) => i.key === issueKey)) return 'reviewed';
  const bare = issueKey.startsWith('issue:') ? issueKey.slice(6) : issueKey;
  if (hiddenIds.has(String(bare).toLowerCase()) || hiddenIds.has(String(issueKey).toLowerCase())) {
    return 'tools';
  }
  return 'active';
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
  const { params } = ui.value.route;
  const routeIssue = params?.issue ? decodeURIComponent(String(params.issue)) : null;
  const rawView = params?.view;

  const facts = reports.value.facts;
  const crashAcks = acks.value.crashes ?? {};
  const issueAcks = acks.value.issues ?? {};
  const opsCacheData = opsCache.value.data;
  const peek = issuesPeek.value.data;
  const peekAt = issuesPeek.value.at;
  const isNoReport = noReportYet.value;
  const groups = crashGroups.value;

  const [acking, setAcking] = useState(false);
  const [deepLinkApplied, setDeepLinkApplied] = useState(false);

  const queueOpts = useMemo(() => ({
    backupTrackingEnabled: settings.value?.data?.backup_tracking_enabled !== false,
    issueSuppressions: issueSuppressions.value?.data
      ?? facts?.optional?.active_suppressions
      ?? null,
  }), [
    settings.value?.data?.backup_tracking_enabled,
    issueSuppressions.value?.data,
    facts?.optional?.active_suppressions,
  ]);

  const health = facts ? displayHealth(facts, crashAcks, opsCacheData, queueOpts) : null;
  const queue = facts
    ? buildActionQueue(facts, crashAcks, opsCacheData, groups, issueAcks, queueOpts)
    : { now: [], soon: [], historical: [], reviewed: [] };

  const activeItems = useMemo(
    () => buildActiveItems({ peek, queue, issueAcks }),
    [peek, queue, issueAcks],
  );
  const reviewedItems = useMemo(
    () => buildReviewedItems({ peek, queue, issueAcks }),
    [peek, queue, issueAcks],
  );

  const hidden = facts?.optional?.suppressed_issues ?? [];
  const hiddenIds = useMemo(() => {
    const set = new Set();
    for (const h of hidden) {
      if (h?.id != null) set.add(String(h.id).toLowerCase());
    }
    return set;
  }, [hidden]);

  const needsCount = activeItems.filter((i) => i.band === 'needs').length;
  const watchingCount = activeItems.filter((i) => i.band === 'watching').length;
  const reviewedCount = reviewedItems.length;
  const hasActiveWork = needsCount > 0 || watchingCount > 0
    || activeItems.some((i) => i.band === 'older');

  // Deep link / view normalize
  useEffect(() => {
    if (deepLinkApplied) return;
    if (VALID_VIEWS.has(rawView)) {
      setDeepLinkApplied(true);
      return;
    }
    if (!routeIssue) {
      setDeepLinkApplied(true);
      return;
    }
    // Wait until we have something to resolve against (or empty queue is fine)
    const view = resolveDeepLinkView(routeIssue, activeItems, reviewedItems, hiddenIds);
    navigate('issues', { view, issue: routeIssue }, { replace: true });
    setDeepLinkApplied(true);
  }, [routeIssue, activeItems, reviewedItems, hiddenIds, deepLinkApplied, rawView]);

  const effectiveView = VALID_VIEWS.has(rawView)
    ? rawView
    : (routeIssue && !rawView
      ? resolveDeepLinkView(routeIssue, activeItems, reviewedItems, hiddenIds)
      : 'active');

  const subnavOptions = useMemo(() => SUBNAV.map((opt) => (
    opt.value === 'active' && needsCount > 0
      ? { ...opt, label: `Active (${needsCount})` }
      : opt
  )), [needsCount]);

  const handleSelect = useCallback((key) => {
    const next = { view: effectiveView };
    if (key) next.issue = key;
    navigate('issues', next, { replace: true });
  }, [effectiveView]);

  function handleViewChange(v) {
    if (v === 'tools') {
      navigate('issues', { view: v });
      return;
    }
    const next = { view: v };
    if (routeIssue) {
      const pool = v === 'reviewed' ? reviewedItems : activeItems;
      if (pool.some((i) => i.key === routeIssue)) next.issue = routeIssue;
    }
    navigate('issues', next);
  }

  async function handleAck(id) {
    if (!id) return;
    await ackIssue(id, true);
    addToast('Marked reviewed', 'success');
  }

  async function handleUnack(id) {
    if (!id) return;
    await ackIssue(id, false);
    addToast('Moved back to Active', 'info');
    navigate('issues', { view: 'active', issue: id });
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
      addToast('Hidden from Active — restore in Tools', 'success');
      navigate('issues', { view: 'tools' });
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
    for (const item of activeItems) {
      if (item.kind === 'crash') continue;
      if (item.key) ids.push(item.key);
    }
    const hasCrash = activeItems.some((i) => i.kind === 'crash');
    setAcking(true);
    try {
      if (ids.length) await acknowledgeAllIssues(ids);
      if (hasCrash) await acknowledgeAllCrashes({ scope: 'unreviewed' });
      if (ids.length || hasCrash) {
        addToast('All active issues marked reviewed', 'success');
      }
    } finally {
      setAcking(false);
    }
  }

  if (isNoReport && !peek && !activeItems.length && !reviewedItems.length) {
    return html`
      <${Page} title="Issues" subtitle="Prioritized fixes and alerts">
        <${EmptyState}
          title="No report yet"
          body="Run a report from the top bar to start receiving issue analysis and guided fixes. Live lag peek can still appear after the ops scan warms up."
          action=${html`<${Button} kind="accent" onClick=${() => openModal('run-report')}>Run Report</${Button}>`}
        />
      </${Page}>
    `;
  }

  const inboxWord = needsCount > 0
    ? 'Needs attention'
    : watchingCount > 0
      ? 'Watching'
      : 'Clear';

  return html`
    <${Page}
      title="Issues"
      subtitle="Prioritized fixes — what to do next"
      actions=${html`
        <div class="issues-page-actions">
          ${effectiveView === 'active' && (needsCount > 0 || watchingCount > 0) ? html`
            <${Button} kind="neutral" size="sm" loading=${acking} onClick=${handleAckAllActive}>
              Mark all reviewed
            </${Button}>
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
      <div data-tour="issues" class="ui-page__stack issues-page">
        <div class="issues-summary-slim">
          <span class=${`issues-summary-slim__word issues-summary-slim__word--${needsCount > 0 ? 'danger' : watchingCount > 0 ? 'warn' : 'ok'}`}>
            ${inboxWord}
          </span>
          <span class="issues-summary-slim__counts">
            <span>Needs ${needsCount}</span>
            <span class="issues-summary-slim__sep">·</span>
            <span>Watching ${watchingCount}</span>
            <span class="issues-summary-slim__sep">·</span>
            <span>Reviewed ${reviewedCount}</span>
          </span>
        </div>

        <div class="feat-issues-nav">
          <${Subnav}
            options=${subnavOptions}
            value=${effectiveView}
            onChange=${handleViewChange}
          />
        </div>

        ${effectiveView === 'tools' ? html`
          <${ToolsTab}
            needsCount=${needsCount}
            watchingCount=${watchingCount}
            reviewedCount=${reviewedCount}
            hidden=${hidden}
            onAckAll=${handleAckAllActive}
            onUnsuppress=${handleUnsuppress}
            acking=${acking}
            hasActive=${hasActiveWork}
          />
        ` : html`
          <${QueueTab}
            mode=${effectiveView}
            items=${effectiveView === 'reviewed' ? reviewedItems : activeItems}
            selectedKey=${routeIssue}
            onSelect=${handleSelect}
            onAck=${handleAck}
            onUnack=${handleUnack}
            onSuppress=${handleSuppress}
            onAckCrash=${handleAckCrash}
            onOpenTools=${() => navigate('issues', { view: 'tools' })}
            noReport=${isNoReport}
          />
        `}

        ${peekAt ? html`
          <div class="issues-freshness">
            <${FreshnessBadge} layer="scan" at=${peekAt} />
          </div>
        ` : null}
      </div>
    </${Page}>
  `;
}
