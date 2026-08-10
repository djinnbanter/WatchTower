import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { MetaButton } from '@/components/ui/desk';
import { cn } from '@/lib/utils';
import { ISSUES, type IssueRow, type IssueSeverity } from '../fixtures';
import { Plate } from './Plate';
import { PageHeader } from './PageHero';
import { DeskPage } from './layout/DeskPage';

type Filter = 'all' | IssueSeverity;

const RANK: Record<IssueSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

function severityColor(s: IssueSeverity): string {
  if (s === 'critical') return 'var(--wt-danger)';
  if (s === 'warning') return 'var(--wt-warn)';
  return 'var(--wt-text-low)';
}

function severityLabel(s: IssueSeverity): string {
  if (s === 'critical') return 'Critical';
  if (s === 'warning') return 'Warning';
  return 'Info';
}

function sortActive(list: IssueRow[]): IssueRow[] {
  return [...list]
    .filter((i) => !i.reviewed)
    .sort((a, b) => RANK[a.severity] - RANK[b.severity]);
}

/**
 * Issues POC — slim always-visible queue + case file.
 * Switch issues from the queue (or Prev/Next); no buried “Up next” grid.
 */
export function Issues() {
  const active = useMemo(() => sortActive(ISSUES), []);
  const reviewed = useMemo(() => ISSUES.filter((i) => i.reviewed), []);
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState(active[0]?.id ?? '');
  const [doneIds, setDoneIds] = useState<string[]>([]);

  const visible = useMemo(() => {
    const base = active.filter((i) => !doneIds.includes(i.id));
    if (filter === 'all') return base;
    return base.filter((i) => i.severity === filter);
  }, [active, doneIds, filter]);

  const selectedIndex = Math.max(
    0,
    visible.findIndex((i) => i.id === selectedId),
  );
  const selected = visible[selectedIndex] ?? visible[0] ?? null;

  const selectAt = (index: number) => {
    const item = visible[index];
    if (item) setSelectedId(item.id);
  };

  const markReviewed = (id: string) => {
    setDoneIds((prev) => [...prev, id]);
    const rest = visible.filter((i) => i.id !== id);
    setSelectedId(rest[0]?.id ?? '');
  };

  const filters: { id: Filter; label: string; count: number }[] = [
    {
      id: 'all',
      label: 'Open',
      count: active.filter((i) => !doneIds.includes(i.id)).length,
    },
    {
      id: 'critical',
      label: 'Critical',
      count: active.filter((i) => i.severity === 'critical' && !doneIds.includes(i.id))
        .length,
    },
    {
      id: 'warning',
      label: 'Warning',
      count: active.filter((i) => i.severity === 'warning' && !doneIds.includes(i.id)).length,
    },
    {
      id: 'info',
      label: 'Info',
      count: active.filter((i) => i.severity === 'info' && !doneIds.includes(i.id)).length,
    },
  ];

  return (
    <DeskPage>
        <PageHeader
          group="Triage"
          title="Fix queue"
          sub="Pick from the queue on the left. The case file stays put while you switch."
          aside={
            <p className="wt-meta text-muted-foreground">
              {visible.length} open · {reviewed.length + doneIds.length} reviewed
            </p>
          }
        />

        <div className="flex flex-wrap gap-2 px-0.5">
          {filters.map((f) => {
            const on = filter === f.id;
            return (
              <MetaButton
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  on &&
                    'border-primary bg-[color:var(--wt-accent-soft)] text-primary hover:bg-[color:var(--wt-accent-soft)] hover:text-primary',
                )}
              >
                {f.label}
                <span className="ml-2 tabular-nums opacity-70">{f.count}</span>
              </MetaButton>
            );
          })}
        </div>

        {!selected ? (
          <Plate className="px-6 py-10 md:px-8">
            <p className="wt-display text-[1.5rem] text-[color:var(--wt-text)]">Queue clear</p>
            <p className="mt-3 max-w-[40ch] text-[0.875rem] text-[color:var(--wt-text-mid)]">
              Nothing open in this filter. Switch filter or check reviewed below.
            </p>
          </Plate>
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(15rem,18rem)_minmax(0,1fr)] lg:gap-5">
            {/* Always-visible queue */}
            <aside aria-label="Issue queue" className="flex flex-col gap-2 lg:sticky lg:top-4">
              <p className="px-0.5 wt-meta text-[color:var(--wt-text-low)]">
                Queue · {visible.length}
              </p>
              <Plate className="overflow-hidden">
                <ol className="m-0 flex list-none flex-col p-0">
                  {visible.map((issue, idx) => {
                    const on = issue.id === selected.id;
                    return (
                      <li key={issue.id} className="border-b border-[color:var(--wt-line)] last:border-b-0">
                        <button
                          type="button"
                          onClick={() => setSelectedId(issue.id)}
                          aria-current={on ? 'true' : undefined}
                          className={`flex w-full flex-col gap-1.5 px-4 py-3.5 text-left transition-colors ${
                            on
                              ? 'bg-[color:var(--wt-bg1)]'
                              : 'bg-[color:var(--wt-bg0)] hover:bg-[color:var(--wt-bg1)]'
                          }`}
                        >
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <span
                              className={`wt-meta ${
                                on ? 'text-[color:var(--wt-accent)]' : 'text-[color:var(--wt-text-low)]'
                              }`}
                            >
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            <span className="wt-meta" style={{ color: severityColor(issue.severity) }}>
                              {severityLabel(issue.severity)}
                            </span>
                          </div>
                          <span
                            className={`text-[0.8125rem] font-semibold leading-snug ${
                              on ? 'text-[color:var(--wt-text)]' : 'text-[color:var(--wt-text-mid)]'
                            }`}
                          >
                            {issue.title}
                          </span>
                          <span className="wt-meta text-[color:var(--wt-text-low)]">{issue.age}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </Plate>
            </aside>

            {/* Case file */}
            <section aria-labelledby="case-title" className="flex min-w-0 flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3 px-0.5">
                <p className="wt-meta text-[color:var(--wt-text-low)]">
                  Case {selectedIndex + 1} of {visible.length}
                </p>
                <div className="flex gap-2">
                  <MetaButton
                    type="button"
                    disabled={selectedIndex <= 0}
                    onClick={() => selectAt(selectedIndex - 1)}
                  >
                    Prev
                  </MetaButton>
                  <MetaButton
                    type="button"
                    disabled={selectedIndex >= visible.length - 1}
                    onClick={() => selectAt(selectedIndex + 1)}
                  >
                    Next
                  </MetaButton>
                </div>
              </div>

              <Plate className="bg-[color:var(--wt-bg1)]">
                <div className="border-b border-[color:var(--wt-line)] px-6 py-5 md:px-8 md:py-6">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="wt-meta text-[color:var(--wt-accent)]">Case file</span>
                    <span className="wt-meta" style={{ color: severityColor(selected.severity) }}>
                      {severityLabel(selected.severity)}
                    </span>
                    <span className="wt-meta text-[color:var(--wt-text-low)]">{selected.band}</span>
                    <span className="wt-meta text-[color:var(--wt-text-low)]">
                      First seen {selected.firstSeen} · {selected.age} old
                    </span>
                  </div>
                  <h2
                    id="case-title"
                    className="mt-4 text-[clamp(1.25rem,2.5vw,1.75rem)] font-semibold leading-snug text-[color:var(--wt-text)]"
                  >
                    {selected.title}
                  </h2>
                  <p className="mt-3 max-w-[62ch] text-[0.9375rem] leading-relaxed text-[color:var(--wt-text-mid)]">
                    {selected.detail}
                  </p>
                </div>

                <div className="grid gap-px bg-[color:var(--wt-line)] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                  <div className="bg-[color:var(--wt-bg1)] px-6 py-6 md:px-8">
                    <p className="wt-meta text-[color:var(--wt-accent)]">What to do</p>
                    <p className="mt-3 border-l-2 border-[color:var(--wt-accent)] pl-4 text-[0.9375rem] leading-relaxed text-[color:var(--wt-text)]">
                      {selected.next}
                    </p>
                    <ol className="mt-6 m-0 list-none space-y-4 p-0">
                      {selected.steps.map((step, i) => (
                        <li key={step} className="flex gap-4">
                          <span className="wt-meta shrink-0 text-[color:var(--wt-text-low)]">
                            {String(i + 1).padStart(2, '0')}
                          </span>
                          <span className="text-[0.875rem] leading-relaxed text-[color:var(--wt-text-mid)]">
                            {step}
                          </span>
                        </li>
                      ))}
                    </ol>
                    <div className="mt-8 flex flex-wrap gap-2">
                      <Button type="button" onClick={() => markReviewed(selected.id)} className="wt-meta">
                        Mark reviewed
                      </Button>
                      <MetaButton type="button" disabled title="POC stub">
                        Open related page
                      </MetaButton>
                    </div>
                  </div>

                  <div className="bg-[color:var(--wt-bg0)] px-6 py-6 md:px-8">
                    <p className="wt-meta text-[color:var(--wt-text-low)]">Evidence</p>
                    <ul className="mt-4 m-0 list-none space-y-3 p-0">
                      {selected.evidence.map((line) => (
                        <li
                          key={line}
                          className="border-l border-[color:var(--wt-line-strong)] pl-3 font-mono text-[0.75rem] leading-relaxed text-[color:var(--wt-text-mid)]"
                        >
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Plate>
            </section>
          </div>
        )}

        {(reviewed.length > 0 || doneIds.length > 0) && (
          <details className="border border-[color:var(--wt-line)] bg-[color:var(--wt-bg0)]">
            <summary className="cursor-pointer list-none px-5 py-3.5 md:px-6 [&::-webkit-details-marker]:hidden">
              <span className="wt-meta text-[color:var(--wt-text-low)]">
                Reviewed · {reviewed.length + doneIds.length} parked
              </span>
            </summary>
            <ul className="m-0 list-none border-t border-[color:var(--wt-line)] p-0">
              {[...ISSUES.filter((i) => i.reviewed || doneIds.includes(i.id))].map((issue) => (
                <li
                  key={issue.id}
                  className="border-b border-[color:var(--wt-line)] px-5 py-3.5 last:border-b-0 md:px-6"
                >
                  <span className="wt-meta text-[color:var(--wt-text-low)]">Reviewed</span>
                  <span className="ml-3 text-[0.8125rem] text-[color:var(--wt-text-mid)]">
                    {issue.title}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}

        <footer className="px-0.5 pb-2">
          <p className="wt-meta m-0 text-[color:var(--wt-text-low)]">
            POC · queue + case file · Prev/Next to step without leaving the case
          </p>
        </footer>
    </DeskPage>
  );
}
