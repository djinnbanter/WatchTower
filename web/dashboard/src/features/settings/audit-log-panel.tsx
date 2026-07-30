import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useDashboardTimezone } from '@/app/timezone';
import { FadeIn, Stagger } from '@/ui/motion';
import { Button, EmptyState, ErrorState, Section, StatusPill, useCappedList } from '@/ui/patterns';
import {
  auditTone,
  describeAuditEvent,
  groupAuditRowsByDay,
  parseAuditRows,
  type AuditRow,
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

function toneLabel(tone: ReturnType<typeof auditTone>): string | null {
  if (tone === 'danger') return 'Blocked';
  if (tone === 'warn') return 'Failed';
  return null;
}

function rowMeta(row: AuditRow): string | null {
  const bits: string[] = [];
  if (row.detail) bits.push(row.detail);
  if (row.ip) bits.push(row.ip);
  if (row.role) bits.push(row.role);
  return bits.length ? bits.join(' · ') : null;
}

function LedgerRow({ row, timeZone }: { row: AuditRow; timeZone: string }) {
  const tone = auditTone(row);
  const pill = toneLabel(tone);
  const meta = rowMeta(row);
  return (
    <article className="st-ledger__row">
      <time className="st-ledger__time" dateTime={row.at}>
        {formatRailTime(row.at, timeZone)}
      </time>
      <span className="st-ledger__who" aria-hidden>
        {actorInitial(row.actor)}
      </span>
      <div className="st-ledger__text">
        <div className="st-ledger__sentence">
          <span>{describeAuditEvent(row)}</span>
          {pill ? <StatusPill tone={tone}>{pill}</StatusPill> : null}
        </div>
        {meta ? <div className="st-ledger__meta">{meta}</div> : null}
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
        <div className="h-8 w-64 animate-pulse rounded-xl bg-wt-bg2" />
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

  const body =
    rows.length === 0 ? (
      <EmptyState title="Nothing recorded yet">
        Changes appear here as soon as someone saves a setting or acknowledges an issue.
      </EmptyState>
    ) : (
      <div className="st-ledger">
        <div className="st-ledger__bands" role="tablist" aria-label="Audit log filter">
          {BANDS.map((b) => (
            <button
              key={b.id}
              type="button"
              role="tab"
              aria-selected={band === b.id}
              className="st-ledger__band"
              onClick={() => setBand(b.id)}
            >
              {b.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState title={`No ${BANDS.find((b) => b.id === band)?.label.toLowerCase() ?? ''} events`}>
            Try All, or wait for the next change.
          </EmptyState>
        ) : applyStagger ? (
          <Stagger delayMs={40}>
            {groups.map((g) => (
              <section key={g.day} className="st-ledger__day" aria-label={g.day}>
                <h3 className="st-ledger__day-label">{g.day}</h3>
                {g.rows.map((row) => (
                  <LedgerRow key={row.id} row={row} timeZone={resolvedZone} />
                ))}
              </section>
            ))}
          </Stagger>
        ) : (
          <div>
            {groups.map((g) => (
              <section key={g.day} className="st-ledger__day" aria-label={g.day}>
                <h3 className="st-ledger__day-label">{g.day}</h3>
                {g.rows.map((row) => (
                  <LedgerRow key={row.id} row={row} timeZone={resolvedZone} />
                ))}
              </section>
            ))}
          </div>
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
