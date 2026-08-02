'use client';

import { useCallback, useRef, type CSSProperties, type ReactNode } from 'react';
import { useReducedMotion } from 'motion/react';

export type SpotTone = 'lantern' | 'accent' | 'ok' | 'warn' | 'danger';

const TONE: Record<SpotTone, string> = {
  lantern: 'var(--wt-lantern)',
  accent: 'var(--wt-accent)',
  ok: 'var(--wt-ok)',
  warn: 'var(--wt-warn)',
  danger: 'var(--wt-danger)',
};

/**
 * Soft pointer spotlight. Follows the cursor while hovering; fades toward the
 * edges and fully out when the pointer leaves. Honors reduced motion.
 */
export function DeskSpotlight({
  children,
  className = '',
  tone = 'lantern',
}: {
  children: ReactNode;
  className?: string;
  tone?: SpotTone;
}) {
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);

  const idle = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    el.dataset.active = '0';
    el.style.setProperty('--spot-opacity', '0');
  }, []);

  return (
    <div
      ref={rootRef}
      className={`relative h-full min-h-0 overflow-hidden ${className}`}
      data-active="0"
      style={
        {
          '--spot-x': '50%',
          '--spot-y': '42%',
          '--spot-opacity': '0',
          '--spot-color': TONE[tone],
        } as CSSProperties
      }
      onPointerEnter={(e) => {
        if (reduce) return;
        e.currentTarget.dataset.active = '1';
        e.currentTarget.style.setProperty('--spot-opacity', '1');
      }}
      onPointerMove={(e) => {
        if (reduce) return;
        const el = e.currentTarget;
        const rect = el.getBoundingClientRect();
        const w = Math.max(1, rect.width);
        const h = Math.max(1, rect.height);
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        const x = (px / w) * 100;
        const y = (py / h) * 100;
        const edgeX = Math.min(px, w - px) / (w * 0.5);
        const edgeY = Math.min(py, h - py) / (h * 0.5);
        const inward = Math.min(1, Math.min(edgeX, edgeY));
        const strength = 0.25 + inward * 0.75;
        el.dataset.active = '1';
        el.style.setProperty('--spot-x', `${x}%`);
        el.style.setProperty('--spot-y', `${y}%`);
        el.style.setProperty('--spot-opacity', String(strength));
      }}
      onPointerLeave={idle}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          opacity: reduce ? 0 : ('var(--spot-opacity)' as unknown as number),
          transition: 'opacity 280ms cubic-bezier(0.16, 1, 0.3, 1)',
          background: `radial-gradient(18rem circle at var(--spot-x) var(--spot-y), color-mix(in srgb, var(--spot-color) 16%, transparent), transparent 72%)`,
        }}
      />
      <div className="relative z-[1] h-full min-h-0">{children}</div>
    </div>
  );
}
