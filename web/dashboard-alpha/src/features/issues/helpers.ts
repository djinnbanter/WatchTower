import { asArray, asRecord, num, str, timeAgo } from '@/lib/utils';

export type IssueBand = 'critical' | 'warning' | 'info' | 'reviewed';
export type IssueSeverity = 'critical' | 'warning' | 'info';
export type DetailPanel = 'fix' | 'details';

export type PrimaryAction = {
  label: string;
  tab?: string;
  params?: Record<string, string | null | undefined>;
  href?: string;
};

export type IssueItem = {
  key: string;
  kind: string;
  source: string;
  band: IssueBand;
  severity: IssueSeverity;
  title: string;
  summary: string;
  detail: string | null;
  steps: string[];
  hints: string[];
  primaryAction: PrimaryAction | null;
  when: string | null;
  ackedAt: string | null;
  issueId: string | null;
  metrics: Record<string, unknown> | null;
  confidence: 'High' | 'Medium' | 'Low' | null;
  sample: string | null;
};

export const DETAIL_PANELS: { value: DetailPanel; label: string }[] = [
  { value: 'fix', label: 'Fix' },
  { value: 'details', label: 'Details' },
];

export const LOG_STALE_STEPS = [
  'Confirm the server is still writing latest.log',
  'Check disk space and file permissions on the logs folder',
  'Restart the server if logging has stalled',
];

export function severityTone(severity: string): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (severity === 'critical') return 'danger';
  if (severity === 'warning') return 'warn';
  if (severity === 'info') return 'info';
  return 'neutral';
}

/** Soft provenance for Details only — not used for grouping. */
export function sourceLabel(source: string): string {
  const m: Record<string, string> = {
    live: 'Live peek',
    ops: 'Scan',
    event: 'Event',
    catchup: 'Install',
    report: 'Install',
    updates: 'Update',
    crashes: 'Crash',
    backups: 'Backup',
    boot: 'Boot',
  };
  return m[source] || 'Watchtower';
}

export function confidenceFromSteps(steps: string[], hints: string[] = []): 'High' | 'Medium' | 'Low' {
  const n = steps.length + (steps.length ? 0 : hints.length);
  if (n >= 3) return 'High';
  if (n >= 1) return 'Medium';
  return 'Low';
}

export function confidenceTone(label: string | null): 'ok' | 'warn' | 'neutral' {
  if (label === 'High') return 'ok';
  if (label === 'Medium') return 'warn';
  return 'neutral';
}

/** Unwrap GET/POST `/api/issues/acks` payloads into the id→record map helpers expect. */
export function acksMapFromResponse(data: unknown): Record<string, unknown> {
  const root = asRecord(data);
  if ('acknowledged_issues' in root) {
    return asRecord(root.acknowledged_issues);
  }
  // Fixture / legacy: already a flat map of ack keys
  return root;
}

export function isIssueAcked(acks: Record<string, unknown>, key: string): boolean {
  if (!key) return false;
  return acks[key] != null;
}

export function ackAt(acks: Record<string, unknown>, key: string): string | null {
  const row = asRecord(acks[key]);
  return str(row.ackedAt, str(row.at)) || null;
}

export function bareIssueId(keyOrId: string): string {
  if (keyOrId.startsWith('issue:')) return keyOrId.slice(6);
  return keyOrId;
}

export function formatAge(iso: string | null): string | null {
  if (!iso) return null;
  return timeAgo(iso);
}

function normalizeSeverity(raw: string): IssueSeverity {
  const s = raw.toLowerCase();
  if (s === 'critical' || s === 'error' || s === 'danger') return 'critical';
  if (s === 'info') return 'info';
  return 'warning';
}

/** Active queue groups by severity only. */
export function bandForSeverity(severity: IssueSeverity): IssueBand {
  return severity;
}

export function fromLagEntry(
  entry: Record<string, unknown>,
  ackKey: string,
  ackedAt: string | null = null,
): IssueItem {
  const hints = asArray<string>(entry.hints).map(String);
  const severity = normalizeSeverity(str(entry.severity, 'warning'));
  return {
    key: ackKey,
    kind: 'lag',
    source: 'live',
    band: bandForSeverity(severity),
    severity,
    title: str(entry.title, 'Lag incident'),
    summary: str(entry.narrative),
    detail: null,
    steps: [],
    hints,
    primaryAction: { label: 'Open Live', tab: 'live' },
    when: str(entry.started_at, str(entry.at, str(entry.time))) || null,
    ackedAt,
    issueId: null,
    metrics: asRecord(entry.metrics),
    confidence: confidenceFromSteps([], hints),
    sample: null,
  };
}

export function fromModEntry(
  entry: Record<string, unknown>,
  ackKey: string,
  ackedAt: string | null = null,
): IssueItem {
  const steps = asArray<string>(entry.fix_steps).map(String);
  const hints = asArray<string>(entry.hints).map(String);
  const severity = normalizeSeverity(str(entry.severity, 'warning'));
  return {
    key: ackKey,
    kind: 'mod',
    source: 'live',
    band: bandForSeverity(severity),
    severity,
    title: str(entry.title, 'Mod issue'),
    summary: str(entry.narrative),
    detail: null,
    steps,
    hints,
    primaryAction: {
      label: 'Open Mods',
      tab: 'mods',
      params: {
        view: 'overview',
        ...(str(entry.mod_id) ? { mod: str(entry.mod_id) } : {}),
      },
    },
    when: str(entry.at, str(entry.time)) || null,
    ackedAt,
    issueId: null,
    metrics: null,
    confidence: confidenceFromSteps(steps, hints),
    sample: null,
  };
}

export function fromLogStale(
  entry: Record<string, unknown>,
  ackedAt: string | null = null,
): IssueItem {
  return {
    key: 'log_stale',
    kind: 'log_stale',
    source: 'live',
    band: 'warning',
    severity: 'warning',
    title: str(entry.title, 'Log output stale'),
    summary: str(entry.narrative, 'Server log has not been written recently.'),
    detail: null,
    steps: LOG_STALE_STEPS,
    hints: [],
    primaryAction: { label: 'Open Logs', tab: 'logs' },
    when: str(entry.at, str(entry.checked_at, str(entry.last_mtime))) || null,
    ackedAt,
    issueId: null,
    metrics: null,
    confidence: 'High',
    sample: null,
  };
}

export function fromLedgerRow(
  row: Record<string, unknown>,
  ackedAt: string | null = null,
): IssueItem {
  const id = str(row.id, str(row.key));
  const key = id.startsWith('issue:') ? id : `issue:${id}`;
  const severity = normalizeSeverity(str(row.severity, 'warning'));
  const steps = asArray<string>(row.fix_steps).map(String);
  const source = str(row.source, 'ops');
  let primaryAction: PrimaryAction | null = null;
  if (id.includes('DISK') || id.includes('BACKUP')) {
    primaryAction = { label: 'Open Backups', tab: 'backups' };
  } else if (id.includes('MOD') || id.includes('CLIENT')) {
    const modId = str(row.mod_id);
    primaryAction = {
      label: 'Open Mods',
      tab: 'mods',
      params: { view: 'overview', ...(modId ? { mod: modId } : {}) },
    };
  } else if (id.includes('CONFIG')) {
    primaryAction = { label: 'Open Insights', tab: 'insights', params: { view: 'configs' } };
  } else if (severity === 'critical' || id.includes('LAG') || id.includes('TPS') || id.includes('MSPT')) {
    primaryAction = { label: 'Open Live', tab: 'live' };
  }

  return {
    key,
    kind: 'issue',
    source: source === 'catchup' ? 'catchup' : source === 'report' ? 'report' : source || 'ops',
    band: bandForSeverity(severity),
    severity,
    title: str(row.message, str(row.title, id)),
    summary: str(row.narrative, str(row.detail)),
    detail: str(row.detail) || null,
    steps,
    hints: [],
    primaryAction,
    when: str(row.last_seen, str(row.first_seen)) || null,
    ackedAt,
    issueId: id,
    metrics: null,
    confidence: steps.length ? confidenceFromSteps(steps) : null,
    sample: null,
  };
}

export function bootIssuesFromStartup(ops: Record<string, unknown>): IssueItem[] {
  const startup = asRecord(ops.startup_profile);
  const doneAt = str(startup.done_at, str(ops.updated_at)) || null;
  const out: IssueItem[] = [];

  asArray<Record<string, unknown>>(startup.warnings).forEach((w, i) => {
    const kind = str(w.id, 'warn');
    const modId = str(w.mod_id);
    const title = str(w.title, kind);
    const steps = [str(w.detail)].filter(Boolean);
    const sample = str(w.sample);
    if (sample) steps.push(`Sample: ${sample}`);
    const link = str(w.link);
    let primaryAction: PrimaryAction | null = { label: 'Open Logs', tab: 'logs' };
    if (link === 'mods') {
      steps.push('Open Mods to inspect the jar / load order.');
      primaryAction = {
        label: 'Open Mods',
        tab: 'mods',
        params: { view: 'overview', ...(modId ? { mod: modId } : {}) },
      };
    } else if (link === 'configs') {
      steps.push('Open Insights → Configs for related settings.');
      primaryAction = { label: 'Open Insights', tab: 'insights', params: { view: 'configs' } };
    } else {
      steps.push('Check latest.log around Done! for the full stack.');
    }
    out.push({
      key: `BOOT_WARN:${kind}:${i}`,
      kind: 'boot_warn',
      source: 'boot',
      band: 'warning',
      severity: 'warning',
      title: modId ? `${title} · ${modId}` : title,
      summary: str(w.detail),
      detail: str(w.detail) || null,
      steps,
      hints: [],
      primaryAction,
      when: doneAt,
      ackedAt: null,
      issueId: null,
      metrics: null,
      confidence: confidenceFromSteps(steps),
      sample: sample || null,
    });
  });

  asArray<Record<string, unknown>>(startup.errors).forEach((e, i) => {
    const modId = str(e.mod_id, 'unknown');
    const kind = str(e.kind, 'mod_error');
    const title = str(e.title, kind);
    const blocking = Boolean(e.blocking);
    const steps = [
      str(e.detail),
      blocking
        ? 'This blocked a clean boot — remove or replace the jar, then restart.'
        : 'Non-blocking — server reached Done!, but fix or remove the jar before the next restart.',
      'Open Mods for jar metadata and recent log errors.',
    ].filter(Boolean);
    out.push({
      key: `BOOT_ERR:${modId}:${kind}:${i}`,
      kind: 'boot_err',
      source: 'boot',
      band: bandForSeverity(blocking ? 'critical' : 'warning'),
      severity: blocking ? 'critical' : 'warning',
      title: `${modId} — ${title}`,
      summary: str(e.detail),
      detail: str(e.detail) || null,
      steps,
      hints: [],
      primaryAction: {
        label: 'Open Mods',
        tab: 'mods',
        params: {
          view: 'overview',
          ...(modId && modId !== 'unknown' ? { mod: modId } : {}),
        },
      },
      when: doneAt,
      ackedAt: null,
      issueId: null,
      metrics: null,
      confidence: confidenceFromSteps(steps),
      sample: null,
    });
  });

  return out;
}

export function crashPointerFromOps(ops: Record<string, unknown>): IssueItem | null {
  const crashes = asRecord(ops.crashes);
  const n = num(crashes.unreviewed_groups, num(crashes.unreviewed, 0));
  if (n <= 0) return null;
  const latest = asRecord(crashes.latest);
  const label = str(latest.display_label, 'Crash groups need review');
  return {
    key: 'crash:unreviewed',
    kind: 'crash',
    source: 'crashes',
    band: 'critical',
    severity: 'critical',
    title: `${n} crash group${n === 1 ? '' : 's'} need review`,
    summary: label,
    detail: 'Open Crashes for the numbered fix plan — Issues only tracks open review.',
    steps: [],
    hints: ['Crash forensics and Fix/Evidence live on the Crashes tab.'],
    primaryAction: { label: 'Open Crashes', tab: 'crashes', params: { view: 'review' } },
    when: str(crashes.scanned_at) || null,
    ackedAt: null,
    issueId: null,
    metrics: null,
    confidence: null,
    sample: null,
  };
}

export function buildActiveItems(input: {
  peek: Record<string, unknown>;
  ops: Record<string, unknown>;
  facts: Record<string, unknown>;
  acks: Record<string, unknown>;
  suppressedIds: Set<string>;
}): IssueItem[] {
  const { peek, ops, facts, acks, suppressedIds } = input;
  const items: IssueItem[] = [];
  const seen = new Set<string>();

  const push = (item: IssueItem) => {
    if (seen.has(item.key)) return;
    if (item.issueId && suppressedIds.has(item.issueId)) return;
    if (suppressedIds.has(bareIssueId(item.key))) return;
    if (isIssueAcked(acks, item.key)) return;
    seen.add(item.key);
    items.push(item);
  };

  for (const e of asArray<Record<string, unknown>>(peek.lag_issues)) {
    if (e.resolved) continue;
    const key = `lag:${str(e.incident_id, str(e.id))}`;
    if (!str(e.incident_id, str(e.id))) continue;
    push(fromLagEntry(e, key));
  }
  for (const e of asArray<Record<string, unknown>>(peek.mod_issues)) {
    if (e.resolved) continue;
    const key = `mod:${str(e.mod_id, str(e.id))}`;
    if (!str(e.mod_id, str(e.id))) continue;
    push(fromModEntry(e, key));
  }
  const logStale = asRecord(peek.log_stale);
  if (logStale.active || logStale.stale) {
    push(fromLogStale(logStale));
  }

  const crash = crashPointerFromOps(ops);
  if (crash) push(crash);

  for (const row of asArray<Record<string, unknown>>(ops.issues_live)) {
    const status = str(row.status, 'open').toLowerCase();
    if (status === 'resolved' || status === 'reviewed' || status === 'suppressed') continue;
    push(fromLedgerRow(row));
  }

  for (const b of bootIssuesFromStartup(ops)) push(b);

  const factsIssues = asArray<Record<string, unknown>>(
    asRecord(facts.issues).entries ?? facts.issues,
  );
  for (const f of factsIssues) {
    const id = str(f.id, str(f.key));
    if (!id) continue;
    const key = id.startsWith('issue:') ? id : `issue:${id}`;
    if (seen.has(key)) continue;
    push(
      fromLedgerRow({
        ...f,
        id,
        key: id,
        source: str(f.source, 'report'),
        message: str(f.message, str(f.title, id)),
        severity: str(f.severity, 'info'),
        fix_steps: asArray(f.evidence).length ? asArray(f.evidence) : asArray(f.fix_steps),
      }),
    );
  }

  const rank = (s: IssueSeverity) => (s === 'critical' ? 0 : s === 'warning' ? 1 : 2);
  items.sort((a, b) => {
    const br = rank(a.severity) - rank(b.severity);
    if (br !== 0) return br;
    return str(b.when).localeCompare(str(a.when));
  });
  return items;
}

export function buildReviewedItems(input: {
  peek: Record<string, unknown>;
  ops: Record<string, unknown>;
  facts: Record<string, unknown>;
  acks: Record<string, unknown>;
}): IssueItem[] {
  const { peek, ops, facts, acks } = input;
  const items: IssueItem[] = [];
  const ackKeys = Object.keys(acks);

  for (const e of asArray<Record<string, unknown>>(peek.lag_issues)) {
    const key = `lag:${str(e.incident_id, str(e.id))}`;
    if (!isIssueAcked(acks, key)) continue;
    items.push({ ...fromLagEntry(e, key, ackAt(acks, key)), band: 'reviewed' });
  }
  for (const e of asArray<Record<string, unknown>>(peek.mod_issues)) {
    const key = `mod:${str(e.mod_id, str(e.id))}`;
    if (!isIssueAcked(acks, key)) continue;
    items.push({ ...fromModEntry(e, key, ackAt(acks, key)), band: 'reviewed' });
  }
  if (isIssueAcked(acks, 'log_stale')) {
    const logStale = asRecord(peek.log_stale);
    items.push({
      ...fromLogStale(
        Object.keys(logStale).length ? logStale : { title: 'Log output stale', narrative: 'Marked reviewed.' },
        ackAt(acks, 'log_stale'),
      ),
      band: 'reviewed',
    });
  }

  const byKey = new Map<string, IssueItem>();
  for (const row of asArray<Record<string, unknown>>(ops.issues_live)) {
    const item = fromLedgerRow(row);
    byKey.set(item.key, item);
  }
  for (const b of bootIssuesFromStartup(ops)) byKey.set(b.key, b);
  for (const f of asArray<Record<string, unknown>>(asRecord(facts.issues).entries ?? facts.issues)) {
    const id = str(f.id, str(f.key));
    if (!id) continue;
    const item = fromLedgerRow({ ...f, id, source: str(f.source, 'report') });
    byKey.set(item.key, item);
  }
  const crash = crashPointerFromOps(ops);
  if (crash) byKey.set(crash.key, crash);

  for (const key of ackKeys) {
    if (items.some((i) => i.key === key)) continue;
    const base = byKey.get(key);
    if (base) {
      items.push({ ...base, band: 'reviewed', ackedAt: ackAt(acks, key) });
    } else {
      items.push({
        key,
        kind: 'issue',
        source: 'ops',
        band: 'reviewed',
        severity: 'info',
        title: key,
        summary: 'Marked reviewed.',
        detail: null,
        steps: [],
        hints: [],
        primaryAction: null,
        when: ackAt(acks, key),
        ackedAt: ackAt(acks, key),
        issueId: bareIssueId(key),
        metrics: null,
        confidence: null,
        sample: null,
      });
    }
  }

  items.sort((a, b) => str(b.ackedAt).localeCompare(str(a.ackedAt)));
  return items;
}

export function filterItems(
  items: IssueItem[],
  opts: { search?: string; source?: string; bootPanel?: string | null },
): IssueItem[] {
  const q = (opts.search || '').trim().toLowerCase();
  const source = opts.source || 'all';
  const panel = opts.bootPanel || null;
  return items.filter((item) => {
    if (source !== 'all' && item.source !== source) return false;
    if (panel === 'boot-warn' && item.source === 'boot' && !item.key.startsWith('BOOT_WARN:')) return false;
    if (panel === 'boot-error' && item.source === 'boot' && !item.key.startsWith('BOOT_ERR:')) return false;
    if (!q) return true;
    const hay = [item.title, item.summary, item.detail, item.key, item.kind, item.issueId, sourceLabel(item.source)]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}

export function groupByBand(items: IssueItem[]) {
  const critical: IssueItem[] = [];
  const warning: IssueItem[] = [];
  const info: IssueItem[] = [];
  for (const item of items) {
    if (item.severity === 'critical') critical.push(item);
    else if (item.severity === 'info') info.push(item);
    else warning.push(item);
  }
  return [
    { key: 'critical' as const, label: 'Critical', tone: 'danger' as const, items: critical },
    { key: 'warning' as const, label: 'Warning', tone: 'warn' as const, items: warning },
    { key: 'info' as const, label: 'Info', tone: 'info' as const, items: info },
  ].filter((g) => g.items.length > 0);
}

export function resolveDeepLinkView(
  issueKey: string | undefined,
  active: IssueItem[],
  reviewed: IssueItem[],
  suppressedIds: Set<string>,
): 'active' | 'reviewed' | 'tools' {
  if (!issueKey) return 'active';
  if (findIssue(active, issueKey)) return 'active';
  if (findIssue(reviewed, issueKey)) return 'reviewed';
  const bare = bareIssueId(issueKey);
  if (suppressedIds.has(bare) || suppressedIds.has(issueKey)) return 'tools';
  return 'active';
}

/** Match route `issue=` against item key, bare id, or `issue:` prefix. */
export function findIssue(items: IssueItem[], routeIssue: string | null | undefined): IssueItem | undefined {
  if (!routeIssue) return undefined;
  return items.find(
    (item) =>
      item.key === routeIssue ||
      item.issueId === routeIssue ||
      item.key === `issue:${routeIssue}` ||
      bareIssueId(item.key) === routeIssue,
  );
}

export function canonicalIssueParam(item: IssueItem): string {
  return item.key;
}

export function worstStatusWord(active: IssueItem[]): { word: string; tone: 'ok' | 'warn' | 'danger' } {
  if (!active.length) return { word: 'Clear', tone: 'ok' };
  if (active.some((i) => i.severity === 'critical')) return { word: 'Critical', tone: 'danger' };
  if (active.some((i) => i.severity === 'warning')) return { word: 'Warnings', tone: 'warn' };
  return { word: 'Info only', tone: 'ok' };
}
