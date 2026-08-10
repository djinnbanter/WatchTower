import {
  STARTUP,
  type StartupPhase,
  type Tone,
} from '../fixtures';
import { useNav } from '../nav';
import { HashMeter, toneColor } from './charts';
import { MetaLink } from '@/components/ui/desk';
import { Plate } from './Plate';
import { DeskHero, DeskSignal, PageHeader } from './PageHero';
import { DeskPage } from './layout/DeskPage';

function formatSec(sec: number | null | undefined) {
  if (sec == null || !Number.isFinite(sec)) return '-';
  if (sec >= 100) return `${Math.round(sec)}s`;
  if (sec >= 10) return `${sec.toFixed(1)}s`;
  return `${sec.toFixed(2)}s`;
}

function statusTone(status: string): Tone {
  const s = status.toLowerCase();
  if (s === 'ok' || s === 'healthy') return 'ok';
  if (s === 'failed' || s === 'error') return 'danger';
  if (s === 'warnings' || s === 'warning') return 'warn';
  return 'default';
}

function phaseById(id: string): StartupPhase | undefined {
  return STARTUP.phases.find((p) => p.id === id);
}

function compareLabel(): { text: string; tone: Tone } {
  const { direction, deltaSec } = STARTUP.compare;
  const abs = Math.abs(deltaSec);
  const mag = abs >= 100 ? `${Math.round(abs)}s` : `${abs.toFixed(1)}s`;
  if (direction === 'faster') return { text: `${mag} faster`, tone: 'ok' };
  if (direction === 'slower') return { text: `${mag} slower`, tone: 'warn' };
  return { text: 'Same as last', tone: 'ok' };
}

/**
 * Startup POC — Boot desk: verdict first, fix CTAs, then phases + history.
 * Same facts as prod startup_profile; uses shared PageHeader + DeskHero.
 */
export function Startup() {
  const { setPage } = useNav();
  const tone = statusTone(STARTUP.status);
  const compare = compareLabel();
  const phaseSum = STARTUP.phases.reduce((a, p) => a + p.sec, 0) || STARTUP.totalSec;
  const maxHistory = Math.max(...STARTUP.history.map((h) => h.totalSec), 1);
  const avgHistory =
    STARTUP.history.reduce((a, h) => a + h.totalSec, 0) / STARTUP.history.length;
  const blockingErrors = STARTUP.errors.filter((e) => e.blocking).length;
  const slowest = STARTUP.slowest[0];
  const slowestInk = phaseById('datapack_loot')?.ink ?? 'var(--wt-text)';

  return (
    <DeskPage>
        <PageHeader
          group="Monitor"
          title="Startup"
          sub="Last boot verdict, issues to fix, where time went, and how this run compares."
          aside={
            <p className="wt-meta text-[color:var(--wt-text-low)]">
              Finished {STARTUP.doneAtLabel} · {STARTUP.doneAgo}
            </p>
          }
        />

        <DeskHero
          label="Boot health"
          title={STARTUP.statusWord}
          titleColor={toneColor(tone)}
          detail={
            <>
              <p className="m-0">
                <span className="font-mono tabular-nums text-[color:var(--wt-text)]">
                  {formatSec(STARTUP.totalSec)}
                </span>{' '}
                total · {STARTUP.totalSource}
              </p>
              <p className="mt-2 m-0">
                {STARTUP.cleanShutdown ? 'Clean shutdown' : 'Unclean shutdown'}
                {STARTUP.vanillaDoneSec != null
                  ? ` · Vanilla Done ${formatSec(STARTUP.vanillaDoneSec)}`
                  : ''}
                {STARTUP.updateAvailable ? ' · Update available' : ''}
              </p>
            </>
          }
          sideLabel="This boot"
          side={
            <>
              <ul className="mt-4 m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
                <DeskSignal
                  title={compare.text}
                  detail="vs last boot"
                  toneColor={toneColor(compare.tone)}
                />
                <DeskSignal
                  title={`${STARTUP.warningEventCount} warnings`}
                  detail={`${STARTUP.warnings.length} samples from boot log`}
                  toneColor="var(--wt-warn)"
                />
                <DeskSignal
                  title={`${STARTUP.errors.length} errors`}
                  detail={
                    blockingErrors > 0
                      ? `${blockingErrors} blocking`
                      : 'Non-blocking - server reached Done!'
                  }
                  toneColor={
                    STARTUP.errors.length > 0 ? 'var(--wt-danger)' : 'var(--wt-text-low)'
                  }
                />
                <DeskSignal
                  title={formatSec(slowest?.sec)}
                  detail={`Slowest · ${slowest?.phase ?? '-'}`}
                  toneColor={slowestInk}
                />
              </ul>
              <MetaLink type="button" onClick={() => setPage('issues')}>
                Open Fix queue →
              </MetaLink>
            </>
          }
        />

        <Plate className="grid gap-px overflow-hidden bg-[color:var(--wt-line)] md:grid-cols-2">
          <button
            type="button"
            onClick={() => setPage('issues')}
            className="group flex cursor-pointer flex-col bg-[color:var(--wt-bg1)] px-5 py-5 text-left transition-colors duration-200 hover:bg-[color:var(--wt-bg3)]"
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="wt-meta m-0 text-[color:var(--wt-warn)]">Warnings</p>
              <p className="m-0 font-mono text-[1.5rem] tabular-nums leading-none text-[color:var(--wt-warn)]">
                {STARTUP.warningEventCount}
              </p>
            </div>
            <p className="mt-2 m-0 text-[0.75rem] text-[color:var(--wt-text-low)]">
              {STARTUP.warnings.length} samples from {STARTUP.warningEventCount} boot-log events
            </p>
            <ul className="mt-4 m-0 flex list-none flex-col gap-2 p-0">
              {STARTUP.warnings.slice(0, 3).map((w) => {
                const side = w.modId ?? w.sample;
                return (
                  <li
                    key={w.id}
                    className="border-l-2 border-[color:var(--wt-warn)] pl-3 text-[0.8125rem] text-[color:var(--wt-text)]"
                  >
                    <span className="font-medium">{w.title}</span>
                    {side ? (
                      <span className="text-[color:var(--wt-text-low)]"> · {side}</span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <p className="mt-5 m-0 wt-meta text-[color:var(--wt-text-mid)] group-hover:text-[color:var(--wt-accent)]">
              Open Issues →
            </p>
          </button>

          <button
            type="button"
            onClick={() => setPage('issues')}
            className="group flex cursor-pointer flex-col bg-[color:var(--wt-bg1)] px-5 py-5 text-left transition-colors duration-200 hover:bg-[color:var(--wt-bg3)]"
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="wt-meta m-0 text-[color:var(--wt-danger)]">Errors</p>
              <p className="m-0 font-mono text-[1.5rem] tabular-nums leading-none text-[color:var(--wt-danger)]">
                {STARTUP.errors.length}
              </p>
            </div>
            <p className="mt-2 m-0 text-[0.75rem] text-[color:var(--wt-text-low)]">
              {blockingErrors > 0
                ? `${blockingErrors} blocking of ${STARTUP.errors.length}`
                : 'Mod errors during boot (server still reached Done!)'}
            </p>
            <ul className="mt-4 m-0 flex list-none flex-col gap-2 p-0">
              {STARTUP.errors.slice(0, 3).map((e) => (
                <li
                  key={`${e.modId}-${e.kind}`}
                  className="border-l-2 border-[color:var(--wt-danger)] pl-3 text-[0.8125rem] text-[color:var(--wt-text)]"
                >
                  <span className="font-mono text-[0.75rem] text-[color:var(--wt-text-mid)]">
                    {e.modId}
                  </span>
                  <span className="text-[color:var(--wt-text-low)]"> - </span>
                  {e.title}
                </li>
              ))}
            </ul>
            <p className="mt-5 m-0 wt-meta text-[color:var(--wt-text-mid)] group-hover:text-[color:var(--wt-accent)]">
              Open Issues →
            </p>
          </button>
        </Plate>

        <Plate className="grid gap-px overflow-hidden bg-[color:var(--wt-line)] md:grid-cols-3">
          <div className="flex min-h-0 flex-col bg-[color:var(--wt-bg1)]">
            <div className="border-b border-[color:var(--wt-line)] px-4 py-3">
              <p className="wt-meta m-0 text-[color:var(--wt-text-low)]">Slowest</p>
            </div>
            <div className="flex flex-1 flex-col gap-px bg-[color:var(--wt-line)]">
              {STARTUP.slowest.map((s, i) => {
                const phase = STARTUP.phases.find((p) => p.label === s.phase);
                const ink = phase?.ink ?? 'var(--wt-text-mid)';
                return (
                  <div
                    key={s.phase}
                    className="flex items-baseline justify-between gap-3 bg-[color:var(--wt-bg1)] px-4 py-4"
                  >
                    <div>
                      <p className="wt-meta m-0" style={{ color: ink }}>
                        #{i + 1}
                      </p>
                      <p className="mt-1 m-0 text-[0.875rem] text-[color:var(--wt-text)]">
                        {s.phase}
                      </p>
                    </div>
                    <p
                      className="m-0 font-mono text-[1.15rem] tabular-nums leading-none"
                      style={{ color: ink }}
                    >
                      {formatSec(s.sec)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex min-h-0 flex-col bg-[color:var(--wt-bg1)]">
            <div className="border-b border-[color:var(--wt-line)] px-4 py-3">
              <p className="wt-meta m-0 text-[color:var(--wt-text-low)]">Boot phases</p>
            </div>
            <div className="flex flex-1 flex-col gap-3 px-4 py-4">
              {STARTUP.phases.map((p) => {
                const pct = Math.round((p.sec / phaseSum) * 100);
                const rank = STARTUP.slowest.findIndex((s) => s.phase === p.label);
                return (
                  <div key={p.id}>
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="m-0 text-[0.8rem] text-[color:var(--wt-text)]">
                        {p.label}
                        {rank === 0 ? (
                          <span className="ml-2 wt-meta text-[color:var(--wt-warn)]">#1</span>
                        ) : null}
                      </p>
                      <p className="m-0 font-mono text-[0.75rem] tabular-nums text-[color:var(--wt-text-mid)]">
                        {pct}% · {formatSec(p.sec)}
                      </p>
                    </div>
                    <HashMeter value={pct} ink={p.ink} className="mt-2" />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex min-h-0 flex-col bg-[color:var(--wt-bg1)]">
            <div className="border-b border-[color:var(--wt-line)] px-4 py-3">
              <p className="wt-meta m-0 text-[color:var(--wt-accent)]">Launch & config</p>
            </div>
            <div className="flex flex-1 flex-col px-4 py-4">
              <p className="m-0 text-[0.875rem] text-[color:var(--wt-text)]">
                {STARTUP.configAudit.summary.consider} settings to review ·{' '}
                {STARTUP.configAudit.summary.missing} missing
              </p>
              <p className="mt-1 m-0 text-[0.75rem] text-[color:var(--wt-text-low)]">
                JVM · {STARTUP.configAudit.jvmName} · {STARTUP.configAudit.summary.fine} fine
              </p>
              <ul className="mt-4 m-0 flex list-none flex-col gap-2 p-0">
                {STARTUP.configAudit.properties.map((prop) => (
                  <li
                    key={prop.key}
                    className="border-l-2 pl-3 text-[0.8125rem] text-[color:var(--wt-text)]"
                    style={{
                      borderColor:
                        prop.verdict === 'missing' ? 'var(--wt-danger)' : 'var(--wt-warn)',
                    }}
                  >
                    {prop.title}
                  </li>
                ))}
              </ul>
              <p
                className="mt-auto pt-5 m-0 wt-meta text-[color:var(--wt-text-low)]"
                title="Insights page not in this POC yet"
              >
                Insights → Configs (soon)
              </p>
            </div>
          </div>
        </Plate>

        <Plate className="overflow-hidden">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[color:var(--wt-line)] px-5 py-3.5">
            <div>
              <p className="wt-meta m-0 text-[color:var(--wt-text-low)]">Boot times</p>
              <p className="mt-1 m-0 text-[0.75rem] text-[color:var(--wt-text-mid)]">
                Stacked phases across recent startups. Latest is the current profile.
              </p>
            </div>
            <p className="m-0 font-mono text-[0.875rem] tabular-nums text-[color:var(--wt-text)]">
              {formatSec(avgHistory)}
              <span className="ml-1 text-[0.65rem] text-[color:var(--wt-text-low)]">avg</span>
            </p>
          </div>

          <div className="flex flex-wrap gap-4 border-b border-[color:var(--wt-line)] px-5 py-2.5">
            {STARTUP.phases.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1.5 wt-meta text-[color:var(--wt-text-low)]"
              >
                <span className="inline-block h-2 w-2" style={{ background: p.ink }} />
                {p.label}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-px bg-[color:var(--wt-line)]">
            {STARTUP.history.map((h, hi) => {
              const isLatest = hi === STARTUP.history.length - 1;
              return (
                <div
                  key={h.doneAt}
                  className="flex min-h-[14rem] flex-col bg-[color:var(--wt-bg1)] px-4 py-4"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p
                      className={`wt-meta m-0 ${
                        isLatest
                          ? 'text-[color:var(--wt-accent)]'
                          : 'text-[color:var(--wt-text-low)]'
                      }`}
                    >
                      {h.doneAt}
                      {isLatest ? ' · latest' : ''}
                    </p>
                    <p className="m-0 font-mono text-[0.95rem] tabular-nums text-[color:var(--wt-text)]">
                      {formatSec(h.totalSec)}
                    </p>
                  </div>
                  <div
                    className="mt-4 flex min-h-0 flex-1 flex-col justify-end"
                    role="img"
                    aria-label={`Boot ${h.doneAt} ${formatSec(h.totalSec)}`}
                  >
                    <div
                      className="flex w-full flex-col justify-end"
                      style={{ height: `${(h.totalSec / maxHistory) * 100}%` }}
                    >
                      {[...h.phases].reverse().map((ph) => {
                        const meta = phaseById(ph.id);
                        const share = (ph.sec / h.totalSec) * 100;
                        return (
                          <div
                            key={ph.id}
                            className="w-full"
                            style={{
                              height: `${share}%`,
                              minHeight: share > 0 ? 4 : 0,
                              background: meta?.ink ?? 'var(--wt-bg3)',
                              opacity: isLatest ? 1 : 0.72,
                            }}
                            title={`${meta?.label ?? ph.id}: ${formatSec(ph.sec)}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Plate>
    </DeskPage>
  );
}
