'use client';

import type { CSSProperties } from 'react';

export type SparkTone = 'accent' | 'ok' | 'warn' | 'danger';

export type SparkParticle = {
  id: number;
  x: number;
  y: number;
  tone: SparkTone;
  born: number;
};

const TONE_VAR: Record<SparkTone, string> = {
  accent: 'var(--wt-lantern)',
  ok: 'var(--wt-ok)',
  warn: 'var(--wt-warn)',
  danger: 'var(--wt-danger)',
};

/** Fixed overlay of short-lived click/kill sparks. pointer-events none. */
export function LanternSparkLayer({ particles }: { particles: SparkParticle[] }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[40] overflow-hidden"
    >
      {particles.map((p) => (
        <span
          key={p.id}
          className="wt-mkt-spark"
          style={
            {
              left: p.x,
              top: p.y,
              '--spark-color': TONE_VAR[p.tone],
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
