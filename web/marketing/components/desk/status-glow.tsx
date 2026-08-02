'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useReducedMotion } from 'motion/react';

/**
 * Lean marketing cousin of dashboard BorderGlow / HeroCard.
 * Status-keyed edge wash only (no pointer tracking) so LCP stays calm.
 */
export function StatusGlow({
  tone = 'danger',
  children,
  className = '',
}: {
  tone?: 'ok' | 'warn' | 'danger' | 'info';
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const color =
    tone === 'ok'
      ? 'var(--wt-ok)'
      : tone === 'warn'
        ? 'var(--wt-warn)'
        : tone === 'info'
          ? 'var(--wt-accent)'
          : 'var(--wt-danger)';

  return (
    <div
      className={`desk-glow desk-glow--${tone} ${reduce ? 'desk-glow--static' : ''} ${className}`}
      style={{ '--desk-glow': color } as CSSProperties}
    >
      <div className="desk-glow__ring" aria-hidden />
      {children}
    </div>
  );
}
