export type AuditRow = {
  id: string;
  at: string;
  event: string;
  actor: string;
  role: string | null;
  target: string | null;
  detail: string | null;
  ip: string | null;
  result: string;
};

export type AuditTone = 'neutral' | 'ok' | 'warn' | 'danger' | 'info';

const SENTENCES: Record<string, (r: AuditRow) => string> = {
  login_ok: (r) => `${r.actor} signed in`,
  login_failed: (r) => `Failed sign-in for ${r.actor}`,
  logout: (r) => `${r.actor} signed out`,
  password_changed: (r) => `${r.actor} changed their password`,
  totp_enabled: (r) => `${r.actor} turned on two-factor`,
  totp_disabled: (r) => `${r.actor} turned off two-factor`,
  recovery_codes_regenerated: (r) => `${r.actor} generated new recovery codes`,
  settings_changed: (r) => `${r.actor} changed settings`,
  issue_acked: (r) => `${r.actor} acknowledged ${r.target ?? 'an issue'}`,
  issue_unacked: (r) => `${r.actor} reopened ${r.target ?? 'an issue'}`,
  issue_suppressed: (r) => `${r.actor} suppressed ${r.target ?? 'a rule'}`,
  issue_unsuppressed: (r) => `${r.actor} un-suppressed ${r.target ?? 'a rule'}`,
  crash_acked: (r) => `${r.actor} acknowledged crash ${r.target ?? ''}`.trim(),
  crash_unacked: (r) => `${r.actor} reopened crash ${r.target ?? ''}`.trim(),
  account_created: (r) => `${r.actor} added the account ${r.target ?? ''}`.trim(),
  account_role_changed: (r) => `${r.actor} changed ${r.target ?? 'an account'}'s role`,
  account_disabled: (r) => `${r.actor} disabled ${r.target ?? 'an account'}`,
  account_enabled: (r) => `${r.actor} re-enabled ${r.target ?? 'an account'}`,
  account_deleted: (r) => `${r.actor} removed ${r.target ?? 'an account'}`,
  account_password_reset: (r) => `${r.actor} reset the password for ${r.target ?? 'an account'}`,
  mod_disabled: (r) => `${r.actor} disabled jar ${r.target ?? ''}`.trim(),
  mod_enabled: (r) => `${r.actor} enabled jar ${r.target ?? ''}`.trim(),
  backup_verified: (r) => `${r.actor} verified backup ${r.target ?? ''}`.trim(),
  backup_test_restore_ok: (r) => `${r.actor} test-restored ${r.target ?? ''}`.trim(),
  backup_test_restore_cleanup: (r) => `${r.actor} cleaned test restore ${r.target ?? ''}`.trim(),
  api_write: (r) => `${r.actor} ran ${r.target ?? 'an action'}`,
  write_denied: (r) => `${r.actor} was blocked from ${r.target ?? 'a change'}`,
};

function optStr(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t : null;
}

export function parseAuditRows(payload: Record<string, unknown>): AuditRow[] {
  const entries = payload.entries;
  if (!Array.isArray(entries)) return [];
  const rows: AuditRow[] = [];
  for (let i = 0; i < entries.length; i++) {
    const raw = entries[i];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const rec = raw as Record<string, unknown>;
    const at = typeof rec.at === 'string' ? rec.at : '';
    const event = typeof rec.event === 'string' ? rec.event : '';
    if (!at || !event) continue;
    const actor = typeof rec.actor === 'string' && rec.actor.trim() ? rec.actor.trim() : 'unknown';
    const result = typeof rec.result === 'string' && rec.result.trim() ? rec.result.trim() : 'ok';
    rows.push({
      id: `${at}#${i}`,
      at,
      event,
      actor,
      role: optStr(rec.role),
      target: optStr(rec.target),
      detail: optStr(rec.detail),
      ip: optStr(rec.ip),
      result,
    });
  }
  return rows;
}

export function describeAuditEvent(row: AuditRow): string {
  const fn = SENTENCES[row.event];
  if (fn) return fn(row);
  return `${row.actor} — ${row.event}`;
}

export function auditTone(row: AuditRow): AuditTone {
  if (row.event === 'write_denied' || row.result === 'denied') return 'danger';
  if (row.event === 'login_failed' || row.result === 'failed') return 'warn';
  return 'neutral';
}

export function groupAuditRowsByDay(
  rows: AuditRow[],
  timeZone: string,
): { day: string; rows: AuditRow[] }[] {
  const dayFmt = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const groups: { day: string; rows: AuditRow[] }[] = [];
  const indexByDay = new Map<string, number>();

  for (const row of rows) {
    const d = new Date(row.at);
    const day = Number.isNaN(d.getTime()) ? 'Unknown day' : dayFmt.format(d);
    const idx = indexByDay.get(day);
    if (idx === undefined) {
      indexByDay.set(day, groups.length);
      groups.push({ day, rows: [row] });
    } else {
      groups[idx].rows.push(row);
    }
  }
  return groups;
}
