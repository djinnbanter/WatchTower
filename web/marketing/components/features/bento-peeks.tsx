'use client';

import { useId } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { ModrinthMark } from '@/components/brand/modrinth-mark';
import { SparkMark } from '@/components/brand/spark-mark';
import { DeskDial } from '@/components/desk/desk-dial';
import { CapabilityMark } from '@/components/features/capability-marks';
import {
  DeskRadialGauge,
  HashMeter,
  RingGauge,
  SeriesChart,
} from '@/components/poc-charts';
import { DESK } from '@/content/baked/desk';
import '@/components/desk/desk.css';
import './bento-peeks.css';

type Channel = 'tps' | 'mspt' | 'heap' | 'disk' | 'players' | 'cpu';

function Plate({
  children,
  className = '',
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={`bento-peek-plate ${className}`} style={style}>
      {children}
    </div>
  );
}

/**
 * Sparkline stretches to the card width (preserveAspectRatio none) with
 * non-scaling strokes, so wide cells get a wide chart instead of a
 * letterboxed 260px one floating in the middle.
 */
function PeekSparkline({
  values,
  channel = 'tps',
  label,
  pill,
  readout,
  height = 96,
}: {
  values: number[];
  channel?: Channel;
  label: string;
  pill?: string;
  readout?: string;
  height?: number;
}) {
  const uid = useId().replace(/[:]/g, '');
  const w = 260;
  const h = 100;
  const pad = 8;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = Math.max(max - min, 0.01);
  const pts = values.map((v, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * w;
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${line} L ${w} ${h} L 0 ${h} Z`;

  return (
    <div className="bento-peek__chart-shell">
      <div className="bento-peek__chart-head">
        <span className="bento-peek__kicker">{label}</span>
        <span className="bento-peek__chart-meta">
          {readout ? <span className="bento-peek__readout">{readout}</span> : null}
          {pill ? <span className="desk-pill desk-pill--ok">{pill}</span> : null}
        </span>
      </div>
      <svg
        className="bento-peek__spark"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        style={{ height }}
        aria-hidden
      >
        <defs>
          <linearGradient id={`spark-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={`var(--wt-ch-${channel})`} stopOpacity="0.24" />
            <stop offset="100%" stopColor={`var(--wt-ch-${channel})`} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((g) => (
          <line
            key={g}
            x1="0"
            x2={w}
            y1={h * g}
            y2={h * g}
            stroke="var(--wt-line)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <path d={area} fill={`url(#spark-${uid})`} />
        <path
          d={line}
          fill="none"
          stroke={`var(--wt-ch-${channel})`}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

function PeekBarSet({
  rows,
}: {
  rows: { label: string; pct: number; channel: Channel }[];
}) {
  return (
    <div className="bento-peek__col-bars" aria-hidden>
      {rows.map((r) => (
        <div key={r.label} className="bento-peek__col-bar">
          <span className="bento-peek__col-val">{r.pct}%</span>
          <span className="bento-peek__col-track">
            <span
              className="bento-peek__col-fill"
              style={{ height: `${r.pct}%`, background: `var(--wt-ch-${r.channel})` }}
            />
          </span>
          <span className="bento-peek__col-cap">{r.label}</span>
        </div>
      ))}
    </div>
  );
}

function PeekInstrumentGrid({ active = 'live-vitals' }: { active?: string }) {
  const cells = [
    { id: 'live-vitals', label: 'TPS' },
    { id: 'gc-ram', label: 'Heap' },
    { id: 'schedule-load', label: 'Load' },
    { id: 'storage-runway', label: 'Disk' },
    { id: 'sources', label: 'Poll' },
    { id: 'startup', label: 'Boot' },
  ];
  return (
    <div className="bento-peek__igrid" aria-hidden>
      {cells.map((c) => (
        <span key={c.id} className={`bento-peek__icell${c.id === active ? ' is-on' : ''}`}>
          <CapabilityMark id={c.id} size="md" />
          <span>{c.label}</span>
        </span>
      ))}
    </div>
  );
}

/** Desk mission grades: A Healthy, B Needs attention, F Critical + restart advice. */
export function PeekHealthGrade() {
  const grades = [
    {
      letter: 'A',
      tone: 'ok' as const,
      word: 'Healthy',
      detail: 'Inbox clear · ticks steady',
      hint: 'Restart when you want',
      restart: { label: 'Safe', pill: 'ok' as const },
    },
    {
      letter: 'B',
      tone: 'warn' as const,
      word: 'Needs attention',
      detail: '5 open · disk runway + MSPT',
      hint: 'Playable — fix before Friday',
      restart: { label: 'Caution', pill: 'warn' as const },
    },
    {
      letter: 'F',
      tone: 'danger' as const,
      word: 'Critical',
      detail: 'Crash open · do not bounce yet',
      hint: 'Read the report first',
      restart: { label: 'Wait', pill: 'neutral' as const },
    },
  ];
  return (
    <div className="bento-peek bento-peek--health" aria-hidden>
      <div className="bento-peek__grade-fan">
        <div className="bento-peek__grade-head">
          <span className="bento-peek__kicker">Letter grade</span>
          <span className="bento-peek__sub">+ restart advice</span>
        </div>
        {grades.map((g, i) => (
          <Plate
            key={g.letter}
            className={`bento-peek__card bento-peek__grade-card bento-peek__grade-card--${g.tone} bento-peek__grade-card--${i}`}
          >
            <div className="bento-peek__grade-row">
              <span className={`desk-grade desk-grade--${g.tone}`}>
                <span className="desk-grade__letter">{g.letter}</span>
              </span>
              <div className="bento-peek__grade-copy">
                <div className="bento-peek__grade-word">{g.word}</div>
                <div className="bento-peek__sub">{g.detail}</div>
                <div className="bento-peek__grade-hint">{g.hint}</div>
              </div>
              <span className={`desk-pill desk-pill--${g.restart.pill}`}>{g.restart.label}</span>
            </div>
          </Plate>
        ))}
        <div className="bento-peek__grade-foot">Advisory only — WatchTower never restarts for you</div>
      </div>
    </div>
  );
}

export function PeekFixInbox() {
  const items = [
    {
      tone: 'danger' as const,
      sev: 'Critical',
      title: 'Disk runway under 14 days',
      ago: '2h ago',
      rank: '1',
    },
    {
      tone: 'warn' as const,
      sev: 'Warning',
      title: 'Entity spike near spawn',
      ago: '46m ago',
      rank: '2',
    },
    {
      tone: 'warn' as const,
      sev: 'Warning',
      title: 'create - 14 log errors',
      ago: '3h ago',
      rank: '3',
    },
  ];
  return (
    <div className="bento-peek bento-peek--inbox" aria-hidden>
      <div className="bento-peek__inbox-head">
        <div>
          <span className="bento-peek__kicker">Fix inbox</span>
          <span className="bento-peek__inbox-title">5 open · ranked</span>
        </div>
        <span className="desk-pill desk-pill--danger">1 critical</span>
      </div>
      <ul className="bento-peek__queue">
        {items.map((it, i) => (
          <li key={it.title} className={`bento-peek__q-row bento-peek__q-row--${i}`}>
            <span className={`bento-peek__dot bento-peek__dot--${it.tone}`} />
            <span className="bento-peek__q-text">
              <span className="bento-peek__q-title">{it.title}</span>
              <span className="bento-peek__q-detail">
                {it.sev} · {it.ago}
              </span>
            </span>
            <span className="bento-peek__q-rank">#{it.rank}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function entityPieSlices(
  slices: ReadonlyArray<{ label: string; count: number; color: string }>,
  cx: number,
  cy: number,
  r: number,
) {
  const total = slices.reduce((sum, s) => sum + s.count, 0) || 1;
  let angle = -Math.PI / 2;
  return slices.map((s) => {
    const sweep = (s.count / total) * Math.PI * 2;
    const a0 = angle;
    const a1 = angle + sweep;
    angle = a1;
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const large = sweep > Math.PI ? 1 : 0;
    const d = `M ${cx} ${cy} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
    return { ...s, d, pct: Math.round((s.count / total) * 100) };
  });
}

export function PeekWorldPressure() {
  const entities = [
    { label: 'Dropped items', count: 1842, color: 'var(--wt-ch-mspt)' },
    { label: 'Chicken', count: 412, color: 'var(--wt-ch-tps)' },
    { label: 'Sheep', count: 286, color: 'var(--wt-ch-disk)' },
    { label: 'Other', count: 318, color: 'var(--wt-ch-players)' },
  ];
  const slices = entityPieSlices(entities, 60, 60, 52);
  const total = entities.reduce((sum, s) => sum + s.count, 0);
  const flags = [
    { tone: 'warn' as const, text: 'Item storm' },
    { tone: 'info' as const, text: 'Unattended loaders' },
    { tone: 'warn' as const, text: 'Chunks 71%' },
  ];
  return (
    <div className="bento-peek bento-peek--pressure" aria-hidden>
      <Plate className="bento-peek__pressure-panel">
        <div className="bento-peek__pressure-head">
          <div>
            <span className="bento-peek__kicker">Loaded entities</span>
            <span className="bento-peek__pressure-title">{total.toLocaleString('en-US')} in view</span>
          </div>
          <span className="desk-pill desk-pill--warn">Pressure</span>
        </div>

        <div className="bento-peek__entity-pie">
          <svg className="bento-peek__entity-svg" viewBox="0 0 120 120" aria-hidden>
            {slices.map((s) => (
              <path key={s.label} d={s.d} fill={s.color} />
            ))}
            <circle cx="60" cy="60" r="28" fill="var(--wt-bg0)" />
            <text
              x="60"
              y="58"
              textAnchor="middle"
              className="bento-peek__entity-center-val"
            >
              {slices[0]?.pct}%
            </text>
            <text
              x="60"
              y="72"
              textAnchor="middle"
              className="bento-peek__entity-center-label"
            >
              items
            </text>
          </svg>
          <ul className="bento-peek__entity-legend">
            {slices.map((s) => (
              <li key={s.label}>
                <span className="bento-peek__entity-swatch" style={{ background: s.color }} />
                <span className="bento-peek__entity-name">{s.label}</span>
                <span className="bento-peek__mono">{s.count.toLocaleString('en-US')}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bento-peek__pressure-flags">
          {flags.map((f) => (
            <span key={f.text} className={`desk-pill desk-pill--${f.tone}`}>
              {f.text}
            </span>
          ))}
        </div>
      </Plate>
    </div>
  );
}

export function PeekJoinStrip() {
  const chips = [
    { id: 'join-clinic', text: 'Named mod diffs', tone: '' },
    { id: 'jar-drift', text: 'Player-safe fix copy', tone: ' bento-peek__chip--warn' },
    { id: 'mods-modrinth', text: 'No jar downloads', tone: '' },
  ];
  return (
    <div className="bento-peek bento-peek--strip" aria-hidden>
      {chips.map((c) => (
        <span key={c.id} className={`bento-peek__chip${c.tone}`}>
          <span className="bento-peek__chip-icon">
            <CapabilityMark id={c.id} size="md" />
          </span>
          {c.text}
        </span>
      ))}
    </div>
  );
}

/** Half-width Join Clinic fixture — session + mismatch, not a chip strip alone. */
export function PeekJoinClinic() {
  const diffs = [
    { mod: 'create', detail: 'client missing 6.0.4' },
    { mod: 'create', detail: 'server 6.0.4 · pack list sent' },
  ];
  const online = [
    { name: 'djinn', meta: '2h 14m' },
    { name: 'mica', meta: '41m' },
    { name: 'sable', meta: '18m' },
  ];
  return (
    <div className="bento-peek bento-peek--join" aria-hidden>
      <Plate className="bento-peek__join-panel">
        <div className="bento-peek__join-head">
          <div>
            <span className="bento-peek__kicker">Session · Join Clinic</span>
            <span className="bento-peek__join-title">12 online · 2 blocked</span>
          </div>
          <span className="desk-pill desk-pill--warn">Pack sync</span>
        </div>

        <div className="bento-peek__join-split">
          <div className="bento-peek__join-fail">
            <span className="bento-peek__kicker">NotchFan42 · reject</span>
            <ul className="bento-peek__join-diffs">
              {diffs.map((d) => (
                <li key={`${d.mod}-${d.detail}`}>
                  <code>{d.mod}</code>
                  <span>{d.detail}</span>
                </li>
              ))}
            </ul>
          </div>
          <ul className="bento-peek__join-online">
            {online.map((p) => (
              <li key={p.name}>
                <span className="bento-peek__join-dot" />
                <span className="bento-peek__join-name">{p.name}</span>
                <span className="bento-peek__mono">{p.meta}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bento-peek__join-chips">
          <span className="bento-peek__chip">
            <span className="bento-peek__chip-icon">
              <CapabilityMark id="join-clinic" size="md" />
            </span>
            Named mod diffs
          </span>
          <span className="bento-peek__chip bento-peek__chip--warn">
            <span className="bento-peek__chip-icon">
              <CapabilityMark id="jar-drift" size="md" />
            </span>
            Player-safe fix copy
          </span>
          <span className="bento-peek__chip">
            <span className="bento-peek__chip-icon">
              <CapabilityMark id="mods-modrinth" size="md" />
            </span>
            No jar downloads
          </span>
        </div>
      </Plate>
    </div>
  );
}

/** Wide Live cell — desk instrument: chart + dial column (not a thin spark over tiny gauges). */
/** Monotone-ish cubic through points — keeps TPS chart from looking like stretched polylines. */
function smoothLine(pts: ReadonlyArray<readonly [number, number]>): string {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

export function PeekLiveChart() {
  const series = DESK.live.series;
  const max = Math.max(...series, 1);
  const norm = series.map((v) => v / max);
  const tps = DESK.live.vitals.find((v) => v.label === 'TPS');
  const mspt = DESK.live.vitals.find((v) => v.label === 'MSPT');
  const disk = DESK.live.vitals.find((v) => v.label === 'Disk');

  return (
    <div className="bento-peek bento-peek--live" aria-hidden>
      <Plate className="bento-peek__live-panel !p-3">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="bento-peek__kicker">Live · MSPT window</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-2xl tabular-nums text-[color:var(--wt-text)]">
                {tps?.value ?? '19.4'}
              </span>
              <span className="desk-pill desk-pill--warn">MSPT {mspt?.value ?? '48'}ms</span>
            </div>
          </div>
          <div className="flex gap-3">
            <DeskRadialGauge
              value={Number(tps?.value ?? 19.4)}
              max={20}
              label="TPS"
              color="var(--wt-ok)"
              className="w-24"
            />
            <RingGauge
              pct={Number(disk?.value ?? 71)}
              ink="var(--wt-warn)"
              label="disk"
              sizeClassName="mx-auto aspect-square max-h-24 w-24"
            />
          </div>
        </div>
        <SeriesChart
          tracks={[{ id: 'mspt', label: 'MSPT', series: norm, color: 'var(--wt-warn)' }]}
          points={norm.length}
          mode="line"
          valueAtFull={max}
          unit="ms"
          windowMs={60 * 60 * 1000}
          className="h-36 md:h-40"
        />
      </Plate>
    </div>
  );
}
export function PeekSupportPack() {
  const rows = [
    { file: 'facts.json', note: 'redacted' },
    { file: 'brief.md', note: 'plain English' },
    { file: 'evidence/', note: 'logs + crash' },
  ];
  return (
    <div className="bento-peek bento-peek--side" aria-hidden>
      <div className="bento-peek__support">
        <div className="bento-peek__support-head">
          <span className="bento-peek__kicker">Support pack</span>
          <span className="bento-peek__support-status">Ready</span>
        </div>
        <ul className="bento-peek__support-list">
          {rows.map((r) => (
            <li key={r.file} className="bento-peek__support-row">
              <span className="bento-peek__support-file">{r.file}</span>
              <span className="bento-peek__support-note">{r.note}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function PeekSparkStamp() {
  return (
    <div className="bento-peek bento-peek--spark" aria-hidden>
      <Plate className="bento-peek__spark-panel">
        <div className="bento-peek__spark-head">
          <SparkMark size={36} className="bento-peek__spark-logo" />
          <div className="bento-peek__spark-head-text">
            <span className="bento-peek__kicker">Spark profile</span>
            <span className="bento-peek__spark-title">20.37.29</span>
          </div>
          <span className="desk-pill desk-pill--danger">critical</span>
        </div>

        <div className="bento-peek__spark-metrics">
          <div className="bento-peek__spark-metric">
            <span className="bento-peek__spark-metric-val bento-peek__spark-metric-val--danger">11.9</span>
            <span className="bento-peek__sub">TPS</span>
          </div>
          <div className="bento-peek__spark-metric">
            <span className="bento-peek__spark-metric-val">81.7</span>
            <span className="bento-peek__sub">ms typ.</span>
          </div>
          <div className="bento-peek__spark-metric">
            <span className="bento-peek__spark-metric-val bento-peek__spark-metric-val--danger">778</span>
            <span className="bento-peek__sub">ms worst</span>
          </div>
        </div>

        <div className="bento-peek__spark-step">
          <span className="bento-peek__kicker">Top step</span>
          <div className="bento-peek__spark-step-row">
            <code className="bento-peek__spark-step-code">ContinuousOBBCollider.collideMany</code>
            <span className="bento-peek__mono">8.2%</span>
          </div>
        </div>
      </Plate>
    </div>
  );
}

function PeekGcRam() {
  return (
    <div className="bento-peek bento-peek--gc" aria-hidden>
      <Plate className="bento-peek__gc-panel">
        <div className="bento-peek__gc-head">
          <div className="bento-peek__gc-head-text">
            <span className="bento-peek__kicker">RAM advice</span>
            <p className="bento-peek__gc-advice">Heap is the pressure — GC pauses are quiet.</p>
          </div>
          <span className="desk-pill desk-pill--warn">Maybe</span>
        </div>

        <div className="bento-peek__gc-meters">
          <div className="bento-peek__gc-meter bento-peek__gc-meter--heap">
            <DeskDial value={72} max={100} label="Heap" suffix="%" tone="heap" size={108} decimals={0} />
            <span className="bento-peek__gc-meter-note">Pressure</span>
          </div>

          <div className="bento-peek__gc-meter bento-peek__gc-meter--pause">
            <div className="bento-peek__gc-pause-top">
              <span className="bento-peek__kicker">GC pause share</span>
              <span className="desk-pill desk-pill--ok">Low</span>
            </div>
            <div className="bento-peek__gc-pause-readout">
              <span className="bento-peek__gc-pause-val">8%</span>
              <span className="bento-peek__sub">of wall time</span>
            </div>
            <div className="bento-peek__bar-track bento-peek__bar-track--lg">
              <span className="bento-peek__bar-fill" style={{ width: '8%', background: 'var(--wt-ok)' }} />
            </div>
            <span className="bento-peek__gc-meter-note">Not the bottleneck</span>
          </div>
        </div>

        <div className="bento-peek__gc-flags">
          <span className="desk-pill desk-pill--info">G1GC</span>
          <span className="desk-pill desk-pill--neutral">-Xmx8G</span>
          <span className="bento-peek__gc-flags-hint">Raise heap before chasing GC flags</span>
        </div>
      </Plate>
    </div>
  );
}

function PeekCrashFingerprints() {
  const groups = [
    {
      title: 'Create contraption collision',
      when: '49m ago',
      kind: 'Mod',
      confidence: 'Medium',
      summary: 'Stop the stuck assembly so the world can load, then update Create if needed.',
      active: true,
      steps: [
        'Stop the stuck assembly first so the world can load again.',
        'Replace the broken Create jar with a matching build.',
        'Find the contraption controller / bearing that null-pathed.',
      ],
    },
    {
      title: 'Create crashed while ticking',
      when: '6h ago',
      kind: 'Mod',
      confidence: 'Medium',
      summary: 'Inspect the stack and update Create or matching addons.',
      active: false,
    },
    {
      title: 'External kill / OOM',
      when: 'Unreviewed',
      kind: 'Host',
      confidence: 'High',
      summary: 'Host SIGKILL · reconstructed from logs · no crash report',
      active: false,
      host: true,
    },
  ];
  const active = groups.find((g) => g.active) ?? groups[0]!;

  return (
    <div className="bento-peek bento-peek--crashes" aria-hidden>
      <div className="bento-peek__crashes-head">
        <div>
          <span className="bento-peek__kicker">Crash center</span>
          <span className="bento-peek__inbox-title">11 to review · grouped</span>
        </div>
        <span className="desk-pill desk-pill--danger">Mod · Host</span>
      </div>

      <div className="bento-peek__crashes-split">
        <div className="bento-peek__crashes-list">
          {groups.map((g) => (
            <div
              key={g.title}
              className={`bento-peek__crash-row${g.active ? ' is-active' : ''}${
                g.host ? ' bento-peek__crash-row--host' : ''
              }`}
            >
              <div className="bento-peek__crash-row-top">
                <span className="bento-peek__crash-row-title">{g.title}</span>
                <span className="bento-peek__crash-row-when">{g.when}</span>
              </div>
              <div className="bento-peek__crash-row-pills">
                <span
                  className={`desk-pill desk-pill--${
                    g.kind === 'Host' ? 'info' : 'warn'
                  }`}
                >
                  {g.kind}
                </span>
                <span
                  className={`desk-pill desk-pill--${
                    g.confidence === 'High' ? 'ok' : 'warn'
                  }`}
                >
                  {g.confidence}
                </span>
                {g.host ? (
                  <span className="desk-pill desk-pill--neutral">No report</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <Plate className="bento-peek__crash-detail">
          <div className="bento-peek__crash-detail-tabs">
            <span className="bento-peek__crash-tab is-active">Fix</span>
            <span className="bento-peek__crash-tab">Evidence</span>
            <span className="bento-peek__crash-tab">Details</span>
          </div>
          <div className="bento-peek__crash-detail-title">{active.title}</div>
          <p className="bento-peek__crash-detail-lead">{active.summary}</p>
          <ol className="bento-peek__crash-steps">
            {(active.steps ?? []).map((step, i) => (
              <li key={step}>
                <span className="bento-peek__crash-step-n">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </Plate>
      </div>
    </div>
  );
}

function PeekExternalKill() {
  const cases = [
    {
      tone: 'danger' as const,
      pill: 'OOM',
      title: 'Host killer',
      evidence: 'Killed process java · total-vm 8G',
      cause: 'Memory limit hit',
      fix: 'Raise host/container RAM',
      meta: 'No crash report',
    },
    {
      tone: 'warn' as const,
      pill: 'Panel',
      title: 'Force-kill',
      evidence: 'Abrupt stop · SIGKILL window',
      cause: 'Watchdog / stop timeout',
      fix: 'Lengthen stop grace',
      meta: 'No crash report',
    },
  ];
  return (
    <div className="bento-peek bento-peek--kill" aria-hidden>
      {cases.map((c) => (
        <Plate key={c.pill} className={`bento-peek__kill-card bento-peek__kill-card--${c.tone}`}>
          <div className="bento-peek__kill-head">
            <span className={`desk-pill desk-pill--${c.tone}`}>{c.pill}</span>
            <span className="bento-peek__sub">{c.meta}</span>
          </div>
          <div className="bento-peek__kill-title">{c.title}</div>
          <code className="bento-peek__kill-evidence">{c.evidence}</code>
          <div className="bento-peek__kill-meta">
            <span>{c.cause}</span>
            <span className="bento-peek__kill-fix">{c.fix}</span>
          </div>
        </Plate>
      ))}
    </div>
  );
}

function PeekSilentFails() {
  const rows = [
    {
      tone: 'warn' as const,
      src: 'KubeJS',
      detail: 'recipes.js:142 · Failed to parse recipe',
      ago: '3m',
    },
    {
      tone: 'warn' as const,
      src: 'CraftTweaker',
      detail: '/reload aborted · script error',
      ago: '12m',
    },
    {
      tone: 'info' as const,
      src: 'Datapack',
      detail: 'function tag missing · #minecraft:tick',
      ago: '1h',
    },
    {
      tone: 'warn' as const,
      src: 'KubeJS',
      detail: 'server_scripts · event never fired',
      ago: '2h',
    },
  ];
  return (
    <div className="bento-peek bento-peek--silent" aria-hidden>
      <Plate className="bento-peek__silent-panel">
        <div className="bento-peek__silent-head">
          <span className="bento-peek__kicker">No crash · still Issues</span>
          <span className="desk-pill desk-pill--warn">4 open</span>
        </div>
        <ul className="bento-peek__silent-list">
          {rows.map((r) => (
            <li key={`${r.src}-${r.ago}`} className={`bento-peek__silent-row bento-peek__silent-row--${r.tone}`}>
              <span className={`bento-peek__dot bento-peek__dot--${r.tone}`} />
              <span className="bento-peek__silent-body">
                <span className="bento-peek__silent-src">{r.src}</span>
                <span className="bento-peek__silent-detail">{r.detail}</span>
              </span>
              <span className="bento-peek__silent-ago">{r.ago}</span>
            </li>
          ))}
        </ul>
      </Plate>
    </div>
  );
}

function PeekMods() {
  const rows = [
    {
      id: 'create',
      name: 'Create',
      ver: '6.0.4',
      tone: 'ok' as const,
      badge: 'Server',
      selected: false,
      hue: 'var(--wt-ch-mspt)',
    },
    {
      id: 'jei',
      name: 'Just Enough Items',
      ver: '19.21.0',
      tone: 'ok' as const,
      badge: 'Server',
      selected: false,
      hue: 'var(--wt-accent)',
    },
    {
      id: 'optifine',
      name: 'OptiFine',
      ver: 'conflict',
      tone: 'warn' as const,
      badge: 'Client-only',
      selected: true,
      hue: 'var(--wt-warn)',
    },
  ];
  return (
    <div className="bento-peek bento-peek--mods" aria-hidden>
      <Plate className="bento-peek__mods-panel">
        <div className="bento-peek__mods-split">
          <div className="bento-peek__mods-catalog">
            <div className="bento-peek__config-head">
              <span className="bento-peek__kicker">Catalog</span>
              <span className="bento-peek__readout">58 running</span>
            </div>
            <ul className="bento-peek__mods-list">
              {rows.map((m) => (
                <li
                  key={m.id}
                  className={`bento-peek__mods-row${m.selected ? ' is-selected' : ''}`}
                >
                  <span className="bento-peek__mods-icon" style={{ background: m.hue }}>
                    {m.name.slice(0, 1)}
                  </span>
                  <span className="bento-peek__mods-main">
                    <span className="bento-peek__mods-name">{m.name}</span>
                    <span className="bento-peek__sub">
                      {m.ver} · {m.id}
                    </span>
                  </span>
                  <span className={`desk-pill desk-pill--${m.tone}`}>{m.badge}</span>
                </li>
              ))}
            </ul>
          </div>

          <aside className="bento-peek__mods-hint">
            <div className="bento-peek__mods-hint-head">
              <span className="bento-peek__mods-mr">
                <ModrinthMark className="bento-peek__mods-mr-logo" />
                Modrinth
              </span>
              <span className="desk-pill desk-pill--info">Hint</span>
            </div>
            <div className="bento-peek__mods-hint-title">OptiFine · client-only jar</div>
            <p className="bento-peek__mods-hint-body">
              High-confidence client jar on a dedicated server. Lookup only — WatchTower never downloads jars.
            </p>
            <div className="bento-peek__mods-hint-meta">
              <span>slug · optifine</span>
              <span>lookup only</span>
            </div>
          </aside>
        </div>
      </Plate>
    </div>
  );
}

function PeekJarDrift() {
  const rows = [
    { mark: '~', tone: 'warn' as const, jar: 'create-6.0.0.jar', detail: 'checksum drift' },
    { mark: '+', tone: 'ok' as const, jar: 'sodium-extra-0.6.jar', detail: 'added since baseline' },
    { mark: '!', tone: 'danger' as const, jar: 'optifine-1.21.jar', detail: 'client-only on server' },
  ];
  return (
    <div className="bento-peek bento-peek--drift" aria-hidden>
      <Plate className="bento-peek__drift-panel">
        <div className="bento-peek__drift-head">
          <div className="bento-peek__drift-side">
            <span className="bento-peek__kicker">Baseline</span>
            <code className="bento-peek__hash">e7c1…90af</code>
          </div>
          <span className="bento-peek__drift-arrow" aria-hidden>
            →
          </span>
          <div className="bento-peek__drift-side">
            <span className="bento-peek__kicker">Now</span>
            <code className="bento-peek__hash is-warn">b44d…12ce</code>
          </div>
          <span className="desk-pill desk-pill--warn">3 diffs</span>
        </div>
        <ul className="bento-peek__drift-list">
          {rows.map((r) => (
            <li key={r.jar} className={`bento-peek__drift-row bento-peek__drift-row--${r.tone}`}>
              <span className="bento-peek__drift-mark">{r.mark}</span>
              <span className="bento-peek__drift-text">
                <code>{r.jar}</code>
                <span className="bento-peek__sub">{r.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </Plate>
    </div>
  );
}

/** Deterministic week×hour load (0–100) — real-shaped busy evenings, quiet nights. */
const SCHEDULE_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const SCHEDULE_HOURS = 12; // 2-hour buckets: 00,02,…,22
/** Fri 18:00–20:00 bucket — matches “Peak Fri 19:00”. */
const SCHEDULE_PEAK = { day: 4, h: 9 } as const;

function scheduleLoad(day: number, hourBucket: number): number {
  const hour = hourBucket * 2;
  // Diurnal curve: dead overnight → soft afternoon climb → evening peak ~19.
  let v: number;
  if (hour < 6) v = 4 + hour;
  else if (hour < 10) v = 12 + (hour - 6) * 5;
  else if (hour < 14) v = 32 + (hour - 10) * 4;
  else if (hour < 16) v = 48 + (hour - 14) * 5;
  else if (hour === 16) v = 62;
  else if (hour === 18) v = 100; // 18–20 bucket covers Peak Fri 19:00
  else if (hour === 20) v = 82;
  else v = 38; // 22

  // Day shape — Fri hottest evening, weekends lively, Tue quiet for restarts.
  const eveningScale = [0.62, 0.58, 0.68, 0.78, 1, 0.88, 0.72][day] ?? 0.7;
  const dayScale = [0.85, 0.8, 0.88, 0.92, 1, 1.05, 0.9][day] ?? 0.9;
  if (hour >= 16) v *= eveningScale;
  else v *= dayScale;

  // Tue 04–06 restart window — especially quiet.
  if (day === 1 && hour >= 4 && hour < 8) v *= 0.22;
  // Sat afternoon play session.
  if (day === 5 && hour >= 12 && hour < 18) v *= 1.22;
  // Sun evening drops earlier.
  if (day === 6 && hour >= 20) v *= 0.55;
  // Weekday mid-morning quieter.
  if (day <= 3 && hour >= 8 && hour < 12) v *= 0.72;

  const jitter = ((day * 17 + hourBucket * 13) % 7) - 3;
  return Math.max(3, Math.min(100, Math.round(v + jitter)));
}

function scheduleHeatColor(v: number): string {
  // Cool steel → ember → hazard (no parchment yellow).
  if (v < 18) {
    return `color-mix(in srgb, #52525b ${10 + v}%, var(--wt-bg2))`;
  }
  if (v < 40) {
    const t = (v - 18) / 22;
    return `color-mix(in srgb, #1e3a5f ${Math.round(22 + t * 40)}%, var(--wt-bg2))`;
  }
  if (v < 68) {
    const t = (v - 40) / 28;
    return `color-mix(in srgb, var(--wt-accent) ${Math.round(28 + t * 42)}%, #1e3a5f)`;
  }
  const t = (v - 68) / 32;
  return `color-mix(in srgb, var(--wt-danger) ${Math.round(35 + t * 45)}%, var(--wt-accent))`;
}

function PeekSchedule() {
  const cells = SCHEDULE_DAYS.flatMap((_, day) =>
    Array.from({ length: SCHEDULE_HOURS }, (_, h) => ({
      day,
      h,
      v: scheduleLoad(day, h),
    })),
  );
  return (
    <div className="bento-peek bento-peek--schedule" aria-hidden>
      <Plate className="bento-peek__schedule-panel">
        <div className="bento-peek__schedule-head">
          <div>
            <span className="bento-peek__kicker">Hour × day</span>
            <span className="bento-peek__schedule-peak">Peak Fri 19:00</span>
          </div>
          <div className="bento-peek__pills">
            <span className="desk-pill desk-pill--warn">Busy</span>
            <span className="desk-pill desk-pill--info">Quiet</span>
          </div>
        </div>

        <div className="bento-peek__heatmap">
          <div className="bento-peek__heatmap-grid">
            {SCHEDULE_DAYS.map((label, day) => (
              <div key={label} className="bento-peek__heatmap-row">
                <span className="bento-peek__heatmap-day">{label}</span>
                <div className="bento-peek__heatmap-cells">
                  {cells
                    .filter((c) => c.day === day)
                    .map((c) => {
                      const peak =
                        c.day === SCHEDULE_PEAK.day && c.h === SCHEDULE_PEAK.h;
                      return (
                        <span
                          key={`${c.day}-${c.h}`}
                          className={`bento-peek__heatmap-cell${peak ? ' is-peak' : ''}`}
                          style={{ background: scheduleHeatColor(c.v) }}
                        />
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
          <div className="bento-peek__heatmap-axis">
            <span>00</span>
            <span>12</span>
            <span>22</span>
          </div>
        </div>

        <div className="bento-peek__schedule-foot">
          <span>
            Restart window <strong>Tue 05:00</strong>
          </span>
          <span className="bento-peek__schedule-legend" aria-hidden>
            <span>quiet</span>
            <span className="bento-peek__schedule-legend-bar" />
            <span>busy</span>
          </span>
        </div>
      </Plate>
    </div>
  );
}

function PeekStorage() {
  const s = DESK.insights.storage;

  return (
    <div className="bento-peek bento-peek--storage" aria-hidden>
      <Plate className="bento-peek__storage-panel">
        <div className="bento-peek__storage-split">
          <div className="bento-peek__storage-dims">
            <div className="bento-peek__kicker">By dimension</div>
            <div className="bento-peek__storage-dim-list">
              {s.dims.map((d) => (
                <div key={d.label} className="bento-peek__storage-dim-row">
                  <span className="bento-peek__storage-dim-label">{d.label}</span>
                  <HashMeter
                    value={d.pct}
                    ink="var(--wt-ch-disk)"
                    className="min-w-0 flex-1"
                    trackClassName="h-2"
                  />
                  <span className="bento-peek__storage-dim-gb">{d.gb}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bento-peek__storage-runway">
            <div className="bento-peek__runway-head">
              <span className="bento-peek__kicker">Disk runway</span>
              <span className="desk-pill desk-pill--warn">{s.usedPct}% used</span>
            </div>

            <div className="bento-peek__runway-body">
              <div className="bento-peek__runway-copy">
                <div className="bento-peek__runway-hero">
                  <span className="bento-peek__runway-days">~{s.daysLeft}</span>
                  <span className="bento-peek__runway-unit">days left</span>
                </div>
                <p className="bento-peek__runway-facts">
                  +{s.fillPerDayPct}%/day · {s.freeGb}G free
                </p>
              </div>
              <RingGauge
                pct={s.usedPct}
                ink="var(--wt-warn)"
                label="used"
                sizeClassName="bento-peek__runway-dial aspect-square h-[5.5rem] w-[5.5rem] shrink-0"
              />
            </div>
          </div>
        </div>
      </Plate>
    </div>
  );
}

function PeekDigest() {
  return (
    <div className="bento-peek" aria-hidden>
      <Plate className="bento-peek__card">
        <div className="bento-peek__kicker">Weekly rollup</div>
        <div className="bento-peek__digest-row">
          <span>Grade</span>
          <strong>B</strong>
        </div>
        <div className="bento-peek__digest-row">
          <span>Crashes</span>
          <strong>1 open</strong>
        </div>
        <div className="bento-peek__digest-row">
          <span>Next</span>
          <strong>Trim disk runway</strong>
        </div>
      </Plate>
    </div>
  );
}

function PeekConfig() {
  const rows = [
    {
      tone: 'ok' as const,
      verdict: 'Keep',
      setting: 'view-distance',
      value: '10',
      why: 'Fine for this pack',
    },
    {
      tone: 'warn' as const,
      verdict: 'Tweak',
      setting: 'max-tick-time',
      value: '-1',
      why: 'Hides stuck ticks',
    },
    {
      tone: 'info' as const,
      verdict: 'Why',
      setting: 'G1GC flags',
      value: 'partial',
      why: 'Missing Aikar set',
    },
  ];
  return (
    <div className="bento-peek bento-peek--config" aria-hidden>
      <Plate className="bento-peek__config-panel">
        <div className="bento-peek__config-head">
          <span className="bento-peek__kicker">server.properties</span>
          <span className="bento-peek__readout">3 findings</span>
        </div>
        <ul className="bento-peek__config">
          {rows.map((r) => (
            <li key={r.setting} className="bento-peek__config-row">
              <span className={`desk-pill desk-pill--${r.tone}`}>{r.verdict}</span>
              <span className="bento-peek__config-body">
                <code>
                  {r.setting}
                  <span className="bento-peek__config-eq">=</span>
                  <span className="bento-peek__config-val">{r.value}</span>
                </code>
                <span className="bento-peek__sub">{r.why}</span>
              </span>
            </li>
          ))}
        </ul>
      </Plate>
    </div>
  );
}

function PeekBackups() {
  const rows = [
    {
      path: 'world-2026-08-09-1842.zip',
      tone: 'ok' as const,
      status: 'Fresh',
      age: '6h ago',
      detail: '51.2 GB · verified',
      note: 'Local',
    },
    {
      path: 'world-2026-08-08-0600.zip',
      tone: 'warn' as const,
      status: 'Aging',
      age: '42h ago',
      detail: '50.8 GB · still good',
      note: 'Local',
    },
    {
      path: 'NAS / offsite',
      tone: 'neutral' as const,
      status: 'Missing',
      age: 'not set',
      detail: 'External path not configured',
      note: 'Gap',
    },
  ];
  return (
    <div className="bento-peek bento-peek--backups" aria-hidden>
      <Plate className="bento-peek__backups-panel">
        <div className="bento-peek__backups-head">
          <div>
            <span className="bento-peek__kicker">Archives</span>
            <span className="bento-peek__backups-title">Fresh · 51.2 GB · 6h ago</span>
          </div>
          <span className="desk-pill desk-pill--ok">Tracking on</span>
        </div>
        <div className="bento-peek__backups-grid">
          {rows.map((r) => (
            <div key={r.path} className={`bento-peek__backup-card bento-peek__backup-card--${r.tone}`}>
              <div className="bento-peek__backup-card-top">
                <code className="bento-peek__backup-code">{r.path}</code>
                <span className={`desk-pill desk-pill--${r.tone}`}>{r.status}</span>
              </div>
              <span className="bento-peek__backup-age">{r.age}</span>
              <span className="bento-peek__sub">{r.detail}</span>
              <span className="bento-peek__backup-note">{r.note}</span>
            </div>
          ))}
        </div>
      </Plate>
    </div>
  );
}

function PeekActivity() {
  const events = [
    {
      tone: 'warn' as const,
      kind: 'Lag',
      title: 'MSPT spiked to 48.2',
      detail: 'After restart · players still joining',
      time: '14:18',
    },
    {
      tone: 'danger' as const,
      kind: 'Crash',
      title: 'Server process exited',
      detail: 'Same window as the lag spike',
      time: '14:31',
    },
    {
      tone: 'warn' as const,
      kind: 'Backup',
      title: 'Scheduled backup missed',
      detail: 'No folder change since 12:00',
      time: '15:02',
    },
  ];
  return (
    <div className="bento-peek bento-peek--activity" aria-hidden>
      <Plate className="bento-peek__activity-panel">
        <div className="bento-peek__activity-head">
          <div>
            <span className="bento-peek__kicker">Incident thread</span>
            <span className="bento-peek__activity-title">Afternoon outage story</span>
          </div>
          <span className="desk-pill desk-pill--danger">3 linked</span>
        </div>
        <ol className="bento-peek__activity-thread">
          {events.map((ev, i) => (
            <li key={ev.time} className={`bento-peek__activity-event bento-peek__activity-event--${ev.tone}`}>
              <span className="bento-peek__activity-rail" aria-hidden>
                <span className={`bento-peek__dot bento-peek__dot--${ev.tone}`} />
                {i < events.length - 1 ? <span className="bento-peek__activity-line" /> : null}
              </span>
              <span className="bento-peek__activity-body">
                <span className="bento-peek__activity-meta">
                  <span className={`desk-pill desk-pill--${ev.tone === 'danger' ? 'danger' : 'warn'}`}>{ev.kind}</span>
                  <span className="bento-peek__activity-time">{ev.time}</span>
                </span>
                <span className="bento-peek__activity-event-title">{ev.title}</span>
                <span className="bento-peek__sub">{ev.detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </Plate>
    </div>
  );
}

function PeekLogs() {
  const lines = [
    { t: '14:17:58', tag: 'Watch', msg: 'TPS 19.8 · heap 61%', tone: '' as const },
    { t: '14:18:03', tag: 'Watch', msg: 'MSPT 48.2 warn', tone: 'warn' as const },
    { t: '14:18:04', tag: 'Issue', msg: 'ranked #1 · MSPT spike after restart', tone: 'warn' as const },
    { t: '14:18:41', tag: 'Join', msg: 'djinn disconnected · channel mismatch', tone: 'info' as const },
  ];
  return (
    <div className="bento-peek bento-peek--tail" aria-hidden>
      <Plate className="bento-peek__tail-panel">
        <div className="bento-peek__tail-chrome">
          <span className="bento-peek__tail-dot" />
          <span className="bento-peek__tail-dot bento-peek__tail-dot--dim" />
          <span className="bento-peek__tail-dot bento-peek__tail-dot--dim" />
          <span className="bento-peek__tail-file">latest.log</span>
          <span className="desk-pill desk-pill--ok">Tailed</span>
        </div>
        <ul className="bento-peek__tail-list">
          {lines.map((l) => (
            <li key={`${l.t}-${l.tag}`} className={l.tone ? `is-${l.tone}` : undefined}>
              <span className="bento-peek__tail-time">{l.t}</span>
              <span className="bento-peek__tail-tag">[{l.tag}]</span>
              <span className="bento-peek__tail-msg">{l.msg}</span>
            </li>
          ))}
        </ul>
      </Plate>
    </div>
  );
}

function PeekStartup() {
  const phases = [
    { label: 'JVM', sec: '8.2s', pct: 20 },
    { label: 'Mods', sec: '22.4s', pct: 53 },
    { label: 'World', sec: '11.1s', pct: 26 },
  ];
  return (
    <div className="bento-peek bento-peek--startup" aria-hidden>
      <Plate className="bento-peek__startup-panel">
        <div className="bento-peek__startup-head">
          <div>
            <span className="bento-peek__kicker">This boot</span>
            <div className="bento-peek__startup-total">
              <span className="bento-peek__startup-sec">42.1</span>
              <span className="bento-peek__runway-unit">sec</span>
            </div>
          </div>
          <div className="bento-peek__startup-head-meta">
            <span className="desk-pill desk-pill--warn">World loading</span>
            <span className="bento-peek__startup-delta">
              Last 38.6s · <strong>+3.5s</strong>
            </span>
          </div>
        </div>

        <ul className="bento-peek__startup-phases">
          {phases.map((p) => (
            <li key={p.label} className="bento-peek__startup-row is-on">
              <div className="bento-peek__startup-row-top">
                <span className="bento-peek__startup-row-label">
                  <span className="bento-peek__startup-dot" />
                  {p.label}
                </span>
                <span className="bento-peek__mono">{p.sec}</span>
              </div>
              <HashMeter
                value={p.pct}
                ink="var(--wt-accent)"
                aria-label={`${p.label} boot share`}
                trackClassName="h-2"
              />
            </li>
          ))}
        </ul>
      </Plate>
    </div>
  );
}

function PeekSources() {
  const sources = [
    { name: 'ops-cache', age: '12s', tone: 'ok' as const, note: 'Watching' },
    { name: 'live samples', age: '4s', tone: 'ok' as const, note: 'Current' },
    { name: 'latest.log', age: '18s', tone: 'ok' as const, note: 'Tailed' },
    { name: 'Spark', age: '—', tone: 'neutral' as const, note: 'Idle' },
  ];
  return (
    <div className="bento-peek bento-peek--sources" aria-hidden>
      <Plate className="bento-peek__sources-panel">
        <div className="bento-peek__config-head">
          <span className="bento-peek__kicker">Poller</span>
          <span className="desk-pill desk-pill--ok">Fresh</span>
        </div>
        <ul className="bento-peek__sources-list">
          {sources.map((s) => (
            <li key={s.name} className="bento-peek__sources-row">
              <span className="bento-peek__sources-name">{s.name}</span>
              <span className="bento-peek__sources-note">{s.note}</span>
              <span className={`desk-pill desk-pill--${s.tone} bento-peek__sources-age`}>{s.age}</span>
            </li>
          ))}
        </ul>
        <div className="bento-peek__sources-next">
          <span className="bento-peek__kicker">Next pull</span>
          <strong className="bento-peek__mono">ops-cache · 8s</strong>
        </div>
      </Plate>
    </div>
  );
}

function PeekAccounts() {
  const roles = [
    {
      role: 'Owner',
      tone: 'info' as const,
      who: 'djinn',
      meta: 'Skin linked · full access',
    },
    {
      role: 'Admin',
      tone: 'ok' as const,
      who: 'maya',
      meta: '2FA on · operate desk',
    },
    {
      role: 'Viewer',
      tone: 'neutral' as const,
      who: '2 seats',
      meta: 'Read-only · no writes',
    },
  ];
  const audits = [
    { action: 'settings.save', who: 'djinn', ago: '2m ago' },
    { action: 'account.invite', who: 'djinn', ago: '1h ago' },
    { action: 'role.change', who: 'maya', ago: 'Yesterday' },
  ];
  return (
    <div className="bento-peek bento-peek--accounts" aria-hidden>
      <Plate className="bento-peek__accounts-panel">
        <div className="bento-peek__accounts-chrome">
          <div>
            <span className="bento-peek__kicker">Accounts</span>
            <span className="bento-peek__accounts-title">4 seats · 3 roles</span>
          </div>
          <span className="desk-pill desk-pill--ok">2FA on</span>
        </div>

        <div className="bento-peek__accounts-split">
          <div className="bento-peek__accounts-roles">
            {roles.map((r) => (
              <div key={r.role} className="bento-peek__accounts-role">
                <div className="bento-peek__accounts-role-top">
                  <span className={`desk-pill desk-pill--${r.tone}`}>{r.role}</span>
                  <span className="bento-peek__accounts-who">{r.who}</span>
                </div>
                <span className="bento-peek__sub">{r.meta}</span>
              </div>
            ))}
          </div>

          <div className="bento-peek__accounts-log">
            <div className="bento-peek__accounts-log-head">
              <span className="bento-peek__kicker">Audit log</span>
              <span className="bento-peek__readout">Permanent</span>
            </div>
            <ul>
              {audits.map((a) => (
                <li key={a.action + a.ago}>
                  <span className="bento-peek__accounts-action">{a.action}</span>
                  <span className="bento-peek__accounts-meta">
                    {a.who} · {a.ago}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Plate>
    </div>
  );
}

function PeekAuth() {
  return (
    <div className="bento-peek bento-peek--auth" aria-hidden>
      <div className="bento-peek__stamp-wrap bento-peek__stamp-wrap--auth">
        <span className="bento-peek__stamp-box bento-peek__stamp-box--auth">
          <span className="bento-peek__stamp-ring" />
          <Plate className="bento-peek__stamp bento-peek__stamp--auth">
            <CapabilityMark id="auth" size="lg" />
          </Plate>
        </span>
        <span className="desk-pill desk-pill--ok">2FA on</span>
      </div>
    </div>
  );
}

function PeekHelp() {
  const guides = [
    { title: 'Dashboard Overview', section: 'Start' },
    { title: 'Issues', section: 'Triage' },
    { title: 'Join Clinic', section: 'Session' },
  ];
  return (
    <div className="bento-peek bento-peek--help" aria-hidden>
      <Plate className="bento-peek__help-panel">
        <div className="bento-peek__help-head">
          <span className="bento-peek__kicker">In-app wiki</span>
          <span className="desk-pill desk-pill--info">GitHub parity</span>
        </div>
        <ul className="bento-peek__help-list">
          {guides.map((g) => (
            <li key={g.title} className="bento-peek__help-row">
              <span className="bento-peek__help-section">{g.section}</span>
              <span className="bento-peek__help-title">{g.title}</span>
            </li>
          ))}
        </ul>
      </Plate>
    </div>
  );
}

function PeekCli() {
  return (
    <div className="bento-peek bento-peek--cli" aria-hidden>
      <Plate className="bento-peek__term">
        <div className="bento-peek__term-chrome">
          <span />
          <span />
          <span />
          <em>watchtower-cli</em>
        </div>
        <code className="bento-peek__term-body">
          <span className="bento-peek__term-prompt">$</span> java -jar watchtower-cli.jar
          <br />
          <span className="bento-peek__term-dim">watchtower-cli 0.4 · DR mode</span>
          <br />
          <span className="bento-peek__term-prompt">&gt;</span> compose support --redact
          <br />
          <span className="bento-peek__term-ok">wrote support-pack.zip</span>
          <br />
          <span className="bento-peek__term-dim">facts · brief · evidence (redacted)</span>
        </code>
      </Plate>
    </div>
  );
}

function PeekJarDisable() {
  return (
    <div className="bento-peek bento-peek--drift" aria-hidden>
      <Plate className="bento-peek__drift-panel">
        <div className="bento-peek__drift-head">
          <div className="bento-peek__drift-side">
            <span className="bento-peek__kicker">Jar</span>
            <code className="bento-peek__hash">create-6.0.0.jar</code>
          </div>
          <span className="bento-peek__drift-arrow" aria-hidden>
            →
          </span>
          <div className="bento-peek__drift-side">
            <span className="bento-peek__kicker">Next boot</span>
            <code className="bento-peek__hash is-warn">create-6.0.0.jar.disabled</code>
          </div>
          <span className="desk-pill desk-pill--warn">Disabled</span>
        </div>
        <div className="bento-peek__pills bento-peek__pills--gap">
          <span className="desk-pill desk-pill--info">All</span>
          <span className="desk-pill desk-pill--ok">Enabled</span>
          <span className="desk-pill desk-pill--warn">Disabled</span>
        </div>
        <span className="bento-peek__sub">High world risk asks you to confirm first · Admins only</span>
      </Plate>
    </div>
  );
}

function PeekModConfigs() {
  const rows = [
    { label: 'enableHopper', kind: 'bool' as const, value: 'true', dirty: false },
    { label: 'tickRate', kind: 'num' as const, value: '20', dirty: true },
    { label: 'maxDepth', kind: 'num' as const, value: '8', dirty: false },
    { label: 'syncInterval', kind: 'num' as const, value: '40', dirty: false },
  ];
  return (
    <div className="bento-peek bento-peek--mod-config" aria-hidden>
      <Plate className="bento-peek__mod-config-panel">
        <div className="bento-peek__mod-config-chrome">
          <div className="bento-peek__mod-config-file">
            <span className="bento-peek__kicker">Editing</span>
            <code className="bento-peek__mod-config-path">config/create-server.toml</code>
          </div>
          <div className="bento-peek__mod-config-tabs">
            <span className="bento-peek__mod-config-tab is-active">Form</span>
            <span className="bento-peek__mod-config-tab">TOML</span>
            <span className="bento-peek__mod-config-tab">Undo</span>
          </div>
        </div>

        <div className="bento-peek__mod-config-split">
          <ul className="bento-peek__mod-config-form">
            {rows.map((r) => (
              <li
                key={r.label}
                className={`bento-peek__mod-config-row${r.dirty ? ' is-dirty' : ''}`}
              >
                <span
                  className={`desk-pill desk-pill--${r.kind === 'bool' ? 'ok' : 'info'}`}
                >
                  {r.kind === 'bool' ? 'bool' : 'num'}
                </span>
                <span className="bento-peek__mod-config-key">{r.label}</span>
                {r.kind === 'bool' ? (
                  <span
                    className={`bento-peek__mod-config-toggle${
                      r.value === 'true' ? ' is-on' : ''
                    }`}
                  >
                    <span className="bento-peek__mod-config-knob" />
                  </span>
                ) : (
                  <span className="bento-peek__mod-config-input">{r.value}</span>
                )}
              </li>
            ))}
          </ul>

          <div className="bento-peek__mod-config-side">
            <div className="bento-peek__mod-config-preview">
              <span className="bento-peek__kicker">Live preview</span>
              <code className="bento-peek__mod-config-preview-line">
                tickRate = <em>20</em>
              </code>
              <span className="bento-peek__sub">Dirty · not saved yet</span>
            </div>
            <div className="bento-peek__mod-config-safety">
              <div className="bento-peek__mod-config-safety-row">
                <span className="bento-peek__kicker">Auto-backup</span>
                <span className="desk-pill desk-pill--ok">On save</span>
              </div>
              <div className="bento-peek__mod-config-safety-row">
                <span className="bento-peek__kicker">Last backup</span>
                <span className="bento-peek__readout">2m ago</span>
              </div>
              <div className="bento-peek__mod-config-safety-row">
                <span className="bento-peek__kicker">Undo</span>
                <span className="desk-pill desk-pill--warn">1 step</span>
              </div>
            </div>
          </div>
        </div>
      </Plate>
    </div>
  );
}

function PeekStorageSpaceMap() {
  return (
    <div className="bento-peek bento-peek--space-map" aria-hidden>
      <Plate className="bento-peek__space-map-panel">
        <div className="bento-peek__theme-head">
          <span className="bento-peek__kicker">Space map</span>
          <span className="bento-peek__readout">244 GB</span>
        </div>
        <div className="bento-peek__space-map-grid">
          <div
            className="bento-peek__space-map-cell bento-peek__space-map-cell--world"
            style={{
              borderColor: 'color-mix(in srgb, var(--wt-ch-disk) 35%, var(--wt-line))',
              background: 'color-mix(in srgb, var(--wt-ch-disk) 18%, var(--wt-bg2))',
            }}
          >
            <span className="bento-peek__kicker">World</span>
            <span className="bento-peek__readout">184 GB</span>
          </div>
          <div
            className="bento-peek__space-map-cell"
            style={{
              borderColor: 'color-mix(in srgb, var(--wt-accent) 35%, var(--wt-line))',
              background: 'color-mix(in srgb, var(--wt-accent) 16%, var(--wt-bg2))',
            }}
          >
            <span className="bento-peek__kicker">Mods</span>
            <span className="bento-peek__sub">drill in</span>
          </div>
          <div
            className="bento-peek__space-map-cell"
            style={{
              borderColor: 'color-mix(in srgb, var(--wt-warn) 35%, var(--wt-line))',
              background: 'color-mix(in srgb, var(--wt-warn) 16%, var(--wt-bg2))',
            }}
          >
            <span className="bento-peek__kicker">Logs</span>
            <span className="bento-peek__sub">drill in</span>
          </div>
          <div
            className="bento-peek__space-map-cell bento-peek__space-map-cell--backups"
            style={{
              borderColor: 'color-mix(in srgb, var(--wt-ok) 35%, var(--wt-line))',
              background: 'color-mix(in srgb, var(--wt-ok) 16%, var(--wt-bg2))',
            }}
          >
            <span className="bento-peek__kicker">Backups</span>
            <span className="bento-peek__sub">drill in</span>
          </div>
        </div>
      </Plate>
    </div>
  );
}

function PeekSparkMap() {
  const heat = [
    18, 22, 40, 55, 48, 30, 24, 20, 28, 62, 78, 70, 44, 32, 26, 34, 58, 88, 72, 50, 36, 30, 42, 66,
    80, 60, 38, 28,
  ];
  return (
    <div className="bento-peek bento-peek--schedule" aria-hidden>
      <Plate className="bento-peek__schedule-panel">
        <div className="bento-peek__schedule-head">
          <div>
            <span className="bento-peek__kicker">Chunk heat</span>
            <span className="bento-peek__schedule-peak">chunk 3, -12</span>
          </div>
          <div className="bento-peek__pills">
            <span className="desk-pill desk-pill--warn">Hot</span>
            <span className="desk-pill desk-pill--info">Quiet</span>
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '0.2rem',
            minHeight: '5.5rem',
          }}
        >
          {heat.map((v, i) => (
            <span
              key={i}
              className="bento-peek__heatmap-cell"
              style={{
                display: 'block',
                minHeight: '0.85rem',
                borderRadius: 2,
                background: `color-mix(in srgb, var(--wt-lantern) ${Math.round(10 + v * 0.9)}%, var(--wt-bg2))`,
                outline: i === 17 ? '1px solid var(--wt-lantern)' : undefined,
              }}
            />
          ))}
        </div>
        <div className="bento-peek__schedule-foot">
          <span>
            Selected <strong>3, -12</strong> · entity hotspot
          </span>
        </div>
      </Plate>
    </div>
  );
}

function PeekThemeAccent() {
  const themes = [
    { label: 'Light', bg: '#f4f2ec', fg: '#1a1a18', on: false },
    { label: 'Dark', bg: '#1c2433', fg: '#e8e6e0', on: true },
    { label: 'Black', bg: '#000000', fg: '#f2f2f2', on: false },
  ];
  const accents = [
    { c: '#4C8DFF', on: true },
    { c: '#E8A54B', on: false },
    { c: '#3DCF8E', on: false },
    { c: '#F07178', on: false },
  ];
  return (
    <div className="bento-peek bento-peek--theme" aria-hidden>
      <Plate className="bento-peek__theme-panel">
        <div className="bento-peek__theme-head">
          <span className="bento-peek__kicker">Appearance</span>
          <span className="desk-pill desk-pill--info">Per account</span>
        </div>
        <div className="bento-peek__theme-grid bento-peek__theme-grid--three">
          {themes.map((t) => (
            <div
              key={t.label}
              className={`bento-peek__theme-swatch${t.on ? ' is-on' : ''}`}
              style={{ background: t.bg, color: t.fg }}
            >
              <span className="bento-peek__theme-swatch-label">{t.label}</span>
              {t.on ? <span className="desk-pill desk-pill--ok">Active</span> : null}
            </div>
          ))}
        </div>
        <div className="bento-peek__theme-accent-row">
          <span className="bento-peek__kicker">Accent</span>
          <div className="bento-peek__theme-accents">
            {accents.map((a) => (
              <span
                key={a.c}
                className={`bento-peek__theme-dot${a.on ? ' is-on' : ''}`}
                style={{ background: a.c }}
              />
            ))}
          </div>
        </div>
      </Plate>
    </div>
  );
}

function PeekRoadmap() {
  const items = [
    { status: 'Shipped', tone: 'ok' as const, label: 'Join Clinic v2 · mod diff names' },
    { status: 'Building', tone: 'info' as const, label: 'Weekly ops digest email' },
    { status: 'Next', tone: 'neutral' as const, label: 'Multi-admin audit log export' },
  ];
  return (
    <div className="bento-peek bento-peek--roadmap" aria-hidden>
      <Plate className="bento-peek__roadmap-panel">
        <div className="bento-peek__config-head">
          <span className="bento-peek__kicker">Roadmap</span>
          <span className="desk-pill desk-pill--info">In-app</span>
        </div>
        <ul className="bento-peek__roadmap-list">
          {items.map((it) => (
            <li key={it.label} className="bento-peek__roadmap-row">
              <span className={`desk-pill desk-pill--${it.tone}`}>{it.status}</span>
              <span className="bento-peek__roadmap-text">{it.label}</span>
            </li>
          ))}
        </ul>
      </Plate>
    </div>
  );
}

export function featurePeek(id: string): ReactNode {
  switch (id) {
    case 'health-grade':
      return <PeekHealthGrade />;
    case 'fix-inbox':
      return <PeekFixInbox />;
    case 'world-pressure':
      return <PeekWorldPressure />;
    case 'join-clinic':
      return <PeekJoinClinic />;
    case 'live-vitals':
      return <PeekLiveChart />;
    case 'support-pack':
      return <PeekSupportPack />;
    case 'spark':
      return <PeekSparkStamp />;
    case 'spark-map':
      return <PeekSparkMap />;
    case 'gc-ram':
      return <PeekGcRam />;
    case 'crash-fingerprints':
      return <PeekCrashFingerprints />;
    case 'external-kill':
      return <PeekExternalKill />;
    case 'silent-fails':
      return <PeekSilentFails />;
    case 'mods-modrinth':
      return <PeekMods />;
    case 'jar-drift':
      return <PeekJarDrift />;
    case 'jar-disable':
      return <PeekJarDisable />;
    case 'mod-configs':
      return <PeekModConfigs />;
    case 'schedule-load':
      return <PeekSchedule />;
    case 'storage-runway':
      return <PeekStorage />;
    case 'storage-space-map':
      return <PeekStorageSpaceMap />;
    case 'weekly-digest':
      return <PeekDigest />;
    case 'config-audit':
      return <PeekConfig />;
    case 'backups':
      return <PeekBackups />;
    case 'activity':
      return <PeekActivity />;
    case 'logs':
      return <PeekLogs />;
    case 'startup':
      return <PeekStartup />;
    case 'sources':
      return <PeekSources />;
    case 'accounts':
      return <PeekAccounts />;
    case 'theme-accent':
      return <PeekThemeAccent />;
    case 'roadmap':
      return <PeekRoadmap />;
    case 'auth':
      return <PeekAuth />;
    case 'help':
      return <PeekHelp />;
    case 'cli-dr':
      return <PeekCli />;
    default:
      throw new Error(`Missing feature peek: ${id}`);
  }
}


// Keep helper exported for potential reuse / tree-shake friendliness
export { PeekInstrumentGrid };
