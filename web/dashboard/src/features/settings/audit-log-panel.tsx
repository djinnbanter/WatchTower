import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useDashboardTimezone } from '@/app/timezone';
import { FadeIn, Stagger } from '@/ui/motion';
import {
  Button,
  EmptyState,
  ErrorState,
  HeroTabNav,
  Section,
  StatusPill,
  useCappedList,
} from '@/ui/patterns';
import {
  auditTone,
  describeAuditEvent,
  groupAuditRowsByDay,
  parseAuditRows,
  type AuditRow,
  type AuditTone,
} from './audit-log-helpers';

const PAGE_CAP = 30;

type BandId = 'all' | 'changes' | 'accounts' | 'signins' | 'blocked';

const BANDS: { id: BandId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'changes', label: 'Changes' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'signins', label: 'Sign-ins' },
  { id: 'blocked', label: 'Blocked' },
];

const CHANGE_EVENTS = new Set([
  'settings_changed',
  'issue_acked',
  'issue_unacked',
  'issue_suppressed',
  'issue_unsuppressed',
  'crash_acked',
  'crash_unacked',
  'mod_disabled',
  'mod_enabled',
  'mod_swap',
  'mod_batch',
  'mod_install',
  'mod_quarantine',
  'mod_swap_undo',
  'account_capabilities_changed',
  'backup_verified',
  'backup_test_restore_ok',
  'backup_test_restore_cleanup',
  'api_write',
]);

const SIGNIN_EVENTS = new Set([
  'login_ok',
  'login_failed',
  'logout',
  'password_changed',
  'totp_enabled',
  'totp_disabled',
  'recovery_codes_regenerated',
]);

function matchesBand(row: AuditRow, band: BandId): boolean {
  if (band === 'all') return true;
  if (band === 'blocked') return row.event === 'write_denied' || row.result === 'denied';
  if (band === 'accounts') return row.event.startsWith('account_');
  if (band === 'signins') return SIGNIN_EVENTS.has(row.event);
  return CHANGE_EVENTS.has(row.event);
}

function actorInitial(actor: string): string {
  const ch = actor.trim().charAt(0);
  return ch ? ch.toUpperCase() : '?';
}

function formatRailTime(iso: string, timeZone: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(d);
  } catch {
    return '—';
  }
}

function toneLabel(tone: AuditTone): string | null {
  if (tone === 'danger') return 'Blocked';
  if (tone === 'warn') return 'Failed';
  return null;
}

function MetaChips({ row }: { row: AuditRow }) {
  const chips: { key: string; text: string }[] = [];
  if (row.detail) chips.push({ key: 'detail', text: row.detail });
  if (row.ip) chips.push({ key: 'ip', text: row.ip });
  if (row.role) chips.push({ key: 'role', text: row.role });
  if (!chips.length) return null;
  return (
    <div className="st-ledger__meta">
      {chips.map((c) => (
        <span key={c.key} className="st-ledger__chip">
          {c.text}
        </span>
      ))}
    </div>
  );
}

function LedgerRow({ row, timeZone }: { row: AuditRow; timeZone: string }) {
  const tone = auditTone(row);
  const pill = toneLabel(tone);
  return (
    <article className={`st-ledger__row st-ledger__row--${tone}`}>
      <time className="st-ledger__time" dateTime={row.at}>
        {formatRailTime(row.at, timeZone)}
      </time>
      <span className={`st-ledger__who st-ledger__who--${tone}`} aria-hidden>
        {actorInitial(row.actor)}
      </span>
      <div className="st-ledger__text">
        <div className="st-ledger__sentence">
          <span className="st-ledger__action">{describeAuditEvent(row)}</span>
          {pill ? <StatusPill tone={tone}>{pill}</StatusPill> : null}
        </div>
        <MetaChips row={row} />
      </div>
    </article>
  );
}

export function AuditLogPanel() {
  const { resolvedZone } = useDashboardTimezone();
  const [band, setBand] = useState<BandId>('all');
  const staggerOnce = useRef(true);
  const q = useQuery({
    queryKey: ['audit-log', 200],
    queryFn: () => api.auditLog(200),
  });

  const rows = useMemo(
    () => (q.data ? parseAuditRows(q.data) : []),
    [q.data],
  );

  const filtered = useMemo(
    () => rows.filter((r) => matchesBand(r, band)),
    [rows, band],
  );

  const bandCounts = useMemo(() => {
    const counts: Record<BandId, number> = {
      all: rows.length,
      changes: 0,
      accounts: 0,
      signins: 0,
      blocked: 0,
    };
    for (const row of rows) {
      for (const b of BANDS) {
        if (b.id === 'all') continue;
        if (matchesBand(row, b.id)) counts[b.id] += 1;
      }
    }
    return counts;
  }, [rows]);

  const list = useCappedList(filtered, PAGE_CAP);
  const groups = useMemo(
    () => groupAuditRowsByDay(list.shown, resolvedZone),
    [list.shown, resolvedZone],
  );

  const applyStagger = staggerOnce.current && list.shown.length > 0;
  useEffect(() => {
    if (list.shown.length === 0) return;
    const t = window.setTimeout(() => {
      staggerOnce.current = false;
    }, 850);
    return () => window.clearTimeout(t);
  }, [list.shown.length]);

  if (q.isLoading) {
    return (
      <div className="grid gap-3">
        <div className="h-8 w-64 animate-pulse rounded-[var(--radius-wt)] bg-wt-bg2" />
        <div className="h-72 animate-pulse rounded-[var(--radius-wt)] bg-wt-bg2" />
      </div>
    );
  }

  if (q.isError) {
    return (
      <ErrorState title="Couldn't load the audit log">
        {(q.error as Error)?.message || 'Try again in a moment.'}
      </ErrorState>
    );
  }

  const daySections = groups.map((g) => (
    <section key={g.day} className="st-ledger__day" aria-label={g.day}>
      <h3 className="st-ledger__day-label">
        <span>{g.day}</span>
        <span className="st-ledger__day-count">{g.rows.length}</span>
      </h3>
      <div className="st-ledger__day-body">
        {g.rows.map((row) => (
          <LedgerRow key={row.id} row={row} timeZone={resolvedZone} />
        ))}
      </div>
    </section>
  ));

  const body =
    rows.length === 0 ? (
      <EmptyState title="Nothing recorded yet">
        Changes appear here as soon as someone saves a setting or acknowledges an issue.
      </EmptyState>
    ) : (
      <div className="st-ledger">
        <HeroTabNav
          layoutGroupId="st-audit-bands"
          className="st-ledger__bands"
          stretch={false}
          aria-label="Audit log filter"
          value={band}
          items={BANDS.map((b) => ({
            id: b.id,
            label: b.label,
            count: bandCounts[b.id],
          }))}
          onChange={(id) => setBand(id as BandId)}
        />

        {filtered.length === 0 ? (
          <EmptyState title={`No ${BANDS.find((b) => b.id === band)?.label.toLowerCase() ?? ''} events`}>
            Try All, or wait for the next change.
          </EmptyState>
        ) : applyStagger ? (
          <Stagger delayMs={40}>{daySections}</Stagger>
        ) : (
          <div className="st-ledger__days">{daySections}</div>
        )}

        {list.more > 0 ? (
          <Button kind="ghost" className="st-ledger__more" onClick={list.expand}>
            Show more ({list.more} more)
          </Button>
        ) : null}
        {list.expanded && filtered.length > PAGE_CAP ? (
          <Button kind="ghost" className="st-ledger__more" onClick={list.collapse}>
            Show less
          </Button>
        ) : null}
      </div>
    );

  return (
    <FadeIn>
      <Section
        title="Audit log"
        hint="Who changed what, and who tried. Keeps the newest 2,000 entries for 90 days."
      >
        {body}
      </Section>
    </FadeIn>
  );
}
