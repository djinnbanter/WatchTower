/**
 * Issues helpers — normalize peek + action-queue items into one list shape.
 */

import { peekIssueAckKey, isIssueAcked } from '../../domain/health.js';
import { addToast } from '../../state/actions.js';

export const SOURCE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'live', label: 'Live' },
  { value: 'report', label: 'Report' },
  { value: 'updates', label: 'Updates' },
  { value: 'crashes', label: 'Crashes' },
  { value: 'backups', label: 'Backups' },
];

export const DETAIL_PANELS = [
  { value: 'fix', label: 'Fix' },
  { value: 'details', label: 'Details' },
];

export const LOG_STALE_STEPS = [
  'Confirm the server is still writing latest.log',
  'Check disk space and file permissions on the logs folder',
  'Restart the server if logging has stalled',
];

export function toast(msg, tone = 'info') {
  addToast(msg, tone);
}

export function severityTone(severity) {
  if (severity === 'critical') return 'danger';
  if (severity === 'warning') return 'warn';
  if (severity === 'info') return 'info';
  return 'neutral';
}

export function mapGrade(status) {
  const m = { ok: 'A', warning: 'C', critical: 'F' };
  return m[status] ?? '?';
}

export function sourceLabel(source) {
  const m = {
    live: 'Live',
    report: 'Report',
    updates: 'Update',
    crashes: 'Crash',
    backups: 'Backup',
  };
  return m[source] || 'Report';
}

export function sourceForKind(kind) {
  if (kind === 'lag' || kind === 'mod' || kind === 'log_stale') return 'live';
  if (kind === 'mod_update') return 'updates';
  if (kind === 'crash') return 'crashes';
  if (kind === 'backup') return 'backups';
  return 'report';
}

export function confidenceFromSteps(steps, hints) {
  const n = (Array.isArray(steps) ? steps.length : 0)
    + (Array.isArray(hints) && !(Array.isArray(steps) && steps.length) ? hints.length : 0);
  if (n >= 3) return 'High';
  if (n >= 1) return 'Medium';
  return 'Low';
}

export function confidenceTone(label) {
  if (label === 'High') return 'ok';
  if (label === 'Medium') return 'warn';
  return 'neutral';
}

function stepsFromActionItem(item) {
  if (Array.isArray(item.fix_steps) && item.fix_steps.length) return item.fix_steps;
  if (Array.isArray(item.evidence)) {
    return item.evidence.filter((e) => typeof e === 'string');
  }
  return [];
}

function issueIdFromItem(item) {
  return item.meta?.issueId
    || (item.kind === 'issue' && item.key?.startsWith('issue:') ? item.key.slice(6) : null)
    || (item.kind === 'backup' ? item.meta?.backupId ?? null : null);
}

/**
 * @returns {object} unified IssueListItem
 */
export function fromActionItem(item, band) {
  const steps = item.kind === 'crash' ? [] : stepsFromActionItem(item);
  const hints = [];
  let primaryAction = item.primaryAction || null;
  if (item.kind === 'crash' && primaryAction?.tab === 'crashes' && !primaryAction.params) {
    primaryAction = { ...primaryAction, params: { view: 'review' } };
  }
  return {
    key: item.key,
    kind: item.kind,
    source: sourceForKind(item.kind),
    band,
    severity: item.severity || 'warning',
    title: item.title,
    summary: item.summary || '',
    detail: item.detail || null,
    steps,
    hints,
    docUrl: null,
    primaryAction,
    when: item.when || null,
    ackedAt: item.ackedAt || null,
    issueId: issueIdFromItem(item),
    metrics: null,
    primarySuspect: null,
    confidence: item.kind === 'crash' ? null : confidenceFromSteps(steps, hints),
    raw: item,
  };
}

export function fromLagEntry(entry, ackKey, band, ackedAt = null) {
  const hints = Array.isArray(entry.hints) ? entry.hints : [];
  return {
    key: ackKey,
    kind: 'lag',
    source: 'live',
    band,
    severity: entry.severity || 'warning',
    title: entry.title || 'Lag incident',
    summary: entry.narrative || '',
    detail: null,
    steps: [],
    hints,
    docUrl: null,
    primaryAction: {
      label: 'Open full incident',
      lagModal: true,
      entry,
      modalId: entry.incident_id ?? entry.id,
    },
    when: entry.started_at || entry.at || entry.time || null,
    ackedAt,
    issueId: null,
    metrics: entry.metrics || null,
    primarySuspect: entry.primary_suspect || null,
    confidence: confidenceFromSteps([], hints),
    raw: entry,
  };
}

export function fromModEntry(entry, ackKey, band, ackedAt = null) {
  const steps = Array.isArray(entry.fix_steps) ? entry.fix_steps : [];
  const hints = Array.isArray(entry.hints) ? entry.hints : [];
  return {
    key: ackKey,
    kind: 'mod',
    source: 'live',
    band,
    severity: entry.severity || 'warning',
    title: entry.title || 'Mod issue',
    summary: entry.narrative || '',
    detail: null,
    steps,
    hints,
    docUrl: entry.doc_url || null,
    primaryAction: { label: 'Open Mods', tab: 'mods', params: { view: 'conflicts' } },
    when: entry.at || entry.time || null,
    ackedAt,
    issueId: null,
    metrics: null,
    primarySuspect: null,
    confidence: confidenceFromSteps(steps, hints),
    raw: entry,
  };
}

export function fromLogStale(entry, band, ackedAt = null) {
  return {
    key: 'log_stale',
    kind: 'log_stale',
    source: 'live',
    band,
    severity: 'warning',
    title: entry?.title || 'Log output stale',
    summary: entry?.narrative || 'Server log has not been written recently.',
    detail: null,
    steps: LOG_STALE_STEPS,
    hints: [],
    docUrl: null,
    primaryAction: null,
    when: entry?.at || null,
    ackedAt,
    issueId: null,
    metrics: null,
    primarySuspect: null,
    confidence: 'High',
    raw: entry,
  };
}

/**
 * Build Active queue items grouped conceptually by band.
 */
export function buildActiveItems({ peek, queue, issueAcks }) {
  const items = [];
  const allLag = peek?.lag_issues ?? [];
  const allMod = peek?.mod_issues ?? [];
  const logStale = peek?.log_stale?.active ? peek.log_stale : null;

  for (const e of allLag) {
    if (e.resolved) continue;
    const key = peekIssueAckKey('lag', e);
    if (!key || isIssueAcked(issueAcks, key)) continue;
    items.push(fromLagEntry(e, key, 'needs'));
  }
  for (const e of allMod) {
    if (e.resolved) continue;
    const key = peekIssueAckKey('mod', e);
    if (!key || isIssueAcked(issueAcks, key)) continue;
    items.push(fromModEntry(e, key, 'needs'));
  }
  if (logStale && !isIssueAcked(issueAcks, 'log_stale')) {
    items.push(fromLogStale(logStale, 'needs'));
  }

  for (const item of queue?.now ?? []) {
    items.push(fromActionItem(item, 'needs'));
  }
  for (const item of queue?.soon ?? []) {
    items.push(fromActionItem(item, 'watching'));
  }
  for (const item of queue?.historical ?? []) {
    items.push(fromActionItem(item, 'older'));
  }

  return items;
}

/**
 * Build Reviewed archive items (explicitly marked only — no historical duplicate).
 */
export function buildReviewedItems({ peek, queue, issueAcks }) {
  const items = [];
  const allLag = peek?.lag_issues ?? [];
  const allMod = peek?.mod_issues ?? [];
  const logStale = peek?.log_stale?.active ? peek.log_stale : null;

  for (const e of allLag) {
    const key = peekIssueAckKey('lag', e);
    if (!key || !isIssueAcked(issueAcks, key)) continue;
    items.push(fromLagEntry(e, key, 'reviewed', issueAcks[key]?.ackedAt ?? null));
  }
  for (const e of allMod) {
    const key = peekIssueAckKey('mod', e);
    if (!key || !isIssueAcked(issueAcks, key)) continue;
    items.push(fromModEntry(e, key, 'reviewed', issueAcks[key]?.ackedAt ?? null));
  }
  if (isIssueAcked(issueAcks, 'log_stale')) {
    const stub = logStale || { title: 'Log output stale', narrative: 'Marked reviewed.' };
    items.push(fromLogStale(stub, 'reviewed', issueAcks.log_stale?.ackedAt ?? null));
  }

  for (const item of queue?.reviewed ?? []) {
    items.push(fromActionItem(item, 'reviewed'));
  }

  items.sort((a, b) => {
    const ta = a.ackedAt || '';
    const tb = b.ackedAt || '';
    return tb.localeCompare(ta);
  });

  return items;
}

export function filterItems(items, { search, source }) {
  const q = (search || '').trim().toLowerCase();
  return (items || []).filter((item) => {
    if (source && source !== 'all' && item.source !== source) return false;
    if (!q) return true;
    const hay = [
      item.title,
      item.summary,
      item.detail,
      item.key,
      item.kind,
      item.issueId,
      sourceLabel(item.source),
    ].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  });
}

export function groupByBand(items) {
  const needs = [];
  const watching = [];
  const older = [];
  for (const item of items) {
    if (item.band === 'watching') watching.push(item);
    else if (item.band === 'older') older.push(item);
    else needs.push(item);
  }
  return [
    { key: 'needs', label: 'Needs attention', tone: 'danger', items: needs },
    { key: 'watching', label: 'Worth watching', tone: 'warn', items: watching },
    { key: 'older', label: 'Older findings', tone: 'neutral', items: older },
  ].filter((g) => g.items.length > 0);
}

export function formatAge(iso) {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.round(sec / 3600)}h ago`;
  return `${Math.round(sec / 86400)}d ago`;
}

export function runPrimaryAction(action, { setRoute, openModal, navigate }) {
  if (!action) return;
  if (action.lagModal) {
    openModal('lag-incident', { id: action.modalId, entry: action.entry });
    return;
  }
  if (action.href) {
    try {
      window.open(action.href, '_blank', 'noopener,noreferrer');
    } catch {
      /* ignore */
    }
    return;
  }
  if (action.params) {
    if (navigate) navigate(action.tab, action.params);
    else setRoute(action.tab, action.params);
  } else if (action.tab) {
    if (navigate) navigate(action.tab);
    else setRoute(action.tab);
  }
}
