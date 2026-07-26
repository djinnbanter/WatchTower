import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronRight, Copy, X } from '@/ui/icons';
import { navigate } from '@/app/router';
import { Button, EmptyState, StatusPill } from '@/ui/patterns';
import { num } from '@/lib/utils';
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

function runPrimaryAction(action: PrimaryAction | null) {
  if (!action) return;
  if (action.href) {
    window.open(action.href, '_blank', 'noopener,noreferrer');
    return;
  }
  if (action.tab) {
    navigate({ tab: action.tab, ...(action.params ?? {}) });
  }
}

async function copySteps(item: IssueItem) {
  const lines = (item.steps.length ? item.steps : item.hints).map((s, i) => `${i + 1}. ${s}`);
  const text = [`${item.title}`, '', ...lines].join('\n');
  try {
    await navigator.clipboard.writeText(text);
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
  const [panel, setPanel] = useState<DetailPanel>('fix');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [bandExpanded, setBandExpanded] = useState<Record<string, boolean>>({});

  const bands = useMemo(() => (mode === 'active' ? groupByBand(items) : null), [items, mode]);
  const selected = items.find((i) => i.key === selectedKey) ?? null;

  useEffect(() => {
    setPanel('fix');
  }, [selectedKey]);

  useEffect(() => {
    if (!bands) return;
    setCollapsed((prev) => {
      const next = { ...prev };
      const hasCritical = bands.some((b) => b.key === 'critical');
      const hasWarning = bands.some((b) => b.key === 'warning');
      for (const b of bands) {
        if (next[b.key] != null) continue;
        if (b.key === 'info' && (hasCritical || hasWarning)) next[b.key] = true;
        else if (b.key === 'warning' && hasCritical) next[b.key] = true;
        else next[b.key] = false;
      }
      return next;
    });
  }, [bands]);

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
      <div className="is-list">
        {mode === 'active' && bands ? (
          bands.length ? (
            bands.map((band) => (
              <div key={band.key} className={`is-band is-band--${band.key}`}>
                <button
                  type="button"
                  className="is-band__header"
                  onClick={() => setCollapsed((c) => ({ ...c, [band.key]: !c[band.key] }))}
                >
                  <span className="is-band__label">{band.label}</span>
                  <StatusPill tone={band.tone}>{band.items.length}</StatusPill>
                </button>
                {!collapsed[band.key] ? (
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
            ))
          ) : (
            <EmptyState title="Queue is empty">No open issues right now — nice work.</EmptyState>
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
                    <Button kind="primary" disabled={marking} onClick={() => onMarkReviewed(selected)}>
                      <CheckCircle2 size={14} className="mr-1.5" /> Mark reviewed
                    </Button>
                  ) : (
                    <Button kind="primary" disabled={marking} onClick={() => onMoveToActive(selected)}>
                      Move to Active
                    </Button>
                  )}
                  {(selected.steps.length || selected.hints.length) && selected.kind !== 'crash' ? (
                    <Button onClick={() => void copySteps(selected)}>
                      <Copy size={14} className="mr-1.5" /> Copy steps
                    </Button>
                  ) : null}
                  {mode === 'active' && selected.issueId ? (
                    <Button onClick={() => onSuppress(selected)}>Hide from Active</Button>
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
