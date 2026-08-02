'use client';

import { useId } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { ModrinthMark } from '@/components/brand/modrinth-mark';
import { SparkMark } from '@/components/brand/spark-mark';
import { DeskDial } from '@/components/desk/desk-dial';
import { CapabilityMark } from '@/components/features/capability-marks';
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

/** Desk mission grades: A Healthy, C Needs attention, F Critical + restart advice. */
export function PeekHealthGrade() {
  const grades = [
    {
      letter: 'A',
      tone: 'ok' as const,
      word: 'Healthy',
      detail: 'Inbox clear · no crash open',
      hint: 'Restart when you want',
      restart: { label: 'Safe', pill: 'ok' as const },
    },
    {
      letter: 'C',
      tone: 'warn' as const,
      word: 'Needs attention',
      detail: '2 open · MSPT + disk runway',
      hint: 'Fix first, then restart',
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
    { tone: 'danger' as const, title: 'MSPT spike after restart', ago: '3m ago', rank: '1' },
    { tone: 'warn' as const, title: 'Disk runway under 14 days', ago: '1h ago', rank: '2' },
    { tone: 'info' as const, title: 'Client-only jar on server', ago: 'Yesterday', rank: '3' },
  ];
  return (
    <div className="bento-peek bento-peek--stack" aria-hidden>
      <ul className="bento-peek__queue">
        {items.map((it, i) => (
          <li key={it.title} className={`bento-peek__q-row bento-peek__q-row--${i}`}>
            <span className={`bento-peek__dot bento-peek__dot--${it.tone}`} />
            <span className="bento-peek__q-text">
              <span className="bento-peek__q-title">{it.title}</span>
              <span className="bento-peek__q-detail">{it.ago}</span>
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
  const census = [
    { label: 'Items', value: 82, channel: 'mspt' as const, note: 'Storm risk' },
    { label: 'Mobs', value: 54, channel: 'tps' as const, note: 'Elevated' },
    { label: 'Chunks', value: 71, channel: 'disk' as const, note: 'Loaders on' },
  ];
  const flags = [
    { tone: 'warn' as const, text: 'Item storm' },
    { tone: 'info' as const, text: 'Unattended loaders' },
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

        <div className="bento-peek__census">
          <div className="bento-peek__kicker">World census</div>
          <ul className="bento-peek__h-bars bento-peek__h-bars--flush">
            {census.map((r) => (
              <li key={r.label}>
                <div className="bento-peek__bar-label">
                  <span>
                    {r.label} <em className="bento-peek__census-note">{r.note}</em>
                  </span>
                  <span className="bento-peek__mono">{r.value}%</span>
                </div>
                <div className="bento-peek__bar-track bento-peek__bar-track--lg">
                  <span
                    className="bento-peek__bar-fill"
                    style={{ width: `${r.value}%`, background: `var(--wt-ch-${r.channel})` }}
                  />
                </div>
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
  const uid = useId().replace(/[:]/g, '');
  // Hour window with a real mid-window soft dip so the 16–20 band isn't empty chrome.
  const tps = [
    19.8, 19.9, 19.7, 19.6, 19.8, 19.5, 19.2, 18.9, 18.4, 17.8, 17.1, 16.6, 16.9, 17.4, 18.1, 18.8, 19.2,
    19.5, 19.7, 19.4, 19.1, 19.6, 19.8, 19.9, 19.7, 19.8, 19.9, 20,
  ];
  const msptBars = [
    4.1, 4.4, 4.8, 5.2, 4.9, 5.6, 6.8, 9.4, 14.2, 11.1, 7.6, 5.8, 5.1, 4.7, 4.5, 4.9, 5.2, 4.8, 4.6, 4.4,
    4.7, 4.9, 4.6, 4.7,
  ];
  const channels = [
    { label: 'Players', value: '12', tone: 'var(--wt-ch-players)' },
    { label: 'Heap', value: '61%', tone: 'var(--wt-ch-heap)' },
    { label: 'CPU', value: '34%', tone: 'var(--wt-ch-cpu)' },
    { label: 'Host', value: 'panel', tone: 'var(--wt-info)' },
  ];
  const w = 640;
  const h = 200;
  const padL = 2;
  const padR = 8;
  const padT = 10;
  const padB = 8;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const yMin = 16;
  const yMax = 20;
  const pts = tps.map((v, i) => {
    const x = padL + (i / Math.max(tps.length - 1, 1)) * plotW;
    const y = padT + (1 - (v - yMin) / (yMax - yMin)) * plotH;
    return [x, y] as const;
  });
  const line = smoothLine(pts);
  const area = `${line} L ${padL + plotW} ${padT + plotH} L ${padL} ${padT + plotH} Z`;
  const last = pts[pts.length - 1];
  const yTicks = [20, 18, 16];
  const msptMax = Math.max(...msptBars);

  return (
    <div className="bento-peek bento-peek--live" aria-hidden>
      <Plate className="bento-peek__live-panel">
        <div className="bento-peek__live-head">
          <div>
            <span className="bento-peek__kicker">TPS · last hour</span>
            <div className="bento-peek__live-readout">
              <span className="bento-peek__live-value">19.9</span>
              <span className="desk-pill desk-pill--ok">Steady</span>
            </div>
          </div>
          <div className="bento-peek__live-head-meta">
            <span className="bento-peek__sub">Dip ~35m ago · recovered</span>
            <span className="desk-pill desk-pill--info">Watching</span>
          </div>
        </div>

        <div className="bento-peek__live-split">
          <div className="bento-peek__live-chart">
            <div className="bento-peek__live-plot">
              <div className="bento-peek__live-ylabels" aria-hidden>
                {yTicks.map((tick) => (
                  <span key={tick}>{tick}</span>
                ))}
              </div>
              <svg className="bento-peek__live-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
                <defs>
                  <linearGradient id={`live-fill-${uid}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--wt-ch-tps)" stopOpacity="0.32" />
                    <stop offset="100%" stopColor="var(--wt-ch-tps)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {yTicks.map((tick) => {
                  const y = padT + (1 - (tick - yMin) / (yMax - yMin)) * plotH;
                  return (
                    <line
                      key={tick}
                      x1={padL}
                      x2={padL + plotW}
                      y1={y}
                      y2={y}
                      stroke="var(--wt-line)"
                      strokeWidth="1"
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })}
                <path d={area} fill={`url(#live-fill-${uid})`} />
                <path
                  d={line}
                  fill="none"
                  stroke="var(--wt-ch-tps)"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
                <circle
                  cx={last[0]}
                  cy={last[1]}
                  r="4"
                  fill="var(--wt-bg0)"
                  stroke="var(--wt-ch-tps)"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>
            <div className="bento-peek__live-axis">
              <span>−60m</span>
              <span>−30m</span>
              <span>now</span>
            </div>

            <div className="bento-peek__live-mspt">
              <div className="bento-peek__live-mspt-head">
                <span className="bento-peek__kicker">MSPT · same window</span>
                <span className="bento-peek__readout">4.7 ms typ · spike 14.2</span>
              </div>
              <div className="bento-peek__live-bars">
                {msptBars.map((v, i) => (
                  <span
                    key={i}
                    className={`bento-peek__live-bar${v >= 10 ? ' is-hot' : ''}`}
                    style={{ height: `${Math.max(10, (v / msptMax) * 100)}%` }}
                  />
                ))}
              </div>
            </div>

            <div className="bento-peek__live-channels">
              {channels.map((c) => (
                <div key={c.label} className="bento-peek__live-channel">
                  <span className="bento-peek__live-channel-dot" style={{ background: c.tone }} />
                  <span className="bento-peek__kicker">{c.label}</span>
                  <strong>{c.value}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="bento-peek__live-dials">
            <DeskDial value={19.9} max={20} label="TPS" tone="tps" size={112} decimals={1} />
            <DeskDial value={4.7} max={50} label="MSPT" suffix="ms" tone="mspt" size={112} decimals={1} />
            <DeskDial value={61} max={100} label="Heap" suffix="%" tone="heap" size={112} decimals={0} />
          </div>
        </div>
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
  const cards = [
    {
      title: 'OutOfMemoryError',
      fp: 'a3f2…c91',
      n: '×4',
      tone: 'danger' as const,
      log: 'Java heap space · last 2h',
    },
    {
      title: 'ConcurrentModification',
      fp: '9b10…e2a',
      n: '×2',
      tone: 'warn' as const,
      log: 'entity tick · nearby log match',
    },
  ];
  return (
    <div className="bento-peek bento-peek--crashes" aria-hidden>
      {cards.map((c, i) => (
        <Plate
          key={c.fp}
          className={`bento-peek__card bento-peek__crash-card bento-peek__crash-card--${c.tone} bento-peek__crash-card--${i}`}
        >
          <div className="bento-peek__crash-main">
            <span className={`bento-peek__dot bento-peek__dot--${c.tone}`} />
            <span className="bento-peek__stack-text">
              <span className="bento-peek__stack-title">{c.title}</span>
              <span className="bento-peek__sub">{c.log}</span>
            </span>
            <span className={`desk-pill desk-pill--${c.tone === 'danger' ? 'danger' : 'warn'}`}>{c.n}</span>
          </div>
          <code className="bento-peek__crash-fp">{c.fp}</code>
        </Plate>
      ))}
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
              High-confidence client jar on a dedicated server. Lookup fills the name — WatchTower never
              downloads a jar for you.
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

/** Deterministic week×hour load (0–100) — evenings + weekends hotter. */
const SCHEDULE_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const SCHEDULE_HOURS = 12; // 2-hour buckets across the day

function scheduleLoad(day: number, hourBucket: number): number {
  const hour = hourBucket * 2;
  const evening = Math.max(0, 1 - Math.abs(hour - 19) / 8);
  const weekend = day >= 5 ? 1.15 : 1;
  const night = hour < 7 ? 0.35 : 1;
  const base = 18 + evening * 62 * weekend * night + (day % 3) * 3 + hourBucket * 1.2;
  return Math.max(8, Math.min(96, Math.round(base)));
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
                    .map((c) => (
                      <span
                        key={`${c.day}-${c.h}`}
                        className="bento-peek__heatmap-cell"
                        style={{
                          background: `color-mix(in srgb, var(--wt-ch-players) ${Math.round(12 + c.v * 0.85)}%, var(--wt-bg2))`,
                        }}
                      />
                    ))}
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
  const dims = [
    { label: 'Overworld', pct: 62, gb: '184 GB' },
    { label: 'Nether', pct: 28, gb: '41 GB' },
    { label: 'End', pct: 14, gb: '19 GB' },
  ];
  const trend = [48, 50, 51, 53, 55, 56, 58, 59, 61, 62, 64, 66];
  const w = 160;
  const h = 48;
  const min = Math.min(...trend);
  const max = Math.max(...trend);
  const span = Math.max(max - min, 1);
  const line = trend
    .map((v, i) => {
      const x = (i / Math.max(trend.length - 1, 1)) * w;
      const y = h - 4 - ((v - min) / span) * (h - 8);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div className="bento-peek bento-peek--storage" aria-hidden>
      <Plate className="bento-peek__storage-panel">
        <div className="bento-peek__storage-split">
          <div className="bento-peek__storage-dims">
            <div className="bento-peek__kicker">By dimension</div>
            <div className="bento-peek__col-bars bento-peek__col-bars--storage">
              {dims.map((d) => (
                <div key={d.label} className="bento-peek__col-bar">
                  <span className="bento-peek__col-val">{d.gb}</span>
                  <span className="bento-peek__col-track">
                    <span
                      className="bento-peek__col-fill"
                      style={{ height: `${d.pct}%`, background: 'var(--wt-ch-disk)' }}
                    />
                  </span>
                  <span className="bento-peek__col-cap">{d.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bento-peek__storage-runway">
            <div className="bento-peek__kicker">Disk runway</div>
            <div className="bento-peek__runway-hero">
              <span className="bento-peek__runway-days">~12</span>
              <span className="bento-peek__runway-unit">days left</span>
            </div>
            <div className="bento-peek__runway-facts">
              <span>
                Disk <strong>66%</strong>
              </span>
              <span>
                +1.8%/day <strong>filling</strong>
              </span>
            </div>
            <svg className="bento-peek__runway-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
              <path
                d={line}
                fill="none"
                stroke="var(--wt-ch-disk)"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <div className="bento-peek__live-axis">
              <span>−30d</span>
              <span>projected fill</span>
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
          <strong>3</strong>
        </div>
        <div className="bento-peek__digest-row">
          <span>Next</span>
          <strong>Trim item storms</strong>
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
      path: 'world/',
      tone: 'ok' as const,
      status: 'Fresh',
      age: '2h ago',
      detail: 'Folder mtime looks current',
      note: 'Local',
    },
    {
      path: 'panel/',
      tone: 'warn' as const,
      status: 'Stale',
      age: '3d ago',
      detail: 'No new archive since Tuesday',
      note: 'Alpha',
    },
    {
      path: 'cloud/',
      tone: 'neutral' as const,
      status: 'Unknown',
      age: 'no signal',
      detail: 'Watcher has no evidence yet',
      note: 'Alpha',
    },
  ];
  return (
    <div className="bento-peek bento-peek--backups" aria-hidden>
      <Plate className="bento-peek__backups-panel">
        <div className="bento-peek__backups-head">
          <div>
            <span className="bento-peek__kicker">Sources</span>
            <span className="bento-peek__backups-title">1 fresh · 1 stale · 1 unknown</span>
          </div>
          <span className="desk-pill desk-pill--warn">Check panel</span>
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
    { t: '14:02:11', tag: 'Server', msg: 'Done (42.1s)! For help, type "help"', tone: 'ok' as const },
    { t: '14:17:58', tag: 'Watch', msg: 'TPS 19.8 · heap 61%', tone: '' as const },
    { t: '14:18:03', tag: 'Watch', msg: 'MSPT 48.2 warn', tone: 'warn' as const },
    { t: '14:18:04', tag: 'Issue', msg: 'ranked #1 · MSPT spike after restart', tone: 'warn' as const },
    { t: '14:18:41', tag: 'Join', msg: 'djinn disconnected · channel mismatch', tone: 'info' as const },
    { t: '14:19:11', tag: 'Join', msg: 'clinic matched · named mod diffs', tone: 'ok' as const },
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
    { label: 'JVM', sec: '8.2s', pct: 20, on: true },
    { label: 'Mods', sec: '22.4s', pct: 53, on: true },
    { label: 'World', sec: '11.1s', pct: 26, on: true },
    { label: 'Ready', sec: '…', pct: 0, on: false },
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
          <span className="desk-pill desk-pill--warn">World loading</span>
        </div>

        <ul className="bento-peek__startup-phases">
          {phases.map((p) => (
            <li key={p.label} className={`bento-peek__startup-row${p.on ? ' is-on' : ' is-wait'}`}>
              <div className="bento-peek__startup-row-top">
                <span className="bento-peek__startup-row-label">
                  <span className="bento-peek__startup-dot" />
                  {p.label}
                </span>
                <span className="bento-peek__mono">{p.sec}</span>
              </div>
              <div className="bento-peek__bar-track">
                <span
                  className="bento-peek__bar-fill"
                  style={{
                    width: `${p.pct}%`,
                    background: p.on ? 'var(--wt-accent)' : 'var(--wt-bg3)',
                  }}
                />
              </div>
            </li>
          ))}
        </ul>

        <div className="bento-peek__startup-foot">
          <span>
            Last <strong>38.6s</strong>
          </span>
          <span className="bento-peek__startup-delta">+3.5s</span>
        </div>
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
    { role: 'Owner', tone: 'info' as const, who: 'djinn' },
    { role: 'Admin', tone: 'ok' as const, who: 'maya' },
    { role: 'Viewer', tone: 'neutral' as const, who: '2 seats' },
  ];
  const audits = [
    { action: 'settings.save', who: 'djinn', ago: '2m ago' },
    { action: 'account.invite', who: 'djinn', ago: '1h ago' },
    { action: 'role.change', who: 'maya', ago: 'Yesterday' },
  ];
  return (
    <div className="bento-peek bento-peek--accounts" aria-hidden>
      <Plate className="bento-peek__accounts-panel">
        <div className="bento-peek__accounts-roles">
          {roles.map((r) => (
            <div key={r.role} className="bento-peek__accounts-role">
              <span className={`desk-pill desk-pill--${r.tone}`}>{r.role}</span>
              <span className="bento-peek__sub">{r.who}</span>
            </div>
          ))}
        </div>
        <div className="bento-peek__accounts-log">
          <div className="bento-peek__kicker">Audit log</div>
          <ul>
            {audits.map((a) => (
              <li key={a.action + a.ago}>
                <span className="bento-peek__q-title">{a.action}</span>
                <span className="bento-peek__q-detail">
                  {a.who} · {a.ago}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Plate>
    </div>
  );
}

function PeekAuth() {
  return (
    <div className="bento-peek bento-peek--side" aria-hidden>
      <div className="bento-peek__stamp-wrap">
        <span className="bento-peek__stamp-box">
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
    { label: 'enableHopper', kind: 'bool', value: 'true' },
    { label: 'tickRate', kind: 'num', value: '20' },
    { label: 'maxDepth', kind: 'num', value: '8' },
  ];
  return (
    <div className="bento-peek bento-peek--config" aria-hidden>
      <Plate className="bento-peek__config-panel">
        <div className="bento-peek__config-head">
          <span className="bento-peek__kicker">config/</span>
          <span className="bento-peek__readout">TOML form · undo</span>
        </div>
        <ul className="bento-peek__config">
          {rows.map((r) => (
            <li key={r.label} className="bento-peek__config-row">
              <span className={`desk-pill desk-pill--${r.kind === 'bool' ? 'ok' : 'info'}`}>
                {r.kind === 'bool' ? 'bool' : 'num'}
              </span>
              <span className="bento-peek__config-body">
                <code>
                  {r.label}
                  <span className="bento-peek__config-eq">=</span>
                  <span className="bento-peek__config-val">{r.value}</span>
                </code>
              </span>
            </li>
          ))}
        </ul>
      </Plate>
    </div>
  );
}

function PeekStorageSpaceMap() {
  const cells = [
    { label: 'World', flex: 2.4, tone: 'var(--wt-ch-disk)' },
    { label: 'Mods', flex: 1.2, tone: 'var(--wt-accent)' },
    { label: 'Logs', flex: 0.8, tone: 'var(--wt-warn)' },
    { label: 'Backups', flex: 1.6, tone: 'var(--wt-ok)' },
  ];
  return (
    <div className="bento-peek bento-peek--storage" aria-hidden>
      <Plate className="bento-peek__storage-panel">
        <div className="bento-peek__config-head">
          <span className="bento-peek__kicker">Space map</span>
          <span className="bento-peek__readout">244 GB</span>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2.4fr 1.2fr',
            gridTemplateRows: '1.2fr 0.8fr',
            gap: '0.35rem',
            minHeight: '7.5rem',
          }}
        >
          <div
            style={{
              gridRow: '1 / 3',
              borderRadius: 4,
              border: '1px solid color-mix(in srgb, var(--wt-ch-disk) 35%, var(--wt-line))',
              background: 'color-mix(in srgb, var(--wt-ch-disk) 18%, var(--wt-bg2))',
              padding: '0.45rem 0.55rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <span className="bento-peek__kicker">World</span>
            <span className="bento-peek__readout">184 GB</span>
          </div>
          {cells.slice(1).map((c) => (
            <div
              key={c.label}
              style={{
                borderRadius: 4,
                border: `1px solid color-mix(in srgb, ${c.tone} 35%, var(--wt-line))`,
                background: `color-mix(in srgb, ${c.tone} 16%, var(--wt-bg2))`,
                padding: '0.35rem 0.45rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <span className="bento-peek__kicker">{c.label}</span>
              <span className="bento-peek__sub">drill in</span>
            </div>
          ))}
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
    { label: 'Light', bg: '#f4f2ec', fg: '#1a1a18' },
    { label: 'Dark', bg: '#16181d', fg: '#e8e6e0' },
    { label: 'Black', bg: '#0a0a0b', fg: '#e8e6e0' },
    { label: 'System', bg: '#2a2d34', fg: '#e8e6e0' },
  ];
  const accents = ['#4C8DFF', '#E8A54B', '#3DCF8E', '#F07178'];
  return (
    <div className="bento-peek bento-peek--accounts" aria-hidden>
      <Plate className="bento-peek__accounts-panel">
        <div className="bento-peek__config-head">
          <span className="bento-peek__kicker">Appearance</span>
          <span className="desk-pill desk-pill--info">Per account</span>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '0.35rem',
            marginBottom: '0.55rem',
          }}
        >
          {themes.map((t) => (
            <div
              key={t.label}
              style={{
                borderRadius: 4,
                border: '1px solid var(--wt-line)',
                background: t.bg,
                color: t.fg,
                padding: '0.45rem 0.35rem',
                textAlign: 'center',
                fontSize: '0.75rem',
                fontFamily: 'var(--wt-font-mono)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              {t.label}
            </div>
          ))}
        </div>
        <div className="bento-peek__pills bento-peek__pills--gap">
          {accents.map((c) => (
            <span
              key={c}
              style={{
                width: '1.1rem',
                height: '1.1rem',
                borderRadius: 999,
                background: c,
                border: c === '#4C8DFF' ? '2px solid var(--wt-text)' : '1px solid var(--wt-line)',
                display: 'inline-block',
              }}
            />
          ))}
        </div>
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
      return <PeekJoinStrip />;
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
