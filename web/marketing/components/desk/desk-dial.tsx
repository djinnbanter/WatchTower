'use client';

import { useId, useMemo } from 'react';
import NumberFlow from '@number-flow/react';
import { useReducedMotion } from 'motion/react';

export type DialTone = 'tps' | 'mspt' | 'players' | 'heap' | 'cpu' | 'disk' | 'ok' | 'warn' | 'danger';

const GRADIENTS: Record<DialTone, readonly [string, string]> = {
  ok: ['#34d399', '#10b981'],
  warn: ['#fbbf24', '#f59e0b'],
  danger: ['#f87171', '#ef4444'],
  tps: ['#34d399', '#22c55e'],
  mspt: ['#fbbf24', '#f97316'],
  players: ['#38bdf8', '#0ea5e9'],
  heap: ['#fb7185', '#e11d48'],
  cpu: ['#a78bfa', '#7c3aed'],
  disk: ['#5fb3c4', '#2dd4bf'],
};

const INACTIVE: Record<DialTone, string> = {
  ok: 'color-mix(in srgb, #10b981 18%, transparent)',
  warn: 'color-mix(in srgb, #f59e0b 18%, transparent)',
  danger: 'color-mix(in srgb, #ef4444 18%, transparent)',
  tps: 'color-mix(in srgb, #22c55e 18%, transparent)',
  mspt: 'color-mix(in srgb, #f97316 18%, transparent)',
  players: 'color-mix(in srgb, #0ea5e9 18%, transparent)',
  heap: 'color-mix(in srgb, #e11d48 18%, transparent)',
  cpu: 'color-mix(in srgb, #7c3aed 18%, transparent)',
  disk: 'color-mix(in srgb, #2dd4bf 18%, transparent)',
};

function interpolateHex(a: string, b: string, t: number) {
  const parse = (c: string) => [
    Number.parseInt(c.slice(1, 3), 16),
    Number.parseInt(c.slice(3, 5), 16),
    Number.parseInt(c.slice(5, 7), 16),
  ] as const;
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  const u = Math.min(1, Math.max(0, t));
  const r = Math.round(r1 + (r2 - r1) * u);
  const g = Math.round(g1 + (g2 - g1) * u);
  const bl = Math.round(b1 + (b2 - b1) * u);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}

/** Stable SVG numbers across Node vs browser float trig (avoids hydration mismatches). */
function svgN(n: number) {
  return (Math.round(n * 1e4) / 1e4).toFixed(4);
}

/**
 * Lean marketing cousin of dashboard WtGauge / Bklit notch dial.
 * Arc notches + NumberFlow center — no @visx dependency.
 */
export function DeskDial({
  value,
  max = 100,
  label,
  suffix = '',
  tone = 'ok',
  size = 96,
  decimals,
}: {
  value: number;
  max?: number;
  label: string;
  suffix?: string;
  tone?: DialTone;
  size?: number;
  decimals?: number;
}) {
  const reduce = useReducedMotion();
  const uid = useId().replace(/:/g, '');
  const pct = Math.min(100, Math.max(0, (value / Math.max(1e-6, max)) * 100));
  const [g0, g1] = GRADIENTS[tone];
  const inactive = INACTIVE[tone];
  const totalNotches = size <= 100 ? 28 : 36;
  const spacing = size <= 100 ? 26 : 22;
  const startAngle = 135;
  const endAngle = 405;

  const notches = useMemo(() => {
    const cx = size / 2;
    const cy = size / 2;
    const outer = size * 0.42;
    const innerBase = size * 0.28;
    const notchLength = outer - innerBase;
    const activeCount = Math.round((pct / 100) * totalNotches);
    const totalAngle = endAngle - startAngle;
    const available = totalAngle * (1 - spacing / 100);
    const notchAngle = totalNotches > 0 ? available / totalNotches : 0;
    const gapDen = Math.max(1, totalNotches - 1);
    const gapAngle = (totalAngle * (spacing / 100)) / gapDen;

    return Array.from({ length: totalNotches }, (_, i) => {
      const angle = startAngle + i * (notchAngle + gapAngle) + notchAngle / 2;
      const rad = (angle * Math.PI) / 180;
      const half = ((notchAngle * 0.8) * Math.PI) / 180 / 2;
      const x1 = cx + Math.cos(rad - half) * outer;
      const y1 = cy + Math.sin(rad - half) * outer;
      const x2 = cx + Math.cos(rad + half) * outer;
      const y2 = cy + Math.sin(rad + half) * outer;
      const px = Math.cos(rad);
      const py = Math.sin(rad);
      const x3 = x2 - px * notchLength;
      const y3 = y2 - py * notchLength;
      const x4 = x1 - px * notchLength;
      const y4 = y1 - py * notchLength;
      const denom = Math.max(1, totalNotches - 1);
      return {
        i,
        d: `M ${svgN(x1)} ${svgN(y1)} L ${svgN(x2)} ${svgN(y2)} L ${svgN(x3)} ${svgN(y3)} L ${svgN(x4)} ${svgN(y4)} Z`,
        active: i < activeCount,
        color: interpolateHex(g0, g1, i / denom),
      };
    });
  }, [size, pct, totalNotches, spacing, g0, g1]);

  const frac = decimals ?? (Number.isInteger(value) ? 0 : 1);
  // Scale center type with dial diameter so hero-sized gauges stay readable.
  const valuePx = Math.max(18, Math.round(size * 0.18));
  const labelPx = Math.max(12, Math.round(size * 0.055));

  return (
    <div className="desk-dial" style={{ width: size, height: size }} aria-label={`${label} ${value}${suffix}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="desk-dial__svg">
        <defs>
          <linearGradient id={`desk-dial-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={g0} />
            <stop offset="100%" stopColor={g1} />
          </linearGradient>
        </defs>
        {notches.map((n) => (
          <path
            key={n.i}
            d={n.d}
            fill={n.active ? n.color : inactive}
            opacity={n.active ? 1 : 0.9}
          />
        ))}
      </svg>
      <div className="desk-dial__center">
        <div className="desk-dial__value" style={{ fontSize: valuePx }}>
          {reduce ? (
            value.toFixed(frac)
          ) : (
            <NumberFlow
              value={value}
              trend={0}
              format={{ maximumFractionDigits: frac, minimumFractionDigits: frac > 0 ? 0 : 0 }}
              transformTiming={{ duration: 650, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
              spinTiming={{ duration: 650, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
            />
          )}
          {suffix ? <span className="desk-dial__suffix">{suffix}</span> : null}
        </div>
        <div className="desk-dial__label" style={{ fontSize: labelPx }}>
          {label}
        </div>
      </div>
    </div>
  );
}
