import { useEffect, useMemo, useState } from 'react';
import { Activity, Copy } from '@/ui/icons';
import { FadeIn, GlareIcon } from '@/ui/motion';
import { Button, EmptyState, StatusPill, useCappedList } from '@/ui/patterns';
import { timeAgo } from '@/lib/utils';
import {
  kindLabel,
  type JoinClinicEntry,
  type JoinClinicMod,
} from './join-clinic-helpers';
import {
  buildSessionActivityItems,
  type SessionActivityItem,
  type SessionActivityKind,
} from './session-activity-helpers';

const ACTIVITY_CAP = 12;

type FilterId = 'all' | SessionActivityKind;

type ChipTone = 'missing' | 'wrong' | 'extra';

function kindTone(kind: string): 'warn' | 'info' | 'neutral' {
  if (kind === 'mismatched_channel' || kind === 'missing_mod' || kind === 'wrong_version') {
    return 'warn';
  }
  return 'info';
}

function verbFor(kind: SessionActivityKind): string {
  if (kind === 'join') return 'Joined';
  if (kind === 'leave') return 'Left';
  return "Couldn't join";
}

function ModChip({ mod, tone }: { mod: JoinClinicMod; tone: ChipTone }) {
  return (
    <span className={`ss-activity-mod ss-activity-mod--${tone}`}>
      <span className="ss-activity-mod__name">{mod.label}</span>
      {mod.detail ? <span className="ss-activity-mod__meta">{mod.detail}</span> : null}
    </span>
  );
}

function FailedDiff({ entry }: { entry: JoinClinicEntry }) {
  const hasAny =
    entry.missing.length > 0 || entry.wrongVersion.length > 0 || entry.extra.length > 0;
  if (!hasAny) {
    return (
      <p className="ss-activity-expand__empty">
        No named mods on this log line. Copy fix still has whatever we could parse.
      </p>
    );
  }
  return (
    <div className="ss-activity-diff">
      {entry.missing.length > 0 ? (
        <div className="ss-activity-diff__row">
          <span className="ss-activity-diff__label">Missing on client</span>
          <div className="ss-activity-diff__mods">
            {entry.missing.map((m) => (
              <ModChip key={`m-${m.modId}`} mod={m} tone="missing" />
            ))}
          </div>
        </div>
      ) : null}
      {entry.wrongVersion.length > 0 ? (
        <div className="ss-activity-diff__row">
          <span className="ss-activity-diff__label">Wrong version</span>
          <div className="ss-activity-diff__mods">
            {entry.wrongVersion.map((m) => (
              <ModChip key={`w-${m.modId}`} mod={m} tone="wrong" />
            ))}
          </div>
        </div>
      ) : null}
      {entry.extra.length > 0 ? (
        <div className="ss-activity-diff__row">
          <span className="ss-activity-diff__label">Extra on client</span>
          <div className="ss-activity-diff__mods">
            {entry.extra.map((m) => (
              <ModChip key={`e-${m.modId}`} mod={m} tone="extra" />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

async function copyFix(entry: JoinClinicEntry) {
  try {
    await navigator.clipboard.writeText(entry.fixCopy);
  } catch {
    /* ignore */
  }
}

function ActivityRow({
  item,
  expanded,
  onToggle,
  copiedKey,
  onCopied,
}: {
  item: SessionActivityItem;
  expanded: boolean;
  onToggle: () => void;
  copiedKey: string | null;
  onCopied: (key: string) => void;
}) {
  const clinic = item.clinic;
  const isFailed = item.kind === 'failed' && clinic;

  return (
    <div className={`ss-activity-row${isFailed ? ' ss-activity-row--failed' : ''}${expanded ? ' is-open' : ''}`}>
      {isFailed ? (
        <button type="button" className="ss-activity-row__main" onClick={onToggle} aria-expanded={expanded}>
          <span className="ss-activity-row__name">{item.player}</span>
          <span className="ss-activity-row__verb">{verbFor(item.kind)}</span>
          <StatusPill tone={kindTone(clinic.kind)}>{kindLabel(clinic.kind)}</StatusPill>
          <span className="ss-activity-row__when">{item.time ? timeAgo(item.time) : '—'}</span>
        </button>
      ) : (
        <div className="ss-activity-row__main">
          <span className="ss-activity-row__name">{item.player}</span>
          <span className="ss-activity-row__verb">{verbFor(item.kind)}</span>
          <span className="ss-activity-row__when">{item.time ? timeAgo(item.time) : '—'}</span>
        </div>
      )}

      {isFailed && expanded ? (
        <div className="ss-activity-expand">
          <FailedDiff entry={clinic} />
          <Button
            kind="ghost"
            disabled={!clinic.fixCopy}
            onClick={() => {
              void copyFix(clinic).then(() => onCopied(clinic.key));
            }}
          >
            <Copy size={12} />
            {copiedKey === clinic.key ? 'Copied' : 'Copy fix'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function SessionActivityPlate({ ops }: { ops: Record<string, unknown> }) {
  const all = useMemo(() => buildSessionActivityItems(ops), [ops]);
  const [filter, setFilter] = useState<FilterId>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === 'all') return all;
    return all.filter((i) => i.kind === filter);
  }, [all, filter]);

  const list = useCappedList(filtered, ACTIVITY_CAP);

  useEffect(() => {
    const newestFailed = all.find((i) => i.kind === 'failed');
    if (filter === 'failed' && newestFailed) {
      setExpandedId(newestFailed.id);
      return;
    }
    setExpandedId((prev) => {
      if (prev && filtered.some((i) => i.id === prev)) return prev;
      return null;
    });
  }, [all, filter, filtered]);

  const failedCount = all.filter((i) => i.kind === 'failed').length;

  return (
    <FadeIn className="ss-split__col">
      <div className="ss-plate" role="region" aria-label="Session activity">
        <div className="ss-plate__head">
          <div>
            <div className="ss-plate__title">
              <GlareIcon icon={Activity} tone="info" size={15} className="h-8 w-8 rounded-[var(--radius-wt)]" />
              <h3>Session activity</h3>
            </div>
            <p className="ss-plate__hint">
              Joins, leaves, and pack-sync rejects from the live log.
            </p>
          </div>
          {failedCount > 0 ? (
            <StatusPill tone="warn">{failedCount} failed</StatusPill>
          ) : all.length ? (
            <StatusPill tone="neutral">{all.length} recent</StatusPill>
          ) : null}
        </div>

        <div className="ss-plate__body">
          {all.length ? (
            <>
              <div className="ss-pills ss-activity-filters" role="group" aria-label="Activity filter">
                {(
                  [
                    ['all', 'All'],
                    ['join', 'Joined'],
                    ['leave', 'Left'],
                    ['failed', 'Failed'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`ss-pill${filter === id ? ' is-active' : ''}`}
                    onClick={() => setFilter(id)}
                    aria-pressed={filter === id}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {filtered.length ? (
                <>
                  <div className="ss-activity-list">
                    {list.shown.map((item) => (
                      <ActivityRow
                        key={item.id}
                        item={item}
                        expanded={expandedId === item.id}
                        onToggle={() =>
                          setExpandedId((cur) => (cur === item.id ? null : item.id))
                        }
                        copiedKey={copiedKey}
                        onCopied={(key) => {
                          setCopiedKey(key);
                          window.setTimeout(
                            () => setCopiedKey((k) => (k === key ? null : k)),
                            1500,
                          );
                        }}
                      />
                    ))}
                  </div>
                  {list.more > 0 ? (
                    <Button kind="ghost" className="ss-show-more" onClick={list.expand}>
                      Show more ({list.more} more)
                    </Button>
                  ) : null}
                  {list.expanded && filtered.length > ACTIVITY_CAP ? (
                    <Button kind="ghost" className="ss-show-more" onClick={list.collapse}>
                      Show less
                    </Button>
                  ) : null}
                </>
              ) : (
                <EmptyState title={`No ${filter} events`}>
                  Try All, or wait for the next log scan.
                </EmptyState>
              )}
            </>
          ) : (
            <EmptyState title="No join activity yet">
              Joins, leaves, and pack-sync rejects appear once Watching reads the live log.
            </EmptyState>
          )}
        </div>
      </div>
    </FadeIn>
  );
}
