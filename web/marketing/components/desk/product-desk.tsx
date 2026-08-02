'use client';

import type { ReactNode } from 'react';
import NumberFlow from '@number-flow/react';
import { motion, useReducedMotion } from 'motion/react';
import type { DeskSurface, DeskVital } from '@/content/baked/desk';
import { DESK } from '@/content/baked/desk';
import { InstrumentPlate } from '@/components/instrument-plate';
import { WatchSweep } from '@/components/watch-sweep';
import { StatusGlow } from '@/components/desk/status-glow';
import { DeskDial, type DialTone } from '@/components/desk/desk-dial';
import { type GlowTone } from '@/components/motion/desk-border-glow';
import { DeskSpotlight, type SpotTone } from '@/components/motion/desk-spotlight';
import '@/components/desk/desk.css';

const GLOW_TO_SPOT: Record<GlowTone, SpotTone> = {
  accent: 'accent',
  ok: 'ok',
  warn: 'warn',
  danger: 'danger',
};

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
      className={`desk-vitals${dense ? ' desk-vitals--dense' : ''}${fill ? ' desk-vitals--fill' : ''}`}
      aria-label="Live vitals"
    >
      {vitals.map((v) => (
        <div key={v.label} className={`desk-vital desk-vital--${v.tone}`}>
          <div className="desk-vital__label">{v.label}</div>
          <div className="desk-vital__row">
            <div className="desk-vital__value">
              <FlowValue value={v.value} />
            </div>
            <Spark values={v.spark} channel={v.channel} large={fill} />
          </div>
        </div>
      ))}
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
      badge={<StatusPill tone="danger">{o.word}</StatusPill>}
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
  const size = compact ? 118 : 142;
  const dials: Array<{
    label: string;
    value: number;
    max: number;
    suffix: string;
    tone: DialTone;
    decimals?: number;
  }> = [
    { label: 'TPS', value: 19.99, max: 20, suffix: '', tone: 'tps', decimals: 1 },
    { label: 'MSPT', value: 4.7, max: 50, suffix: 'ms', tone: 'mspt', decimals: 1 },
    { label: 'Heap', value: 79, max: 100, suffix: '%', tone: 'heap', decimals: 0 },
  ];

  // Prefer baked live vitals when present so marketing stays fixture-true.
  const byLabel = Object.fromEntries(DESK.live.vitals.map((v) => [v.label, v]));
  const resolved = dials.map((d) => {
    const baked = byLabel[d.label];
    if (!baked) return d;
    const n = Number(baked.value);
    return Number.isFinite(n) ? { ...d, value: n } : d;
  });

  return (
    <div className={`desk-dials${compact ? ' desk-dials--compact' : ''}`} aria-label="Live vitals">
      {resolved.map((d) => (
        <DeskDial
          key={d.label}
          label={d.label}
          value={d.value}
          max={d.max}
          suffix={d.suffix}
          tone={d.tone}
          size={size}
          decimals={d.decimals}
        />
      ))}
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
  const max = Math.max(...DESK.live.series);
  const reduce = useReducedMotion();
  const showChart = cut === 'full';
  const useDials = cut === 'vitals' || cut === 'chart' || compact;

  return (
    <DeskChrome title="Live" chrome={chrome} badge={<StatusPill tone="ok">Watching</StatusPill>}>
      {useDials ? <LiveDialRow compact={compact} /> : <VitalGrid vitals={DESK.live.vitals} dense />}
      {showChart ? (
        <div className="desk-plate desk-plate--chart">
          <div className="desk-plate__head">
            <span>MSPT</span>
            <span className="desk-plate__hint">sample window</span>
          </div>
          <div className="desk-bars" aria-hidden>
            {DESK.live.series.map((v, i) => (
              <motion.span
                key={i}
                className="desk-bars__col"
                initial={reduce ? false : { scaleY: 0.15 }}
                whileInView={{ scaleY: 1 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{
                  duration: 0.55,
                  delay: i * 0.02,
                  ease: [0.16, 1, 0.3, 1],
                }}
                style={{
                  height: `${Math.max(8, (v / max) * 100)}%`,
                  transformOrigin: 'bottom',
                }}
              />
            ))}
          </div>
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
                            <StatusPill tone={c.kind === 'Host' ? 'info' : 'warn'}>{c.kind}</StatusPill>
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
                <StatusPill tone={active.kind === 'Host' ? 'info' : 'warn'}>{active.kind}</StatusPill>
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
        {compact ? null : (
          <div className="desk-plate">
            <div className="desk-queue__title">{DESK.insights.stickyLag}</div>
            <div className="desk-queue__detail mt-2">{DESK.insights.storageHint}</div>
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
                b.status === 'Healthy' ? 'ok' : b.status === 'In progress' ? 'warn' : 'neutral'
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
  glow = false,
  pointerGlow = false,
  spotlight = false,
  chrome = 'rail',
  cut = 'full',
  compact = false,
  stage = false,
  className = '',
}: {
  surface: DeskSurface;
  sweep?: boolean;
  /** Status-keyed BorderGlow-style wash (hero only). */
  glow?: boolean;
  /**
   * Pointer spotlight (same language as Overview HeroReadout).
   * Accepts a tone for accent/warn/danger wash color.
   */
  pointerGlow?: false | GlowTone;
  /** Soft lantern/accent spotlight follow. */
  spotlight?: boolean | SpotTone;
  chrome?: DeskChrome;
  cut?: DeskCut;
  /** Shorter marketing cuts: fewer rows, no long narratives. */
  compact?: boolean;
  /** Hero rotator: stretch content into the fixed stage frame. */
  stage?: boolean;
  className?: string;
}) {
  let card = (
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
  );

  const spotTone: SpotTone | null = pointerGlow
    ? GLOW_TO_SPOT[pointerGlow]
    : spotlight === true
      ? 'lantern'
      : spotlight
        ? spotlight
        : null;

  if (spotTone) {
    card = (
      <DeskSpotlight tone={spotTone} className="h-full">
        {card}
      </DeskSpotlight>
    );
  }

  return (
    <div className={`desk-frame ${className}`}>
      {glow && surface === 'overview' ? (
        <StatusGlow tone={DESK.overview.tone} className="h-full">
          {card}
        </StatusGlow>
      ) : (
        card
      )}
    </div>
  );
}
