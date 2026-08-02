'use client';

import { useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { DESK } from '@/content/baked/desk';
import '@/components/desk/desk.css';

type Pt = { x: number; y: number };

/** Catmull-Rom → cubic Bezier path (Bklit-style monotone-ish curve). */
function smoothPath(points: Pt[]): string {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M ${points[0]!.x} ${points[0]!.y} L ${points[1]!.x} ${points[1]!.y}`;
  }
  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function areaFromLine(line: string, points: Pt[], baselineY: number): string {
  if (!points.length) return '';
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return `${line} L ${last.x} ${baselineY} L ${first.x} ${baselineY} Z`;
}

const VB = { w: 1000, h: 420 };
const PAD = { t: 28, r: 8, b: 8, l: 8 };

/**
 * Evening chart styled like dashboard Bklit area charts:
 * players as gradient area, MSPT as line, hover crosshair + tooltip.
 * `bleed` = full-width marketing band; `panel` = desk snippet in a column.
 */
export function EveningChart({
  className = '',
  variant = 'bleed',
}: {
  className?: string;
  variant?: 'bleed' | 'panel';
}) {
  const panel = variant === 'panel';
  const evening = DESK.insights.evening;
  const busy = DESK.insights.busy;
  const uid = useId().replace(/:/g, '');
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const iw = VB.w - PAD.l - PAD.r;
  const ih = VB.h - PAD.t - PAD.b;
  const maxPlayers = Math.max(...evening.map((b) => b.avgPlayers), 1) * 1.08;
  const maxMspt = Math.max(...evening.map((b) => b.avgMspt), 1) * 1.08;

  const geometry = useMemo(() => {
    const xAt = (i: number) => PAD.l + (i / Math.max(evening.length - 1, 1)) * iw;
    const yPlayers = (v: number) => PAD.t + ih - (v / maxPlayers) * ih;
    const yMspt = (v: number) => PAD.t + ih - (v / maxMspt) * ih;
    const baseline = PAD.t + ih;
    const playerPts = evening.map((b, i) => ({ x: xAt(i), y: yPlayers(b.avgPlayers) }));
    const msptPts = evening.map((b, i) => ({ x: xAt(i), y: yMspt(b.avgMspt) }));
    const playerLine = smoothPath(playerPts);
    return {
      xAt,
      yPlayers,
      yMspt,
      baseline,
      playerLine,
      playerArea: areaFromLine(playerLine, playerPts, baseline),
      msptLine: smoothPath(msptPts),
      gridYs: [0, 0.25, 0.5, 0.75, 1].map((t) => PAD.t + ih * (1 - t)),
      yTicksPlayers: [0, 0.25, 0.5, 0.75, 1].map((t) =>
        (maxPlayers * t).toFixed(t === 0 ? 0 : 1),
      ),
      yTicksMspt: [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(maxMspt * t)),
    };
  }, [evening, ih, iw, maxMspt, maxPlayers]);

  const {
    xAt,
    yPlayers,
    yMspt,
    baseline,
    playerLine,
    playerArea,
    msptLine,
    gridYs,
    yTicksPlayers,
    yTicksMspt,
  } = geometry;

  const active = hover != null ? evening[hover] : null;
  const activeX = hover != null ? xAt(hover) : null;
  const activeXPct = activeX != null ? (activeX / VB.w) * 100 : null;

  const onPointer = (clientX: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * VB.w;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < evening.length; i++) {
      const d = Math.abs(xAt(i) - x);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    setHover(best);
  };

  const padX = panel
    ? 'px-3 sm:px-4'
    : 'px-2 sm:px-4 lg:px-6';
  const headPad = panel
    ? 'px-3 pt-4 pb-2 sm:px-4'
    : 'mx-auto max-w-[84rem] px-5 pt-5 pb-2 lg:pl-[7.5rem] lg:pr-8';
  const footPad = panel
    ? 'px-3 sm:px-4'
    : 'mx-auto max-w-[84rem] px-5 lg:pl-[7.5rem] lg:pr-8';
  const plotH = panel
    ? 'h-[min(28vh,16rem)] min-h-[12rem]'
    : 'h-[min(46vh,26rem)] min-h-[20rem]';
  const yCols = panel
    ? 'grid-cols-[2.25rem_minmax(0,1fr)_2.25rem]'
    : 'grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] sm:grid-cols-[3.25rem_minmax(0,1fr)_3.25rem]';

  return (
    <div
      className={`w-full bg-[color:var(--wt-bg1)] ${
        panel
          ? 'border border-[color:var(--wt-line)]'
          : 'border-y border-[color:var(--wt-line)]'
      } ${className}`}
      style={
        {
          '--chart-grid': 'color-mix(in srgb, var(--wt-line) 88%, transparent)',
          '--chart-crosshair': 'color-mix(in srgb, var(--wt-accent) 55%, transparent)',
          '--chart-tooltip-bg': 'color-mix(in srgb, var(--wt-bg1) 96%, var(--wt-bg0))',
          borderRadius: panel ? 'var(--wt-radius-sm)' : undefined,
        } as CSSProperties
      }
    >
      <div className={`flex flex-wrap items-center justify-between gap-3 ${headPad}`}>
        <p className="font-mono text-[0.75rem] uppercase tracking-[0.12em] text-[color:var(--wt-text-low)]">
          {panel ? 'dashboard · Insights' : 'players · area · MSPT · line'}
        </p>
        <div className="flex items-center gap-4 font-mono text-[0.75rem] text-[color:var(--wt-text-mid)]">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2"
              style={{ background: 'var(--wt-ch-players)', borderRadius: 1 }}
              aria-hidden
            />
            Players
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-0.5 w-3"
              style={{ background: 'var(--wt-ch-mspt)' }}
              aria-hidden
            />
            MSPT
          </span>
        </div>
      </div>

      <div className={`grid ${yCols} gap-x-1 ${padX}`}>
        {/* Left Y: players */}
        <div className={`relative ${plotH}`}>
          {yTicksPlayers.map((label, i) => (
            <span
              key={`lp-${label}`}
              className="absolute right-0 font-mono text-[0.75rem] tabular-nums text-[color:var(--wt-text-low)]"
              style={{ top: `${(gridYs[i]! / VB.h) * 100}%`, transform: 'translateY(-50%)' }}
            >
              {label}
            </span>
          ))}
        </div>

        <div
          ref={wrapRef}
          className={`relative ${plotH} w-full touch-pan-y outline-none`}
          onPointerMove={(e) => onPointer(e.clientX)}
          onPointerLeave={() => setHover(null)}
          onPointerDown={(e) => onPointer(e.clientX)}
          role="img"
          aria-label="Evening busy hours: players rising, MSPT creeping up. Hover or focus to read each hour."
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') {
              e.preventDefault();
              setHover((h) => Math.min(evening.length - 1, (h ?? -1) + 1));
            } else if (e.key === 'ArrowLeft') {
              e.preventDefault();
              setHover((h) => Math.max(0, (h ?? evening.length) - 1));
            } else if (e.key === 'Escape') {
              setHover(null);
            }
          }}
        >
          <svg
            viewBox={`0 0 ${VB.w} ${VB.h}`}
            className="absolute inset-0 h-full w-full"
            preserveAspectRatio="none"
            aria-hidden
          >
            <defs>
              <linearGradient id={`${uid}-players`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--wt-ch-players)" stopOpacity="0.48" />
                <stop offset="45%" stopColor="var(--wt-ch-players)" stopOpacity="0.16" />
                <stop offset="100%" stopColor="var(--wt-ch-players)" stopOpacity="0" />
              </linearGradient>
              <linearGradient id={`${uid}-edge`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="white" stopOpacity="0" />
                <stop offset="4%" stopColor="white" stopOpacity="1" />
                <stop offset="96%" stopColor="white" stopOpacity="1" />
                <stop offset="100%" stopColor="white" stopOpacity="0" />
              </linearGradient>
              <mask id={`${uid}-fade`}>
                <rect x={PAD.l} y={PAD.t} width={iw} height={ih} fill={`url(#${uid}-edge)`} />
              </mask>
            </defs>

            {gridYs.map((y, i) => (
              <line
                key={y}
                x1={PAD.l}
                x2={PAD.l + iw}
                y1={y}
                y2={y}
                stroke="var(--chart-grid)"
                strokeWidth={1}
                strokeDasharray={i === gridYs.length - 1 ? undefined : '4 5'}
                vectorEffect="non-scaling-stroke"
              />
            ))}

            <g mask={`url(#${uid}-fade)`}>
              <path d={playerArea} fill={`url(#${uid}-players)`} />
              <path
                d={playerLine}
                fill="none"
                stroke="var(--wt-ch-players)"
                strokeWidth="2.5"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={msptLine}
                fill="none"
                stroke="var(--wt-ch-mspt)"
                strokeWidth="2.5"
                vectorEffect="non-scaling-stroke"
              />
            </g>

            {activeX != null && active ? (
              <g>
                <line
                  x1={activeX}
                  x2={activeX}
                  y1={PAD.t}
                  y2={baseline}
                  stroke="var(--chart-crosshair)"
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                />
                <circle
                  cx={activeX}
                  cy={yPlayers(active.avgPlayers)}
                  r={5}
                  fill="var(--wt-ch-players)"
                  stroke="var(--wt-bg1)"
                  strokeWidth={2}
                />
                <circle
                  cx={activeX}
                  cy={yMspt(active.avgMspt)}
                  r={5}
                  fill="var(--wt-ch-mspt)"
                  stroke="var(--wt-bg1)"
                  strokeWidth={2}
                />
              </g>
            ) : null}
          </svg>

          {active && activeXPct != null ? (
            <div
              className="pointer-events-none absolute z-10 min-w-[9.5rem] border border-[color:var(--wt-line)] px-3 py-2"
              style={{
                left: `clamp(0.25rem, ${activeXPct}% - 4.75rem, calc(100% - 10rem))`,
                top: '0.5rem',
                background: 'var(--chart-tooltip-bg)',
                borderRadius: 'var(--wt-radius-sm)',
              }}
            >
              <p className="font-mono text-[0.75rem] uppercase tracking-[0.12em] text-[color:var(--wt-text-low)]">
                {active.label} UTC
              </p>
              <p className="mt-1.5 flex items-center justify-between gap-4 font-mono text-[0.8125rem] tabular-nums text-[color:var(--wt-text)]">
                <span className="text-[color:var(--wt-ch-players)]">Players</span>
                <span>{active.avgPlayers.toFixed(1)}</span>
              </p>
              <p className="mt-1 flex items-center justify-between gap-4 font-mono text-[0.8125rem] tabular-nums text-[color:var(--wt-text)]">
                <span className="text-[color:var(--wt-ch-mspt)]">MSPT</span>
                <span>{active.avgMspt.toFixed(1)} ms</span>
              </p>
            </div>
          ) : null}
        </div>

        {/* Right Y: MSPT */}
        <div className={`relative ${plotH}`}>
          {yTicksMspt.map((label, i) => (
            <span
              key={`rm-${label}`}
              className="absolute left-0 font-mono text-[0.75rem] tabular-nums text-[color:var(--wt-text-low)]"
              style={{ top: `${(gridYs[i]! / VB.h) * 100}%`, transform: 'translateY(-50%)' }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* X labels under plot */}
      <div className={`grid ${yCols} gap-x-1 ${padX} pb-2`}>
        <div />
        <div className="relative h-6">
          {evening.map((b, i) => (
            <span
              key={b.label}
              className="absolute font-mono text-[0.75rem] tabular-nums text-[color:var(--wt-text-low)]"
              style={{
                left: `${(xAt(i) / VB.w) * 100}%`,
                transform: 'translateX(-50%)',
              }}
            >
              {b.label}
            </span>
          ))}
        </div>
        <div />
      </div>

      <div className={footPad}>
        <ul
          className={`grid gap-3 border-t border-[color:var(--wt-line)] py-4 font-mono text-[0.75rem] text-[color:var(--wt-text-mid)] ${
            panel ? 'grid-cols-1 sm:grid-cols-3' : 'sm:grid-cols-3 py-5'
          }`}
        >
          {busy.map((row) => {
            const hour = row.label.slice(0, 5);
            const eveningIndex = evening.findIndex((e) => e.label === hour);
            const matched = hover != null && evening[hover]?.label === hour;
            return (
              <li key={row.label}>
                <button
                  type="button"
                  className="flex w-full justify-between gap-3 border px-3 py-2.5 text-left transition-[border-color,background-color] duration-150"
                  style={{
                    borderRadius: 'var(--wt-radius-sm)',
                    borderColor: matched ? 'var(--wt-accent)' : 'var(--wt-line)',
                    background: matched
                      ? 'color-mix(in srgb, var(--wt-accent) 10%, var(--wt-bg1))'
                      : 'var(--wt-bg0)',
                    color: matched ? 'var(--wt-text)' : undefined,
                  }}
                  onMouseEnter={() => {
                    if (eveningIndex >= 0) setHover(eveningIndex);
                  }}
                  onFocus={() => {
                    if (eveningIndex >= 0) setHover(eveningIndex);
                  }}
                  onClick={() => {
                    if (eveningIndex >= 0) setHover(eveningIndex);
                  }}
                >
                  <span>{row.label}</span>
                  <span className="tabular-nums text-[color:var(--wt-text)]">
                    {row.avgPlayers}p · {row.avgMspt}ms
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
