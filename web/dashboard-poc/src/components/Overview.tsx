import { SeriesChart, SparkBars, toneColor } from './charts';
import { MetaLink } from '@/components/ui/desk';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import {
  INSTRUMENTS,
  ISSUE_COUNTS,
  ISSUES,
  LOAD_24H,
  OVERVIEW,
  PLAYERS,
  RESTART,
  RIGHT_NOW,
  SCHEDULE,
  VITALS,
  WORLD,
  type IssueRow,
  type IssueSeverity,
  type Tone,
} from '../fixtures';
import { isPageReady, useNav, type PageId } from '../nav';
import { DeskPage } from './layout/DeskPage';
import { OverviewVitals } from './OverviewVitals';
import { DeskHero, DeskSignal, PageHeader } from './PageHero';
import { Plate } from './Plate';

const HEAD = 'flex h-11 shrink-0 items-center border-b border-[color:var(--wt-line)] px-4';

const SEVERITY_RANK: Record<IssueSeverity, number> = {
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

function sortedOpenIssues(): IssueRow[] {
  return [...ISSUES]
    .filter((i) => !i.reviewed)
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

function goOrStay(
  setPage: (id: PageId) => void,
  tab: string,
  fallback: PageId = 'issues',
) {
  if (isPageReady(tab as PageId)) setPage(tab as PageId);
  else setPage(fallback);
}

/**
 * Overview POC - mission desk: grade, reboot caution, ranked fix queue,
 * right-now signals, live vitals, collapsible instruments.
 */
export function Overview() {
  const { setPage } = useNav();
  const [instrumentsOpen, setInstrumentsOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);

  const ranked = sortedOpenIssues();
  const top = ranked[0];
  const queue = ranked.slice(0, 3);
  const overflow = ranked.length - queue.length;
  const primaryInstruments = INSTRUMENTS.slice(0, 2);
  const moreInstruments = INSTRUMENTS.slice(2);

  return (
    <DeskPage>
        <PageHeader
          group="Monitor"
          title="Overview"
          sub={`${OVERVIEW.uptime} up · scanned ${OVERVIEW.lastScan}`}
          aside={
            <p className="wt-meta inline-flex items-center gap-2 text-[color:var(--wt-text-low)]">
              <span
                aria-hidden
                className={`inline-block h-2 w-2 ${
                  OVERVIEW.watching ? 'bg-[color:var(--wt-ok)]' : 'bg-[color:var(--wt-text-low)]'
                }`}
              />
              Watching · {ISSUE_COUNTS.open} open
            </p>
          }
        />

        <OverviewVitals />

        <DeskHero
          label={`Server status · ${OVERVIEW.serverName}`}
          title={OVERVIEW.grade}
          titleColor={toneColor(OVERVIEW.gradeTone as Tone)}
          detail={
            <>
              <p className="m-0 font-semibold text-[color:var(--wt-text)]">{OVERVIEW.headline}</p>
              <p className="mt-2 m-0">{OVERVIEW.sub}</p>
              <ul className="mt-3 m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0">
                {OVERVIEW.identity.map((chip) => (
                  <li key={chip.label} className="wt-meta text-[color:var(--wt-text-low)]">
                    {chip.label}{' '}
                    <span className="text-[color:var(--wt-text-mid)]">{chip.value}</span>
                  </li>
                ))}
              </ul>
              {OVERVIEW.gradeReasons.length > 0 ? (
                <ul className="mt-3 m-0 flex list-none flex-col gap-1 p-0">
                  {OVERVIEW.gradeReasons.map((r) => (
                    <li
                      key={r}
                      className="border-l-2 border-[color:var(--wt-line)] pl-3 text-[0.75rem] text-[color:var(--wt-text-mid)]"
                    >
                      {r}
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          }
          sideLabel="If you reboot"
          side={
            <>
              <p
                className="mt-4 m-0 wt-display text-[clamp(1.75rem,3.5vw,2.5rem)] leading-none"
                style={{ color: toneColor(RESTART.tone) }}
              >
                {RESTART.verdict}
              </p>
              <p className="mt-3 m-0 max-w-[38ch] text-[0.875rem] leading-relaxed text-[color:var(--wt-text-mid)]">
                {RESTART.summary}
              </p>
              <ul className="mt-4 m-0 grid list-none gap-3 p-0 sm:grid-cols-1">
                {RESTART.reasons.map((r) => (
                  <DeskSignal
                    key={r.label}
                    title={r.label}
                    detail={r.detail}
                    toneColor={toneColor(RESTART.tone)}
                  />
                ))}
              </ul>
              <p className="mt-5 m-0 wt-meta text-[color:var(--wt-accent)]">{OVERVIEW.advice}</p>
              <MetaLink type="button" onClick={() => setPage('issues')} className="mt-4">
                Open Fix queue →
              </MetaLink>
            </>
          }
        />

        {/* Fix next - featured #01, then 02|03, then live signals */}
        <section aria-labelledby="fix-next-title" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3 px-0.5">
            <div>
              <h2
                id="fix-next-title"
                className="wt-display text-[clamp(1.35rem,2.5vw,1.75rem)] text-[color:var(--wt-text)]"
              >
                Fix next
              </h2>
              <p className="mt-2 m-0 text-[0.8125rem] text-[color:var(--wt-text-mid)]">
                Ranked by severity. Clear #1 before chasing the rest.
              </p>
            </div>
            <p className="wt-meta m-0 text-[color:var(--wt-text-low)]">
              {ISSUE_COUNTS.critical} crit · {ISSUE_COUNTS.warning} warn · {ISSUE_COUNTS.info} info
            </p>
          </div>

          {top ? (
            <Plate className="bg-[color:var(--wt-bg1)]">
              <div className="px-6 py-6 md:px-8 md:py-7">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-mono text-[0.75rem] tabular-nums text-[color:var(--wt-accent)]">
                    01
                  </span>
                  <span className="wt-meta" style={{ color: severityColor(top.severity) }}>
                    {severityLabel(top.severity)}
                  </span>
                  <span className="wt-meta text-[color:var(--wt-text-low)]">{top.band}</span>
                </div>
                <p className="mt-4 m-0 text-[1.125rem] font-semibold text-[color:var(--wt-text)]">
                  {top.title}
                </p>
                <p className="mt-3 m-0 max-w-[58ch] text-[0.875rem] leading-relaxed text-[color:var(--wt-text-mid)]">
                  {top.detail}
                </p>
                <p className="mt-5 m-0 max-w-[58ch] border-l-2 border-[color:var(--wt-accent)] pl-4 text-[0.875rem] leading-relaxed text-[color:var(--wt-text)]">
                  <span className="wt-meta mr-2 text-[color:var(--wt-accent)]">Next</span>
                  {top.next}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[color:var(--wt-line)] px-6 py-3.5 md:px-8">
                <MetaLink
                  type="button"
                  onClick={() =>
                    goOrStay(setPage, top.band === 'Storage' ? 'backups' : 'issues', 'issues')
                  }
                >
                  {top.band === 'Storage' ? 'Open Backups →' : 'Open Issues →'}
                </MetaLink>
                <MetaLink
                  type="button"
                  onClick={() => setPage('issues')}
                  className="text-muted-foreground"
                >
                  Full Fix queue →
                </MetaLink>
              </div>
            </Plate>
          ) : (
            <Plate className="px-6 py-6">
              <p className="m-0 text-[0.875rem] text-[color:var(--wt-text-mid)]">
                Queue clear - nothing open.
              </p>
            </Plate>
          )}

          {queue.length > 1 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {queue.slice(1).map((issue, idx) => (
                <Plate key={issue.id}>
                  <button
                    type="button"
                    onClick={() => setPage('issues')}
                    className="flex h-full w-full cursor-pointer flex-col px-5 py-5 text-left transition-colors duration-200 hover:bg-[color:var(--wt-bg0)] md:px-6"
                  >
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-mono text-[0.7rem] tabular-nums text-[color:var(--wt-text-low)]">
                        {String(idx + 2).padStart(2, '0')}
                      </span>
                      <span className="wt-meta" style={{ color: severityColor(issue.severity) }}>
                        {severityLabel(issue.severity)}
                      </span>
                      <span className="wt-meta text-[color:var(--wt-text-low)]">{issue.band}</span>
                    </div>
                    <p className="mt-3 m-0 text-[0.9375rem] font-semibold text-[color:var(--wt-text)]">
                      {issue.title}
                    </p>
                    <p className="mt-2 m-0 flex-1 text-[0.8125rem] leading-relaxed text-[color:var(--wt-text-mid)]">
                      {issue.next}
                    </p>
                  </button>
                </Plate>
              ))}
            </div>
          ) : null}

          {overflow > 0 ? (
            <button
              type="button"
              onClick={() => setPage('issues')}
              className="cursor-pointer self-start px-0.5 wt-meta text-[color:var(--wt-text-low)] hover:text-[color:var(--wt-accent)]"
            >
              + {overflow} lower priority on Issues →
            </button>
          ) : null}
        </section>

        {/* Right now - quiet signal strip */}
        <Plate className="overflow-hidden">
          <div className={`${HEAD} justify-between gap-3`}>
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="wt-meta m-0 text-[color:var(--wt-text-low)]">Right now</p>
              <p className="wt-meta m-0 text-[color:var(--wt-text-low)]">Live desk</p>
            </div>
            <MetaLink type="button" onClick={() => setPage('live')}>
              Open Live →
            </MetaLink>
          </div>
          <ul className="m-0 grid list-none gap-px bg-[color:var(--wt-line)] p-0 sm:grid-cols-2">
            {RIGHT_NOW.map((sig) => (
              <li key={sig.id} className="bg-[color:var(--wt-bg1)]">
                <button
                  type="button"
                  onClick={() => goOrStay(setPage, sig.tab, 'live')}
                  className="flex h-full w-full cursor-pointer items-start justify-between gap-3 px-4 py-3.5 text-left transition-colors duration-200 hover:bg-[color:var(--wt-bg0)]"
                >
                  <span
                    className="min-w-0 border-l-2 pl-3"
                    style={{ borderColor: severityColor(sig.severity) }}
                  >
                    <span className="block text-[0.8125rem] font-semibold text-[color:var(--wt-text)]">
                      {sig.label}
                    </span>
                    <span className="mt-1 block text-[0.7rem] leading-relaxed text-[color:var(--wt-text-mid)]">
                      {sig.detail}
                    </span>
                  </span>
                  <span className="shrink-0 wt-meta text-[color:var(--wt-text-low)]">
                    {isPageReady(sig.tab) ? 'Open' : 'Soon'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Plate>

        {/* Live vitals - single ruled strip */}
        <section aria-labelledby="vitals-title">
          <div className="mb-2 flex items-baseline justify-between gap-3 px-0.5">
            <h2 id="vitals-title" className="wt-meta m-0 text-[color:var(--wt-text-low)]">
              Live vitals
            </h2>
            <p className="wt-meta m-0 text-[color:var(--wt-text-low)]">Evidence for the grade</p>
          </div>
          <Plate className="grid grid-cols-2 gap-px overflow-hidden bg-[color:var(--wt-line)] sm:grid-cols-3 xl:grid-cols-6">
            {VITALS.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => setPage('live')}
                className="cursor-pointer bg-[color:var(--wt-bg1)] px-4 py-4 text-left transition-colors duration-200 hover:bg-[color:var(--wt-bg0)] md:px-5"
              >
                <p className="wt-meta m-0 text-[color:var(--wt-text-low)]">{v.label}</p>
                <p className="mt-2 m-0 font-mono text-[1.2rem] tabular-nums text-[color:var(--wt-text)]">
                  <span style={{ color: toneColor(v.tone) }}>{v.value}</span>
                  {v.unit ? (
                    <span className="ml-1 text-[0.7rem] text-[color:var(--wt-text-low)]">
                      {v.unit}
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 m-0 text-[0.65rem] text-[color:var(--wt-text-low)]">{v.hint}</p>
                <div className="opacity-70">
                  <SparkBars samples={v.spark} tone={v.tone} />
                </div>
              </button>
            ))}
          </Plate>
        </section>

        {/* Instruments */}
        <Plate className="overflow-hidden">
          <div className={`${HEAD} justify-between gap-3`}>
            <p className="wt-meta m-0 text-[color:var(--wt-text-low)]">Instruments</p>
            <Button
              type="button"
              variant="ghost"
              className="h-auto cursor-pointer wt-meta text-primary hover:text-foreground"
              aria-expanded={instrumentsOpen}
              onClick={() => setInstrumentsOpen((o) => !o)}
            >
              {instrumentsOpen ? 'Hide extras' : `Show ${moreInstruments.length} more`}
            </Button>
          </div>
          <div className="grid gap-px bg-[color:var(--wt-line)] sm:grid-cols-2">
            {(instrumentsOpen ? INSTRUMENTS : primaryInstruments).map((inst) => (
              <button
                key={inst.id}
                type="button"
                onClick={() => goOrStay(setPage, inst.tab, 'live')}
                className="cursor-pointer bg-[color:var(--wt-bg1)] px-5 py-4 text-left transition-colors duration-200 hover:bg-[color:var(--wt-bg0)]"
              >
                <p className="wt-meta m-0" style={{ color: toneColor(inst.tone) }}>
                  {inst.label}
                </p>
                <p className="mt-2 m-0 text-[0.875rem] font-semibold text-[color:var(--wt-text)]">
                  {inst.title}
                </p>
                <p className="mt-1 m-0 text-[0.75rem] leading-relaxed text-[color:var(--wt-text-mid)]">
                  {inst.detail}
                </p>
                <p className="mt-3 m-0 wt-meta text-[color:var(--wt-text-low)]">
                  {isPageReady(inst.tab) ? 'Open →' : 'Soon'}
                </p>
              </button>
            ))}
          </div>
        </Plate>

        {/* Optional context */}
        <Plate>
          <button
            type="button"
            className="flex w-full cursor-pointer items-center justify-between gap-3 px-5 py-4 text-left transition-colors duration-200 hover:bg-[color:var(--wt-bg1)] md:px-6"
            aria-expanded={contextOpen}
            onClick={() => setContextOpen((o) => !o)}
          >
            <span>
              <span className="wt-meta text-[color:var(--wt-text)]">More context</span>
              <span className="mt-1.5 block text-[0.75rem] text-[color:var(--wt-text-low)]">
                24h load · world / backup · who is online
              </span>
            </span>
            <span className="wt-meta text-[color:var(--wt-accent)]">
              {contextOpen ? 'Hide' : 'Show'}
            </span>
          </button>

          {contextOpen ? (
            <div className="grid gap-px border-t border-[color:var(--wt-line)] bg-[color:var(--wt-line)] lg:grid-cols-3">
              <div className="bg-[color:var(--wt-bg1)] px-5 py-4">
                  <p className="wt-meta m-0 text-muted-foreground">
                    Load · 24h · peak {SCHEDULE.peak}
                  </p>
                  <SeriesChart
                    className="mt-4 h-28"
                    points={LOAD_24H.length}
                    mode="bar"
                    xLabels={LOAD_24H.map((h) => `${h.hour}:00`)}
                    valueAtFull={100}
                    unit="%"
                    formatValue={(v) => `${Math.round(v)}%`}
                    tracks={[
                      {
                        id: 'load',
                        label: 'Load',
                        series: LOAD_24H.map((h) => h.load),
                        color: 'var(--primary)',
                      },
                    ]}
                  />
                  <p className="mt-3 m-0 text-[0.75rem] text-muted-foreground">{SCHEDULE.note}</p>
              </div>

              <div className="bg-[color:var(--wt-bg1)]">
                <p className="border-b border-[color:var(--wt-line)] px-5 py-3 wt-meta text-[color:var(--wt-text-low)]">
                  World · backup
                </p>
                <div className="grid grid-cols-2 gap-px bg-[color:var(--wt-line)]">
                  {(
                    [
                      ['Overworld', WORLD.overworldSize],
                      ['Entities', WORLD.entities],
                      ['Chunks', WORLD.chunks],
                      ['Backup', WORLD.backupAge],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label} className="bg-[color:var(--wt-bg0)] px-4 py-3.5">
                      <p className="wt-meta m-0 text-[color:var(--wt-text-low)]">{label}</p>
                      <p className="mt-1.5 m-0 font-mono text-[0.75rem] text-[color:var(--wt-text)]">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[color:var(--wt-bg1)]">
                <p className="border-b border-[color:var(--wt-line)] px-5 py-3 wt-meta text-[color:var(--wt-text-low)]">
                  Online · {PLAYERS.length}
                </p>
                <ul className="m-0 list-none p-0">
                  {PLAYERS.map((p) => (
                    <li
                      key={p.name}
                      className="flex justify-between gap-2 border-b border-[color:var(--wt-line)] px-5 py-2.5 last:border-b-0"
                    >
                      <span className="font-mono text-[0.75rem] text-[color:var(--wt-text)]">
                        {p.name}
                      </span>
                      <span className="wt-meta text-[color:var(--wt-text-low)]">{p.ping}ms</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </Plate>

        <footer className="px-0.5 pb-2">
          <p className="wt-meta m-0 text-[color:var(--wt-text-low)]">
            Advisory only · does not restart the host or download jars · {OVERVIEW.modsLoaded}{' '}
            mods · Spark {OVERVIEW.spark}
          </p>
        </footer>
    </DeskPage>
  );
}
