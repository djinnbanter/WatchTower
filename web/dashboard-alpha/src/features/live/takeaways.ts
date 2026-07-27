import { isIssueAcked } from '@/features/issues/helpers';
import { asArray, asRecord, str } from '@/lib/utils';

/**
 * Live "Active alerts" / takeaways from ops right_now signals.
 * Hide signals whose backing Issues items are all reviewed.
 */
export function filterLiveTakeaways(
  signals: Record<string, unknown>[],
  acks: Record<string, unknown>,
  ops: Record<string, unknown> = {},
): Record<string, unknown>[] {
  const lagEntries = asArray<Record<string, unknown>>(
    asRecord(ops.lag_issues).entries ?? ops.lag_issues,
  ).filter((e) => !e.resolved);
  const modEntries = asArray<Record<string, unknown>>(
    asRecord(ops.mod_issues).entries ?? ops.mod_issues,
  ).filter((e) => !e.resolved);

  const openLag = lagEntries.filter((e) => {
    const id = str(e.incident_id, str(e.id));
    return id && !isIssueAcked(acks, `lag:${id}`);
  });
  const openMods = modEntries.filter((e) => {
    const id = str(e.mod_id, str(e.id));
    return id && !isIssueAcked(acks, `mod:${id}`);
  });
  const logStaleOpen =
    !!asRecord(ops.log_stale).active && !isIssueAcked(acks, 'log_stale');

  return signals.filter((s) => {
    const type = str(s.type).toLowerCase();
    if (type === 'lag') return openLag.length > 0;
    if (type === 'mod_errors' || type === 'mod_issues') return openMods.length > 0;
    if (type === 'log_stale') return logStaleOpen;
    return true;
  });
}

/** Open issues_live rows for Live takeaways (excludes reviewed/resolved). */
export function openLiveIssueTakeaways(
  ops: Record<string, unknown>,
  acks: Record<string, unknown> = {},
): Record<string, unknown>[] {
  return asArray<Record<string, unknown>>(ops.issues_live).filter((row) => {
    const status = str(row.status, 'open').toLowerCase();
    if (status !== 'open') return false;
    const key = str(row.key, str(row.id));
    const issueKey = key.startsWith('issue:') ? key : key ? `issue:${key}` : '';
    if (issueKey && isIssueAcked(acks, issueKey)) return false;
    if (key && isIssueAcked(acks, key)) return false;
    return true;
  });
}
