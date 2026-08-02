'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useReducedMotion } from 'motion/react';
import './desk-border-glow.css';

export type GlowTone = 'accent' | 'ok' | 'warn' | 'danger';

const TONE: Record<GlowTone, string> = {
  accent: 'var(--wt-accent)',
  ok: 'var(--wt-ok)',
  warn: 'var(--wt-warn)',
  danger: 'var(--wt-danger)',
};

/**
 * Pointer-tracking edge wash — WatchTower-owned, React Bits Border Glow–inspired.
 * Not vendor source. Honors prefers-reduced-motion.
 */
export function DeskBorderGlow({
  children,
  tone = 'accent',
  intensity = 0.55,
  glowRadius = 220,
  disabled = false,
  className = '',
}: {
  children: ReactNode;
  tone?: GlowTone;
  intensity?: number;
  glowRadius?: number;
  disabled?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const live = !reduce && !disabled;
  const color = TONE[tone];

  return (
    <div
      className={`wt-mkt-glow ${live ? 'wt-mkt-glow--live' : ''} ${className}`}
      style={
        {
          '--wt-mkt-glow-color': color,
          '--wt-mkt-glow-intensity': String(intensity),
          '--wt-mkt-glow-radius': `${glowRadius}px`,
          '--glow-x': '50%',
          '--glow-y': '50%',
          '--glow-angle': '135deg',
          '--glow-edge': '0.4',
          borderRadius: 'var(--wt-radius-lg)',
        } as CSSProperties
      }
      onPointerMove={(e) => {
        if (!live) return;
        const el = e.currentTarget;
        const rect = el.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        const w = Math.max(1, rect.width);
        const h = Math.max(1, rect.height);
        const x = (px / w) * 100;
        const y = (py / h) * 100;
        const angle = (Math.atan2(py - h / 2, px - w / 2) * 180) / Math.PI + 90;
        const edgeX = Math.min(px, w - px) / (w * 0.5);
        const edgeY = Math.min(py, h - py) / (h * 0.5);
        const edge = 1 - Math.min(1, Math.min(edgeX, edgeY));
        el.style.setProperty('--glow-x', `${x}%`);
        el.style.setProperty('--glow-y', `${y}%`);
        el.style.setProperty('--glow-angle', `${angle}deg`);
        el.style.setProperty('--glow-edge', String(0.35 + edge * 0.65));
        el.dataset.active = '1';
      }}
      onPointerLeave={(e) => {
        delete e.currentTarget.dataset.active;
        e.currentTarget.style.setProperty('--glow-edge', '0');
        e.currentTarget.style.setProperty('--glow-x', '50%');
        e.currentTarget.style.setProperty('--glow-y', '50%');
      }}
    >
      <div aria-hidden className="wt-mkt-glow__aura" />
      <div aria-hidden className="wt-mkt-glow__frame" />
      <div className="wt-mkt-glow__body">{children}</div>
    </div>
  );
}
