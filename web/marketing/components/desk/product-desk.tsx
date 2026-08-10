'use client';

import type { ReactNode } from 'react';
import NumberFlow from '@number-flow/react';
import { motion, useReducedMotion } from 'motion/react';
import type { DeskCrash, DeskSurface, DeskVital } from '@/content/baked/desk';
import { DESK } from '@/content/baked/desk';
import { InstrumentPlate } from '@/components/instrument-plate';
import { WatchSweep } from '@/components/watch-sweep';
import {
  DeskHeatmap,
  DeskRadialGauge,
  HashMeter,
  SeriesChart,
  SparkBars,
  type Tone,
} from '@/components/poc-charts';
import '@/components/desk/desk.css';

/** Visual chrome / composition, not which bake data to load. */
export type DeskChrome = 'rail' | 'bar' | 'bare';
export type DeskCut =
  | 'full'
  | 'mission'
  | 'grade'
  | 'vitals'
  | 'attention'
  | 'chart'
  | 'bands'
  | 'list';

function crashKindTone(kind: DeskCrash['kind']): 'info' | 'warn' | 'danger' {
  if (kind === 'Host') return 'info';
  if (kind === 'Hang') return 'danger';
  return 'warn';
}

function Spark({
  values,
  channel,
  large = false,
}: {
  values: number[];
  channel: DeskVital['channel'];
  large?: boolean;
}) {
  const w = large ? 72 : 56;
  const h = large ? 28 : 18;
  const max = Math.max(...values, 0.01);
  const pts = values
    .map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * w;
      const y = h - (v / max) * (h - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="desk-spark">
      <polyline
        fill="none"
        stroke={`var(--wt-ch-${channel})`}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={pts}
      />
    </svg>
  );
}

function StatusPill({
  children,
  tone,
}: {
  children: ReactNode;
  tone: 'ok' | 'warn' | 'danger' | 'info' | 'neutral';
}) {
  return <span className={`desk-pill desk-pill--${tone}`}>{children}</span>;
}

function FlowValue({ value }: { value: string }) {
  const n = Number(value);
  const reduce = useReducedMotion();
  if (!Number.isFinite(n)) return <>{value}</>;
  if (reduce) return <>{value}</>;
  return (
    <NumberFlow
      value={n}
      trend={0}
      format={{ maximumFractionDigits: value.includes('.') ? 1 : 0 }}
      transformTiming={{ duration: 650, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
      spinTiming={{ duration: 650, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
    />
  );
}

function VitalGrid({
  vitals,
  dense = false,
  fill = false,
}: {
  vitals: readonly DeskVital[];
  dense?: boolean;
  fill?: boolean;
}) {
  return (
    <div
      className={[
        'grid gap-px bg-[color:var(--wt-line)]',
        dense ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 lg:grid-cols-3',
        fill ? 'flex-1' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label="Live vitals"
    >
      {vitals.map((v) => {
        const n = Number(v.value);
        const isPct =
          v.unit === '%' || v.channel === 'disk' || v.channel === 'heap' || v.channel === 'cpu';
        const ink = `var(--wt-ch-${v.channel})`;
        return (
          <div key={v.label} className="flex flex-col gap-2 bg-[color:var(--wt-bg1)] p-3 md:p-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-[0.65rem] uppercase tracking-wide text-[color:var(--wt-text-low)]">
                {v.label}
              </span>
              <span className="font-mono text-lg tabular-nums" style={{ color: ink }}>
                <FlowValue value={v.value} />
                {v.unit ? (
                  <span className="text-sm text-[color:var(--wt-text-low)]">{v.unit}</span>
                ) : null}
              </span>
            </div>
            {isPct && Number.isFinite(n) ? (
              <HashMeter value={n} ink={ink} aria-label={v.label} />
            ) : v.channel === 'tps' || v.channel === 'mspt' ? (
              <DeskRadialGauge
                value={Number.isFinite(n) ? n : 0}
                max={v.channel === 'tps' ? 20 : 50}
                label={v.label}
                color={ink}
                className="w-full max-w-[7.5rem]"
              />
            ) : (
              <SparkBars samples={[...v.spark]} tone={v.tone as Tone} className="mt-0 h-6" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function QueueRows({
  items,
}: {
  items: Array<{
    key: string;
    title: string;
    detail?: string;
    trailing: ReactNode;
  }>;
}) {
  const reduce = useReducedMotion();
  return (
    <ul className="desk-queue">
      {items.map((item, i) => (
        <motion.li
          key={item.key}
          className="desk-queue__row"
          initial={reduce ? false : { opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{
            duration: 0.45,
            delay: i * 0.05,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          <div>
            <div className="desk-queue__title">{item.title}</div>
            {item.detail ? <div className="desk-queue__detail">{item.detail}</div> : null}
          </div>
          {item.trailing}
        </motion.li>
      ))}
    </ul>
  );
}

function DeskChrome({
  title,
  children,
  badge,
  chrome = 'rail',
}: {
  title: string;
  children: ReactNode;
  badge?: ReactNode;
  chrome?: DeskChrome;
}) {
  if (chrome === 'bare') {
    return <div className="desk-chrome desk-chrome--bare">{children}</div>;
  }
  if (chrome === 'bar') {
    return (
      <div className="desk-chrome desk-chrome--bar">
        <div className="desk-chrome__main">
          <div className="desk-chrome__bar">
            <span className="desk-chrome__title">{title}</span>
            {badge}
          </div>
          {children}
        </div>
      </div>
    );
  }
  return (
    <div className="desk-chrome">
      <div className="desk-chrome__rail" aria-hidden>
        <span className="desk-chrome__mark" />
        <span className="desk-chrome__tick" />
        <span className="desk-chrome__tick" />
        <span className="desk-chrome__tick is-active" />
        <span className="desk-chrome__tick" />
      </div>
      <div className="desk-chrome__main">
        <div className="desk-chrome__bar">
          <span className="desk-chrome__title">{title}</span>
          {badge}
        </div>
        {children}
      </div>
    </div>
  );
}

function OverviewCard({
  cut,
  chrome,
  stage = false,
  compact = false,
}: {
  cut: DeskCut;
  chrome: DeskChrome;
  stage?: boolean;
  compact?: boolean;
}) {
  const o = DESK.overview;
  const showMission = cut === 'full' || cut === 'mission' || cut === 'grade';
  const showVitals = cut === 'full' || cut === 'mission' || cut === 'vitals';
  const showAttention = cut === 'full' || cut === 'attention';
  const focusTop = cut === 'mission' || cut === 'grade';
  const stackGrade = compact && cut === 'grade';
  const gradeStage = stage && cut === 'grade';
  const vitalsStage = stage && cut === 'vitals';

  return (
    <DeskChrome
      title="Overview"
      chrome={chrome}
      badge={
        <StatusPill
          tone={
            (o.tone as string) === 'ok' ? 'ok' : (o.tone as string) === 'warn' ? 'warn' : 'danger'
          }
        >
          {o.word}
        </StatusPill>
      }
    >
      <div
        className={[
          `desk-mission desk-mission--${o.tone}`,
          stage && (cut === 'grade' || cut === 'vitals') ? 'desk-mission--stage' : '',
          gradeStage ? 'desk-mission--grade' : '',
          vitalsStage ? 'desk-mission--vitals' : '',
          stackGrade ? 'desk-mission--stack' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {showMission ? (
          <div
            className={[
              'desk-mission__top',
              focusTop ? 'desk-mission__top--focus' : '',
              stackGrade ? 'desk-mission__top--stack' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div className={`desk-grade desk-grade--${o.tone}`} aria-label={`Health grade ${o.letter}`}>
              <span className="desk-grade__letter">{o.letter}</span>
              <span className="desk-grade__word">{o.word}</span>
            </div>
            <div className="desk-mission__copy">
              <div className="desk-mission__meta">
                <span>Server status</span>
                <span aria-hidden>/</span>
                <span>{DESK.serverName}</span>
              </div>
              <h3 className="desk-mission__headline">{o.headline}</h3>
              <p className="desk-mission__sub">{o.sub}</p>
              {cut === 'full' ? (
                <div className="desk-identity">
                  {DESK.identity.map((chip) => (
                    <div key={chip.label} className="desk-identity__chip">
                      <span className="desk-identity__label">{chip.label}</span>
                      <span className="desk-identity__value">{chip.value}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            {cut === 'full' ? (
              <aside className="desk-kpi">
                <div className="desk-kpi__label">Restart</div>
                <div className="desk-kpi__value">{o.restart.verdict}</div>
                <p className="desk-kpi__detail">{o.restart.summary}</p>
              </aside>
            ) : null}
          </div>
        ) : null}
        {gradeStage ? (
          <aside className="desk-kpi">
            <div className="desk-kpi__label">Restart</div>
            <div className="desk-kpi__value">{o.restart.verdict}</div>
            <p className="desk-kpi__detail">{o.restart.summary}</p>
          </aside>
        ) : null}
        {showVitals ? (
          <VitalGrid vitals={o.vitals} dense={cut !== 'full'} fill={vitalsStage} />
        ) : null}
        {showAttention ? (
          <div className="desk-plate">
            <div className="desk-plate__head">
              <span>Needs attention</span>
              <StatusPill tone="warn">{o.attention.length}</StatusPill>
            </div>
            <QueueRows
              items={o.attention.map((item) => ({
                key: item.label,
                title: item.label,
                detail: item.detail,
                trailing: (
                  <StatusPill
                    tone={
                      item.severity === 'critical'
                        ? 'danger'
                        : item.severity === 'warning'
                          ? 'warn'
                          : 'info'
                    }
                  >
                    {item.severity}
                  </StatusPill>
                ),
              }))}
            />
          </div>
        ) : null}
      </div>
    </DeskChrome>
  );
}

function LiveDialRow({ compact }: { compact?: boolean }) {
  const byLabel = Object.fromEntries(DESK.live.vitals.map((v) => [v.label, v]));
  const tps = Number(byLabel.TPS?.value ?? 19.4);
  const mspt = Number(byLabel.MSPT?.value ?? 48);
  const disk = Number(byLabel.Disk?.value ?? 71);
  void compact;

  return (
    <div className="grid grid-cols-3 gap-3" aria-label="Live vitals">
      <DeskRadialGauge
        value={tps}
        max={20}
        label="TPS"
        color="var(--wt-ch-tps)"
        className="w-full"
      />
      <DeskRadialGauge
        value={mspt}
        max={50}
        label="MSPT"
        color="var(--wt-ch-mspt)"
        className="w-full"
      />
      <DeskRadialGauge
        value={disk}
        max={100}
        label="Disk"
        unit="%"
        color="var(--wt-ch-disk)"
        className="w-full"
      />
    </div>
  );
}

function LiveCard({
  cut,
  chrome,
  compact,
}: {
  cut: DeskCut;
  chrome: DeskChrome;
  compact?: boolean;
}) {
  const showChart = cut === 'full';
  const useDials = cut === 'vitals' || cut === 'chart' || compact;
  const series = DESK.live.series;
  const max = Math.max(...series, 1);
  const norm = series.map((v) => v / max);

  return (
    <DeskChrome title="Live" chrome={chrome} badge={<StatusPill tone="ok">Watching</StatusPill>}>
      {useDials ? <LiveDialRow compact={compact} /> : <VitalGrid vitals={DESK.live.vitals} dense />}
      {showChart ? (
        <div className="desk-plate desk-plate--chart mt-3 border border-[color:var(--wt-line)] bg-[color:var(--wt-bg1)] p-3">
          <div className="desk-plate__head mb-2">
            <span>MSPT</span>
            <span className="desk-plate__hint">sample window</span>
          </div>
          <SeriesChart
            tracks={[{ id: 'mspt', label: 'MSPT', series: norm, color: 'var(--wt-warn)' }]}
            points={norm.length}
            mode="bar"
            valueAtFull={max}
            unit="ms"
            windowMs={60 * 60 * 1000}
            className="h-32 md:h-36"
          />
        </div>
      ) : null}
    </DeskChrome>
  );
}

function IssuesCard({
  cut,
  chrome,
  compact,
}: {
  cut: DeskCut;
  chrome: DeskChrome;
  compact?: boolean;
}) {
  const bands = (
    cut === 'bands' || cut === 'attention'
      ? DESK.issues.bands.filter((b) => b.key === 'critical' || b.key === 'warning')
      : DESK.issues.bands
  )
    .map((band) => ({
      ...band,
      // Compact peeks: titles only, keep both bands so the plate isn't empty.
      items: compact
        ? band.items.slice(0, band.key === 'critical' ? 2 : 2)
        : band.items,
    }))
    .filter((band) => band.items.length > 0);

  return (
    <DeskChrome
      title="Issues"
      chrome={chrome}
      badge={
        <StatusPill tone="danger">
          {DESK.issues.bands.reduce((n, b) => n + b.count, 0)} open
        </StatusPill>
      }
    >
      <div className={`desk-inbox${compact ? ' desk-inbox--compact' : ''}`}>
        {bands.map((band) => (
          <div key={band.key} className="desk-band">
            <div className="desk-band__head">
              <span>{band.label}</span>
              <StatusPill
                tone={band.key === 'critical' ? 'danger' : band.key === 'warning' ? 'warn' : 'info'}
              >
                {band.count}
              </StatusPill>
            </div>
            <QueueRows
              items={band.items.map((item) => ({
                key: item.title,
                title: item.title,
                detail: compact ? undefined : item.narrative,
                trailing: (
                  <span className="desk-queue__chev" aria-hidden>
                    →
                  </span>
                ),
              }))}
            />
          </div>
        ))}
      </div>
    </DeskChrome>
  );
}

function CrashesCard({
  chrome,
  compact,
}: {
  cut: DeskCut;
  chrome: DeskChrome;
  compact?: boolean;
}) {
  if (compact) {
    const items = DESK.crashes.items.slice(0, 3);
    return (
      <DeskChrome
        title="Crashes"
        chrome={chrome}
        badge={<StatusPill tone="warn">{DESK.crashes.unreviewed} unreviewed</StatusPill>}
      >
        <QueueRows
          items={items.map((c) => ({
            key: c.file,
            title: c.title,
            detail: c.summary,
            trailing: <StatusPill tone="neutral">{c.when}</StatusPill>,
          }))}
        />
      </DeskChrome>
    );
  }

  const days = DESK.crashes.days;
  const active =
    days.flatMap((d) => d.items).find((c) => c.active) ?? days[0]?.items[0] ?? DESK.crashes.items[0];
  const steps = active?.steps ?? [];

  return (
    <DeskChrome
      title="Crashes"
      chrome={chrome}
      badge={<StatusPill tone="danger">{DESK.crashes.needsReview} to review</StatusPill>}
    >
      <div className="desk-crash">
        <div className="desk-crash__chips" aria-hidden>
          {(['All', 'Mod', 'Hang', 'Host'] as const).map((k, i) => (
            <span key={k} className={`desk-crash__chip${i === 0 ? ' is-active' : ''}`}>
              {k}
            </span>
          ))}
        </div>

        <div className="desk-crash__split">
          <div className="desk-crash__list">
            {days.map((day) => {
              const open = day.items.length > 0;
              return (
                <div key={day.label} className={`desk-crash__day${open ? ' is-open' : ''}`}>
                  <div className="desk-crash__day-head">
                    <span className="desk-crash__day-label">
                      <span className="desk-crash__chev" aria-hidden>
                        {open ? '▾' : '▸'}
                      </span>
                      {day.label}
                    </span>
                    <span className="desk-crash__day-meta">
                      {day.open > 0 ? <StatusPill tone="warn">{day.open} open</StatusPill> : null}
                      {open ? (
                        <span className="desk-crash__day-count">{day.items.length}</span>
                      ) : null}
                    </span>
                  </div>
                  {open
                    ? day.items.map((c) => (
                        <div
                          key={c.file}
                          className={`desk-crash__row${c.active ? ' is-active' : ''}`}
                        >
                          <div className="desk-crash__row-top">
                            <span className="desk-crash__row-title">{c.title}</span>
                            <span className="desk-crash__row-when font-mono">{c.when}</span>
                          </div>
                          <p className="desk-crash__row-summary">{c.summary}</p>
                          <div className="desk-crash__row-pills">
                            <StatusPill tone={crashKindTone(c.kind)}>{c.kind}</StatusPill>
                            <StatusPill tone={c.confidence === 'High' ? 'ok' : 'warn'}>
                              {c.confidence}
                            </StatusPill>
                          </div>
                        </div>
                      ))
                    : null}
                </div>
              );
            })}
          </div>

          {active ? (
            <div className="desk-crash__detail">
              <div className="desk-crash__detail-pills">
                <StatusPill tone={crashKindTone(active.kind)}>{active.kind}</StatusPill>
                <StatusPill tone={active.confidence === 'High' ? 'ok' : 'warn'}>
                  {active.confidence} confidence
                </StatusPill>
              </div>
              <h3 className="desk-crash__detail-title">{active.title}</h3>
              <div className="desk-crash__file font-mono">{active.file}</div>
              <div className="desk-crash__tabs" role="tablist" aria-label="Crash panels">
                <span className="desk-crash__tab is-active" role="tab" aria-selected="true">
                  Fix
                </span>
                <span className="desk-crash__tab" role="tab" aria-selected="false">
                  Evidence
                </span>
                <span className="desk-crash__tab" role="tab" aria-selected="false">
                  Details
                </span>
              </div>
              <div className="desk-crash__panel">
                <div className="desk-crash__now-label">Do this now</div>
                <p className="desk-crash__now-lead">{active.summary}</p>
                {steps.length ? (
                  <ol className="desk-crash__steps">
                    {steps.map((step, i) => (
                      <li key={step}>
                        <span className="desk-crash__step-n" aria-hidden>
                          {i + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </DeskChrome>
  );
}

function InsightsCard({
  chrome,
  compact,
}: {
  cut: DeskCut;
  chrome: DeskChrome;
  compact?: boolean;
}) {
  const busy = compact ? DESK.insights.busy.slice(0, 3) : DESK.insights.busy;
  return (
    <DeskChrome title="Insights" chrome={chrome} badge={<StatusPill tone="info">{DESK.insights.window}</StatusPill>}>
      <div className={`desk-insights${compact ? ' desk-insights--center' : ''}`}>
        {compact ? (
          <div className="desk-plate">
            <div className="desk-plate__head">
              <span>Busy hours</span>
            </div>
            <div className="desk-busy">
              {busy.map((h) => (
                <div key={h.label} className="desk-busy__row">
                  <span className="desk-busy__label">{h.label}</span>
                  <span className="desk-busy__meta font-mono">
                    {h.avgPlayers.toFixed(1)} players
                  </span>
                  <span className="desk-busy__meta font-mono">{h.avgMspt.toFixed(1)} ms MSPT</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="border border-[color:var(--wt-line)] bg-[color:var(--wt-bg1)] p-2">
            <DeskHeatmap height={240} />
            <p className="mt-2 px-1 font-mono text-[0.7rem] text-[color:var(--wt-text-low)]">
              {DESK.insights.stickyLag}
            </p>
          </div>
        )}
      </div>
    </DeskChrome>
  );
}

function ModsCard({ chrome }: { cut: DeskCut; chrome: DeskChrome }) {
  return (
    <DeskChrome
      title="Mods"
      chrome={chrome}
      badge={<StatusPill tone="neutral">{DESK.mods.running} running</StatusPill>}
    >
      <QueueRows
        items={DESK.mods.rows.map((m) => ({
          key: m.name,
          title: m.name,
          detail: m.detail,
          trailing: (
            <StatusPill tone={m.severity === 'warning' ? 'warn' : 'info'}>{m.severity}</StatusPill>
          ),
        }))}
      />
      <p className="desk-footnote">Modrinth lookups fill names and versions. Never downloads a jar.</p>
    </DeskChrome>
  );
}

function BackupsCard({ chrome }: { cut: DeskCut; chrome: DeskChrome }) {
  return (
    <DeskChrome title="Backups" chrome={chrome} badge={<StatusPill tone="warn">Advisory</StatusPill>}>
      <QueueRows
        items={DESK.backups.rows.map((b) => ({
          key: b.name,
          title: b.name,
          detail: b.detail,
          trailing: (
            <StatusPill
              tone={
                b.status === 'Fresh'
                  ? 'ok'
                  : b.status === 'Aging' || b.status === 'Missing'
                    ? 'warn'
                    : 'neutral'
              }
            >
              {b.status}
            </StatusPill>
          ),
        }))}
      />
    </DeskChrome>
  );
}

function renderCard(
  surface: DeskSurface,
  cut: DeskCut,
  chrome: DeskChrome,
  compact?: boolean,
  stage?: boolean,
) {
  switch (surface) {
    case 'overview':
      return <OverviewCard cut={cut} chrome={chrome} stage={stage} compact={compact} />;
    case 'live':
      return <LiveCard cut={cut} chrome={chrome} compact={compact} />;
    case 'issues':
      return <IssuesCard cut={cut} chrome={chrome} compact={compact} />;
    case 'crashes':
      return <CrashesCard cut={cut} chrome={chrome} compact={compact} />;
    case 'insights':
      return <InsightsCard cut={cut} chrome={chrome} compact={compact} />;
    case 'mods':
      return <ModsCard cut={cut} chrome={chrome} />;
    case 'backups':
      return <BackupsCard cut={cut} chrome={chrome} />;
  }
}

export function ProductDesk({
  surface,
  sweep = false,
  glow: _glow = false,
  pointerGlow: _pointerGlow = false,
  spotlight: _spotlight = false,
  chrome = 'rail',
  cut = 'full',
  compact = false,
  stage = false,
  className = '',
}: {
  surface: DeskSurface;
  sweep?: boolean;
  /** @deprecated Flat desks — glow wash removed; prop ignored for API stability. */
  glow?: boolean;
  /** @deprecated Flat desks — spotlight removed; prop ignored for API stability. */
  pointerGlow?: false | 'accent' | 'ok' | 'warn' | 'danger';
  /** @deprecated Flat desks — spotlight removed; prop ignored for API stability. */
  spotlight?: boolean | 'accent' | 'lantern' | 'ok' | 'warn' | 'danger';
  chrome?: DeskChrome;
  cut?: DeskCut;
  /** Shorter marketing cuts: fewer rows, no long narratives. */
  compact?: boolean;
  /** Hero rotator: stretch content into the fixed stage frame. */
  stage?: boolean;
  className?: string;
}) {
  return (
    <div className={`desk-frame ${className}`}>
      <InstrumentPlate className="h-full">
        <div
          className={`desk-surface${compact ? ' desk-surface--compact' : ''}${
            stage ? ' desk-surface--stage' : ''
          }`}
        >
          {renderCard(surface, cut, chrome, compact, stage)}
          {sweep ? <WatchSweep /> : null}
        </div>
      </InstrumentPlate>
    </div>
  );
}
