import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ChevronRight, Copy, X } from '@/ui/icons';
import { useCanWrite, VIEW_ONLY_TITLE } from '@/app/permissions';
import { navigate } from '@/app/router';
import { api } from '@/api/client';
import { Button, EmptyState, StatusPill } from '@/ui/patterns';
import { asRecord, cn, num, str } from '@/lib/utils';
import {
  DETAIL_PANELS,
  confidenceTone,
  formatAge,
  groupByBand,
  severityTone,
  sourceLabel,
  type DetailPanel,
  type IssueItem,
  type PrimaryAction,
} from './helpers';

type QueueBand = {
  key: string;
  label: string;
  tone: 'danger' | 'warn' | 'info' | 'neutral';
  items: IssueItem[];
};

const SEV_PRIORITY = ['critical', 'warning', 'info'] as const;

function defaultExpanded(bands: QueueBand[]): Set<string> {
  const focus = SEV_PRIORITY.find((key) => bands.some((b) => b.key === key)) ?? bands[0]?.key ?? null;
  return focus ? new Set([focus]) : new Set();
}

function hangDumpBasename(path: string): string {
  const norm = path.replace(/\\/g, '/');
  const parts = norm.split('/');
  return parts[parts.length - 1] || '';
}

function SoftHangDumpPreview({ dumpPath }: { dumpPath: string }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const name = hangDumpBasename(dumpPath);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError('');
      setText('');
      try {
        const res = asRecord(await api.softHangDump(name || undefined));
        if (cancelled) return;
        setText(str(res.content, str(res.text)));
        if (!str(res.content, str(res.text))) {
          setError(str(res.message, 'Hang dump is empty or missing.'));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load hang dump');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [name]);

  return (
    <div className="is-hang-dump">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-wt-text-low">Hang dump</div>
      <p className="is-hang-dump__path">{dumpPath}</p>
      {loading ? <p className="text-sm text-wt-text-low">Loading dump…</p> : null}
      {error ? (
        <p className="text-sm text-wt-warn" role="alert">
          {error}
        </p>
      ) : null}
      {text ? <pre className="is-sample is-sample--hang">{text}</pre> : null}
    </div>
  );
}

function runPrimaryAction(action: PrimaryAction | null) {
  if (!action) return;
  if (action.href) {
    window.open(action.href, '_blank', 'noopener,noreferrer');
    return;
  }
  if (action.tab === 'support') {
    window.dispatchEvent(new Event('wt:open-support'));
    return;
  }
  if (action.tab) {
    navigate({ tab: action.tab, ...(action.params ?? {}) });
  }
}

async function copySteps(item: IssueItem) {
  const lines = (item.steps.length ? item.steps : item.hints).map((s, i) => `${i + 1}. ${s}`);
  const textLines = [`${item.title}`, '', ...lines].join('\n');
  try {
    await navigator.clipboard.writeText(textLines);
  } catch {
    /* ignore */
  }
}

export function IssuesQueue({
  mode,
  items,
  selectedKey,
  onSelect,
  onMarkReviewed,
  onMoveToActive,
  onSuppress,
  marking,
}: {
  mode: 'active' | 'reviewed';
  items: IssueItem[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  onMarkReviewed: (item: IssueItem) => void;
  onMoveToActive: (item: IssueItem) => void;
  onSuppress: (item: IssueItem) => void;
  marking: boolean;
}) {
  const canWrite = useCanWrite();
  const [panel, setPanel] = useState<DetailPanel>('fix');
  const [expandedBands, setExpandedBands] = useState<Set<string>>(new Set());
  const [bandExpanded, setBandExpanded] = useState<Record<string, boolean>>({});
  const listRef = useRef<HTMLDivElement>(null);

  const bands = useMemo(() => (mode === 'active' ? groupByBand(items) : null), [items, mode]);
  const selected = items.find((i) => i.key === selectedKey) ?? null;
  const bandKeys = bands?.map((b) => b.key).join('|') ?? '';

  useEffect(() => {
    setPanel('fix');
  }, [selectedKey]);

  useEffect(() => {
    if (!bands?.length) return;
    setExpandedBands(defaultExpanded(bands));
    setBandExpanded({});
  }, [bandKeys]); // reset when the set of bands changes

  useEffect(() => {
    if (!selected || !bands) return;
    const key = selected.severity === 'critical' || selected.severity === 'info' ? selected.severity : 'warning';
    setExpandedBands((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, [selectedKey, selected, bands]);

  const toggleBand = (key: string) => {
    setExpandedBands((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderRow = (item: IssueItem) => (
    <button
      key={item.key}
      type="button"
      className={`is-row${selectedKey === item.key ? ' is-selected' : ''}`}
      onClick={() => onSelect(item.key)}
    >
      <div className="is-row__top">
        <h4 className="is-row__title">{item.title}</h4>
        <div className="is-row__meta">
          <StatusPill tone={severityTone(item.severity)}>{item.severity}</StatusPill>
          {formatAge(mode === 'reviewed' ? item.ackedAt : item.when) ? (
            <span className="text-xs text-wt-text-low">
              {formatAge(mode === 'reviewed' ? item.ackedAt : item.when)}
            </span>
          ) : null}
        </div>
      </div>
      {item.summary ? <p className="is-row__cause">{item.summary}</p> : null}
    </button>
  );

  return (
    <div className="is-split">
      <div className="is-list" ref={listRef}>
        {mode === 'active' && bands ? (
          bands.length ? (
            <>
              {bands.map((band) => {
                const open = expandedBands.has(band.key);
                return (
                  <div
                    key={band.key}
                    data-band-key={band.key}
                    className={`is-band is-band--${band.key}${open ? '' : ' is-collapsed'}`}
                  >
                    <button
                      type="button"
                      className="is-band__header"
                      aria-expanded={open}
                      onClick={() => toggleBand(band.key)}
                    >
                      <span className="is-band__lead">
                        <ChevronRight
                          size={14}
                          className={cn('is-band__chevron', open && 'is-open')}
                          aria-hidden
                        />
                        <span className="is-band__label">{band.label}</span>
                      </span>
                      <StatusPill tone={band.tone}>{band.items.length}</StatusPill>
                    </button>
                    {open ? (
                      <div className="is-band__items">
                        {(bandExpanded[band.key] ? band.items : band.items.slice(0, 8)).map(renderRow)}
                        {band.items.length > 8 && !bandExpanded[band.key] ? (
                          <button
                            type="button"
                            className="is-band__more"
                            onClick={() => setBandExpanded((prev) => ({ ...prev, [band.key]: true }))}
                          >
                            Show more in this band ({band.items.length - 8} more)
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </>
          ) : (
            <EmptyState title="Queue is empty">No open issues. Check Live if the server feels off.</EmptyState>
          )
        ) : items.length ? (
          <div className="is-band">
            <div className="is-band__items">{items.map(renderRow)}</div>
          </div>
        ) : (
          <EmptyState title="Nothing reviewed yet">Mark an active issue reviewed to see it here.</EmptyState>
        )}
      </div>

      <div className="is-detail">
        {selected ? (
          <div className="is-detail__card">
            <div className="is-detail__head">
              <div className="is-detail__intro">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone={severityTone(selected.severity)}>{selected.severity}</StatusPill>
                  {selected.confidence ? (
                    <StatusPill tone={confidenceTone(selected.confidence)}>{selected.confidence}</StatusPill>
                  ) : null}
                </div>
                <h3 className="is-detail__title">{selected.title}</h3>
                {selected.summary ? <p className="is-detail__summary">{selected.summary}</p> : null}
              </div>
              <button
                type="button"
                className="is-detail__close rounded-lg p-1 text-wt-text-low hover:bg-wt-bg3"
                aria-label="Close detail"
                onClick={() => onSelect(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="is-panels" role="tablist">
              {DETAIL_PANELS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  role="tab"
                  aria-selected={panel === p.value}
                  className={`is-panel-tab${panel === p.value ? ' is-active' : ''}`}
                  onClick={() => setPanel(p.value)}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {panel === 'fix' ? (
              <>
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-wt-text-low">
                  {mode === 'reviewed' ? 'Reviewed' : 'Do this next'}
                </div>
                {selected.kind === 'crash' ? (
                  <p className="is-crash-hint">
                    Issues only tracks open crash review. Open Crashes for the numbered fix plan, evidence, and group
                    actions.
                  </p>
                ) : null}
                {(selected.steps.length ? selected.steps : selected.hints).length ? (
                  <ol className="is-steps">
                    {(selected.steps.length ? selected.steps : selected.hints).map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                ) : selected.kind !== 'crash' ? (
                  <p className="text-sm text-wt-text-low">No fix steps yet — use the primary link for context.</p>
                ) : null}

                <div className="is-actions">
                  {selected.primaryAction ? (
                    <Button kind="primary" onClick={() => runPrimaryAction(selected.primaryAction)}>
                      {selected.primaryAction.label}
                      <ChevronRight size={13} className="ml-1" />
                    </Button>
                  ) : null}
                  {mode === 'active' ? (
                    <Button
                      kind="primary"
                      disabled={!canWrite || marking}
                      title={canWrite ? undefined : VIEW_ONLY_TITLE}
                      onClick={() => onMarkReviewed(selected)}
                    >
                      <CheckCircle2 size={14} className="mr-1.5" /> Mark reviewed
                    </Button>
                  ) : (
                    <Button
                      kind="primary"
                      disabled={!canWrite || marking}
                      title={canWrite ? undefined : VIEW_ONLY_TITLE}
                      onClick={() => onMoveToActive(selected)}
                    >
                      Move to Active
                    </Button>
                  )}
                  {(selected.steps.length || selected.hints.length) && selected.kind !== 'crash' ? (
                    <Button onClick={() => void copySteps(selected)}>
                      <Copy size={14} className="mr-1.5" /> Copy steps
                    </Button>
                  ) : null}
                  {mode === 'active' && selected.issueId ? (
                    <Button
                      disabled={!canWrite}
                      title={canWrite ? undefined : VIEW_ONLY_TITLE}
                      onClick={() => onSuppress(selected)}
                    >
                      Hide from Active
                    </Button>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <dl className="is-dl">
                  <div>
                    <dt>Key</dt>
                    <dd>{selected.key}</dd>
                  </div>
                  <div>
                    <dt>Source</dt>
                    <dd>{sourceLabel(selected.source)}</dd>
                  </div>
                  <div>
                    <dt>Kind</dt>
                    <dd>{selected.kind}</dd>
                  </div>
                  <div>
                    <dt>Severity</dt>
                    <dd className="capitalize">{selected.severity}</dd>
                  </div>
                  <div>
                    <dt>When</dt>
                    <dd>{selected.when ? formatAge(selected.when) : '—'}</dd>
                  </div>
                  <div>
                    <dt>Reviewed</dt>
                    <dd>{selected.ackedAt ? formatAge(selected.ackedAt) : mode === 'reviewed' ? 'Yes' : '—'}</dd>
                  </div>
                  {selected.issueId ? (
                    <div>
                      <dt>Issue id</dt>
                      <dd>{selected.issueId}</dd>
                    </div>
                  ) : null}
                </dl>
                {selected.detail ? <p className="text-sm text-wt-text-mid">{selected.detail}</p> : null}
                {selected.sample ? <pre className="is-sample">{selected.sample}</pre> : null}
                {selected.metrics && Object.keys(selected.metrics).length ? (
                  <div className="is-metrics">
                    {selected.metrics.soft_hang_stall_seconds != null ? (
                      <div className="is-metric">
                        <div className="is-metric__label">Stall</div>
                        <div className="is-metric__value">
                          {String(num(selected.metrics.soft_hang_stall_seconds))}s
                        </div>
                      </div>
                    ) : null}
                    {selected.metrics.soft_hang_phase != null ? (
                      <div className="is-metric">
                        <div className="is-metric__label">Phase</div>
                        <div className="is-metric__value">{str(selected.metrics.soft_hang_phase)}</div>
                      </div>
                    ) : null}
                    {selected.metrics.soft_hang_likely_cause_summary != null ? (
                      <div className="is-metric">
                        <div className="is-metric__label">Likely cause</div>
                        <div className="is-metric__value">
                          {str(selected.metrics.soft_hang_likely_cause_summary)}
                          {str(selected.metrics.soft_hang_likely_cause_confidence)
                            ? ` (${str(selected.metrics.soft_hang_likely_cause_confidence)})`
                            : ''}
                        </div>
                      </div>
                    ) : null}
                    {str(selected.metrics?.soft_hang_suspect_mod) ? (
                      <div className="is-metric">
                        <div className="is-metric__label">Suspect mod</div>
                        <div className="is-metric__value">
                          {str(selected.metrics.soft_hang_suspect_mod)}
                          {str(selected.metrics.soft_hang_suspect_mod_note)
                            ? ` — ${str(selected.metrics.soft_hang_suspect_mod_note)}`
                            : ''}
                        </div>
                      </div>
                    ) : null}
                    {selected.metrics.tps != null ? (
                      <div className="is-metric">
                        <div className="is-metric__label">TPS</div>
                        <div className="is-metric__value">{num(selected.metrics.tps).toFixed(1)}</div>
                      </div>
                    ) : null}
                    {selected.metrics.mspt != null ? (
                      <div className="is-metric">
                        <div className="is-metric__label">MSPT</div>
                        <div className="is-metric__value">{num(selected.metrics.mspt).toFixed(1)}</div>
                      </div>
                    ) : null}
                    {selected.metrics.players_online != null ? (
                      <div className="is-metric">
                        <div className="is-metric__label">Players</div>
                        <div className="is-metric__value">{String(num(selected.metrics.players_online))}</div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {str(selected.metrics?.soft_hang_dump_path) ? (
                  <SoftHangDumpPreview dumpPath={str(selected.metrics?.soft_hang_dump_path)} />
                ) : selected.issueId === 'SOFT_HANG' ? (
                  <p className="text-sm text-wt-text-low">
                    No hang dump yet. Set SOFT_HANG_THREAD_DUMP=true in watchtower.conf to capture one on the next
                    freeze.
                  </p>
                ) : null}
              </>
            )}
          </div>
        ) : (
          <EmptyState title="No issue selected">Pick an issue from the queue to see fix steps and details.</EmptyState>
        )}
      </div>
    </div>
  );
}
